"""Resume PDF parsing — extract plain text + a quick guess at structured fields.

We use ``pdfplumber`` (pure-Python, no system deps). Fancy AI parsing can be
added later via ``CompanyProfile.enable_ai_parsing``.
"""
from __future__ import annotations

import hashlib
import io
import re
from dataclasses import dataclass, field
from typing import Iterable


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(\+?\d[\d\s\-().]{7,}\d)")
URL_RE = re.compile(r"https?://[^\s)]+")

SKILL_HINTS = {
    # short curated list — extended in production
    "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C#", "C++", "Ruby", "PHP", "Kotlin", "Swift",
    "React", "Angular", "Vue", "Next.js", "Node.js", "Django", "Flask", "FastAPI", "Spring", ".NET",
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Kafka",
    "SQL", "NoSQL", "REST", "GraphQL", "gRPC", "OAuth", "OIDC",
    "Machine Learning", "Deep Learning", "PyTorch", "TensorFlow", "Pandas", "NumPy",
    "Tableau", "Power BI", "Snowflake", "Databricks",
    "HTML", "CSS", "Tailwind", "SAP", "Salesforce",
    "SCRUM", "Agile", "Jira", "Confluence",
}


@dataclass
class ParseResult:
    text: str = ""
    text_hash: str = ""
    full_name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    current_title: str = ""
    current_company: str = ""
    skills: list[str] = field(default_factory=list)
    summary: str = ""
    error: str = ""


def _read_pdf_text(file_obj) -> str:
    """Extract text. Accepts a Django UploadedFile or file path."""
    import pdfplumber  # lazy: keeps boot-time clean if PDF stack is unavailable
    chunks: list[str] = []
    if hasattr(file_obj, "read"):
        data = file_obj.read()
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
    else:
        with pdfplumber.open(file_obj) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
    return "\n".join(chunks).strip()


def _guess_name(first_lines: Iterable[str], email: str) -> str:
    """A name is usually within the first 5 non-empty lines and contains 2-4 words."""
    candidates = []
    for line in first_lines:
        line = line.strip()
        if not line or len(line) > 60:
            continue
        if EMAIL_RE.search(line) or URL_RE.search(line) or PHONE_RE.search(line):
            continue
        words = line.split()
        if not (2 <= len(words) <= 4):
            continue
        # Mostly alphabetic, title-cased
        if all(re.fullmatch(r"[A-Za-zÀ-ÿ.\-']{1,}", w) for w in words):
            candidates.append(line.title() if line.isupper() else line)
    if candidates:
        return candidates[0]
    if email:
        local = email.split("@")[0]
        return re.sub(r"[._-]+", " ", local).title()
    return ""


def _guess_skills(text: str) -> list[str]:
    found = []
    seen = set()
    lower = text.lower()
    for s in SKILL_HINTS:
        token = s.lower()
        # Word-boundary match
        if re.search(r"(?:^|[^a-z+#.])" + re.escape(token) + r"(?:$|[^a-z+#.])", lower):
            if token not in seen:
                found.append(s)
                seen.add(token)
    return found[:30]


def _guess_current(lines: list[str]) -> tuple[str, str]:
    """Extract a (title, company) hint from lines following an 'Experience' header."""
    title, company = "", ""
    for i, line in enumerate(lines):
        l = line.strip().lower()
        if l in {"experience", "work experience", "professional experience", "employment history"}:
            # Look at the next 3 non-empty lines
            after = [x for x in lines[i + 1: i + 8] if x.strip()]
            if after:
                first = after[0].strip()
                # Often "Senior Engineer | Acme Corp" or "Senior Engineer at Acme Corp"
                m = re.split(r"\s+(?:\||-|–|@|at)\s+", first, maxsplit=1)
                if len(m) == 2:
                    title, company = m[0].strip(), m[1].strip()
                else:
                    title = first
                    if len(after) > 1:
                        company = after[1].strip()
            break
    return title, company


def parse_resume(file_obj) -> ParseResult:
    """Best-effort extraction. Always returns a ParseResult; sets ``error`` on failure."""
    result = ParseResult()
    try:
        text = _read_pdf_text(file_obj)
    except Exception as exc:  # noqa: BLE001 — surface any pdf failure
        result.error = f"PDF parse failed: {exc}"
        return result
    if not text:
        result.error = "Could not extract any text (image-only PDF?). OCR is required."
        return result

    result.text = text
    result.text_hash = hashlib.sha256(text.encode("utf-8", errors="ignore")).hexdigest()

    lines = text.splitlines()
    first_lines = lines[:8]
    head_blob = "\n".join(first_lines)

    if (m := EMAIL_RE.search(text)):
        result.email = m.group(0).strip().lower()
    if (m := PHONE_RE.search(text)):
        result.phone = re.sub(r"\s+", " ", m.group(0)).strip()
    result.full_name = _guess_name(first_lines, result.email)

    title, company = _guess_current(lines)
    result.current_title = title
    result.current_company = company

    # Location heuristic: line near top with a comma and 1–4 words on each side
    for line in first_lines:
        if "," in line and 5 <= len(line) <= 60 and not EMAIL_RE.search(line):
            parts = [p.strip() for p in line.split(",")]
            if 2 <= len(parts) <= 3 and all(1 <= len(p.split()) <= 4 for p in parts):
                result.location = line.strip()
                break

    result.skills = _guess_skills(text)

    # Summary: first paragraph after an "Summary"/"Profile" header, else first ~3 sentences
    for i, line in enumerate(lines):
        l = line.strip().lower()
        if l in {"summary", "profile", "professional summary", "objective"}:
            blob = "\n".join(lines[i + 1: i + 8]).strip()
            if blob:
                result.summary = blob[:600]
            break
    if not result.summary:
        # First non-header sentences
        sentences = re.split(r"(?<=[.!?])\s+", text)
        result.summary = " ".join(sentences[:3])[:600]

    return result
