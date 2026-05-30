import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { clientAccounts, clientContacts, jobs } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader, JobStatusBadge, Badge, ListRow, EmptyState } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Avatar } from "@/components/avatar";
import { RecentTracker } from "@/components/recently-viewed";
import { addContactAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const clientId = Number(id);
  const c = (await db.select().from(clientAccounts).where(eq(clientAccounts.id, clientId)))[0];
  if (!c) notFound();
  const [contacts, jobRows] = await Promise.all([
    db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientAccountId, clientId))
      .orderBy(desc(clientContacts.isPrimary), desc(clientContacts.createdAt)),
    db
      .select({ id: jobs.id, title: jobs.title, status: jobs.status, location: jobs.location })
      .from(jobs)
      .where(eq(jobs.clientAccountId, clientId))
      .orderBy(desc(jobs.createdAt)),
  ]);

  return (
    <>
      <RecentTracker kind="client" label={c.name} />
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/clients", label: "Clients" },
          { label: c.name },
        ]}
      />
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            <Avatar name={c.name} size="lg" />
            {c.name}
          </span>
        }
        subtitle={c.industry || undefined}
        actions={<Link href={`/clients/${c.id}/edit`} className="btn-ghost">Edit</Link>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Section title="Profile">
            <Field label="Website">
              {c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{c.website}</a> : "—"}
            </Field>
            <Field label="Primary contact">{c.primaryContactName || "—"}</Field>
            <Field label="Email">{c.primaryContactEmail || "—"}</Field>
            <Field label="Phone">{c.primaryContactPhone || "—"}</Field>
            {c.notes && (
              <div className="pt-3 border-t border-hairline mt-3">
                <div className="text-xs text-ink-muted uppercase tracking-wide mb-1">Notes</div>
                <p className="text-sm whitespace-pre-line">{c.notes}</p>
              </div>
            )}
          </Section>

          <Section title="Jobs">
            {jobRows.length === 0 ? (
              <EmptyState title="No jobs yet" cta={{ href: "/jobs/new", label: "New job" }} />
            ) : (
              <div className="-mx-4 -mb-4 divide-y divide-hairline">
                {jobRows.map((j) => (
                  <ListRow
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    primary={j.title}
                    secondary={j.location || "—"}
                    trailing={<JobStatusBadge status={j.status} />}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Contacts">
            {contacts.length === 0 ? (
              <div className="text-sm text-ink-soft">None.</div>
            ) : (
              <ul className="text-sm divide-y divide-hairline -mx-1">
                {contacts.map((ct) => (
                  <li key={ct.id} className="px-1 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{ct.name}</span>
                      {ct.isPrimary && <Badge tone="green" className="h-5 px-1.5 text-[10px]">Primary</Badge>}
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {[ct.title, ct.email, ct.phone].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Add contact">
            <form action={addContactAction.bind(null, clientId)} className="space-y-2">
              <input name="name" placeholder="Name" required className="input text-sm" />
              <input name="title" placeholder="Title" className="input text-sm" />
              <input name="email" type="email" placeholder="Email" className="input text-sm" />
              <input name="phone" placeholder="Phone" className="input text-sm" />
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" name="isPrimary" value="true" /> Primary
              </label>
              <button className="btn-primary text-xs w-full" type="submit">Add contact</button>
            </form>
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm">
      <div className="text-ink-muted text-xs uppercase tracking-wide pt-0.5">{label}</div>
      <div className="col-span-2 text-ink truncate">{children}</div>
    </div>
  );
}
