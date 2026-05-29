#!/usr/bin/env bash
# Vercel build step: install deps + collectstatic.
# Migrations and seeding must run separately (see README "Deploy" section)
# because Vercel build runs in a sandbox without DATABASE_URL access.

set -euo pipefail

python3.12 -m pip install --break-system-packages -r requirements.txt
python3.12 manage.py collectstatic --noinput --clear
