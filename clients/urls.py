from django.urls import path

from . import views

urlpatterns = [
    path("", views.client_list, name="list"),
    path("new/", views.client_create, name="create"),
    path("portal/", views.client_portal, name="portal"),
    path("portal/submissions/", views.client_submissions, name="submissions"),
    path("portal/jobs/", views.client_jobs, name="jobs"),
    path("portal/submission/<int:pk>/", views.client_submission_detail, name="submission_detail"),
    path("<int:pk>/", views.client_detail, name="detail"),
    path("<int:pk>/edit/", views.client_edit, name="edit"),
    path("<int:pk>/contact/", views.add_contact, name="add_contact"),
]
