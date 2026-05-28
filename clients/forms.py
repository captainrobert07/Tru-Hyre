from django import forms

from .models import ClientAccount, ClientContact


class _Mix:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in self.fields.values():
            w = f.widget
            if not isinstance(w, (forms.CheckboxInput, forms.FileInput)):
                w.attrs["class"] = (w.attrs.get("class", "") + " input").strip()


class ClientAccountForm(_Mix, forms.ModelForm):
    class Meta:
        model = ClientAccount
        fields = [
            "name", "industry", "website", "address",
            "primary_contact_name", "primary_contact_email", "primary_contact_phone",
            "notes", "is_active",
        ]
        widgets = {"notes": forms.Textarea(attrs={"rows": 3})}


class ClientContactForm(_Mix, forms.ModelForm):
    class Meta:
        model = ClientContact
        fields = ["name", "title", "email", "phone", "is_primary", "notes"]


class ClientFeedbackForm(_Mix, forms.Form):
    ACTION_CHOICES = [
        ("shortlisted", "Shortlist"),
        ("interview", "Move to interview"),
        ("hold", "Put on hold"),
        ("rejected", "Reject"),
    ]
    action = forms.ChoiceField(choices=ACTION_CHOICES)
    comment = forms.CharField(required=False, widget=forms.Textarea(attrs={"rows": 3}))
