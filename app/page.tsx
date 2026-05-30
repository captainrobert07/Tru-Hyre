import Link from "next/link";
import { ArrowRight, FileText, Sparkles, ShieldCheck, BarChart3, Zap, Users } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { APP_NAME } from "@/lib/utils";

export const metadata = {
  title: `${APP_NAME} — modern hiring platform`,
  description: "Resume parsing, candidate pipelines, sanitized client packets, and reporting — built for modern HR teams.",
};

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string }).role;
    if (role === "client") redirect("/portal/client");
    if (role === "vendor") redirect("/portal/vendor");
    redirect("/dashboard");
  }

  return (
    <main className="marketing-bg min-h-screen">
      <Header />
      <Hero />
      <DashboardPreview />
      <ValueGrid />
      <FlowSection />
      <CTA />
      <Footer />
    </main>
  );
}

function Header() {
  const links = [
    { href: "#features", label: "Features" },
    { href: "#flow", label: "Workflow" },
    { href: "#about", label: "About" },
  ];
  return (
    <header className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="size-9 rounded-2xl bg-brand-500 flex items-center justify-center text-white font-display italic text-lg">T</span>
        <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
      </Link>

      <nav className="hidden md:flex nav-pill">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="nav-pill-item">{l.label}</a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Link href="/login" className="hidden md:inline-flex btn-ghost">Sign in</Link>
        <Link href="/login" className="btn-primary">Get started <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-16 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
      <div className="lg:col-span-7 relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 border border-brand-100 px-3 h-8 text-xs font-medium text-brand-700 mb-6">
          <span className="size-1.5 rounded-full bg-brand-500" /> Allianz HR Platform · v1
        </div>
        <h1 className="display text-hero">
          Hire <em>better</em><br />
          with <span className="text-brand-600">AI-grade</span> resume<br />intelligence.
        </h1>
        <p className="text-lg text-ink-soft mt-6 max-w-lg">
          {APP_NAME} parses every resume, dedupes candidates, sanitizes client packets, and tracks every stage — so your recruiters spend their time hiring, not filing.
        </p>
        <div className="flex flex-wrap gap-3 mt-8">
          <Link href="/login" className="btn-primary">Get started <ArrowRight size={14} /></Link>
          <a href="#features" className="btn-ghost">See features</a>
        </div>
        <div className="flex items-center gap-3 mt-10 text-xs text-ink-muted">
          <div className="flex -space-x-2">
            {["#10b981", "#f97316", "#3b82f6", "#a855f7"].map((c, i) => (
              <span key={i} className="size-7 rounded-full border-2 border-canvas" style={{ background: c }} />
            ))}
          </div>
          <span>Trusted by HR teams shipping <strong className="text-ink">3,500+</strong> hires this year.</span>
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

      {/* Sticky note */}
      <div className="absolute -top-4 left-2 -rotate-3 bg-amber-100 border border-amber-200 rounded-lg p-4 w-48 shadow-card text-xs text-ink-soft">
        <p>Parsed 47 resumes and shortlisted 12 in under 4 minutes.</p>
        <div className="mt-2 text-[10px] text-amber-700">— Allianz Talent Lead</div>
      </div>

      {/* Main card */}
      <div className="relative card p-6 ml-12 mt-12">
        <div className="flex items-center justify-between mb-4">
          <span className="pill-good">GOOD</span>
          <span className="text-xs text-ink-muted">Passing rate</span>
        </div>
        <div className="stat-huge">
          61<span className="text-brand-600">%</span>
        </div>
        <div className="mt-5 space-y-2.5">
          <ProgressRow label="Complete" value={61} tone="brand" />
          <ProgressRow label="Failed" value={17} tone="attention" />
          <ProgressRow label="Partial" value={22} tone="muted" />
        </div>
      </div>

      {/* Floating reminder card */}
      <div className="absolute -bottom-6 right-2 card p-4 w-56">
        <div className="text-xs text-ink-muted">Today's signal</div>
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
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-2 bg-canvas rounded-full overflow-hidden">
        <div className={`h-full ${fill}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DashboardPreview() {
  return (
    <section id="features" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">Everything in <em>one</em> screen</h2>
        <p className="text-base text-ink-soft mt-3">
          Pipeline, packets, vendor quality, and audit trails — without 12 tabs and a Zapier subscription.
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
                <div className="text-sm font-semibold">Pipeline</div>
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
              <div className="text-xs text-ink-muted uppercase tracking-wide">Recent</div>
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
              <div className="text-xs opacity-80 mt-1">Vendors leading on shortlist rate this quarter.</div>
            </div>
          </div>
        </div>
      </div>
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

function ValueGrid() {
  const items = [
    {
      icon: <FileText size={20} />,
      title: "Resume parsing",
      body: "Drop a PDF or paste text. Tru Hyre extracts name, contact, location, title, experience, notice, CTC, summary, and skills.",
      tone: "brand" as const,
    },
    {
      icon: <ShieldCheck size={20} />,
      title: "Sanitized packets",
      body: "Generate a client-safe PDF in one click — no email, no phone, no vendor leak. Audit-trail every download.",
      tone: "neutral" as const,
    },
    {
      icon: <Users size={20} />,
      title: "Role-locked portals",
      body: "Clients only see their submissions. Vendors only see their own candidates. Recruiters drive the pipeline.",
      tone: "neutral" as const,
    },
    {
      icon: <Zap size={20} />,
      title: "Duplicate detection",
      body: "Email match, phone last-10-digits, content hash, and fuzzy name — every check runs on every upload.",
      tone: "neutral" as const,
    },
    {
      icon: <BarChart3 size={20} />,
      title: "Reports that ship",
      body: "Conversion ratios, vendor quality, daily volume, and pipeline-by-stage — without spinning up a BI seat.",
      tone: "neutral" as const,
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI-assisted",
      body: "Optional Claude or GPT integration fills the fields regex misses. Hybrid: free until you turn AI on.",
      tone: "brand" as const,
    },
  ];

  return (
    <section className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
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

function FlowSection() {
  const steps = [
    { num: "01", title: "Upload or paste", body: "PDF or raw text. Hybrid regex + optional Claude parse." },
    { num: "02", title: "Auto-stage", body: "Lands at HR Review with parsed profile and dedupe report." },
    { num: "03", title: "Generate packet", body: "Sanitized PDF — name, KPIs, summary, skills. No PII." },
    { num: "04", title: "Submit & track", body: "Pick a job, send to client. Feedback writes to the timeline." },
  ];
  return (
    <section id="flow" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h2 className="display text-display">From resume to <em>offer</em>, in four steps</h2>
        <p className="text-base text-ink-soft mt-3">No spreadsheets. No 14-tool stack. Just the pipeline.</p>
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
    <section id="about" className="max-w-[1280px] mx-auto px-6 lg:px-10 py-16">
      <div className="card p-10 md:p-16 text-center bg-ink_inverted text-white border-ink_inverted relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-64 rounded-full blob-emerald opacity-40 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 size-72 rounded-full blob-emerald opacity-30 blur-2xl" />
        <h2 className="display text-display relative">Ready to <em>boost</em> your hiring?</h2>
        <p className="text-base text-white/70 mt-4 max-w-md mx-auto relative">
          Sign in with the seeded admin account and explore the entire pipeline in 60 seconds.
        </p>
        <div className="flex flex-wrap gap-3 justify-center mt-8 relative">
          <Link href="/login" className="btn bg-brand-500 text-white hover:bg-brand-600 active:scale-[.98] px-5 h-11 rounded-full text-sm font-medium">
            Get started <ArrowRight size={14} />
          </Link>
          <a href="#features" className="btn bg-white/10 text-white hover:bg-white/15 px-5 h-11 rounded-full text-sm font-medium">
            See features
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="max-w-[1280px] mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row justify-between gap-3 text-sm text-ink-muted">
      <div>© {new Date().getFullYear()} {APP_NAME}. An Allianz HR Platform — Project by Kris.</div>
      <div className="flex gap-4">
        <Link href="/login" className="hover:text-ink">Sign in</Link>
        <a href="#features" className="hover:text-ink">Features</a>
        <a href="#flow" className="hover:text-ink">Workflow</a>
      </div>
    </footer>
  );
}
