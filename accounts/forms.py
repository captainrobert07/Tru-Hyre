from django import forms
from django.contrib.auth.forms import AuthenticationForm

from .models import Role, User


class TruHyreAuthForm(AuthenticationForm):
    """Email + password sign-in form. Email is the username field."""

    username = forms.EmailField(
        label="Email",
        widget=forms.EmailInput(attrs={
            "class": "input",
            "autocomplete": "email",
            "autofocus": True,
            "inputmode": "email",
            "placeholder": "you@company.com",
        }),
    )
    password = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(attrs={
            "class": "input",
            "autocomplete": "current-password",
            "placeholder": "Your password",
        }),
    )

    error_messages = {
        "invalid_login": "Incorrect email or password.",
        "inactive": "This account is disabled. Contact an administrator.",
    }


class UserCreateForm(forms.ModelForm):
    password1 = forms.CharField(
        label="Password",
        widget=forms.PasswordInput(attrs={"class": "input"}),
        min_length=8,
    )
    password2 = forms.CharField(
        label="Confirm password",
        widget=forms.PasswordInput(attrs={"class": "input"}),
    )

    class Meta:
        model = User
        fields = ["email", "full_name", "role", "phone", "client_account", "vendor_account"]
        widgets = {
            "email": forms.EmailInput(attrs={"class": "input"}),
            "full_name": forms.TextInput(attrs={"class": "input"}),
            "role": forms.Select(attrs={"class": "input"}),
            "phone": forms.TextInput(attrs={"class": "input"}),
            "client_account": forms.Select(attrs={"class": "input"}),
            "vendor_account": forms.Select(attrs={"class": "input"}),
        }

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("A user with this email already exists.")
        return email

    def clean(self):
        data = super().clean()
        if data.get("password1") != data.get("password2"):
            raise forms.ValidationError("Passwords do not match.")
        role = data.get("role")
        if role == Role.CLIENT and not data.get("client_account"):
            raise forms.ValidationError("Client users must be linked to a client account.")
        if role == Role.VENDOR and not data.get("vendor_account"):
            raise forms.ValidationError("Vendor users must be linked to a vendor account.")
        return data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data["email"]
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class UserEditForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ["full_name", "role", "phone", "is_active", "client_account", "vendor_account"]
        widgets = {
            "full_name": forms.TextInput(attrs={"class": "input"}),
            "role": forms.Select(attrs={"class": "input"}),
            "phone": forms.TextInput(attrs={"class": "input"}),
            "client_account": forms.Select(attrs={"class": "input"}),
            "vendor_account": forms.Select(attrs={"class": "input"}),
        }
