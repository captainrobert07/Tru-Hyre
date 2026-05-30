type SendInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SendResult = { delivered: boolean; reason?: string; id?: string };

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Tru Hyre <noreply@truhyre.app>";

  if (!apiKey) {
    console.log("[email] (dev) skipping send →", { to: input.to, subject: input.subject });
    return { delivered: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] resend error", res.status, body.slice(0, 400));
      return { delivered: false, reason: `resend_${res.status}` };
    }
    const data = (await res.json()) as { id?: string };
    return { delivered: true, id: data.id };
  } catch (e) {
    console.error("[email] resend threw", (e as Error).message);
    return { delivered: false, reason: "exception" };
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
