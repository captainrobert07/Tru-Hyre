"""Role-gating helpers for views."""
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseForbidden
from django.shortcuts import redirect


def role_required(*roles):
    """Decorator: only users with one of the listed roles may proceed.

    Unauthenticated users are sent to login. Authenticated users with the wrong
    role are redirected to their own home (so a Client cannot snoop on HR).
    """
    def decorator(view):
        @wraps(view)
        @login_required
        def _wrapped(request, *args, **kwargs):
            if request.user.role not in roles:
                # Don't reveal which URLs exist — just bounce to home.
                return redirect("core:home")
            return view(request, *args, **kwargs)
        return _wrapped
    return decorator


def admin_required(view):
    return role_required("admin")(view)


def staff_required(view):
    """Admin or HR (internal staff)."""
    return role_required("admin", "hr")(view)


def client_required(view):
    return role_required("admin", "client")(view)


def vendor_required(view):
    return role_required("admin", "vendor")(view)
