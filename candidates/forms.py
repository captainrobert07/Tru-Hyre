from django import forms

from .models import Candidate, CandidateNote, CandidateStage


class _BootstrapMixin:
    """Apply the .input class to every visible widget."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for f in self.fields.values():
            w = f.widget
            css = w.attrs.get("class", "")
            if not isinstance(w, (forms.CheckboxInput, forms.FileInput)):
                w.attrs["class"] = (css + " input").strip()


class ResumeUploadForm(_BootstrapMixin, forms.Form):
    resume = forms.FileField(
        label="Resume (PDF)",
        widget=forms.ClearableFileInput(attrs={"accept": "application/pdf", "class": "input"}),
        help_text="PDF only. Max 10 MB.",
    )
    full_name = forms.CharField(label="Candidate name (optional)", required=False, max_length=200)
    source = forms.CharField(label="Source (optional)", required=False, max_length=80,
                             widget=forms.TextInput(attrs={"placeholder": "LinkedIn, Naukri, …"}))
    vendor = forms.ModelChoiceField(
        label="Vendor (optional)",
        queryset=None, required=False,
    )

    def __init__(self, *args, vendor_locked=None, **kwargs):
        super().__init__(*args, **kwargs)
        from vendors.models import VendorAccount
        self.fields["vendor"].queryset = VendorAccount.objects.filter(is_active=True)
        if vendor_locked is not None:
            self.fields["vendor"].queryset = VendorAccount.objects.filter(pk=vendor_locked.pk)
            self.fields["vendor"].initial = vendor_locked
            self.fields["vendor"].widget = forms.HiddenInput()

    def clean_resume(self):
        f = self.cleaned_data["resume"]
        if f.size > 10 * 1024 * 1024:
            raise forms.ValidationError("File is larger than 10 MB.")
        # PDF magic-byte sanity check.
        head = f.read(5)
        f.seek(0)
        if head[:4] != b"%PDF":
            raise forms.ValidationError("This file does not look like a PDF.")
        return f


class CandidateForm(_BootstrapMixin, forms.ModelForm):
    class Meta:
        model = Candidate
        fields = [
            "full_name", "email", "phone", "location",
            "current_title", "current_company",
            "total_experience_years", "notice_period_days",
            "current_ctc", "expected_ctc", "ctc_currency",
            "skills_csv", "summary",
            "source", "owner", "client", "vendor",
        ]
        widgets = {
            "summary": forms.Textarea(attrs={"rows": 4}),
            "skills_csv": forms.Textarea(attrs={"rows": 2, "placeholder": "Python, Django, AWS, …"}),
        }


class StageChangeForm(_BootstrapMixin, forms.Form):
    stage = forms.ChoiceField(choices=CandidateStage.choices)
    note = forms.CharField(required=False, max_length=300)


class CandidateNoteForm(_BootstrapMixin, forms.ModelForm):
    class Meta:
        model = CandidateNote
        fields = ["body"]
        widgets = {
            "body": forms.Textarea(attrs={"rows": 3, "placeholder": "Add an internal note…"}),
        }


class SubmitToClientForm(_BootstrapMixin, forms.Form):
    job = forms.ModelChoiceField(queryset=None, label="Job / requirement")
    note = forms.CharField(required=False, max_length=300)

    def __init__(self, *args, candidate=None, **kwargs):
        super().__init__(*args, **kwargs)
        from jobs.models import Job, JobStatus
        qs = Job.objects.filter(status__in=[JobStatus.OPEN, JobStatus.CLOSING]).select_related("client")
        if candidate and candidate.client_id:
            qs = qs.filter(client_id=candidate.client_id)
        self.fields["job"].queryset = qs
