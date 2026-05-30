import { extractText, getDocumentProxy } from "unpdf";

export type ParsedResume = {
  text: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  experienceYears: string | null;
  noticePeriodDays: number | null;
  currentCtc: string | null;
  expectedCtc: string | null;
  summary: string | null;
  skills: string[];
  linkedinUrl: string | null;
  githubUrl: string | null;
};

const SKILL_LIBRARY = [
  // languages
  "Java", "Python", "JavaScript", "TypeScript", "Go", "Rust", "C#", "C++", "Ruby", "Scala", "Kotlin", "Swift", "PHP", "R", "MATLAB", "Perl",
  // backend / frameworks
  "Spring", "Spring Boot", "Hibernate", ".NET", "Django", "Flask", "FastAPI", "Express", "Nest.js", "Rails", "Laravel",
  // frontend / mobile
  "React", "Next.js", "Vue", "Angular", "Svelte", "Tailwind", "HTML", "CSS", "Sass", "Redux", "Zustand", "React Native", "Flutter",
  // data / messaging
  "PostgreSQL", "MySQL", "Oracle", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB", "Snowflake", "BigQuery",
  "Kafka", "RabbitMQ", "ActiveMQ", "Pulsar",
  // BI / analytics
  "Power BI", "PowerBI", "Tableau", "QlikView", "Looker", "Superset", "Metabase", "DAX", "SSAS", "SSRS", "SSIS", "ETL", "ELT",
  "Pandas", "NumPy", "PyTorch", "TensorFlow", "scikit-learn", "Spark", "Hadoop", "Airflow", "dbt",
  // cloud / infra
  "AWS", "Azure", "GCP", "Kubernetes", "Docker", "Terraform", "Ansible", "Helm", "Linux", "Bash",
  "CloudFormation", "Lambda", "EC2", "S3", "RDS", "EKS", "AKS", "GKE",
  // ops / methodology
  "CI/CD", "Jenkins", "GitHub Actions", "GitLab CI", "Argo", "Prometheus", "Grafana", "Datadog", "New Relic", "Splunk",
  "Agile", "Scrum", "Kanban", "JIRA", "Confluence",
  // protocols
  "REST", "GraphQL", "gRPC", "WebSocket",
];

const CITY_LIBRARY = [
  "Bengaluru", "Bangalore", "Mumbai", "Delhi", "New Delhi", "Pune", "Hyderabad", "Chennai", "Kolkata", "Noida", "Gurgaon", "Gurugram",
  "Ahmedabad", "Jaipur", "Coimbatore", "Trivandrum", "Kochi", "Cochin", "Indore", "Chandigarh", "Lucknow",
  "Munich", "München", "Berlin", "Frankfurt", "Hamburg", "Cologne", "Köln", "Stuttgart",
  "London", "Manchester", "Edinburgh", "Dublin",
  "New York", "San Francisco", "Seattle", "Boston", "Chicago", "Austin", "Los Angeles", "Atlanta",
  "Toronto", "Vancouver", "Montreal", "Singapore", "Dubai", "Abu Dhabi", "Sydney", "Melbourne", "Tokyo",
];

const COUNTRY_LIBRARY = [
  "India", "Germany", "Deutschland", "United States", "USA", "United Kingdom", "UK", "Canada", "Australia",
  "Singapore", "UAE", "Netherlands", "Ireland", "France", "Switzerland",
];

const TITLE_KEYWORDS = [
  "engineer", "developer", "architect", "manager", "lead", "consultant",
  "analyst", "designer", "specialist", "director", "head of", "scientist",
  "administrator", "intern", "trainee", "principal", "associate", "officer",
  "executive", "advisor", "strategist",
];

export async function pdfToText(buffer: Buffer): Promise<string> {
  const u8 = Uint8Array.from(buffer);
  const pdf = await getDocumentProxy(u8);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).replace(/\r/g, "");
}

export function extractFields(rawText: string): ParsedResume {
  const text = rawText.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0];
  const phone = pickPhone(text);
  const fullName = pickName(lines, email);

  return {
    text,
    fullName,
    email,
    phone,
    location: findLocation(text),
    currentTitle: findTitle(lines),
    currentCompany: findCompany(lines),
    experienceYears: findExperienceYears(text),
    noticePeriodDays: findNoticeDays(text),
    currentCtc: findCtc(text, "current"),
    expectedCtc: findCtc(text, "expected"),
    summary: findSummary(text, lines),
    skills: findSkills(text),
    linkedinUrl: findLinkedin(text),
    githubUrl: findGithub(text),
  };
}

// Back-compat wrapper for the PDF flow.
export async function parseResume(buffer: Buffer): Promise<ParsedResume> {
  const text = await pdfToText(buffer);
  return extractFields(text);
}

// ---------- field extractors ----------

function pickPhone(text: string): string | null {
  const m = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}[\s.-]?\d{0,5}/g);
  if (!m) return null;
  const candidates = m
    .map((s) => s.trim())
    .filter((s) => s.replace(/\D/g, "").length >= 10 && s.replace(/\D/g, "").length <= 15);
  return candidates[0]?.replace(/\s+/g, " ") || null;
}

function pickName(lines: string[], email: string | null): string | null {
  // Try "Firstname Lastname" before any email/phone/url, in the first 8 lines.
  for (const line of lines.slice(0, 10)) {
    if (/@/.test(line) || /https?:\/\//i.test(line) || /\d{3,}/.test(line)) continue;
    if (line.length > 60) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 5 && /^[A-Za-z][A-Za-z .'-]*$/.test(line)) {
      return line;
    }
  }
  // Fallback: derive from email local-part.
  if (email) {
    const local = email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim();
    if (local) return local.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return null;
}

function findExperienceYears(text: string): string | null {
  const explicit = text.match(
    /(?:total[\s-]+(?:experience|exp)|experience|exp\.?|years?\s+of\s+experience)\s*[:\-—]*\s*(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)?/i,
  );
  if (explicit) {
    const n = Number(explicit[1]);
    if (Number.isFinite(n) && n > 0 && n <= 50) return String(n);
  }
  const all = [...text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/gi)];
  if (all.length === 0) return null;
  // Take the largest plausible value (years of professional experience usually > internships).
  const max = Math.max(...all.map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > 0 && n <= 50));
  return Number.isFinite(max) && max > 0 ? String(max) : null;
}

function findNoticeDays(text: string): number | null {
  if (/notice\s*period\s*[:\-—]?\s*(immediate|immediately|nil|none|0)/i.test(text)) return 0;
  if (/serving\s+notice/i.test(text) && !/days|weeks|months/i.test(text)) {
    // mention without number — skip
  }
  const m = text.match(/notice\s*(?:period)?\s*[:\-—]?\s*(\d+)\s*(days?|weeks?|months?)/i);
  if (!m) {
    const m2 = text.match(/(\d+)\s*(days?|weeks?|months?)\s*notice/i);
    if (!m2) return null;
    return toDays(Number(m2[1]), m2[2]);
  }
  return toDays(Number(m[1]), m[2]);
}

function toDays(n: number, unit: string): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 365) return null;
  const u = unit.toLowerCase();
  if (u.startsWith("week")) return n * 7;
  if (u.startsWith("month")) return n * 30;
  return n;
}

function findCtc(text: string, kind: "current" | "expected"): string | null {
  const synonyms = kind === "current" ? "(?:current|present)" : "(?:expected|expecting)";
  const re = new RegExp(
    `${synonyms}\\s*(?:ctc|salary|compensation|package|annual\\s*(?:ctc|salary)?)\\s*[:\\-—]?\\s*` +
      `(?:rs\\.?|inr|usd|eur|gbp|\\$|£|€)?\\s*([\\d.,]+)\\s*` +
      `(lpa|lakhs?|lac|crore|cr|k|million|m)?`,
    "i",
  );
  const m = text.match(re);
  if (!m) return null;
  const numRaw = m[1].replace(/,/g, "");
  const num = Number(numRaw);
  if (!Number.isFinite(num)) return null;
  const unit = (m[2] || "").toLowerCase();
  if (unit === "lpa" || unit.startsWith("lakh") || unit === "lac") return String(Math.round(num * 100_000));
  if (unit.startsWith("cr")) return String(Math.round(num * 10_000_000));
  if (unit === "k") return String(Math.round(num * 1000));
  if (unit.startsWith("m") || unit === "million") return String(Math.round(num * 1_000_000));
  return String(Math.round(num));
}

function findLocation(text: string): string | null {
  // Prefer "City, Country" patterns
  for (const city of CITY_LIBRARY) {
    const re = new RegExp(`\\b${escapeRe(city)}\\b(?:[,\\s-]+([A-Za-z. ]{2,30}))?`, "i");
    const m = text.match(re);
    if (m) {
      const tail = (m[1] || "").trim().replace(/[,.]+$/, "");
      return tail ? `${city}, ${tail.split(/\s+/).slice(0, 3).join(" ")}` : city;
    }
  }
  for (const country of COUNTRY_LIBRARY) {
    const re = new RegExp(`\\b${escapeRe(country)}\\b`, "i");
    if (re.test(text)) return country;
  }
  return null;
}

function findTitle(lines: string[]): string | null {
  // Search the top 12 lines and the first "Experience"/"Work" section.
  const head = lines.slice(0, 12);
  for (const l of head) {
    if (l.length > 80) continue;
    if (/@|https?:\/\/|\+?\d/.test(l)) continue;
    if (TITLE_KEYWORDS.some((k) => new RegExp(`\\b${escapeRe(k)}\\b`, "i").test(l))) {
      return l;
    }
  }
  // Look for "Title at Company" or "Title | Company"
  for (const l of lines.slice(0, 30)) {
    const m = l.match(/^([A-Za-z][\w \-/&]{4,80})\s+(?:at|@|\|)\s+/i);
    if (m && TITLE_KEYWORDS.some((k) => new RegExp(`\\b${escapeRe(k)}\\b`, "i").test(m[1]))) {
      return m[1].trim();
    }
  }
  return null;
}

function findCompany(lines: string[]): string | null {
  // 1) "<Title> at/@/| <Company>"
  for (const l of lines.slice(0, 40)) {
    const m = l.match(/^.+?\s+(?:at|@|\|)\s+([A-Z][\w&. ,'-]{1,80})/);
    if (m) return m[1].replace(/[•·]+$/, "").trim();
  }
  // 2) Lines with common company suffixes near top.
  const suffixRe = /\b(Pvt\.?\s*Ltd\.?|Private\s+Limited|Limited|Ltd\.?|Inc\.?|LLC|GmbH|AG|Corp\.?|Corporation|Technologies|Solutions|Systems|Software|Services|Consulting|Group|Partners|S\.?A\.?|B\.?V\.?)\b/i;
  for (const l of lines.slice(0, 40)) {
    if (suffixRe.test(l) && l.length < 120 && !TITLE_KEYWORDS.some((k) => new RegExp(`\\b${escapeRe(k)}\\b`, "i").test(l))) {
      return l;
    }
  }
  return null;
}

function findLinkedin(text: string): string | null {
  const m = text.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_\-%/.]+/i);
  if (m) return m[0].replace(/[).,;:]+$/, "");
  // Bare slug pattern: linkedin.com/in/slug
  const m2 = text.match(/(?:^|\s)linkedin\.com\/in\/([A-Za-z0-9_\-%]+)/i);
  if (m2) return `https://linkedin.com/in/${m2[1]}`;
  return null;
}

function findGithub(text: string): string | null {
  const m = text.match(/https?:\/\/github\.com\/[A-Za-z0-9_\-]+(?:\/[A-Za-z0-9_\-.]+)?/i);
  if (m) {
    // Drop trailing punctuation
    return m[0].replace(/[).,;:]+$/, "");
  }
  const m2 = text.match(/(?:^|\s)github\.com\/([A-Za-z0-9_\-]+)/i);
  if (m2) return `https://github.com/${m2[1]}`;
  return null;
}

const SUMMARY_HEADINGS = ["Professional Summary", "Career Summary", "Summary", "Profile", "About Me", "About", "Objective", "Career Objective"];

function findSummary(text: string, lines: string[]): string | null {
  // Look for an explicit "Summary:" / "Professional Summary" section.
  for (const heading of SUMMARY_HEADINGS) {
    const idx = lines.findIndex((l) => new RegExp(`^${escapeRe(heading)}\\s*[:\\-]?$`, "i").test(l));
    if (idx >= 0) {
      const para = lines.slice(idx + 1, idx + 6).filter((l) => !/^\s*$/.test(l));
      const joined = para.join(" ").trim();
      if (joined.length > 30 && joined.length < 1200) return joined.slice(0, 800);
    }
  }
  // Fallback: longest plausible sentence in the first quarter of the doc.
  const head = lines.slice(0, Math.max(20, Math.floor(lines.length / 4)));
  const candidate = head.find((l) => l.length > 80 && l.length < 600 && /[.!]/.test(l));
  if (candidate) return candidate;
  // Bigger fallback: first long line anywhere.
  const anywhere = lines.find((l) => l.length > 120 && l.length < 800);
  return anywhere ?? null;
}

function findSkills(text: string): string[] {
  const found = new Set<string>();
  for (const skill of SKILL_LIBRARY) {
    if (new RegExp(`(?:^|[^A-Za-z])${escapeRe(skill)}(?:[^A-Za-z]|$)`, "i").test(text)) {
      found.add(skill);
    }
  }
  return [...found].slice(0, 40);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
