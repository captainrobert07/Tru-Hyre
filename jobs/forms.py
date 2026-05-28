from django import forms

from .models import Job


class _Mix:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in self.fields.values():
            w = f.widget
            if not isinstance(w, (forms.CheckboxInput, forms.CheckboxSelectMultiple, forms.SelectMultiple, forms.FileInput)):
                w.attrs["class"] = (w.attrs.get("class", "") + " input").strip()
            else:
                w.attrs.setdefault("class", "")


class JobForm(_Mix, forms.ModelForm):
    class Meta:
        model = Job
        fields = [
            "title", "client", "role", "location", "is_remote", "openings",
            "budget_min", "budget_max", "budget_currency", "priority", "status",
            "owner", "assigned_vendors", "target_close_date", "description",
        ]
        widgets = {
            "description": forms.Textarea(attrs={"rows": 5}),
            "target_close_date": forms.DateInput(attrs={"type": "date"}),
            "assigned_vendors": forms.CheckboxSelectMultiple(),
        }
