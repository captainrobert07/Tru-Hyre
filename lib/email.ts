import nodemailer from "nodemailer";
import { getIntegration } from "@/lib/integrations";

export type SendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendResult = { delivered: boolean; reason?: string; id?: string };

// Resolve Gmail SMTP config from admin Integrations (DB) → env fallback.
async function resolveGmail(): Promise<{ user?: string; pass?: string; from: string }> {
  const r = await getIntegration("gmail");
  const user = r.values.user;
  const pass = r.values.appPassword?.replace(/\s/g, "");
  const from = r.values.from || (user ? `Tru Hyre Recruitment <${user}>` : "Tru Hyre <noreply@truhyre.app>");
  return { user, pass, from };
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const { user, pass, from } = await resolveGmail();
  if (!user || !pass) {
    console.log("[email] (dev) skipping send →", { to: input.to, subject: input.subject });
    return { delivered: false, reason: "no_smtp_credentials" };
  }
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 8_000,
    socketTimeout: 8_000,
  });

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { delivered: true, id: info.messageId };
  } catch (e) {
    // Log full error server-side; return a coarse reason so SMTP error
    // strings (which can include "Username and Password not accepted")
    // never reach toasts or audit_log.meta.
    console.error("[email] gmail send threw", (e as Error).message);
    const code = (e as { code?: string }).code || "exception";
    return { delivered: false, reason: `smtp_${code}` };
  }
}

export function inviteEmail({
  appName,
  inviteeEmail,
  role,
  inviteUrl,
}: {
  appName: string;
  inviteeEmail: string;
  role: string;
  inviteUrl: string;
}) {
  return {
    subject: `${appName}: you've been invited as ${role}`,
    text:
      `Hi,\n\nYou've been invited to join ${appName} as ${role}.\n\n` +
      `Activate your account here:\n${inviteUrl}\n\n` +
      `This invitation expires in 7 days. If you didn't expect this email, ignore it.\n\n` +
      `— ${appName}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Inter,sans-serif;color:#0f172a;max-width:480px;margin:0 auto;padding:24px">
        <h1 style="font-size:20px;margin:0 0 6px">You've been invited to ${appName}</h1>
        <p style="color:#475569;font-size:14px;margin:0 0 18px">Role: <strong>${role}</strong></p>
        <p style="font-size:14px;margin:0 0 18px">Activate your account to set a password and start using ${appName}.</p>
        <p style="margin:0 0 24px"><a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:500">Accept invitation</a></p>
        <p style="font-size:12px;color:#94a3b8;margin:0">If the button doesn't work, copy this link:<br/><span style="word-break:break-all">${inviteUrl}</span></p>
        <p style="font-size:12px;color:#94a3b8;margin:24px 0 0">This invitation for ${inviteeEmail} expires in 7 days.</p>
      </div>
    `,
  };
}
