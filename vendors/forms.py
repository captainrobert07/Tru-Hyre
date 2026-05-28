from django import forms

from .models import VendorAccount


class _Mix:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in self.fields.values():
            w = f.widget
            if not isinstance(w, (forms.CheckboxInput, forms.FileInput)):
                w.attrs["class"] = (w.attrs.get("class", "") + " input").strip()


class VendorAccountForm(_Mix, forms.ModelForm):
    class Meta:
        model = VendorAccount
        fields = ["name", "contact_name", "contact_email", "contact_phone", "country", "website", "notes", "is_active"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 3})}
