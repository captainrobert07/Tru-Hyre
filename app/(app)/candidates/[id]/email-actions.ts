"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, emailTemplates, emailOutbox } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderTemplate, type TemplateContext } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";
import { requireStaff } from "@/lib/rbac";
import { APP_NAME } from "@/lib/utils";

const schema = z.object({
  // Either a template slug to render, or a custom subject+body.
  templateSlug: z.string().max(64).optional().or(z.literal("")),
  subject: z.string().max(240).optional().or(z.literal("")),
  body: z.string().max(8000).optional().or(z.literal("")),
});

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}

function fromAddress(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.GMAIL_USER) return process.env.GMAIL_USER;
  return "noreply@truhyre.app";
}

function textToHtml(text: string): string {
  const esc = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,sans-serif;color:#0f172a;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc}</div>`;
}

/**
 * Send a one-off email to a candidate — either from a chosen template (rendered
 * with the candidate's context) or a custom subject/body the recruiter typed.
 * Always logged to emailOutbox (so it shows on the comms timeline) and audited.
 */
export async function sendAdHocEmailAction(
  candidateId: number,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireStaff();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const v = parsed.data;

  const cand = (await db.select().from(candidates).where(eq(candidates.id, candidateId)))[0];
  if (!cand) return { ok: false, error: "Candidate not found." };
  if (!cand.email) return { ok: false, error: "This candidate has no email address." };

  const ctx: TemplateContext = {
    candidate: {
      fullName: cand.fullName,
      firstName: firstName(cand.fullName),
      email: cand.email,
      refId: cand.refId,
    },
    stage: { from: "", to: cand.stage },
    recruiter: { fullName: user.fullName, email: user.email },
    job: { title: "" },
    appName: APP_NAME,
  };

  let subject: string;
  let bodyHtml: string;
  let bodyText: string;
  let slug: string;

  if (v.templateSlug) {
    const [tmpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.slug, v.templateSlug)).limit(1);
    if (!tmpl) return { ok: false, error: "Template not found." };
    subject = renderTemplate(tmpl.subject, ctx, "text");
    bodyText = renderTemplate(tmpl.bodyText, ctx, "text");
    bodyHtml = renderTemplate(tmpl.bodyHtml, ctx, "html");
    slug = `adhoc:${tmpl.slug}`;
  } else {
    const subj = (v.subject || "").trim();
    const text = (v.body || "").trim();
    if (subj.length < 2 || text.length < 2) return { ok: false, error: "Add a subject and a message." };
    // Render tokens in custom text too, so {{candidate.firstName}} still works.
    subject = renderTemplate(subj, ctx, "text");
    bodyText = renderTemplate(text, ctx, "text");
    bodyHtml = textToHtml(renderTemplate(text, ctx, "text"));
    slug = "adhoc:custom";
  }

  const result = await sendEmail({ to: cand.email, subject, text: bodyText, html: bodyHtml });

  await db.insert(emailOutbox).values({
    candidateId,
    templateSlug: slug,
    toEmail: cand.email,
    fromEmail: fromAddress(),
    subject,
    bodyHtml,
    bodyText,
    status: result.delivered ? "sent" : "failed",
    error: result.delivered ? null : (result.reason || "unknown"),
    sentAt: result.delivered ? new Date() : null,
    triggeredById: Number(user.id),
  });

  await logAudit({
    actorId: Number(user.id),
    actorEmail: user.email,
    action: "email_send",
    targetType: "candidate",
    targetId: candidateId,
    summary: `Sent ad-hoc email "${subject}" → ${cand.email} (${result.delivered ? "sent" : "failed"})`,
    meta: { slug, delivered: result.delivered, reason: result.reason },
  });

  revalidatePath(`/candidates/${candidateId}`);
  if (!result.delivered) {
    return { ok: false, error: `Saved to outbox but delivery failed (${result.reason}). Check SMTP settings.` };
  }
  return { ok: true };
}
