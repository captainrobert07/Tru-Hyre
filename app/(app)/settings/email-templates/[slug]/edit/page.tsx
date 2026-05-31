import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireStaff } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { TEMPLATE_VARIABLES } from "@/lib/email-templates";
import { TemplateEditor } from "./template-editor";
import { CopyableToken } from "./copyable-token";

export const dynamic = "force-dynamic";

export default async function EditEmailTemplate({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireStaff();
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  const [tmpl] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, decodedSlug))
    .limit(1);
  if (!tmpl) notFound();

  return (
    <>
      <div className="text-xs text-ink-soft mb-2">
        <Link href="/settings" className="hover:text-ink">Settings</Link>
        {" / "}
        <Link href="/settings/email-templates" className="hover:text-ink">Email templates</Link>
        {" / "}
        <span className="text-ink">{tmpl.name}</span>
      </div>

      <PageHeader
        title={tmpl.name}
        subtitle={`Slug: ${tmpl.slug}`}
        actions={
          <Link href="/settings/email-templates" className="btn-ghost text-xs">
            ← All templates
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mt-2">
        <TemplateEditor
          slug={tmpl.slug}
          initialSubject={tmpl.subject}
          initialBodyText={tmpl.bodyText}
          initialBodyHtml={tmpl.bodyHtml}
          initialIsActive={tmpl.isActive}
        />

        <aside className="space-y-4">
          <div className="card p-4">
            <div className="text-xs font-semibold mb-2">Variables</div>
            <p className="text-[11px] text-ink-muted mb-3">Click to copy. Drop into the subject or body.</p>
            <ul className="space-y-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <li key={v.token}>
                  <CopyableToken token={v.token} description={v.description} />
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
