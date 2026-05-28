from django.conf import settings
from django.db import models
from django.urls import reverse


class NotificationKind(models.TextChoices):
    STAGE_CHANGED = "stage_changed", "Candidate stage changed"
    RESUME_PARSED = "resume_parsed", "Resume parsed"
    PACKET_GENERATED = "packet_generated", "Client-safe PDF generated"
    VENDOR_SUBMITTED = "vendor_submitted", "Vendor submitted candidate"
    CLIENT_FEEDBACK = "client_feedback", "Client feedback received"
    DUPLICATE_FLAGGED = "duplicate_flagged", "Duplicate flagged"
    INTERVIEW_REQUESTED = "interview_requested", "Interview requested"
    OFFER_UPDATED = "offer_updated", "Offer updated"
    JOINING_CONFIRMED = "joining_confirmed", "Joining confirmed"
    GENERIC = "generic", "Notification"


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=32, choices=NotificationKind.choices, default=NotificationKind.GENERIC)
    title = models.CharField(max_length=200)
    body = models.CharField(max_length=400, blank=True)
    link_url = models.CharField(max_length=400, blank=True)
    candidate = models.ForeignKey("candidates.Candidate", on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    job = models.ForeignKey("jobs.Job", on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    submission = models.ForeignKey("submissions.Submission", on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "is_read"]),
        ]

    def __str__(self):
        return f"[{self.kind}] {self.title} → {self.user_id}"

    def get_target_url(self):
        if self.link_url:
            return self.link_url
        if self.candidate_id:
            return reverse("candidates:detail", args=[self.candidate_id])
        if self.submission_id:
            return reverse("submissions:detail", args=[self.submission_id])
        if self.job_id:
            return reverse("jobs:detail", args=[self.job_id])
        return reverse("notifications:list")
