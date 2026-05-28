"""Top-level URL configuration."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include(("core.urls", "core"), namespace="core")),
    path("auth/", include(("accounts.urls", "accounts"), namespace="accounts")),
    path("candidates/", include(("candidates.urls", "candidates"), namespace="candidates")),
    path("jobs/", include(("jobs.urls", "jobs"), namespace="jobs")),
    path("clients/", include(("clients.urls", "clients"), namespace="clients")),
    path("vendors/", include(("vendors.urls", "vendors"), namespace="vendors")),
    path("submissions/", include(("submissions.urls", "submissions"), namespace="submissions")),
    path("notifications/", include(("notifications.urls", "notifications"), namespace="notifications")),
    path("reports/", include(("reports.urls", "reports"), namespace="reports")),
    path("settings/", include(("settings_app.urls", "settings_app"), namespace="settings_app")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
