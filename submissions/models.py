from django.conf import settings
from django.db import models


class SubmissionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SHORTLISTED = "shortlisted", "Shortlisted"
    REJECTED = "rejected", "Rejected"
    INTERVIEW = "interview", "Interview"
    HOLD = "hold", "Hold"
    OFFER = "offer", "Offer"
    JOINED = "joined", "Joined"


class VendorSubmissionState(models.TextChoices):
    READY = "ready", "Ready"
    REVIEW = "review", "Review"
    DUPLICATE = "duplicate", "Duplicate"


class Submission(models.Model):
    """A candidate sent to a client for a specific job."""
    candidate = models.ForeignKey("candidates.Candidate", on_delete=models.CASCADE, related_name="submissions")
    job = models.ForeignKey("jobs.Job", on_delete=models.CASCADE, related_name="submissions")
    client = models.ForeignKey("clients.ClientAccount", on_delete=models.PROTECT, related_name="submissions")
    packet = models.ForeignKey(
        "candidates.ClientPacket",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="submissions",
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="submissions_made",
    )
    status = models.CharField(max_length=16, choices=SubmissionStatus.choices, default=SubmissionStatus.PENDING)
    vendor_state = models.CharField(max_length=12, choices=VendorSubmissionState.choices, default=VendorSubmissionState.READY)
    submitted_at = models.DateTimeField(auto_now_add=True)
    last_status_at = models.DateTimeField(auto_now=True)
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["client", "status"]),
            models.Index(fields=["job"]),
        ]

    def __str__(self):
        return f"{self.candidate} → {self.job}"

    @property
    def is_pending_feedback(self):
        return self.status == SubmissionStatus.PENDING


class FeedbackEvent(models.Model):
    """A client action on a submission — shortlist, reject, interview, hold."""
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="feedback_events")
    action = models.CharField(max_length=16, choices=SubmissionStatus.choices)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="feedback_given",
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} on {self.submission}"
