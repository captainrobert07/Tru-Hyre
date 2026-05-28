"""Candidates and supporting models — resume files, parsing artifacts,
duplicate flags, stage history, notes, and client-safe packets."""
from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone


class CandidateStage(models.TextChoices):
    PARSED = "parsed", "Parsed"
    HR_REVIEW = "hr_review", "HR Review"
    SUBMITTED = "submitted", "Submitted"
    CLIENT_REVIEW = "client_review", "Client Review"
    INTERVIEW = "interview", "Interview"
    OFFER = "offer", "Offer"
    JOINED = "joined", "Joined"
    REJECTED = "rejected", "Rejected"
    HOLD = "hold", "Hold"


# Visual class for stage pill (matches CSS in tailwind.css).
STAGE_CSS = {
    "parsed": "stage-parsed",
    "hr_review": "stage-hr_review",
    "submitted": "stage-submitted",
    "client_review": "stage-client_review",
    "interview": "stage-interview",
    "offer": "stage-offer",
    "joined": "stage-joined",
    "rejected": "stage-rejected",
    "hold": "stage-hold",
}


class DuplicateStatus(models.TextChoices):
    UNIQUE = "unique", "Unique"
    POSSIBLE = "possible", "Possible duplicate"
    DUPLICATE = "duplicate", "Confirmed duplicate"


class ResumeParseStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


def resume_upload_path(instance, filename):
    return f"resumes/{timezone.now():%Y/%m}/{instance.pk or 'new'}_{filename}"


def packet_upload_path(instance, filename):
    return f"packets/{timezone.now():%Y/%m}/{instance.pk or 'new'}_{filename}"


class Candidate(models.Model):
    full_name = models.CharField(max_length=200)
    email = models.EmailField(blank=True, db_index=True)
    phone = models.CharField(max_length=40, blank=True, db_index=True)

    location = models.CharField(max_length=200, blank=True)
    current_company = models.CharField(max_length=200, blank=True)
    current_title = models.CharField(max_length=200, blank=True)
    total_experience_years = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    notice_period_days = models.PositiveIntegerField(null=True, blank=True)
    current_ctc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    expected_ctc = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ctc_currency = models.CharField(max_length=8, default="EUR")

    skills_csv = models.TextField(blank=True, help_text="Comma-separated skills")
    summary = models.TextField(blank=True)

    source = models.CharField(max_length=80, blank=True, help_text="LinkedIn, Naukri, Vendor referral, etc.")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="owned_candidates",
        limit_choices_to={"role__in": ["admin", "hr"]},
    )
    client = models.ForeignKey(
        "clients.ClientAccount",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="candidates",
    )
    vendor = models.ForeignKey(
        "vendors.VendorAccount",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="candidates",
    )

    stage = models.CharField(max_length=20, choices=CandidateStage.choices, default=CandidateStage.PARSED)
    duplicate_status = models.CharField(max_length=12, choices=DuplicateStatus.choices, default=DuplicateStatus.UNIQUE)
    duplicate_of = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="duplicates")

    parse_status = models.CharField(max_length=12, choices=ResumeParseStatus.choices, default=ResumeParseStatus.PENDING)
    parse_error = models.CharField(max_length=400, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="created_candidates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["stage"]),
            models.Index(fields=["client"]),
            models.Index(fields=["vendor"]),
            models.Index(fields=["owner"]),
            models.Index(fields=["duplicate_status"]),
        ]

    def __str__(self):
        return self.full_name

    def get_absolute_url(self):
        return reverse("candidates:detail", args=[self.pk])

    @property
    def stage_label(self):
        return self.get_stage_display()

    @property
    def stage_css(self):
        return STAGE_CSS.get(self.stage, "stage-parsed")

    @property
    def skills_list(self):
        return [s.strip() for s in (self.skills_csv or "").split(",") if s.strip()]

    @property
    def initials(self):
        parts = [p for p in self.full_name.split() if p]
        if len(parts) >= 2:
            return (parts[0][0] + parts[-1][0]).upper()
        return (self.full_name or "?")[:2].upper()

    @property
    def latest_resume(self):
        return self.resumes.order_by("-uploaded_at").first()

    @property
    def latest_packet(self):
        return self.packets.order_by("-generated_at").first()

    def set_stage(self, new_stage, *, by=None, note=""):
        old = self.stage
        if old == new_stage:
            return False
        self.stage = new_stage
        self.save(update_fields=["stage", "updated_at"])
        StageHistory.objects.create(candidate=self, from_stage=old, to_stage=new_stage, changed_by=by, note=note)
        return True


class ResumeFile(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="resumes")
    file = models.FileField(upload_to=resume_upload_path)
    original_filename = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=80, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True)
    text_hash = models.CharField(max_length=64, blank=True, db_index=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="uploaded_resumes",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Resume of {self.candidate.full_name}"


class ClientPacket(models.Model):
    """Sanitized PDF prepared for client viewing (no PII / vendor info)."""
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="packets")
    file = models.FileField(upload_to=packet_upload_path)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="generated_packets",
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["-generated_at"]

    def __str__(self):
        return f"Packet · {self.candidate.full_name} ({self.generated_at:%Y-%m-%d})"


class StageHistory(models.Model):
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="stage_history")
    from_stage = models.CharField(max_length=20, choices=CandidateStage.choices)
    to_stage = models.CharField(max_length=20, choices=CandidateStage.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="stage_changes",
    )
    note = models.CharField(max_length=400, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-changed_at"]


class CandidateNote(models.Model):
    """Internal notes — never shown to client."""
    candidate = models.ForeignKey(Candidate, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="candidate_notes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
