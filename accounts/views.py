from django.contrib.auth import login as auth_login
from django.contrib.auth import logout as auth_logout
from django.contrib.auth.views import LoginView
from django.shortcuts import redirect
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import TruHyreAuthForm


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
