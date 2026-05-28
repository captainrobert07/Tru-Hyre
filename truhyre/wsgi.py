"""WSGI config for truhyre project."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "truhyre.settings")
application = get_wsgi_application()
# Vercel's @vercel/python looks for `app`; gunicorn/Heroku/Render use `application`.
app = application
