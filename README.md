# Tru Hyre

**An Allianz HR Platform — Project by Kris**

A mobile-first SaaS HR & recruitment platform for managing candidates, jobs,
clients, vendors, resume intake, candidate submissions, status tracking,
feedback, notifications, and reporting.

Built with Django 5, hand-rolled Tailwind-compatible CSS, HTMX + Alpine.js,
SQLite by default (Postgres-ready).

---

## Roles & seeded users

Four roles, each with a dedicated workspace after login:

| Role            | Email                  | Lands on                    |
| --------------- | ---------------------- | --------------------------- |
| Admin           | `admin@truhyre.app`    | Admin dashboard (all modules) |
| HR / Recruiter  | `hr@truhyre.app`       | Recruiting workspace        |
| Client          | `client@truhyre.app`   | Client portal (sanitized)   |
| Vendor          | `vendor@truhyre.app`   | Vendor portal               |

Initial password for all four: **`Kris@35193`** (change after first login).

Auth is email + password only. The first screen the app shows is the login page.

---

## Modules

1. **Dashboard / Pipeline** — stage counts, recent submissions, pending feedback, vendor queue, notifications.
2. **Candidates** — directory, resume upload (PDF), parsing, duplicate detection, stage history, notes.
3. **Jobs** — CRUD, vendor assignment, owner, priority, status (Open / Hold / Closing / Closed), pipeline counts.
4. **Clients** — internal admin + client portal with sanitized candidate packets and feedback (Shortlist / Reject / Interview / Hold).
5. **Vendors** — internal admin + vendor portal showing assigned jobs and own submissions.
6. **Submissions** — internal view of who-was-submitted-where with feedback timeline.
7. **Notifications** — in-app + optional email; per-event kinds (stage change, feedback, packet, duplicate, etc.).
8. **Reports** — resume volume, conversion ratios, vendor quality, HR productivity, daily volume chart.
9. **Settings** — user management, role assignment, invitations, company profile, parsing toggles, audit log.

---

## Resume workflow

1. HR or vendor uploads a PDF resume via `/candidates/upload/`.
2. The original is stored privately (`media/resumes/`); only HR/admin can download it.
3. `pdfplumber` extracts text → regex/heuristics derive name, email, phone, skills, summary, location, current title/company.
4. Duplicate detection: exact email, last-10-digit phone match, full-text SHA-256 hash, fuzzy name match.
5. Candidate lands at stage **HR Review** with `parse_status=ok` (or `failed` with an error message).
6. HR opens the candidate, edits/cleans fields, then clicks **Generate client packet** → `reportlab` renders a sanitized PDF.
7. The client-safe packet **excludes** email, phone, vendor name, and internal notes — it includes name, location, title, summary, skills, KPIs (experience, notice, current/expected CTC), and a Tru Hyre reference ID.
8. HR submits the packet to a client → status moves to **Submitted**, client portal users get notified.
9. Client opens the submission and acts: **Shortlist / Reject / Interview / Hold** (or moves to Offer / Joined later). Feedback logs to `FeedbackEvent`, notifies HR.
10. Stage transitions are recorded in `StageHistory`.

---

## Local setup

```bash
# 1. Clone
git clone https://github.com/captainrobert07/Tru-Hyre.git
cd Tru-Hyre

# 2. (Optional) virtualenv
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# 3. Install deps
pip install -r requirements.txt

# 4. Configure env
cp .env.example .env
# Edit .env — at minimum set DJANGO_SECRET_KEY for non-DEBUG runs.

# 5. Migrate + seed
python manage.py migrate
python manage.py seed_users

# 6. Run
python manage.py runserver
```

Open http://127.0.0.1:8000/ — you'll be redirected to the login page.

### Optional: real email

Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` in `.env` and
populate `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
`EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`. Default is the console backend.

### Optional: Postgres

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
```

`psycopg[binary]` is installed; settings parses `DATABASE_URL` automatically.

---

## Deploy

> **TL;DR.** Tru Hyre is a stateful Django app with file uploads, sessions, and a relational DB. Deploy it on **Render** (one-click via the included `render.yaml`). **Railway**, **Fly.io**, and any Docker target also work. Vercel/serverless is **not supported** — read-only filesystem and ephemeral storage break uploads, sessions, and migrations.

### Render (recommended) — step-by-step

The repo ships a `render.yaml` blueprint that provisions a web service + managed Postgres in one click.

**1. Push the repo to GitHub** (already done if you cloned this from `captainrobert07/Tru-Hyre`).

**2. Create the blueprint on Render**
   - Go to https://dashboard.render.com → **New +** → **Blueprint**
   - Connect your GitHub account, pick the `Tru-Hyre` repo
   - Render reads `render.yaml` and shows: 1 web service (`tru-hyre`) + 1 Postgres DB (`tru-hyre-db`)
   - Click **Apply**

**3. Watch the build**
   - Render runs `pip install -r requirements.txt` → `collectstatic` → `migrate` → `seed_users` automatically
   - First build takes ~3-5 minutes (free tier)
   - When status flips to **Live**, your app is at `https://tru-hyre.onrender.com` (or whatever subdomain Render assigned)

**4. Log in**
   - Visit `https://<your-subdomain>.onrender.com/auth/login/`
   - Use any of the four seeded accounts (see [Roles & seeded users](#roles--seeded-users) above)
   - **Immediately change the seed password under Settings → Users.**

**5. (Optional) Wire real email**
   - Render → service → **Environment** tab → add `EMAIL_BACKEND=smtp` plus the `EMAIL_HOST`/`EMAIL_PORT`/etc. from the env-var table below
   - Save → Render redeploys automatically

**Required env vars** (Render auto-fills the starred ones from `render.yaml`):

| Variable | Required | Notes |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` ★ | yes | auto-generated by Render |
| `DJANGO_DEBUG` ★ | yes | `False` in production |
| `DJANGO_ALLOWED_HOSTS` ★ | yes | `.onrender.com` works for default subdomain |
| `DATABASE_URL` ★ | yes | injected from the managed Postgres |
| `PYTHON_VERSION` ★ | yes | `3.12.7` |
| `EMAIL_BACKEND` | optional | `smtp` for real email |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `EMAIL_USE_TLS` | optional | only when `EMAIL_BACKEND=smtp` |
| `DEFAULT_FROM_EMAIL` | optional | `Tru Hyre <noreply@yourdomain>` |

**Free-tier caveats.** Render's free web service spins down after 15 minutes of inactivity (first request after sleep takes ~30s). The free Postgres expires after 90 days — upgrade to a paid plan or back up via `pg_dump` before then. Resume uploads land on the service's local disk and are wiped on every redeploy; for durable file storage, attach a Render persistent disk or wire S3.

### Railway

1. New Project → Deploy from GitHub → pick the repo.
2. Railway uses `railway.toml` + `nixpacks.toml`. Add a Postgres plugin; Railway injects `DATABASE_URL`.
3. Set `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS=.up.railway.app`. Deploy.

### Fly.io / Docker / any container host

```bash
fly launch                       # uses the included Dockerfile
fly postgres create              # provision Postgres
fly postgres attach <db-name>    # injects DATABASE_URL
fly secrets set DJANGO_SECRET_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(50))") \
                DJANGO_DEBUG=False \
                DJANGO_ALLOWED_HOSTS=.fly.dev
fly deploy
```

The `Dockerfile` at the repo root runs `migrate` + `seed_users` + `gunicorn` on every container start.

---

## Tech stack

- **Backend:** Django 5.x, Python 3.11+ (tested on 3.14)
- **Auth:** custom `accounts.User` model, email-as-username, `EmailBackend` (case-insensitive)
- **DB:** SQLite default; `DATABASE_URL` parsed for Postgres in production
- **Static:** WhiteNoise + hand-rolled Tailwind-compatible CSS in `static/css/tailwind.css` (no Node build step)
- **JS:** HTMX + Alpine.js loaded via CDN with `defer`
- **Files:** `media/` for development; `FILE_STORAGE_BACKEND` env hook for cloud storage
- **PDF parsing:** `pdfplumber` (pure Python). OCR + AI parsing flagged in CompanyProfile, integration left as future work.
- **PDF generation:** `reportlab` for client packets
- **Audit:** `core.AuditLog` written via thread-local middleware, viewable under Settings → Audit log

---

## Project layout

```
truhyre/         project settings + root urls
accounts/        custom User, role decorators, email-backend auth, login
core/            home routing, dashboards, audit log, nav config, middleware
candidates/      Candidate, ResumeFile, ClientPacket, parsing, duplicates, packet PDF
jobs/            Job model + CRUD
clients/         ClientAccount, contacts, internal admin + client portal
vendors/         VendorAccount, internal admin + vendor portal, quality snapshot
submissions/     Submission + FeedbackEvent
notifications/   Notification model + fanout service
reports/         analytics views & queries
settings_app/    company profile, invitations, admin settings UI
templates/       all templates, organised by app
static/css/      hand-rolled utility CSS (Tailwind-compatible subset)
```

---

## Security & data hygiene

- Custom RBAC via `accounts.decorators` (`admin_required`, `staff_required`, `client_required`, `vendor_required`).
- Client portal hides PII (no email, no phone, no vendor name, no internal notes); even if a client guesses a candidate URL they're redirected.
- Vendors only see their own candidates and assigned jobs.
- Resume originals are gated behind `download_resume` which forbids client role.
- Client packets are generated server-side and stored separately from originals.
- Audit log is append-only; every consequential action calls `core.audit.log(...)` and records actor, action, target, summary, and IP.
- `DEBUG=False` enables HSTS, secure cookies, and `X-Content-Type-Options` in production.

---

## Roadmap (intentionally not built)

- OCR for image-only PDFs (toggle present, integration TBD)
- AI-assisted resume parsing (LLM hook)
- SSO / SAML
- Cloud storage adapter for resumes & packets
- Bulk import / CSV exports
- Real-time pipeline updates via HTMX SSE

---

© Tru Hyre. An Allianz HR Platform — Project by Kris.
