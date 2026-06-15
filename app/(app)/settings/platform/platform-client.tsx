"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";
import { createApiKeyAction, revokeApiKeyAction, createWebhookAction, deleteWebhookAction } from "./actions";

export type KeyRow = { id: number; name: string; prefix: string; isActive: boolean; lastUsedAt: string | null };
export type HookRow = { id: number; url: string; events: string[]; isActive: boolean; lastStatus: string | null };

export function ApiKeysCard({ keys, enabled }: { keys: KeyRow[]; enabled: boolean }) {
  const [pending, start] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);

  if (!enabled) return <Disabled label="Read API is disabled. Enable it in Features." />;

  const create = (formData: FormData) => {
    start(async () => {
      const r = await createApiKeyAction(formData);
      if (!r.ok || !r.raw) { toast.error(r.error || "Failed."); return; }
      setNewKey(r.raw);
      toast.success("API key created — copy it now.");
    });
  };
  const revoke = (id: number) => start(async () => { await revokeApiKeyAction(id); toast.success("Revoked."); });

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold mb-3">API keys</h2>
      {newKey && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 mb-3">
          <div className="text-xs text-brand-900 font-medium mb-1">Copy this key now — it won&apos;t be shown again:</div>
          <code className="text-xs break-all">{newKey}</code>
        </div>
      )}
      <form action={create} className="flex gap-2 mb-3">
        <input name="name" placeholder="Key name (e.g. Analytics export)" className="input text-sm" aria-label="API key name" />
        <button type="submit" disabled={pending} className="btn-primary text-xs shrink-0">Create</button>
      </form>
      {keys.length === 0 ? (
        <p className="text-sm text-ink-soft">No keys yet.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{k.name}</div>
                <div className="text-[11px] text-ink-muted font-mono">{k.prefix}… {k.lastUsedAt ? "· used" : "· never used"}</div>
              </div>
              {k.isActive ? (
                <button type="button" disabled={pending} onClick={() => revoke(k.id)} className="text-[11px] text-red-700 hover:underline">Revoke</button>
              ) : (
                <Badge tone="default">revoked</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-ink-muted mt-3">Use as <code>Authorization: Bearer &lt;key&gt;</code> on <code>/api/v1/candidates</code>.</p>
    </section>
  );
}

export function WebhooksCard({ hooks, enabled }: { hooks: HookRow[]; enabled: boolean }) {
  const [pending, start] = useTransition();
  if (!enabled) return <Disabled label="Webhooks are disabled. Enable them in Features." />;

  const create = (formData: FormData) => {
    start(async () => {
      const r = await createWebhookAction(formData);
      if (!r.ok) { toast.error(r.error || "Failed."); return; }
      toast.success("Webhook added.");
    });
  };
  const del = (id: number) => start(async () => { await deleteWebhookAction(id); toast.success("Deleted."); });

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold mb-3">Webhooks</h2>
      <form action={create} className="space-y-2 mb-3">
        <input name="url" placeholder="https://example.com/hook" className="input text-sm" aria-label="Webhook URL" />
        <input name="events" placeholder="candidate.created, candidate.stage_changed, offer.accepted" className="input text-sm" aria-label="Subscribed events (comma-separated)" />
        <input name="secret" placeholder="Shared secret (optional)" className="input text-sm" aria-label="Webhook shared secret" />
        <button type="submit" disabled={pending} className="btn-primary text-xs">Add webhook</button>
      </form>
      {hooks.length === 0 ? (
        <p className="text-sm text-ink-soft">No webhooks configured.</p>
      ) : (
        <ul className="divide-y divide-hairline">
          {hooks.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{h.url}</div>
                <div className="text-[11px] text-ink-muted truncate">{h.events.join(", ")} {h.lastStatus ? `· last: ${h.lastStatus}` : ""}</div>
              </div>
              <button type="button" disabled={pending} onClick={() => del(h.id)} className="text-[11px] text-red-700 hover:underline shrink-0">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Disabled({ label }: { label: string }) {
  return <section className="card p-5 text-sm text-ink-muted">{label}</section>;
}
