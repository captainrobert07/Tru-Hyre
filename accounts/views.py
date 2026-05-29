from django.contrib import messages
from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.audit import log as audit_log
from core.nav import nav_for

from .forms import PasswordChangeForm, TruHyreAuthForm


class TruHyreLoginView(LoginView):
    template_name = "accounts/login.html"
    authentication_form = TruHyreAuthForm
    redirect_authenticated_user = True

    def form_valid(self, form):
        user = form.get_user()
        user.last_login_at = timezone.now()
        user.save(update_fields=["last_login_at"])
        auth_login(self.request, user)
        return redirect("core:home")


@require_POST
def logout_view(request):
    auth_logout(request)
    return redirect("accounts:login")


@login_required
def change_password(request):
    form = PasswordChangeForm(user=request.user, data=request.POST or None)
    if request.method == "POST" and form.is_valid():
        form.save()
        update_session_auth_hash(request, form.user)
        audit_log("user.password_changed", target=request.user, summary=request.user.email)
        messages.success(request, "Password changed.")
        return redirect("core:home")
    return render(request, "accounts/change_password.html", {
        "form": form,
        "nav_items": nav_for(request),
    })
