from django.urls import path

from . import views

urlpatterns = [
    path("", views.settings_home, name="home"),
    path("users/", views.user_list, name="users"),
    path("users/new/", views.user_create, name="user_create"),
    path("users/<int:pk>/edit/", views.user_edit, name="user_edit"),
    path("users/<int:pk>/toggle/", views.user_toggle_active, name="user_toggle"),
    path("invitations/", views.invitation_list, name="invitations"),
    path("invitations/new/", views.invitation_create, name="invitation_create"),
    path("invitations/<int:pk>/revoke/", views.invitation_revoke, name="invitation_revoke"),
    path("company/", views.company_profile, name="company"),
    path("audit/", views.audit_log_view, name="audit_log"),
]
