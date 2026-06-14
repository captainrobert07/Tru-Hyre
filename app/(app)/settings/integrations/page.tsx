import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { INTEGRATIONS, getIntegration, type IntegrationCategory } from "@/lib/integrations";
import { IntegrationCard, type IntegrationView } from "./integration-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

const ORDER: IntegrationCategory[] = ["AI", "Email", "Calendar", "Storage", "Messaging", "Signing", "HRIS", "Job boards", "Telephony", "Automation", "Auth", "Other"];

export default async function IntegrationsPage() {
  await requireAdmin();

  // Resolve each integration server-side (never sends secret values to client —
  // only whether a value exists).
  const views: IntegrationView[] = await Promise.all(
    INTEGRATIONS.map(async (def) => {
      const r = await getIntegration(def.key);
      const required = def.fields.find((f) => f.secret) || def.fields[0];
      const ready = r.enabled && Boolean(required && r.values[required.key]);
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        description: def.description,
        status: def.status,
        setupNote: def.setupNote,
        enabled: r.enabled && r.hasRow,
        ready,
        fields: def.fields.map((f) => ({
          key: f.key,
          label: f.label,
          secret: Boolean(f.secret),
          placeholder: f.placeholder,
          help: f.help,
          hasValue: Boolean(r.values[f.key]),
          // Only expose non-secret values back to the client.
          value: f.secret ? "" : (r.values[f.key] || ""),
        })),
      };
    }),
  );

  const byCat = new Map<string, IntegrationView[]>();
  for (const v of views) {
    if (!byCat.has(v.category)) byCat.set(v.category, []);
    byCat.get(v.category)!.push(v);
  }
  const readyCount = views.filter((v) => v.ready).length;

  return (
    <>
      <Breadcrumbs crumbs={[{ href: "/dashboard", label: "Dashboard" }, { href: "/settings", label: "Settings" }, { label: "Integrations" }]} />
      <PageHeader
        title="Integrations"
        subtitle={`Connect external services. ${readyCount} of ${views.length} ready. Keys entered here apply everywhere and override environment variables.`}
      />
      <div className="space-y-6">
        {ORDER.filter((c) => byCat.has(c)).map((cat) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft mb-2">{cat}</h2>
            <div className="space-y-3">
              {byCat.get(cat)!.map((v) => (
                <IntegrationCard key={v.key} integration={v} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
