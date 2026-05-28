"""Role-aware navigation configuration."""
from django.urls import reverse


# Inline SVG path data for icons (used in <svg ...>{{ item.icon|safe }}</svg>).
ICON = {
    "dashboard": '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    "candidates": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "jobs": '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    "clients": '<path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>',
    "vendors": '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/>',
    "reports": '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    "portal": '<path d="M5 12l-2 0"/><path d="M12 19l0 2"/><path d="M19 12l2 0"/><path d="M12 5l0 -2"/><path d="M7.5 7.5l-1.5 -1.5"/><path d="M16.5 7.5l1.5 -1.5"/><path d="M7.5 16.5l-1.5 1.5"/><path d="M16.5 16.5l1.5 1.5"/><circle cx="12" cy="12" r="4"/>',
    "submissions": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    "notifications": '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
}


def _build(request, items):
    path = request.path
    out = []
    for label, urlname, icon_key in items:
        url = reverse(urlname)
        out.append({
            "label": label,
            "url": url,
            "icon": ICON.get(icon_key, ""),
            "active": path == url or (url != "/" and path.startswith(url)),
        })
    return out


def nav_for(request):
    """Return up to 5 nav items appropriate to the user's role (mobile bottom nav)."""
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return []

    if user.role == "admin":
        items = [
            ("Home", "core:home", "dashboard"),
            ("Candidates", "candidates:list", "candidates"),
            ("Jobs", "jobs:list", "jobs"),
            ("Reports", "reports:home", "reports"),
            ("Settings", "settings_app:home", "settings"),
        ]
    elif user.role == "hr":
        items = [
            ("Pipeline", "core:home", "dashboard"),
            ("Candidates", "candidates:list", "candidates"),
            ("Jobs", "jobs:list", "jobs"),
            ("Clients", "clients:list", "clients"),
            ("Reports", "reports:home", "reports"),
        ]
    elif user.role == "client":
        items = [
            ("Home", "core:home", "dashboard"),
            ("Submissions", "clients:submissions", "submissions"),
            ("Jobs", "clients:jobs", "jobs"),
            ("Notifications", "notifications:list", "notifications"),
        ]
    elif user.role == "vendor":
        items = [
            ("Home", "core:home", "dashboard"),
            ("Jobs", "vendors:jobs", "jobs"),
            ("Submissions", "vendors:submissions", "submissions"),
            ("Upload", "vendors:upload", "portal"),
            ("Notifications", "notifications:list", "notifications"),
        ]
    else:
        items = [("Home", "core:home", "dashboard")]
    return _build(request, items)
