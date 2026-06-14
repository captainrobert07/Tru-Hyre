import Link from "next/link";
import {
  ArrowRight, FileText, Sparkles, ShieldCheck, BarChart3, Workflow,
  FileSignature, Briefcase, UserCog, Truck, UserRound,
} from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/utils";

export const metadata = {
  title: `${APP_NAME} — internal hiring platform`,
  description:
    "Tru Hyre is an internal hiring platform: candidate pipelines, AI matching, interviews, offers, role-scoped portals, reporting and governance — every hire in one system.",
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string }).role;
    if (role === "client") redirect("/portal/client");
    if (role === "vendor") redirect("/portal/vendor");
    if (role === "candidate") redirect("/portal/candidate");
    redirect("/dashboard");
  }

  return (
    <main className="marketing-bg min-h-screen">
      <Header />
      <Hero />
      <DashboardPreview />
      <Capabilities />
      <Roles />
      <FlowSection />
      <CTA />
      <Footer />
    </main>
  );
}

function Header() {
  const links = [
    { href: "#capabilities", label: "Capabilities" },
    { href: "#roles", label: "Roles" },
    { href: "#flow", label: "Workflow" },
  ];
  return (
    <header className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="size-9 rounded-xl2 bg-brand-500 flex items-center justify-center text-white font-display italic text-lg">T</span>
        <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
      </Link>

      <nav className="hidden md:flex nav-pill">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-pill-item">{l.label}</a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-primary">Sign in <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-16 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
      <div className="lg:col-span-7 relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-3 h-8 text-xs font-medium text-brand-700 mb-6">
          <span className="size-1.5 rounded-full bg-brand-500" /> Internal hiring platform
        </div>
        <h1 className="display text-hero">
          Every <em>hire</em>.<br />
          <span className="text-brand-600">One</span> system.
        </h1>
        <p className="text-lg text-ink-soft mt-6 max-w-lg">
          The command center for hiring — candidates, AI matching, interviews, offers and analytics
          in one place, with every role seeing exactly what it should.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/login" className="btn-primary">Sign in <ArrowRight size={14} /></Link>
          <a href="#capabilities" className="btn-ghost">Explore capabilities</a>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-10 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck size={14} className="text-brand-600" /> Role-based access</span>
          <span className="inline-flex items-center gap-1.5"><Sparkles size={14} className="text-brand-600" /> AI-assisted</span>
          <span className="inline-flex items-center gap-1.5"><BarChart3 size={14} className="text-brand-600" /> Full audit trail</span>
        </div>
      </div>

      <div className="lg:col-span-5 relative">
        <FloatingResumePeek />
      </div>
    </section>
  );
}

function FloatingResumePeek() {
  return (
    <div className="relative">
      <div className="absolute -top-6 -left-6 size-32 rounded-full blob-emerald opacity-90" />
      <div className="absolute -bottom-10 -right-6 size-24 rounded-full blob-emerald opacity-60 blur-sm" />

      {/* Match-score card */}
      <div className="absolute -top-4 left-2 -rotate-3 bg-surface border border-hairline rounded-lg p-4 w-52 shadow-card text-xs">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted">AI match</span>
          <span className="pill-good">87</span>
        </div>
        <p className="mt-2 text-ink-soft">Strong on backend + cloud; notice period fits the role.</p>
      </div>

      {/* Main card */}
      <div className="relative card p-6 ml-12 mt-12">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-ink-muted">Parse status</span>
          <span className="pill-good">OK</span>
        </div>
        <div className="stat-huge">
          1,248
        </div>
        <div className="text-xs text-ink-muted -mt-1 mb-4">candidates in the pipeline</div>
        <div className="space-y-2.5">
          <ProgressRow label="Shortlisted" value={42} tone="brand" />
          <ProgressRow label="Interviewing" value={28} tone="muted" />
          <ProgressRow label="Offer stage" value={12} tone="attention" />
        </div>
      </div>

      {/* Floating reminder card */}
      <div className="absolute -bottom-6 right-2 card p-4 w-56">
        <div className="text-xs text-ink-muted">Today&apos;s signal</div>
        <div className="text-sm font-medium mt-1">3 vendor candidates ready for review</div>
        <div className="mt-2"><span className="pill-attention">ATTENTION</span></div>
      </div>
    </div>
  );
}

function ProgressRow({ label, value, tone }: { label: string; value: number; tone: "brand" | "attention" | "muted" }) {
  const fill = tone === "brand" ? "bg-brand-500" : tone === "attention" ? "bg-attention-500" : "bg-slate-300";
  return (
    <div className="text-xs">
      <div className="flex justify-between mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 bg-canvas rounded-full overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">The whole pipeline on <em>one</em> screen</h2>
        <p className="text-base text-ink-soft mt-3">
          Volume, stages, vendor quality and what needs you today — without juggling a dozen tabs.
        </p>
      </div>

      <div className="card p-3 md:p-5">
        <div className="rounded-xl2 bg-canvas border border-hairline p-5 md:p-7 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <PreviewStat label="Candidates" value="1,248" tone="GOOD" />
              <PreviewStat label="Open jobs" value="34" tone="NORMAL" />
              <PreviewStat label="Submissions" value="412" tone="NORMAL" />
              <PreviewStat label="Offers out" value="18" tone="GOOD" />
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Submissions</div>
                <span className="text-xs text-ink-muted">Last 7 days</span>
              </div>
              <div className="flex items-end gap-2 h-24">
                {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 bg-gradient-to-b from-brand-500 to-brand-700 rounded-md" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="card p-4">
              <div className="text-xs text-ink-muted uppercase tracking-wide">Recent activity</div>
              {[
                { name: "Priya Raman", role: "Sr. Backend Engineer", stage: "shortlist", tone: "brand" },
                { name: "Markus Weber", role: "Backend Lead", stage: "interview", tone: "amber" },
                { name: "Anjali Sharma", role: "Frontend Engineer", stage: "submitted", tone: "blue" },
              ].map((c) => (
                <div key={c.name} className="flex items-center justify-between py-2.5 border-b border-hairline last:border-0">
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-ink-soft">{c.role}</div>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-medium px-2 h-5 inline-flex items-center rounded-full ${
                      c.tone === "brand" ? "bg-brand-50 text-brand-700" :
                      c.tone === "amber" ? "bg-amber-50 text-amber-700" :
                      "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {c.stage}
                  </span>
                </div>
              ))}
            </div>
            <div className="card p-4 bg-brand-500 text-white">
              <div className="text-xs uppercase tracking-wide opacity-80">Vendor quality</div>
              <div className="stat-big mt-2">+24%</div>
              <div className="text-xs opacity-80 mt-1">Top vendors leading on shortlist rate this quarter.</div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ink-muted text-center mt-3">Illustrative preview — sign in to see live data.</p>
    </section>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: string; tone: "GOOD" | "NORMAL" | "ATTENTION" }) {
  const cls = tone === "GOOD" ? "pill-good" : tone === "ATTENTION" ? "pill-attention" : "pill-normal";
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-ink-soft">{label}</div>
        <span className={cls}>{tone}</span>
      </div>
      <div className="stat-big">{value}</div>
    </div>
  );
}

function Capabilities() {
  const items = [
    {
      icon: <FileText size={20} />,
      title: "Sourcing & intake",
      body: "Resume parsing from PDF or text, multi-layer duplicate detection, bulk upload, a public careers page, employee referrals and a talent pool.",
      tone: "brand" as const,
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI assistance",
      body: "Claude-powered candidate–job match scoring, summaries, semantic search, screening questions, outreach drafts and offer-acceptance prediction. Off until you add a key.",
      tone: "neutral" as const,
    },
    {
      icon: <Workflow size={20} />,
      title: "Pipeline & interviews",
      body: "Stage tracking, requisition approval, multi-round interviews with kits and scorecards, reference checks, and candidate self-scheduling links.",
      tone: "neutral" as const,
    },
    {
      icon: <FileSignature size={20} />,
      title: "Offers & packets",
      body: "Sanitized client packets with no PII leak, offer management, and a one-click offer-letter PDF — every download on the audit trail.",
      tone: "brand" as const,
    },
    {
      icon: <BarChart3 size={20} />,
      title: "Reports & analytics",
      body: "Funnel conversion, cycle time, vendor SLA, recruiter scoreboard, bottlenecks, forecasting and a custom report builder — no separate BI seat.",
      tone: "neutral" as const,
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Governance",
      body: "Role-based access, granular permissions, append-only audit log, GDPR export & erasure, feature flags, webhooks and integrations you control.",
      tone: "neutral" as const,
    },
  ];

  return (
    <section id="capabilities" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">Built for the <em>whole</em> hiring loop</h2>
        <p className="text-base text-ink-soft mt-3">
          Every capability below is in the product today, each one toggleable by an admin.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div
            key={it.title}
            className={`card p-6 ${it.tone === "brand" ? "bg-brand-500 text-white border-brand-500" : ""}`}
          >
            <div
              className={`size-10 rounded-xl2 flex items-center justify-center mb-4 ${
                it.tone === "brand" ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700"
              }`}
            >
              {it.icon}
            </div>
            <h3 className="text-base font-semibold mb-1.5">{it.title}</h3>
            <p className={`text-sm ${it.tone === "brand" ? "text-white/85" : "text-ink-soft"}`}>{it.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    {
      icon: <UserCog size={18} />,
      title: "Recruiters & HR",
      body: "Drive the full pipeline — upload, match, interview, submit and offer. Admins manage users, features and integrations.",
    },
    {
      icon: <Briefcase size={18} />,
      title: "Clients",
      body: "A scoped portal showing only their submissions, with packets to review and feedback scores to leave.",
    },
    {
      icon: <Truck size={18} />,
      title: "Vendors",
      body: "Agencies upload and track only their own candidates, with self-onboarding and commission terms.",
    },
    {
      icon: <UserRound size={18} />,
      title: "Candidates",
      body: "An invited self-service portal to see their own stage, interviews and offer — and nothing else.",
    },
  ];
  return (
    <section id="roles" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">One platform, <em>four</em> vantage points</h2>
        <p className="text-base text-ink-soft mt-3">
          Everyone signs into the same system, but each role sees only what it should.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {roles.map((r) => (
          <div key={r.title} className="card p-6">
            <div className="size-10 rounded-xl2 bg-brand-50 text-brand-700 flex items-center justify-center mb-4">
              {r.icon}
            </div>
            <h3 className="text-base font-semibold mb-1.5">{r.title}</h3>
            <p className="text-sm text-ink-soft">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlowSection() {
  const steps = [
    { num: "01", title: "Upload or apply", body: "Recruiters upload a PDF, or candidates self-apply via the careers page. Fields parse automatically." },
    { num: "02", title: "Match & screen", body: "Dedupe runs, AI scores fit against open jobs, and the candidate lands at HR review." },
    { num: "03", title: "Interview & assess", body: "Schedule rounds with kits and scorecards; clients review sanitized packets and leave feedback." },
    { num: "04", title: "Offer & onboard", body: "Send the offer, generate the letter PDF, and hand off to HRIS when they join." },
  ];
  return (
    <section id="flow" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">From resume to <em>offer</em>, in four steps</h2>
        <p className="text-base text-ink-soft mt-3">No spreadsheets, no scattered tools — just the pipeline.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((s) => (
          <div key={s.num} className="card p-6 relative overflow-hidden">
            <div className="font-display italic text-7xl text-brand-100 absolute -top-2 -right-2 leading-none select-none">
              {s.num}
            </div>
            <div className="relative">
              <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="text-sm text-ink-soft mt-2">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="card p-10 md:p-16 text-center bg-ink_inverted text-white border-ink_inverted relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-64 rounded-full blob-emerald opacity-40 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 size-72 rounded-full blob-emerald opacity-30 blur-2xl" />
        <h2 className="display text-display relative">Sign in to your <em>workspace</em></h2>
        <p className="text-base text-white/70 mt-4 max-w-md mx-auto relative">
          Recruiters and admins sign in here. Clients, vendors and candidates join by invitation —
          check your email for an invite link.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-8 relative">
          <Link href="/login" className="btn bg-brand-500 text-white hover:bg-brand-600 active:scale-[.98] px-5 h-11 rounded-full text-sm font-medium">
            Sign in <ArrowRight size={14} />
          </Link>
          <a href="#capabilities" className="btn bg-white/10 text-white hover:bg-white/15 px-5 h-11 rounded-full text-sm font-medium">
            Explore capabilities
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const year = process.env.NEXT_PUBLIC_BUILD_YEAR || "2026";
  return (
    <footer className="max-w-[1280px] mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row justify-between gap-3 text-sm text-ink-muted">
      <div>© {year} {APP_NAME}. An internal hiring platform.</div>
      <div className="flex gap-4">
        <Link href="/login" className="hover:text-ink">Sign in</Link>
        <a href="#capabilities" className="hover:text-ink">Capabilities</a>
        <a href="#roles" className="hover:text-ink">Roles</a>
      </div>
    </footer>
  );
}
