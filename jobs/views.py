from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from accounts.decorators import staff_required
from core.audit import log as audit_log
from core.nav import nav_for

from .forms import JobForm
from .models import Job, JobStatus


def _scope(user, qs):
    if user.role == "client":
        return qs.filter(client=user.client_account)
    if user.role == "vendor":
        return qs.filter(assigned_vendors=user.vendor_account).distinct()
    return qs


@login_required
def job_list(request):
    qs = Job.objects.select_related("client", "owner").prefetch_related("assigned_vendors")
    qs = _scope(request.user, qs)

    q = (request.GET.get("q") or "").strip()
    status = request.GET.get("status") or ""
    if q:
        qs = qs.filter(
            Q(title__icontains=q) | Q(role__icontains=q) | Q(location__icontains=q) | Q(client__name__icontains=q)
        )
    if status:
        qs = qs.filter(status=status)

    return render(request, "jobs/list.html", {
        "jobs": qs[:200],
        "q": q,
        "status": status,
        "statuses": JobStatus.choices,
        "total": qs.count(),
        "nav_items": nav_for(request),
    })


@login_required
def job_detail(request, pk):
    job = get_object_or_404(Job, pk=pk)
    if request.user.role == "client" and job.client_id != request.user.client_account_id:
        return redirect("core:home")
    if request.user.role == "vendor" and not job.assigned_vendors.filter(pk=request.user.vendor_account_id).exists():
        return redirect("core:home")

    submissions = job.submissions.select_related("candidate").order_by("-submitted_at")[:50]

    return render(request, "jobs/detail.html", {
        "job": job,
        "submissions": submissions,
        "nav_items": nav_for(request),
    })


@staff_required
def job_create(request):
    form = JobForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        job = form.save(commit=False)
        if not job.owner:
            job.owner = request.user
        job.save()
        form.save_m2m()
        audit_log("job.created", target=job, summary=job.title)
        messages.success(request, "Job created.")
        return redirect("jobs:detail", pk=job.pk)
    return render(request, "jobs/form.html", {"form": form, "title": "Create job", "nav_items": nav_for(request)})


@staff_required
def job_edit(request, pk):
    job = get_object_or_404(Job, pk=pk)
    form = JobForm(request.POST or None, instance=job)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("job.updated", target=job, summary=job.title)
        messages.success(request, "Job updated.")
        return redirect("jobs:detail", pk=job.pk)
    return render(request, "jobs/form.html", {"form": form, "title": f"Edit {job.title}", "nav_items": nav_for(request)})
