from django.urls import path

from . import views

urlpatterns = [
    path("", views.vendor_list, name="list"),
    path("new/", views.vendor_create, name="create"),
    path("portal/", views.vendor_portal, name="portal"),
    path("portal/jobs/", views.vendor_jobs, name="jobs"),
    path("portal/submissions/", views.vendor_submissions, name="submissions"),
    path("portal/upload/", views.vendor_upload, name="upload"),
    path("<int:pk>/", views.vendor_detail, name="detail"),
    path("<int:pk>/edit/", views.vendor_edit, name="edit"),
]
