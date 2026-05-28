from django import forms

from .models import CompanyProfile, Invitation


class _Mix:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in self.fields.values():
            w = f.widget
            if not isinstance(w, (forms.CheckboxInput, forms.FileInput)):
                w.attrs["class"] = (w.attrs.get("class", "") + " input").strip()


class CompanyProfileForm(_Mix, forms.ModelForm):
    class Meta:
        model = CompanyProfile
        fields = [
            "name", "tagline", "address", "contact_email", "contact_phone",
            "enable_pdf_parsing", "enable_ocr", "enable_ai_parsing", "notes",
        ]
        widgets = {"notes": forms.Textarea(attrs={"rows": 3})}


class InvitationForm(_Mix, forms.ModelForm):
    class Meta:
        model = Invitation
        fields = ["email", "full_name", "kind", "client_account", "vendor_account"]
