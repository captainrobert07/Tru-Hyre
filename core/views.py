from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .nav import nav_for


@login_required
def home(request):
    """Role-routed landing page after login."""
    role = request.user.role
    if role == "admin":
        return redirect("core:dashboard_admin")
    if role == "hr":
        return redirect("core:dashboard_hr")
    if role == "client":
        return redirect("clients:portal")
    if role == "vendor":
        return redirect("vendors:portal")
    return render(request, "core/no_role.html")


# --- Dashboards ---
# Detailed metric assembly happens in core/dashboards.py to keep this view file
# small and easier to read. The role-specific dashboards are below.

@login_required
def dashboard_admin(request):
    if request.user.role != "admin":
        return redirect("core:home")
    from .dashboards import build_admin_dashboard
    ctx = build_admin_dashboard(request.user)
    ctx["nav_items"] = nav_for(request)
    return render(request, "core/dashboard_admin.html", ctx)


@login_required
def dashboard_hr(request):
    if request.user.role not in ("admin", "hr"):
        return redirect("core:home")
    from .dashboards import build_hr_dashboard
    ctx = build_hr_dashboard(request.user)
    ctx["nav_items"] = nav_for(request)
    return render(request, "core/dashboard_hr.html", ctx)
