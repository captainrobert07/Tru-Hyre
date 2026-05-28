from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "full_name", "role", "is_active", "last_login_at")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    readonly_fields = ("date_joined", "last_login_at", "last_login")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name", "phone")}),
        ("Role & access", {"fields": ("role", "client_account", "vendor_account", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Activity", {"fields": ("last_login", "last_login_at", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "role", "password1", "password2"),
        }),
    )
