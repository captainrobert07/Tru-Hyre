import { requireAdmin } from "@/lib/rbac";
import { PageHeader, Badge } from "@/components/primitives";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { FEATURES, getFeatureStates, type FeatureCategory } from "@/lib/features";
import { FeatureToggle } from "./feature-toggle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Features" };

const CATEGORY_ORDER: FeatureCategory[] = ["AI", "Scheduling", "Pipeline", "Communication", "Sourcing", "Analytics", "Platform", "Productivity"];

export default async function FeaturesPage() {
  await requireAdmin();
  const states = await getFeatureStates();

  const enabledCount = FEATURES.filter((f) => states[f.key]).length;

  const byCategory = new Map<FeatureCategory, typeof FEATURES>();
  for (const f of FEATURES) {
    if (!byCategory.has(f.category)) byCategory.set(f.category, []);
    byCategory.get(f.category)!.push(f);
  }

  return (
    <>
      <Breadcrumbs
        crumbs={[
          { href: "/dashboard", label: "Dashboard" },
          { href: "/settings", label: "Settings" },
          { label: "Features" },
        ]}
      />
      <PageHeader
        title="Features"
        subtitle={`Turn features on or off for everyone. ${enabledCount} of ${FEATURES.length} enabled.`}
      />

      <div className="space-y-6">
        {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
          <section key={category} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline bg-canvas/40">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{category}</h2>
            </div>
            <div className="divide-y divide-hairline">
              {byCategory.get(category)!.map((f) => {
                const on = states[f.key];
                return (
                  <div key={f.key} className="flex items-start gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{f.label}</span>
                        <Badge tone={on ? "green" : "default"}>{on ? "On" : "Off"}</Badge>
                      </div>
                      <p className="text-xs text-ink-soft mt-1 max-w-xl">{f.description}</p>
                    </div>
                    <div className="pt-0.5">
                      <FeatureToggle featureKey={f.key} label={f.label} enabled={on} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-[11px] text-ink-muted mt-6">
        Disabling a feature hides its UI and blocks its actions immediately for all staff. State changes are recorded in the audit log.
      </p>
    </>
  );
}
