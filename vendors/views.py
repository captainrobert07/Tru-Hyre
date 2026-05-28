from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from accounts.decorators import staff_required, vendor_required
from candidates.models import Candidate, CandidateStage
from core.audit import log as audit_log
from core.nav import nav_for
from jobs.models import Job, JobStatus

from .forms import VendorAccountForm
from .models import VendorAccount


@staff_required
def vendor_list(request):
    qs = VendorAccount.objects.all().order_by("name")
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(name__icontains=q)
    return render(request, "vendors/list.html", {"vendors": qs[:200], "q": q, "nav_items": nav_for(request)})


@staff_required
def vendor_detail(request, pk):
    vendor = get_object_or_404(VendorAccount, pk=pk)
    return render(request, "vendors/detail.html", {
        "vendor": vendor,
        "users": vendor.users.all(),
        "candidates": vendor.candidates.all().order_by("-created_at")[:30],
        "jobs": vendor.jobs.all().order_by("-created_at")[:20],
        "quality": vendor.quality_snapshot(),
        "nav_items": nav_for(request),
    })


@staff_required
def vendor_create(request):
    form = VendorAccountForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        v = form.save()
        audit_log("vendor.created", target=v, summary=v.name)
        messages.success(request, "Vendor created.")
        return redirect("vendors:detail", pk=v.pk)
    return render(request, "vendors/form.html", {"form": form, "title": "Add vendor", "nav_items": nav_for(request)})


@staff_required
def vendor_edit(request, pk):
    v = get_object_or_404(VendorAccount, pk=pk)
    form = VendorAccountForm(request.POST or None, instance=v)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("vendor.updated", target=v, summary=v.name)
        messages.success(request, "Vendor updated.")
        return redirect("vendors:detail", pk=v.pk)
    return render(request, "vendors/form.html", {"form": form, "title": f"Edit {v.name}", "nav_items": nav_for(request)})


# --- Vendor portal -----------------------------------------------------------

@vendor_required
def vendor_portal(request):
    if request.user.role == "admin":
        return redirect("core:home")
    vendor = request.user.vendor_account
    if not vendor:
        return redirect("core:home")

    open_jobs = vendor.jobs.filter(status=JobStatus.OPEN).order_by("-created_at")[:10]
    candidates = vendor.candidates.all().order_by("-created_at")[:10]
    in_review = vendor.candidates.filter(stage=CandidateStage.HR_REVIEW).count()
    duplicates = vendor.candidates.filter(duplicate_status__in=["possible", "duplicate"]).count()
    submitted = vendor.candidates.exclude(stage__in=[CandidateStage.PARSED, CandidateStage.HR_REVIEW]).count()

    return render(request, "vendors/portal.html", {
        "vendor": vendor,
        "open_jobs": open_jobs,
        "candidates": candidates,
        "metrics": {
            "open_jobs": open_jobs.count(),
            "in_review": in_review,
            "duplicates": duplicates,
            "submitted": submitted,
            "total": vendor.candidates.count(),
        },
        "nav_items": nav_for(request),
    })


@vendor_required
def vendor_jobs(request):
    if request.user.role == "admin":
        return redirect("core:home")
    vendor = request.user.vendor_account
    jobs = Job.objects.filter(assigned_vendors=vendor).select_related("client").order_by("-created_at")
    return render(request, "vendors/jobs.html", {"jobs": jobs, "nav_items": nav_for(request)})


@vendor_required
def vendor_submissions(request):
    if request.user.role == "admin":
        return redirect("core:home")
    vendor = request.user.vendor_account
    qs = Candidate.objects.filter(vendor=vendor).select_related("client").order_by("-created_at")
    return render(request, "vendors/submissions.html", {"candidates": qs[:200], "nav_items": nav_for(request)})


@vendor_required
def vendor_upload(request):
    """Vendors upload via the same resume flow — vendor is auto-locked."""
    return redirect("candidates:upload")
