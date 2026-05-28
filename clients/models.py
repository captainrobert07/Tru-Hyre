from django.db import models


class ClientAccount(models.Model):
    name = models.CharField(max_length=200, unique=True)
    industry = models.CharField(max_length=120, blank=True)
    website = models.URLField(blank=True)
    address = models.CharField(max_length=300, blank=True)
    primary_contact_name = models.CharField(max_length=200, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ClientContact(models.Model):
    client = models.ForeignKey(ClientAccount, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=200)
    title = models.CharField(max_length=120, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    is_primary = models.BooleanField(default=False)
    notes = models.CharField(max_length=300, blank=True)

    class Meta:
        ordering = ["-is_primary", "name"]

    def __str__(self):
        return f"{self.name} ({self.client.name})"
