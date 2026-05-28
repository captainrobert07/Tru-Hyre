from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    ADMIN = "admin", "Admin"
    HR = "hr", "HR / Recruiter"
    CLIENT = "client", "Client"
    VENDOR = "vendor", "Vendor"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, role=Role.HR, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, role=role, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", Role.ADMIN)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.HR)
    phone = models.CharField(max_length=32, blank=True)

    # Optional links to a Client or Vendor account when role is client/vendor.
    client_account = models.ForeignKey(
        "clients.ClientAccount",
        on_delete=models.SET_NULL,
        related_name="users",
        null=True, blank=True,
    )
    vendor_account = models.ForeignKey(
        "vendors.VendorAccount",
        on_delete=models.SET_NULL,
        related_name="users",
        null=True, blank=True,
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    last_login_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["email"]

    def __str__(self):
        return self.full_name or self.email

    @property
    def initials(self):
        if self.full_name:
            parts = [p for p in self.full_name.split() if p]
            if len(parts) >= 2:
                return (parts[0][0] + parts[-1][0]).upper()
            if parts:
                return parts[0][:2].upper()
        return self.email[:2].upper() if self.email else "?"

    @property
    def is_admin(self):
        return self.role == Role.ADMIN

    @property
    def is_hr(self):
        return self.role == Role.HR

    @property
    def is_client(self):
        return self.role == Role.CLIENT

    @property
    def is_vendor(self):
        return self.role == Role.VENDOR
