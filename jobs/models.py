from django.conf import settings
from django.db import models


class JobStatus(models.TextChoices):
    OPEN = "open", "Open"
    HOLD = "hold", "Hold"
    CLOSING = "closing", "Closing"
    CLOSED = "closed", "Closed"


class JobPriority(models.TextChoices):
    LOW = "low", "Low"
    MEDIUM = "medium", "Medium"
    HIGH = "high", "High"
    URGENT = "urgent", "Urgent"


class Job(models.Model):
    title = models.CharField(max_length=200)
    client = models.ForeignKey("clients.ClientAccount", on_delete=models.PROTECT, related_name="jobs")
    role = models.CharField(max_length=120, blank=True, help_text="e.g. 'Backend Engineer', 'Data Analyst'")
    description = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    is_remote = models.BooleanField(default=False)
    openings = models.PositiveIntegerField(default=1)
    budget_min = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_max = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    budget_currency = models.CharField(max_length=8, default="EUR")
    priority = models.CharField(max_length=12, choices=JobPriority.choices, default=JobPriority.MEDIUM)
    status = models.CharField(max_length=12, choices=JobStatus.choices, default=JobStatus.OPEN)

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="owned_jobs",
        limit_choices_to={"role__in": ["admin", "hr"]},
    )
    assigned_vendors = models.ManyToManyField("vendors.VendorAccount", blank=True, related_name="jobs")

    target_close_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["client", "status"]),
            models.Index(fields=["owner"]),
        ]

    def __str__(self):
        return f"{self.title} · {self.client.name}"

    @property
    def pipeline_count(self):
        # Distinct candidates currently associated with this job through any submission.
        from submissions.models import Submission

        return Submission.objects.filter(job=self).values("candidate_id").distinct().count()

    @property
    def is_open(self):
        return self.status == JobStatus.OPEN

    @property
    def budget_display(self):
        if self.budget_min and self.budget_max:
            return f"{self.budget_currency} {self.budget_min:,.0f}–{self.budget_max:,.0f}"
        if self.budget_min:
            return f"{self.budget_currency} {self.budget_min:,.0f}+"
        if self.budget_max:
            return f"up to {self.budget_currency} {self.budget_max:,.0f}"
        return ""
