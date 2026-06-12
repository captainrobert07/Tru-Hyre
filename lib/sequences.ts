import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sequenceEnrollments, candidates, emailTemplates, emailOutbox } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderTemplate, type TemplateContext } from "@/lib/email-templates";
import { APP_NAME } from "@/lib/utils";

/**
 * Drip email sequences. Definitions live here in code (the catalogue); per-
 * candidate progress lives in the sequence_enrollments table. The daily cron
 * calls processDueSequenceSteps() to send the next due step and advance.
 *
 * Each step references an email template slug + a delay (days) from the prior
 * step. Step 0 sends immediately on enrollment (nextRunAt = now).
 */

export type SequenceStep = { templateSlug: string; delayDays: number };
export type SequenceDef = { key: string; label: string; steps: SequenceStep[] };

export const SEQUENCES: SequenceDef[] = [
  {
    key: "nurture",
    label: "Talent nurture (3 touches)",
    steps: [
      { templateSlug: "stage:hr_review", delayDays: 0 },
      { templateSlug: "stage:screening", delayDays: 7 },
      { templateSlug: "stage:shortlist", delayDays: 14 },
    ],
  },
];

export function getSequence(key: string): SequenceDef | undefined {
  return SEQUENCES.find((s) => s.key === key);
}

function firstName(n: string): string {
  return n.split(/\s+/)[0] || n;
}
function fromAddress(): string {
  return process.env.EMAIL_FROM || process.env.GMAIL_USER || "noreply@truhyre.app";
}

/**
 * Send any due sequence steps (status=active, nextRunAt<=now). Returns count
 * of steps sent. Bounded by `limit` enrollments per run.
 */
export async function processDueSequenceSteps(limit = 100): Promise<number> {
  const due = await db
    .select()
    .from(sequenceEnrollments)
    .where(and(eq(sequenceEnrollments.status, "active"), sql`${sequenceEnrollments.nextRunAt} <= now()`))
    .limit(limit);

  let sent = 0;
  for (const enr of due) {
    const seq = getSequence(enr.sequenceKey);
    if (!seq || enr.stepIndex >= seq.steps.length) {
      await db.update(sequenceEnrollments).set({ status: "done", updatedAt: new Date() }).where(eq(sequenceEnrollments.id, enr.id));
      continue;
    }
    const step = seq.steps[enr.stepIndex];
    const cand = (await db.select().from(candidates).where(eq(candidates.id, enr.candidateId)))[0];
    const [tmpl] = await db.select().from(emailTemplates).where(eq(emailTemplates.slug, step.templateSlug)).limit(1);

    if (cand?.email && tmpl) {
      const ctx: TemplateContext = {
        candidate: { fullName: cand.fullName, firstName: firstName(cand.fullName), email: cand.email, refId: cand.refId },
        stage: { from: "", to: cand.stage },
        recruiter: { fullName: APP_NAME, email: fromAddress() },
        job: { title: "" },
        appName: APP_NAME,
      };
      const subject = renderTemplate(tmpl.subject, ctx, "text");
      const bodyText = renderTemplate(tmpl.bodyText, ctx, "text");
      const bodyHtml = renderTemplate(tmpl.bodyHtml, ctx, "html");
      const r = await sendEmail({ to: cand.email, subject, text: bodyText, html: bodyHtml });
      await db.insert(emailOutbox).values({
        candidateId: cand.id,
        templateSlug: `sequence:${seq.key}`,
        toEmail: cand.email,
        fromEmail: fromAddress(),
        subject, bodyHtml, bodyText,
        status: r.delivered ? "sent" : "failed",
        error: r.delivered ? null : (r.reason || "unknown"),
        sentAt: r.delivered ? new Date() : null,
      });
      if (r.delivered) sent++;
    }

    // Advance to the next step (or finish).
    const nextIndex = enr.stepIndex + 1;
    if (nextIndex >= seq.steps.length) {
      await db.update(sequenceEnrollments).set({ status: "done", stepIndex: nextIndex, updatedAt: new Date() }).where(eq(sequenceEnrollments.id, enr.id));
    } else {
      const delay = seq.steps[nextIndex].delayDays;
      await db
        .update(sequenceEnrollments)
        .set({ stepIndex: nextIndex, nextRunAt: sql`now() + (${delay} || ' days')::interval`, updatedAt: new Date() })
        .where(eq(sequenceEnrollments.id, enr.id));
    }
  }
  return sent;
}
