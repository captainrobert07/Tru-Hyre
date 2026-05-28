from django.urls import path

from . import views

urlpatterns = [
    path("", views.submission_list, name="list"),
    path("<int:pk>/", views.submission_detail, name="detail"),
]
