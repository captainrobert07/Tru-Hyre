"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { renderTemplate, sampleContext } from "@/lib/email-templates";
import { updateTemplateAction, type UpdateResult } from "../../actions";

const APP_NAME = "Tru Hyre";

export function TemplateEditor({
  slug,
  initialSubject,
  initialBodyText,
  initialBodyHtml,
  initialIsActive,
}: {
  slug: string;
  initialSubject: string;
  initialBodyText: string;
  initialBodyHtml: string;
  initialIsActive: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [isActive, setIsActive] = useState(initialIsActive);

  const [state, formAction, pending] = useActionState<UpdateResult | null, FormData>(
    async (prev, fd) => {
      const r = await updateTemplateAction(prev, fd);
      if (r.ok) toast.success("Saved");
      else toast.error(r.error);
      return r;
    },
    null,
  );

  const ctx = sampleContext(APP_NAME);
  const previewSubject = renderTemplate(subject, ctx, "text");
  const previewHtml = renderTemplate(bodyHtml, ctx, "html");
  const previewText = renderTemplate(bodyText, ctx, "text");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-4 accent-emerald-600"
        />
        <span className="font-medium">Active</span>
        <span className="text-ink-muted">
          {isActive
            ? "auto-fires when a candidate moves into this stage"
            : "silent — stage transition will not trigger an email"}
        </span>
      </label>

      <div>
        <label className="block text-[11px] text-ink-soft mb-1">Subject</label>
        <input
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={240}
          required
          className="input w-full text-sm"
        />
        <div className="text-[10px] text-ink-muted mt-1">
          Preview: <span className="text-ink">{previewSubject || <em className="text-ink-muted">(empty)</em>}</span>
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-ink-soft mb-1">Plain-text body</label>
        <textarea
          name="bodyText"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={8}
          maxLength={20_000}
          required
          className="input w-full text-sm font-mono"
        />
      </div>

      <div>
        <label className="block text-[11px] text-ink-soft mb-1">HTML body</label>
        <textarea
          name="bodyHtml"
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          rows={10}
          maxLength={50_000}
          required
          className="input w-full text-sm font-mono"
        />
      </div>

      <div className="card p-4 bg-canvas/40">
        <div className="text-xs font-semibold mb-2">Live preview (sample candidate)</div>
        <div className="text-[10px] text-ink-muted mb-2">Renders with: Priya Sharma · C-2026-001 · screening → interview · Senior Backend Engineer</div>
        <div className="bg-surface border border-hairline rounded-lg p-4 max-h-[260px] overflow-y-auto">
          <div className="text-xs text-ink-soft mb-2">Subject — <span className="text-ink font-medium">{previewSubject}</span></div>
          {/* Safe sink: previewHtml is the admin's OWN authored template body
              (this is an admin-only editor), and renderTemplate(..., "html")
              htmlEscape()s every interpolated {{token}} value — so sample-context
              data can't inject. Same render path as the real outbound email
              (bulk-email / email-actions / stage-change / sequences), which is
              where escaping actually matters. Don't copy this pattern to a sink
              fed by cross-user data. */}
          <div className="text-xs prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
        <details className="mt-2">
          <summary className="text-[11px] text-ink-soft cursor-pointer">Plain-text fallback</summary>
          <pre className="mt-2 text-[11px] whitespace-pre-wrap font-mono bg-surface border border-hairline rounded p-3 max-h-[200px] overflow-y-auto">{previewText}</pre>
        </details>
      </div>

      <div className="flex items-center gap-3 sticky bottom-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary text-sm"
        >
          {pending ? "Saving…" : "Save template"}
        </button>
        {state && !state.ok && <span className="text-xs text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
