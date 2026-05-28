"""Notification helpers — fan out to a list of users + (optionally) email."""
from __future__ import annotations

from typing import Iterable

from django.conf import settings
from django.core.mail import send_mail

from .models import Notification, NotificationKind


def notify_users(users: Iterable, *, kind=NotificationKind.GENERIC, title: str, body: str = "",
                 candidate=None, job=None, submission=None, link_url: str = "", send_email: bool = False):
    """Create one Notification per user. Returns the list of created notifications."""
    created = []
    for user in users:
        if not user or not getattr(user, "is_authenticated", True):
            continue
        n = Notification.objects.create(
            user=user, kind=kind, title=title, body=body,
            candidate=candidate, job=job, submission=submission,
            link_url=link_url,
        )
        created.append(n)
        if send_email and user.email:
            try:
                send_mail(
                    subject=f"[{settings.SITE_NAME}] {title}",
                    message=f"{title}\n\n{body}\n\nOpen Tru Hyre to take action.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:  # noqa: BLE001 — never block the request on email
                pass
    return created
