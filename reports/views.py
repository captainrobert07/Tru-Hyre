from datetime import timedelta

from django.db.models import Avg, Count, F, Q
from django.db.models.functions import TruncDate
from django.shortcuts import render
from django.utils import timezone

from accounts.decorators import staff_required
from candidates.models import Candidate, CandidateStage, ResumeFile
from clients.models import ClientAccount
from core.nav import nav_for
from jobs.models import Job, JobStatus
from submissions.models import FeedbackEvent, Submission, SubmissionStatus
from vendors.models import VendorAccount


def _date_range(days=30):
    end = timezone.now()
    return end - timedelta(days=days), end


@staff_required
def reports_home(request):
    days = int(request.GET.get("days") or 30)
    start, end = _date_range(days)

    resume_volume = ResumeFile.objects.filter(uploaded_at__gte=start).count()
    submissions_30 = Submission.objects.filter(submitted_at__gte=start)
    submissions_count = submissions_30.count()
    interviews = Candidate.objects.filter(stage_history__to_stage=CandidateStage.INTERVIEW, stage_history__changed_at__gte=start).distinct().count()
    offers = Candidate.objects.filter(stage_history__to_stage=CandidateStage.OFFER, stage_history__changed_at__gte=start).distinct().count()
    joinings = Candidate.objects.filter(stage_history__to_stage=CandidateStage.JOINED, stage_history__changed_at__gte=start).distinct().count()

    duplicates = Candidate.objects.filter(created_at__gte=start, duplicate_status__in=["possible", "duplicate"]).count()
    total_new = Candidate.objects.filter(created_at__gte=start).count() or 1
    duplicate_rate = round(100 * duplicates / total_new, 1)

    pending_feedback = Submission.objects.filter(status=SubmissionStatus.PENDING).count()

    # Vendor quality
    vendor_rows = []
    for v in VendorAccount.objects.filter(is_active=True):
        snap = v.quality_snapshot()
        total = snap["total"] or 0
        offers_v = snap["offers"] or 0
        ratio = round(100 * offers_v / total, 1) if total else 0
        vendor_rows.append({
            "name": v.name,
            "total": total,
            "duplicates": snap["duplicates"],
            "interviews": snap["interviews"],
            "offers": offers_v,
            "joins": snap["joins"],
            "offer_rate": ratio,
        })
    vendor_rows.sort(key=lambda r: (-(r["offers"] or 0), -(r["total"] or 0)))

    # Client response time (median) — based on FeedbackEvent created_at minus Submission.submitted_at
    fb_times = FeedbackEvent.objects.filter(created_at__gte=start).select_related("submission").values_list("created_at", "submission__submitted_at")
    deltas_hours = sorted((float((fb - sub).total_seconds()) / 3600.0 for fb, sub in fb_times if sub))
    median_hours = deltas_hours[len(deltas_hours) // 2] if deltas_hours else 0

    # HR productivity
    hr_rows = (Candidate.objects.filter(created_at__gte=start, owner__isnull=False)
               .values("owner__email", "owner__full_name")
               .annotate(candidates=Count("id"),
                         submitted=Count("submissions", filter=Q(submissions__submitted_at__gte=start), distinct=True))
               .order_by("-candidates"))[:10]

    # Conversion ratios
    pipeline_conversion = {
        "submitted_to_interview": _ratio(submissions_count, interviews),
        "interview_to_offer": _ratio(interviews, offers),
        "offer_to_joined": _ratio(offers, joinings),
    }

    # Per-day volume sparkline
    series = (ResumeFile.objects.filter(uploaded_at__gte=start)
              .annotate(d=TruncDate("uploaded_at"))
              .values("d").annotate(c=Count("id")).order_by("d"))
    series = list(series)

    return render(request, "reports/home.html", {
        "days": days,
        "metrics": {
            "resume_volume": resume_volume,
            "submissions": submissions_count,
            "interviews": interviews,
            "offers": offers,
            "joinings": joinings,
            "duplicate_rate": duplicate_rate,
            "pending_feedback": pending_feedback,
            "median_response_hours": round(median_hours, 1),
        },
        "vendor_rows": vendor_rows,
        "hr_rows": hr_rows,
        "conversion": pipeline_conversion,
        "series": series,
        "nav_items": nav_for(request),
    })


def _ratio(a, b):
    if not a:
        return 0
    return round(100 * b / a, 1)
