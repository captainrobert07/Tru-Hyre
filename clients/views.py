from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from accounts.decorators import client_required, staff_required
from candidates.models import CandidateStage
from core.audit import log as audit_log
from core.nav import nav_for
from notifications.models import NotificationKind
from notifications.services import notify_users
from submissions.models import FeedbackEvent, Submission, SubmissionStatus

from .forms import ClientAccountForm, ClientContactForm, ClientFeedbackForm
from .models import ClientAccount


@staff_required
def client_list(request):
    qs = ClientAccount.objects.all().order_by("name")
    q = (request.GET.get("q") or "").strip()
    if q:
        qs = qs.filter(name__icontains=q)
    return render(request, "clients/list.html", {
        "clients": qs[:200], "q": q, "nav_items": nav_for(request),
    })


@staff_required
def client_detail(request, pk):
    client = get_object_or_404(ClientAccount, pk=pk)
    return render(request, "clients/detail.html", {
        "client": client,
        "contacts": client.contacts.all(),
        "jobs": client.jobs.all().order_by("-created_at")[:20],
        "submissions": client.submissions.select_related("candidate", "job").order_by("-submitted_at")[:20],
        "users": client.users.all(),
        "nav_items": nav_for(request),
    })


@staff_required
def client_create(request):
    form = ClientAccountForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        client = form.save()
        audit_log("client.created", target=client, summary=client.name)
        messages.success(request, "Client created.")
        return redirect("clients:detail", pk=client.pk)
    return render(request, "clients/form.html", {"form": form, "title": "Add client", "nav_items": nav_for(request)})


@staff_required
def client_edit(request, pk):
    client = get_object_or_404(ClientAccount, pk=pk)
    form = ClientAccountForm(request.POST or None, instance=client)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("client.updated", target=client, summary=client.name)
        messages.success(request, "Client updated.")
        return redirect("clients:detail", pk=client.pk)
    return render(request, "clients/form.html", {"form": form, "title": f"Edit {client.name}", "nav_items": nav_for(request)})


@staff_required
def add_contact(request, pk):
    client = get_object_or_404(ClientAccount, pk=pk)
    form = ClientContactForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        contact = form.save(commit=False)
        contact.client = client
        contact.save()
        messages.success(request, "Contact added.")
        return redirect("clients:detail", pk=client.pk)
    return render(request, "clients/contact_form.html", {"form": form, "client": client, "nav_items": nav_for(request)})


# --- Client portal -----------------------------------------------------------

@client_required
def client_portal(request):
    """Client-only landing page — shows their jobs and submissions."""
    if request.user.role == "admin":
        return redirect("core:home")
    client = request.user.client_account
    if not client:
        return redirect("core:home")

    open_subs = client.submissions.filter(status=SubmissionStatus.PENDING).select_related("candidate", "job").order_by("-submitted_at")[:10]
    recent = client.submissions.select_related("candidate", "job").order_by("-last_status_at")[:20]
    open_jobs = client.jobs.filter(status="open").order_by("-created_at")[:10]
    return render(request, "clients/portal.html", {
        "client": client,
        "open_submissions": open_subs,
        "recent_submissions": recent,
        "open_jobs": open_jobs,
        "nav_items": nav_for(request),
    })


@client_required
def client_submissions(request):
    if request.user.role == "admin":
        return redirect("core:home")
    client = request.user.client_account
    qs = Submission.objects.filter(client=client).select_related("candidate", "job").order_by("-submitted_at")
    status = request.GET.get("status") or ""
    if status:
        qs = qs.filter(status=status)
    return render(request, "clients/submissions.html", {
        "submissions": qs[:200],
        "status": status,
        "statuses": SubmissionStatus.choices,
        "nav_items": nav_for(request),
    })


@client_required
def client_jobs(request):
    if request.user.role == "admin":
        return redirect("core:home")
    client = request.user.client_account
    jobs = client.jobs.all().order_by("-created_at")
    return render(request, "clients/jobs.html", {"jobs": jobs, "nav_items": nav_for(request)})


@login_required
def client_submission_detail(request, pk):
    """Client-facing detail of a single submission. Sanitized — no resume, no email/phone."""
    sub = get_object_or_404(Submission.objects.select_related("candidate", "job", "packet", "client"), pk=pk)
    if request.user.role == "client" and sub.client_id != request.user.client_account_id:
        return redirect("core:home")
    if request.user.role == "vendor":
        return redirect("core:home")

    form = ClientFeedbackForm()
    if request.method == "POST" and request.user.role in ("client", "admin"):
        form = ClientFeedbackForm(request.POST)
        if form.is_valid():
            action = form.cleaned_data["action"]
            comment = form.cleaned_data.get("comment", "")
            FeedbackEvent.objects.create(submission=sub, action=action, by=request.user, comment=comment)
            sub.status = action
            sub.last_status_at = timezone.now()
            sub.save(update_fields=["status", "last_status_at"])
            stage_map = {
                SubmissionStatus.SHORTLISTED: CandidateStage.CLIENT_REVIEW,
                SubmissionStatus.INTERVIEW: CandidateStage.INTERVIEW,
                SubmissionStatus.OFFER: CandidateStage.OFFER,
                SubmissionStatus.JOINED: CandidateStage.JOINED,
                SubmissionStatus.REJECTED: CandidateStage.REJECTED,
                SubmissionStatus.HOLD: CandidateStage.HOLD,
            }
            new_stage = stage_map.get(action)
            if new_stage:
                sub.candidate.set_stage(new_stage, by=request.user, note=f"Client {action}")

            audit_log("submission.feedback", target=sub.candidate, summary=f"{action}", metadata={"comment": comment})

            from accounts.models import Role, User
            staff = User.objects.filter(role__in=[Role.ADMIN, Role.HR], is_active=True)
            kind = NotificationKind.CLIENT_FEEDBACK
            if action == SubmissionStatus.INTERVIEW:
                kind = NotificationKind.INTERVIEW_REQUESTED
            elif action == SubmissionStatus.OFFER:
                kind = NotificationKind.OFFER_UPDATED
            elif action == SubmissionStatus.JOINED:
                kind = NotificationKind.JOINING_CONFIRMED
            notify_users(staff, kind=kind,
                         title=f"Client feedback: {action}",
                         body=f"{sub.candidate.full_name} for {sub.job.title}",
                         candidate=sub.candidate, submission=sub, job=sub.job)

            messages.success(request, "Feedback recorded.")
            return redirect("clients:submission_detail", pk=sub.pk)

    return render(request, "clients/submission_detail.html", {
        "sub": sub,
        "form": form,
        "feedback_events": sub.feedback_events.select_related("by").order_by("-created_at"),
        "nav_items": nav_for(request),
    })
