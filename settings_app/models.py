from django.db import models


class CompanyProfile(models.Model):
    """Singleton: branding/company-wide settings."""
    name = models.CharField(max_length=200, default="Tru Hyre")
    tagline = models.CharField(max_length=200, default="An Allianz HR Platform - Project by Kris")
    address = models.CharField(max_length=300, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    logo = models.FileField(upload_to="branding/", blank=True, null=True)

    # Resume parsing toggles
    enable_pdf_parsing = models.BooleanField(default=True)
    enable_ocr = models.BooleanField(default=False)
    enable_ai_parsing = models.BooleanField(default=False)

    # Email/storage settings (display-only — actual values come from .env)
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Company profile"
        verbose_name_plural = "Company profile"

    def __str__(self):
        return self.name

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Invitation(models.Model):
    """Pending invite for a Client or Vendor user (admin-driven)."""
    KIND_CHOICES = (("client", "Client"), ("vendor", "Vendor"), ("hr", "HR"))
    email = models.EmailField()
    full_name = models.CharField(max_length=200, blank=True)
    kind = models.CharField(max_length=8, choices=KIND_CHOICES)
    client_account = models.ForeignKey("clients.ClientAccount", null=True, blank=True, on_delete=models.SET_NULL)
    vendor_account = models.ForeignKey("vendors.VendorAccount", null=True, blank=True, on_delete=models.SET_NULL)
    invited_by = models.ForeignKey("accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="invitations_sent")
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Invite · {self.email} ({self.kind})"
