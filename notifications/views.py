from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from core.nav import nav_for

from .models import Notification


@login_required
def list_view(request):
    qs = Notification.objects.filter(user=request.user).order_by("-created_at")
    show = request.GET.get("show") or "all"
    if show == "unread":
        qs = qs.filter(is_read=False)
    return render(request, "notifications/list.html", {
        "items": qs[:200],
        "show": show,
        "nav_items": nav_for(request),
    })


@require_POST
@login_required
def mark_read(request, pk):
    n = get_object_or_404(Notification, pk=pk, user=request.user)
    if not n.is_read:
        n.is_read = True
        n.read_at = timezone.now()
        n.save(update_fields=["is_read", "read_at"])
    target = n.get_target_url()
    return redirect(target or "notifications:list")


@require_POST
@login_required
def mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
    return redirect("notifications:list")
