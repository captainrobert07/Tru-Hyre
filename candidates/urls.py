from django.urls import path

from . import views

urlpatterns = [
    path("", views.candidate_list, name="list"),
    path("new/", views.candidate_create, name="create"),
    path("upload/", views.upload_resume, name="upload"),
    path("<int:pk>/", views.candidate_detail, name="detail"),
    path("<int:pk>/edit/", views.candidate_edit, name="edit"),
    path("<int:pk>/stage/", views.change_stage, name="stage"),
    path("<int:pk>/packet/", views.generate_packet, name="packet"),
    path("<int:pk>/submit/", views.submit_view, name="submit"),
    path("resume/<int:pk>/", views.download_resume, name="download_resume"),
    path("packet/<int:pk>/", views.download_packet, name="download_packet"),
]
