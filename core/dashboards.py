"""Dashboard data assemblers.

Each builder returns a dict suitable for use as a template context.
Kept off the views so we can unit-test them later if needed.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from candidates.models import Candidate, CandidateStage, ResumeFile
from clients.models import ClientAccount
from jobs.models import Job, JobStatus
from notifications.models import Notification
from submissions.models import Submission, SubmissionStatus
from vendors.models import VendorAccount


def _since(days):
    return timezone.now() - timedelta(days=days)


def _stage_counts(qs):
    """Return [{'stage':..., 'label':..., 'css':..., 'count':...}, ...] in pipeline order."""
    rows = qs.values("stage").annotate(count=Count("id"))
    by_stage = {r["stage"]: r["count"] for r in rows}
    out = []
    for value, label in CandidateStage.choices:
        from candidates.models import STAGE_CSS
        out.append({
            "stage": value,
            "label": label,
            "css": STAGE_CSS.get(value, "stage-parsed"),
            "count": by_stage.get(value, 0),
        })
    return out


def build_admin_dashboard(user):
    qs_candidates = Candidate.objects.all()
    last_30 = _since(30)

    metrics = {
        "candidates_total": qs_candidates.count(),
        "candidates_30d": qs_candidates.filter(created_at__gte=last_30).count(),
        "submissions_30d": Submission.objects.filter(submitted_at__gte=last_30).count(),
        "open_jobs": Job.objects.filter(status=JobStatus.OPEN).count(),
        "active_clients": ClientAccount.objects.filter(is_active=True).count(),
        "active_vendors": VendorAccount.objects.filter(is_active=True).count(),
        "duplicates": qs_candidates.filter(duplicate_status__in=["possible", "duplicate"]).count(),
        "pending_feedback": Submission.objects.filter(status=SubmissionStatus.PENDING).count(),
    }

    return {
        "user": user,
        "metrics": metrics,
        "stage_counts": _stage_counts(qs_candidates),
        "recent_submissions": Submission.objects.select_related("candidate", "job", "client").order_by("-submitted_at")[:8],
        "pending_feedback_list": Submission.objects.filter(status=SubmissionStatus.PENDING).select_related("candidate", "job", "client").order_by("-submitted_at")[:6],
        "vendor_queue": Candidate.objects.filter(stage=CandidateStage.HR_REVIEW, vendor__isnull=False).select_related("vendor").order_by("-created_at")[:6],
        "recent_notifications": Notification.objects.filter(user=user).order_by("-created_at")[:6],
        "recent_resumes": ResumeFile.objects.select_related("candidate").order_by("-uploaded_at")[:5],
    }


def build_hr_dashboard(user):
    """HR-scoped: 'mine' filter where it matters; otherwise platform view."""
    mine = Q(owner=user) | Q(created_by=user)
    qs_candidates = Candidate.objects.all()
    qs_my = qs_candidates.filter(mine)
    last_30 = _since(30)

    metrics = {
        "my_candidates": qs_my.count(),
        "my_submissions_30d": Submission.objects.filter(submitted_by=user, submitted_at__gte=last_30).count(),
        "needs_review": qs_candidates.filter(stage=CandidateStage.HR_REVIEW).count(),
        "pending_feedback": Submission.objects.filter(status=SubmissionStatus.PENDING).count(),
        "open_jobs": Job.objects.filter(status=JobStatus.OPEN).count(),
        "duplicates": qs_candidates.filter(duplicate_status__in=["possible", "duplicate"]).count(),
    }

    return {
        "user": user,
        "metrics": metrics,
        "stage_counts": _stage_counts(qs_candidates),
        "review_queue": qs_candidates.filter(stage=CandidateStage.HR_REVIEW).select_related("vendor", "client").order_by("-created_at")[:8],
        "recent_submissions": Submission.objects.select_related("candidate", "job", "client").order_by("-submitted_at")[:8],
        "pending_feedback_list": Submission.objects.filter(status=SubmissionStatus.PENDING).select_related("candidate", "job", "client").order_by("-submitted_at")[:6],
        "recent_notifications": Notification.objects.filter(user=user).order_by("-created_at")[:6],
    }
