from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render

from core.nav import nav_for

from .models import Submission, SubmissionStatus


def _scope(user, qs):
    if user.role == "client":
        return qs.filter(client=user.client_account)
    if user.role == "vendor":
        return qs.filter(candidate__vendor=user.vendor_account)
    return qs


@login_required
def submission_list(request):
    qs = Submission.objects.select_related("candidate", "job", "client").order_by("-submitted_at")
    qs = _scope(request.user, qs)
    status = request.GET.get("status") or ""
    if status:
        qs = qs.filter(status=status)
    return render(request, "submissions/list.html", {
        "submissions": qs[:200],
        "status": status,
        "statuses": SubmissionStatus.choices,
        "nav_items": nav_for(request),
    })


@login_required
def submission_detail(request, pk):
    """Internal (admin/HR/vendor view). Clients have a dedicated portal view."""
    sub = get_object_or_404(Submission.objects.select_related("candidate", "job", "client", "packet"), pk=pk)
    if request.user.role == "client":
        return redirect("clients:submission_detail", pk=pk)
    if request.user.role == "vendor" and sub.candidate.vendor_id != request.user.vendor_account_id:
        return redirect("core:home")

    return render(request, "submissions/detail.html", {
        "sub": sub,
        "feedback_events": sub.feedback_events.select_related("by").order_by("-created_at"),
        "nav_items": nav_for(request),
    })
