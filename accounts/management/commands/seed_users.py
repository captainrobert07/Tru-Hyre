"""Seed the four canonical Tru Hyre users."""
from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import Role, User
from clients.models import ClientAccount
from vendors.models import VendorAccount


SEED_PASSWORD = "Kris@35193"

SEED_USERS = [
    ("admin@truhyre.app",  "Tru Hyre Admin",     Role.ADMIN,  None,                    None),
    ("hr@truhyre.app",     "Recruiter Demo",     Role.HR,     None,                    None),
    ("client@truhyre.app", "Allianz Hiring Mgr", Role.CLIENT, "Allianz Technology",    None),
    ("vendor@truhyre.app", "Vendor Partner",     Role.VENDOR, None,                    "TalentBridge Staffing"),
]


class Command(BaseCommand):
    help = "Create or refresh the four seeded Tru Hyre users (idempotent)."

    @transaction.atomic
    def handle(self, *args, **options):
        client_acct = ClientAccount.objects.filter(name="Allianz Technology").first()
        if not client_acct:
            client_acct = ClientAccount.objects.create(
                name="Allianz Technology",
                industry="Insurance / Financial Services",
                website="https://www.allianz.com",
                primary_contact_name="Allianz Hiring Manager",
                primary_contact_email="client@truhyre.app",
                primary_contact_phone="+49 89 3800 0",
            )
        vendor_acct = VendorAccount.objects.filter(name="TalentBridge Staffing").first()
        if not vendor_acct:
            vendor_acct = VendorAccount.objects.create(
                name="TalentBridge Staffing",
                contact_name="Vendor Partner",
                contact_email="vendor@truhyre.app",
                contact_phone="+91 80 4000 1234",
                country="India",
            )

        link_map = {
            "Allianz Technology": client_acct,
            "TalentBridge Staffing": vendor_acct,
        }

        for email, name, role, client_name, vendor_name in SEED_USERS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"full_name": name, "role": role},
            )
            user.full_name = name
            user.role = role
            user.is_active = True
            user.is_staff = (role == Role.ADMIN)
            user.is_superuser = (role == Role.ADMIN)
            user.client_account = link_map.get(client_name)
            user.vendor_account = link_map.get(vendor_name)
            user.set_password(SEED_PASSWORD)
            user.save()
            verb = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{verb}: {email} ({role})"))

        self.stdout.write(self.style.SUCCESS("\nAll seeded users are ready. Initial password: Kris@35193"))
