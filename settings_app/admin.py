from django.contrib import admin

from .models import CompanyProfile, Invitation


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_email", "updated_at")


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("email", "kind", "accepted", "created_at", "invited_by")
    list_filter = ("kind", "accepted")
    search_fields = ("email", "full_name")
