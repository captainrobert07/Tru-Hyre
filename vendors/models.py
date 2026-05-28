from django.db import models
from django.db.models import Avg, Count, Q


class VendorAccount(models.Model):
    name = models.CharField(max_length=200, unique=True)
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=40, blank=True)
    country = models.CharField(max_length=80, blank=True)
    website = models.URLField(blank=True)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def quality_snapshot(self):
        """Compute submissions / duplicate / interview / offer counts for the vendor."""
        from candidates.models import Candidate

        agg = Candidate.objects.filter(vendor=self).aggregate(
            total=Count("id"),
            duplicates=Count("id", filter=Q(duplicate_status="duplicate")),
            interviews=Count("id", filter=Q(stage="interview")),
            offers=Count("id", filter=Q(stage="offer")),
            joins=Count("id", filter=Q(stage="joined")),
        )
        return agg
