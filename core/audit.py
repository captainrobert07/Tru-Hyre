"""Lightweight audit-log helper used across apps."""
from .middleware import get_current_request, get_current_user
from .models import AuditLog


def _get_ip(request):
    if request is None:
        return None
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log(action, *, target=None, summary="", metadata=None, actor=None):
    request = get_current_request()
    if actor is None:
        actor = get_current_user()
    if actor is not None and not getattr(actor, "is_authenticated", False):
        actor = None

    target_type = ""
    target_id = ""
    if target is not None:
        target_type = f"{target._meta.app_label}.{target._meta.model_name}"
        target_id = str(getattr(target, "pk", "") or "")

    AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        summary=summary,
        metadata=metadata or {},
        ip=_get_ip(request),
    )
