from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404, redirect, render

from accounts.decorators import staff_required, vendor_required
from core.audit import log as audit_log
from core.nav import nav_for

from .forms import (
    CandidateForm, CandidateNoteForm, ResumeUploadForm,
    StageChangeForm, SubmitToClientForm,
)
from .models import Candidate, CandidateStage, ClientPacket, ResumeFile
from .services import ingest_resume, make_client_packet, submit_to_client


def _scope_for_user(user, qs):
    """Apply role-based filtering. Admin/HR see everything; client/vendor see only their own."""
    if user.role == "client":
        return qs.filter(client=user.client_account)
    if user.role == "vendor":
        return qs.filter(vendor=user.vendor_account)
    return qs


@login_required
def candidate_list(request):
    """Searchable directory."""
    if request.user.role == "client":
        return redirect("clients:portal")
    qs = Candidate.objects.all().select_related("client", "vendor", "owner")
    qs = _scope_for_user(request.user, qs)

    q = (request.GET.get("q") or "").strip()
    stage = request.GET.get("stage") or ""
    duplicate = request.GET.get("dup") or ""
    if q:
        qs = qs.filter(
            Q(full_name__icontains=q)
            | Q(email__icontains=q)
            | Q(skills_csv__icontains=q)
            | Q(current_title__icontains=q)
            | Q(current_company__icontains=q)
            | Q(location__icontains=q)
        )
    if stage:
        qs = qs.filter(stage=stage)
    if duplicate == "1":
        qs = qs.filter(duplicate_status__in=["possible", "duplicate"])

    return render(request, "candidates/list.html", {
        "candidates": qs[:200],
        "q": q,
        "stage": stage,
        "duplicate": duplicate,
        "stages": CandidateStage.choices,
        "total": qs.count(),
        "nav_items": nav_for(request),
    })


@login_required
def candidate_detail(request, pk):
    candidate = get_object_or_404(Candidate, pk=pk)
    # Scope check
    if request.user.role == "client" and candidate.client_id != request.user.client_account_id:
        raise Http404
    if request.user.role == "vendor" and candidate.vendor_id != request.user.vendor_account_id:
        raise Http404

    note_form = CandidateNoteForm()
    if request.method == "POST" and "add_note" in request.POST and request.user.role in ("admin", "hr"):
        note_form = CandidateNoteForm(request.POST)
        if note_form.is_valid():
            note = note_form.save(commit=False)
            note.candidate = candidate
            note.author = request.user
            note.save()
            messages.success(request, "Note added.")
            return redirect("candidates:detail", pk=pk)

    return render(request, "candidates/detail.html", {
        "c": candidate,
        "stage_history": candidate.stage_history.select_related("changed_by")[:20],
        "submissions": candidate.submissions.select_related("job", "client")[:20],
        "notes": candidate.notes.select_related("author")[:20] if request.user.role in ("admin", "hr") else [],
        "packets": candidate.packets.order_by("-generated_at")[:10],
        "resumes": candidate.resumes.order_by("-uploaded_at")[:10],
        "stage_choices": CandidateStage.choices,
        "note_form": note_form,
        "nav_items": nav_for(request),
    })


@staff_required
def candidate_create(request):
    form = CandidateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        c = form.save(commit=False)
        c.created_by = request.user
        if not c.owner:
            c.owner = request.user
        c.save()
        audit_log("candidate.created", target=c, summary="Manual create")
        messages.success(request, "Candidate created.")
        return redirect(c.get_absolute_url())
    return render(request, "candidates/form.html", {"form": form, "title": "Add candidate", "nav_items": nav_for(request)})


@staff_required
def candidate_edit(request, pk):
    c = get_object_or_404(Candidate, pk=pk)
    form = CandidateForm(request.POST or None, instance=c)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("candidate.updated", target=c, summary="Edited profile")
        messages.success(request, "Profile updated.")
        return redirect(c.get_absolute_url())
    return render(request, "candidates/form.html", {"form": form, "title": f"Edit {c.full_name}", "nav_items": nav_for(request)})


@login_required
def upload_resume(request):
    """Resume upload — HR or Vendor."""
    if request.user.role not in ("admin", "hr", "vendor"):
        return redirect("core:home")

    vendor_locked = request.user.vendor_account if request.user.role == "vendor" else None
    form = ResumeUploadForm(request.POST or None, request.FILES or None, vendor_locked=vendor_locked)

    if request.method == "POST" and form.is_valid():
        candidate, _resume, parse_result = ingest_resume(
            uploaded_file=form.cleaned_data["resume"],
            uploaded_by=request.user,
            full_name=form.cleaned_data.get("full_name") or "",
            source=form.cleaned_data.get("source") or "",
            vendor=form.cleaned_data.get("vendor"),
        )
        if parse_result.error:
            messages.warning(request, f"Uploaded — but parsing had a hiccup: {parse_result.error}")
        else:
            messages.success(request, f"Resume parsed for {candidate.full_name}.")
        return redirect(candidate.get_absolute_url())

    return render(request, "candidates/upload.html", {"form": form, "nav_items": nav_for(request)})


@staff_required
def change_stage(request, pk):
    if request.method != "POST":
        return redirect("candidates:detail", pk=pk)
    c = get_object_or_404(Candidate, pk=pk)
    form = StageChangeForm(request.POST)
    if form.is_valid():
        c.set_stage(form.cleaned_data["stage"], by=request.user, note=form.cleaned_data.get("note", ""))
        audit_log("candidate.stage_changed", target=c, summary=f"→ {form.cleaned_data['stage']}")
        messages.success(request, "Stage updated.")
    return redirect("candidates:detail", pk=pk)


@staff_required
def generate_packet(request, pk):
    if request.method != "POST":
        return redirect("candidates:detail", pk=pk)
    c = get_object_or_404(Candidate, pk=pk)
    try:
        make_client_packet(c, by=request.user)
        messages.success(request, "Client-safe PDF generated.")
    except Exception as exc:
        messages.error(request, f"Could not generate PDF packet: {exc}")
    return redirect("candidates:detail", pk=pk)


@staff_required
def submit_view(request, pk):
    c = get_object_or_404(Candidate, pk=pk)
    form = SubmitToClientForm(request.POST or None, candidate=c)
    if request.method == "POST" and form.is_valid():
        try:
            sub = submit_to_client(c, job=form.cleaned_data["job"], by=request.user, note=form.cleaned_data.get("note", ""))
        except Exception as exc:
            messages.error(request, f"Could not submit candidate: {exc}")
            return render(request, "candidates/submit.html", {"c": c, "form": form, "nav_items": nav_for(request)})
        messages.success(request, f"Submitted to {sub.client.name}.")
        return redirect("submissions:detail", pk=sub.pk)
    return render(request, "candidates/submit.html", {"c": c, "form": form, "nav_items": nav_for(request)})


@login_required
def download_resume(request, pk):
    rf = get_object_or_404(ResumeFile, pk=pk)
    user = request.user
    # Original resumes: admin/hr always; vendor only if they uploaded; clients NEVER.
    if user.role == "client":
        raise Http404
    if user.role == "vendor" and rf.candidate.vendor_id != user.vendor_account_id:
        raise Http404
    audit_log("resume.downloaded", target=rf.candidate, summary=rf.original_filename)
    return FileResponse(rf.file.open("rb"), as_attachment=True, filename=rf.original_filename or f"resume-{rf.pk}.pdf")


@login_required
def download_packet(request, pk):
    pkt = get_object_or_404(ClientPacket, pk=pk)
    user = request.user
    # Clients see only packets for their account
    if user.role == "client" and pkt.candidate.client_id != user.client_account_id:
        raise Http404
    if user.role == "vendor":
        # Vendors don't see client-facing packets to keep the boundary clean.
        raise Http404
    audit_log("packet.downloaded", target=pkt.candidate, summary=f"Packet #{pkt.pk}")
    return FileResponse(pkt.file.open("rb"), as_attachment=True, filename=f"{pkt.candidate.full_name}-packet.pdf")
