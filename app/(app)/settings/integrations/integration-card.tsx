"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/primitives";
import { saveIntegrationAction, testIntegrationAction } from "./actions";

export type FieldView = { key: string; label: string; secret: boolean; placeholder?: string; help?: string; hasValue: boolean; value: string };
export type IntegrationView = {
  key: string;
  label: string;
  category: string;
  description: string;
  status: "stable" | "beta" | "scaffold";
  setupNote?: string;
  enabled: boolean;
  ready: boolean;
  fields: FieldView[];
};

const MASK = "••••••••";

export function IntegrationCard({ integration }: { integration: IntegrationView }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [enabled, setEnabled] = useState(integration.enabled);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const save = (formData: FormData) => {
    start(async () => {
      const r = await saveIntegrationAction(integration.key, formData);
      if (!r.ok) { toast.error(r.error || "Save failed."); return; }
      toast.success(`${integration.label} saved.`);
      setOpen(false);
    });
  };

  const test = () => {
    setTestMsg(null);
    startTest(async () => {
      const r = await testIntegrationAction(integration.key);
      setTestMsg(r);
      if (r.ok) toast.success(`${integration.label}: connected`);
      else toast.error(`${integration.label}: ${r.message}`);
    });
  };

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{integration.label}</span>
            <Badge tone={integration.ready ? "green" : enabled ? "amber" : "default"}>
              {integration.ready ? "Ready" : enabled ? "Enabled · needs keys" : "Off"}
            </Badge>
            {integration.status === "scaffold" && <Badge tone="default">Scaffold</Badge>}
            {integration.status === "beta" && <Badge tone="blue">Beta</Badge>}
          </div>
          <p className="text-xs text-ink-soft mt-1 max-w-xl">{integration.description}</p>
          {integration.status === "scaffold" && integration.setupNote && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 mt-2 max-w-xl">
              ⚙️ {integration.setupNote}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={test} disabled={testing} className="btn-ghost text-xs">
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">
            {open ? "Close" : "Configure"}
          </button>
        </div>
      </div>

      {testMsg && (
        <div className={`mt-2 text-xs rounded-lg px-3 py-2 border ${testMsg.ok ? "bg-brand-50 text-brand-800 border-brand-100" : "bg-red-50 text-red-800 border-red-100"}`}>
          {testMsg.ok ? "✓ " : "✗ "}{testMsg.message}
        </div>
      )}

      {open && (
        <form action={save} className="mt-3 pt-3 border-t border-hairline space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
            <span>Enabled</span>
          </label>
          {integration.fields.map((f) => (
            <div key={f.key}>
              <label htmlFor={`${integration.key}_${f.key}`} className="label">
                {f.label} {f.secret && <span className="text-ink-muted font-normal">(secret)</span>}
              </label>
              <input
                id={`${integration.key}_${f.key}`}
                name={`field_${f.key}`}
                type={f.secret ? "password" : "text"}
                autoComplete="off"
                defaultValue={f.secret ? (f.hasValue ? MASK : "") : f.value}
                placeholder={f.placeholder}
                className="input text-sm font-mono"
              />
              {f.help && <p className="text-[11px] text-ink-muted mt-1">{f.help}</p>}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-primary text-xs">{pending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
          <p className="text-[11px] text-ink-muted">
            Leave a secret field as {MASK} to keep the current value. Values are stored encrypted-at-rest by the database and override environment variables.
          </p>
        </form>
      )}
    </section>
  );
}
