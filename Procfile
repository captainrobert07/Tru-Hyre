release: python manage.py migrate --noinput && python manage.py seed_users
web: gunicorn truhyre.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 60
