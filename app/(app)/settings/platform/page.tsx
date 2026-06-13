import { desc } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, webhooks } from "@/db/schema";
import { requireAdmin } from "@/lib/rbac";
import { getFeatureStates } from "@/lib/features";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ApiKeysCard, WebhooksCard, type KeyRow, type HookRow } from "./platform-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform & integrations" };

export default async function PlatformPage() {
  await requireAdmin();
  const flags = await getFeatureStates();

  const [keys, hooks] = await Promise.all([
    flags.public_api ? db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)) : Promise.resolve([]),
    flags.webhooks ? db.select().from(webhooks).orderBy(desc(webhooks.createdAt)) : Promise.resolve([]),
  ]);

  const keyRows: KeyRow[] = keys.map((k) => ({
    id: k.id, name: k.name, prefix: k.prefix, isActive: k.isActive,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
  }));
  const hookRows: HookRow[] = hooks.map((h) => ({
    id: h.id, url: h.url, events: h.events || [], isActive: h.isActive, lastStatus: h.lastStatus,
  }));

  return (
    <>
      <Breadcrumbs crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/settings", label: "Settings" }, { label: "Platform" }]} />
      <PageHeader title="Platform & integrations" subtitle="API keys, webhooks, and data governance." />
      <div className="space-y-4">
        <ApiKeysCard keys={keyRows} enabled={flags.public_api} />
        <WebhooksCard hooks={hookRows} enabled={flags.webhooks} />

        {flags.gdpr_tools && (
          <section className="card p-5">
            <h2 className="text-base font-semibold mb-2">Data governance (GDPR)</h2>
            <ul className="text-sm text-ink-soft list-disc pl-5 space-y-1">
              <li>Per-candidate <strong>data export</strong> (JSON) is available from each candidate&apos;s page (admin).</li>
              <li><strong>Right to erasure</strong>: the candidate Danger Zone hard-deletes the record and all resumes/packets; the audit log retains a tombstone.</li>
              <li>Careers/referral applicants consent at submission; their data is used only for recruitment.</li>
              <li>Inbound replies and emails are logged to the candidate timeline and removed on erasure (cascade).</li>
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
