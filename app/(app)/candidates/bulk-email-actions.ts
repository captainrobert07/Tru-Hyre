"use server";

import { inArray, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, emailTemplates, emailOutbox } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderTemplate, buildTemplateContext, defaultFromAddress } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { assertFeatureEnabled } from "@/lib/features";
import { APP_NAME } from "@/lib/utils";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
  templateSlug: z.string().min(1).max(64),
});

export async function bulkEmailAction(
  input: unknown,
): Promise<{ ok: true; sent: number; skipped: number } | { ok: false; error: string }> {
  const user = await requireStaff();
  await assertFeatureEnabled("bulk_email");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a template and at least one candidate." };
  const { ids, templateSlug } = parsed.data;

  const [tmpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.slug, templateSlug)).limit(1);
  if (!tmpl) return { ok: false, error: "Template not found." };

  const rows = await db
    .select({ id: candidates.id, fullName: candidates.fullName, email: candidates.email, refId: candidates.refId, stage: candidates.stage })
    .from(candidates)
    .where(inArray(candidates.id, ids));

  let sent = 0;
  let skipped = 0;
  const from = defaultFromAddress();

  // Render + send per recipient (their tokens differ). Each send is independent.
  await Promise.all(
    rows.map(async (c) => {
      if (!c.email) { skipped++; return; }
      const ctx = buildTemplateContext({
        candidate: { fullName: c.fullName, email: c.email, refId: c.refId },
        appName: APP_NAME,
        stageTo: c.stage,
        recruiter: { fullName: user.fullName, email: user.email },
      });
      const subject = renderTemplate(tmpl.subject, ctx, "text");
      const bodyText = renderTemplate(tmpl.bodyText, ctx, "text");
      const bodyHtml = renderTemplate(tmpl.bodyHtml, ctx, "html");
      const r = await sendEmail({ to: c.email, subject, text: bodyText, html: bodyHtml });
      await db.insert(emailOutbox).values({
        candidateId: c.id,
        templateSlug: `bulk:${tmpl.slug}`,
        toEmail: c.email,
        fromEmail: from,
        subject, bodyHtml, bodyText,
        status: r.delivered ? "sent" : "failed",
        error: r.delivered ? null : (r.reason || "unknown"),
        sentAt: r.delivered ? new Date() : null,
        triggeredById: Number(user.id),
      });
      if (r.delivered) sent++; else skipped++;
    }),
  );

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "email_send",
    targetType: "candidate",
    summary: `Bulk emailed "${tmpl.slug}" to ${sent} candidates (${skipped} skipped)`,
    meta: { templateSlug, sent, skipped, total: ids.length },
  });

  revalidatePath("/candidates");
  return { ok: true, sent, skipped };
}
