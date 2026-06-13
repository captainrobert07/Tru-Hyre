import Link from "next/link";
import { Briefcase, UserPlus, Send, Check } from "lucide-react";

/**
 * Shown on the dashboard only while the workspace is essentially empty. Walks a
 * new HR user through the core loop: create a job → add a candidate → submit.
 * Server component (no state) — it simply reflects the current counts.
 */
export function FirstRunChecklist({
  jobs,
  candidates,
  submissions,
}: {
  jobs: number;
  candidates: number;
  submissions: number;
}) {
  const steps = [
    { done: jobs > 0, icon: <Briefcase size={16} />, label: "Create your first job", href: "/jobs/new", cta: "New job" },
    { done: candidates > 0, icon: <UserPlus size={16} />, label: "Add a candidate", href: "/candidates/upload", cta: "Upload resume" },
    { done: submissions > 0, icon: <Send size={16} />, label: "Submit a candidate to a job", href: "/candidates", cta: "Go to candidates" },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <section className="card p-6 mb-6 border-brand-100 bg-brand-50/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-brand-900">Get started with Tru Hyre</h2>
          <p className="text-xs text-brand-700 mt-0.5">A few steps to set up your recruiting pipeline.</p>
        </div>
        <span className="text-xs font-medium text-brand-700 tabular-nums">{completed}/{steps.length}</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-xl2 border p-3 ${s.done ? "border-brand-100 bg-surface/60" : "border-hairline bg-surface"}`}
          >
            <span className={`size-8 rounded-full flex items-center justify-center ${s.done ? "bg-brand-500 text-white" : "bg-canvas text-ink-soft"}`}>
              {s.done ? <Check size={16} /> : s.icon}
            </span>
            <span className={`flex-1 text-sm ${s.done ? "text-ink-muted line-through" : "text-ink font-medium"}`}>{s.label}</span>
            {!s.done && (
              <Link href={s.href} className="btn-primary text-xs shrink-0">{s.cta}</Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
