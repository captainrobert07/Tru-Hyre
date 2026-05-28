from django.urls import path

from . import views

urlpatterns = [
    path("", views.job_list, name="list"),
    path("new/", views.job_create, name="create"),
    path("<int:pk>/", views.job_detail, name="detail"),
    path("<int:pk>/edit/", views.job_edit, name="edit"),
]
