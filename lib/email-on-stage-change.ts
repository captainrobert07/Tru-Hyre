import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emailTemplates, emailOutbox } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { renderTemplate, type TemplateContext } from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";
import { APP_NAME } from "@/lib/utils";

export type StageEmailInput = {
  candidate: {
    id: number;
    fullName: string;
    email: string | null;
    refId: string;
  };
  fromStage: string | null;
  toStage: string;
  actor: {
    id: number;
    email: string;
    fullName: string;
  };
  jobTitle?: string;
};

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0] || fullName;
}

function fromAddress(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.GMAIL_USER) return process.env.GMAIL_USER;
  return "noreply@truhyre.app";
}

/**
 * Best-effort: never throws into the calling stage action. If the template
 * is missing, inactive, or the candidate has no email, this returns silently
 * (no outbox row, no audit log). Send failures DO get logged to outbox with
 * status="failed" so HR can later re-attempt.
 */
export async function fireStageTransitionEmail(input: StageEmailInput): Promise<void> {
  try {
    if (!input.candidate.email) return;

    const slug = `stage:${input.toStage}`;
    const [tmpl] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.slug, slug))
      .limit(1);

    if (!tmpl || !tmpl.isActive) return;

    const ctx: TemplateContext = {
      candidate: {
        fullName: input.candidate.fullName,
        firstName: firstName(input.candidate.fullName),
        email: input.candidate.email,
        refId: input.candidate.refId,
      },
      stage: { from: input.fromStage || "", to: input.toStage },
      recruiter: { fullName: input.actor.fullName, email: input.actor.email },
      job: { title: input.jobTitle || "" },
      appName: APP_NAME,
    };

    const subject = renderTemplate(tmpl.subject, ctx, "text");
    const bodyText = renderTemplate(tmpl.bodyText, ctx, "text");
    const bodyHtml = renderTemplate(tmpl.bodyHtml, ctx, "html");
    const from = fromAddress();

    const result = await sendEmail({
      to: input.candidate.email,
      subject,
      text: bodyText,
      html: bodyHtml,
    });

    await db.insert(emailOutbox).values({
      candidateId: input.candidate.id,
      templateSlug: slug,
      toEmail: input.candidate.email,
      fromEmail: from,
      subject,
      bodyHtml,
      bodyText,
      status: result.delivered ? "sent" : "failed",
      error: result.delivered ? null : (result.reason || "unknown"),
      sentAt: result.delivered ? new Date() : null,
      triggeredById: input.actor.id,
      fromStage: input.fromStage,
      toStage: input.toStage,
    });

    await logAudit({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: "email_send",
      targetType: "candidate",
      targetId: input.candidate.id,
      summary: `Stage email "${slug}" → ${input.candidate.email} (${result.delivered ? "sent" : "failed"})`,
      meta: {
        slug,
        toStage: input.toStage,
        fromStage: input.fromStage,
        delivered: result.delivered,
        reason: result.reason,
      },
    });
  } catch (e) {
    console.error("[stage-email] threw — swallowing so stage change isn't blocked", (e as Error).message);
  }
}
