"""Duplicate detection — quick deterministic checks over email/phone/text hash.

Returns the most likely duplicate candidate (if any) and a status:
'unique' / 'possible' / 'duplicate'.
"""
from __future__ import annotations

from django.db.models import Q

from .models import Candidate, DuplicateStatus, ResumeFile


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())[-10:]  # last 10 digits


def detect_duplicate(*, email: str = "", phone: str = "", full_name: str = "",
                     text_hash: str = "", exclude_pk: int | None = None) -> tuple[str, Candidate | None]:
    """Return (status, candidate)."""
    qs = Candidate.objects.all()
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)

    # 1. Exact email — definitive duplicate.
    email = (email or "").strip().lower()
    if email:
        match = qs.filter(email__iexact=email).first()
        if match:
            return DuplicateStatus.DUPLICATE, match

    # 2. Same phone (last 10 digits) — definitive duplicate.
    norm_phone = _normalize_phone(phone)
    if len(norm_phone) >= 10:
        for c in qs.filter(phone__icontains=norm_phone[-10:])[:5]:
            if _normalize_phone(c.phone) == norm_phone:
                return DuplicateStatus.DUPLICATE, c

    # 3. Identical extracted-text hash on a stored resume — definitive duplicate.
    if text_hash:
        rf = ResumeFile.objects.filter(text_hash=text_hash)
        if exclude_pk:
            rf = rf.exclude(candidate_id=exclude_pk)
        rf_match = rf.first()
        if rf_match:
            return DuplicateStatus.DUPLICATE, rf_match.candidate

    # 4. Same full name (case-insensitive) — *possible* duplicate.
    name = (full_name or "").strip()
    if name:
        match = qs.filter(full_name__iexact=name).first()
        if match:
            return DuplicateStatus.POSSIBLE, match

    return DuplicateStatus.UNIQUE, None
