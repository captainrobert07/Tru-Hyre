from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect, render

from accounts.decorators import admin_required
from accounts.forms import UserCreateForm, UserEditForm
from accounts.models import Role, User
from core.audit import log as audit_log
from core.models import AuditLog
from core.nav import nav_for

from .forms import CompanyProfileForm, InvitationForm
from .models import CompanyProfile, Invitation


@admin_required
def settings_home(request):
    profile = CompanyProfile.get_solo()
    user_counts = User.objects.values("role").annotate(n=Count("id"))
    roles = {row["role"]: row["n"] for row in user_counts}
    pending_invites = Invitation.objects.filter(accepted=False).count()
    recent_audit = AuditLog.objects.select_related("actor")[:8]
    return render(request, "settings_app/home.html", {
        "profile": profile,
        "roles": roles,
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "pending_invites": pending_invites,
        "recent_audit": recent_audit,
        "nav_items": nav_for(request),
    })


@admin_required
def user_list(request):
    q = (request.GET.get("q") or "").strip()
    role = (request.GET.get("role") or "").strip()
    qs = User.objects.all().order_by("email")
    if q:
        qs = qs.filter(Q(email__icontains=q) | Q(full_name__icontains=q))
    if role in dict(Role.choices):
        qs = qs.filter(role=role)
    return render(request, "settings_app/users.html", {
        "users": qs[:300],
        "q": q,
        "role": role,
        "roles": Role.choices,
        "nav_items": nav_for(request),
    })


@admin_required
def user_create(request):
    form = UserCreateForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        u = form.save()
        audit_log("user.created", target=u, summary=f"{u.email} ({u.role})")
        messages.success(request, "User created.")
        return redirect("settings_app:users")
    return render(request, "settings_app/user_form.html", {
        "form": form,
        "title": "Add user",
        "nav_items": nav_for(request),
    })


@admin_required
def user_edit(request, pk):
    user = get_object_or_404(User, pk=pk)
    form = UserEditForm(request.POST or None, instance=user)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("user.updated", target=user, summary=f"{user.email} ({user.role})")
        messages.success(request, "User updated.")
        return redirect("settings_app:users")
    return render(request, "settings_app/user_form.html", {
        "form": form,
        "title": f"Edit {user.email}",
        "edit_user": user,
        "nav_items": nav_for(request),
    })


@admin_required
def user_toggle_active(request, pk):
    if request.method != "POST":
        return redirect("settings_app:users")
    user = get_object_or_404(User, pk=pk)
    if user == request.user:
        messages.error(request, "You cannot disable your own account.")
        return redirect("settings_app:users")
    user.is_active = not user.is_active
    user.save(update_fields=["is_active"])
    audit_log(
        "user.activated" if user.is_active else "user.deactivated",
        target=user, summary=user.email,
    )
    messages.success(request, f"User {'enabled' if user.is_active else 'disabled'}.")
    return redirect("settings_app:users")


@admin_required
def invitation_list(request):
    pending = Invitation.objects.filter(accepted=False).select_related("client_account", "vendor_account")
    accepted = Invitation.objects.filter(accepted=True).select_related("client_account", "vendor_account")[:50]
    return render(request, "settings_app/invitations.html", {
        "pending": pending,
        "accepted": accepted,
        "nav_items": nav_for(request),
    })


@admin_required
def invitation_create(request):
    form = InvitationForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        inv = form.save(commit=False)
        inv.invited_by = request.user
        inv.save()
        audit_log("invitation.sent", target=inv, summary=f"{inv.email} ({inv.kind})")
        messages.success(request, "Invitation recorded. Share credentials with the recipient.")
        return redirect("settings_app:invitations")
    return render(request, "settings_app/invitation_form.html", {
        "form": form,
        "title": "New invitation",
        "nav_items": nav_for(request),
    })


@admin_required
def invitation_revoke(request, pk):
    if request.method != "POST":
        return redirect("settings_app:invitations")
    inv = get_object_or_404(Invitation, pk=pk, accepted=False)
    audit_log("invitation.revoked", target=inv, summary=inv.email)
    inv.delete()
    messages.success(request, "Invitation revoked.")
    return redirect("settings_app:invitations")


@admin_required
def company_profile(request):
    profile = CompanyProfile.get_solo()
    form = CompanyProfileForm(request.POST or None, request.FILES or None, instance=profile)
    if request.method == "POST" and form.is_valid():
        form.save()
        audit_log("company.updated", target=profile, summary=profile.name)
        messages.success(request, "Company profile updated.")
        return redirect("settings_app:company")
    return render(request, "settings_app/company.html", {
        "form": form,
        "profile": profile,
        "nav_items": nav_for(request),
    })


@admin_required
def audit_log_view(request):
    qs = AuditLog.objects.select_related("actor").all()
    action = (request.GET.get("action") or "").strip()
    actor = (request.GET.get("actor") or "").strip()
    if action:
        qs = qs.filter(action__icontains=action)
    if actor:
        qs = qs.filter(actor__email__icontains=actor)
    paginator = Paginator(qs, 50)
    page = paginator.get_page(request.GET.get("page"))
    return render(request, "settings_app/audit_log.html", {
        "page": page,
        "action": action,
        "actor": actor,
        "nav_items": nav_for(request),
    })
