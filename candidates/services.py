"""High-level operations on candidates: ingest a resume, generate a packet, submit."""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from core.audit import log as audit_log
from notifications.services import notify_users
from notifications.models import NotificationKind

from .duplicates import detect_duplicate
from .models import (
    Candidate, CandidateStage, ClientPacket, ResumeFile,
    ResumeParseStatus, DuplicateStatus,
)
from .packets import generate_and_attach_packet
from .parsing import parse_resume


def _hr_owners():
    """All Admin + HR users — used as default notify list when no owner is set."""
    from accounts.models import Role, User
    return User.objects.filter(role__in=[Role.ADMIN, Role.HR], is_active=True)


@transaction.atomic
def ingest_resume(*, uploaded_file, uploaded_by=None, full_name="", source="", vendor=None, client=None):
    """Create or update a candidate from a freshly uploaded resume PDF.

    Returns (candidate, resume_file, parse_result).
    """
    candidate = Candidate.objects.create(
        full_name=full_name or "(parsing…)",
        source=source,
        vendor=vendor,
        client=client,
        created_by=uploaded_by,
        owner=uploaded_by if uploaded_by and uploaded_by.role == "hr" else None,
        stage=CandidateStage.PARSED,
        parse_status=ResumeParseStatus.PROCESSING,
    )

    resume = ResumeFile(
        candidate=candidate,
        original_filename=getattr(uploaded_file, "name", ""),
        content_type=getattr(uploaded_file, "content_type", "") or "application/pdf",
        size_bytes=getattr(uploaded_file, "size", 0) or 0,
        uploaded_by=uploaded_by,
    )
    # Save the file first (FileField needs a name + content)
    resume.file.save(uploaded_file.name, uploaded_file, save=False)

    parse_result = parse_resume(resume.file)

    resume.extracted_text = parse_result.text
    resume.text_hash = parse_result.text_hash
    resume.save()

    # Apply parsed fields if the human didn't pre-fill them
    if not full_name and parse_result.full_name:
        candidate.full_name = parse_result.full_name
    if parse_result.email:
        candidate.email = parse_result.email
    if parse_result.phone:
        candidate.phone = parse_result.phone
    if parse_result.location:
        candidate.location = parse_result.location
    if parse_result.current_title:
        candidate.current_title = parse_result.current_title
    if parse_result.current_company:
        candidate.current_company = parse_result.current_company
    if parse_result.skills:
        candidate.skills_csv = ", ".join(parse_result.skills)
    if parse_result.summary:
        candidate.summary = parse_result.summary

    if parse_result.error:
        candidate.parse_status = ResumeParseStatus.FAILED
        candidate.parse_error = parse_result.error
    else:
        candidate.parse_status = ResumeParseStatus.COMPLETED

    # Duplicate detection (against existing rows; exclude self)
    dup_status, dup_match = detect_duplicate(
        email=candidate.email, phone=candidate.phone, full_name=candidate.full_name,
        text_hash=resume.text_hash, exclude_pk=candidate.pk,
    )
    candidate.duplicate_status = dup_status
    candidate.duplicate_of = dup_match
    candidate.stage = CandidateStage.HR_REVIEW
    candidate.save()

    audit_log(
        "resume.uploaded",
        target=candidate,
        summary=f"Resume uploaded: {resume.original_filename}",
        metadata={"size_bytes": resume.size_bytes, "duplicate_status": dup_status},
    )

    # Notifications
    notify_targets = _hr_owners()
    notify_users(
        notify_targets,
        kind=NotificationKind.RESUME_PARSED,
        title=f"Resume parsed: {candidate.full_name}",
        body=parse_result.error or f"{candidate.current_title or 'No title'} · {candidate.location or 'Location unknown'}",
        candidate=candidate,
    )
    if dup_status != DuplicateStatus.UNIQUE and dup_match:
        notify_users(
            notify_targets,
            kind=NotificationKind.DUPLICATE_FLAGGED,
            title=f"Possible duplicate: {candidate.full_name}",
            body=f"Matches existing candidate: {dup_match.full_name}",
            candidate=candidate,
        )
    if vendor:
        notify_users(
            notify_targets,
            kind=NotificationKind.VENDOR_SUBMITTED,
            title=f"Vendor submission: {vendor.name}",
            body=f"{candidate.full_name} — review pending",
            candidate=candidate,
        )

    return candidate, resume, parse_result


@transaction.atomic
def make_client_packet(candidate, *, by=None) -> ClientPacket:
    packet = generate_and_attach_packet(candidate, by=by)
    audit_log("packet.generated", target=candidate, summary=f"Client-safe packet generated")
    notify_users(
        _hr_owners(),
        kind=NotificationKind.PACKET_GENERATED,
        title=f"Client packet ready: {candidate.full_name}",
        body="A sanitized PDF was generated and is ready to send.",
        candidate=candidate,
    )
    return packet


@transaction.atomic
def submit_to_client(candidate, *, job, by, note=""):
    """Move candidate → submitted; create a Submission row; notify."""
    from submissions.models import Submission, SubmissionStatus
    packet = candidate.latest_packet or make_client_packet(candidate, by=by)
    sub = Submission.objects.create(
        candidate=candidate,
        job=job,
        client=job.client,
        packet=packet,
        submitted_by=by,
        status=SubmissionStatus.PENDING,
        note=note,
    )
    candidate.client = job.client
    candidate.save(update_fields=["client", "updated_at"])
    candidate.set_stage(CandidateStage.SUBMITTED, by=by, note=f"Submitted to {job.client.name} · {job.title}")
    audit_log("candidate.submitted", target=candidate, summary=f"Submitted to {job.client.name} for {job.title}")

    # Notify the client users
    from accounts.models import User
    client_users = User.objects.filter(role="client", client_account=job.client, is_active=True)
    notify_users(
        client_users,
        kind=NotificationKind.GENERIC,
        title=f"New candidate: {candidate.full_name}",
        body=f"For role: {job.title}",
        candidate=candidate, submission=sub, job=job,
    )
    # And the HR owner
    if candidate.owner and candidate.owner != by:
        notify_users(
            [candidate.owner],
            kind=NotificationKind.GENERIC,
            title=f"Candidate submitted: {candidate.full_name}",
            body=f"To {job.client.name} · {job.title}",
            candidate=candidate, submission=sub, job=job,
        )
    return sub
