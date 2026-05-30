# Tru Hyre

**An Allianz HR Platform — Project by Kris**

A mobile-first HR & recruitment platform: candidates, jobs, clients, vendors,
resume intake, candidate submissions, status tracking, feedback, notifications,
and reporting.

> **Status:** rebuilding on Next.js 15 + Vercel. The previous Django version
> is preserved on the [`archive/django-v1`](https://github.com/captainrobert07/Tru-Hyre/tree/archive/django-v1) branch.

---

## Stack

- **Next.js 15** — App Router, React Server Components, Server Actions
- **TypeScript** — strict mode
- **Auth.js v5** — credentials (email + password), role in JWT
- **Drizzle ORM** + **Vercel Postgres** — typed schema, edge-compatible
- **Vercel Blob** — resume PDFs and generated client packets
- **Tailwind CSS** + **shadcn/ui** — Apple-grade design system
- **unpdf** — PDF text extraction (pure JS, edge-compatible)
- **@react-pdf/renderer** — sanitized client packet generation
- **Resend** — transactional email
- **Zod** — input validation
- **Playwright** — end-to-end QA harness

---

## Roles & seeded users

| Role            | Email                  | Lands on                      |
| --------------- | ---------------------- | ----------------------------- |
| Admin           | `admin@truhyre.app`    | Admin dashboard (all modules) |
| HR / Recruiter  | `hr@truhyre.app`       | Recruiting workspace          |
| Client          | `client@truhyre.app`   | Client portal (sanitized)     |
| Vendor          | `vendor@truhyre.app`   | Vendor portal                 |

Initial password for all four: **`Kris@35193`** (change after first login).

---

## Local setup

```bash
# 1. Node 20+
nvm use

# 2. Install
pnpm install

# 3. Configure env
cp .env.example .env.local
# Fill in POSTGRES_URL, BLOB_READ_WRITE_TOKEN, AUTH_SECRET (openssl rand -base64 32)

# 4. Migrate + seed
pnpm db:push
pnpm db:seed

# 5. Run
pnpm dev
```

Open http://localhost:3000/ — you'll be redirected to the login page.

---

## Deploy (Vercel)

1. Push to GitHub.
2. Vercel → **New Project** → import this repo.
3. **Storage** tab → create a Postgres DB and a Blob store. Vercel auto-injects
   `POSTGRES_URL` and `BLOB_READ_WRITE_TOKEN`.
4. **Environment Variables** → add `AUTH_SECRET` (generate with `openssl rand -base64 32`).
5. First build runs `pnpm db:push` and `pnpm db:seed` automatically.
6. Open the deploy URL → log in with seeded creds → **change the password immediately**.

---

## Project layout

```
app/                Next.js App Router routes
  (auth)/           login, signup
  (app)/            authenticated app shell + role-gated sub-routes
  api/              route handlers (webhooks, file uploads)
components/         shadcn/ui + custom primitives
db/                 Drizzle schema, migrations, seed
lib/                auth, blob, email, pdf, audit, rbac helpers
```

---

## Security & data hygiene

- Custom RBAC via Auth.js JWT roles + middleware.
- Client portal hides PII (no email, no phone, no vendor name, no internal notes).
- Vendors only see their own candidates and assigned jobs.
- Resume originals stored privately in Vercel Blob; only HR/admin can download.
- Client packets generated server-side; exclude email, phone, vendor name, notes.
- Audit log is append-only.

---

© Tru Hyre. An Allianz HR Platform — Project by Kris.
