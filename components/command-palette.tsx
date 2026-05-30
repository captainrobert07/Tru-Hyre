"use client";

import { Command } from "cmdk";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  Briefcase,
  Building2,
  Truck,
  Plus,
  LayoutDashboard,
  BarChart3,
  Bell,
  Settings,
  ScrollText,
} from "lucide-react";

type Results = {
  candidates: { id: number; fullName: string; currentTitle: string | null; refId: string; stage: string }[];
  jobs: { id: number; title: string; status: string; location: string | null }[];
  clients: { id: number; name: string; industry: string | null }[];
  vendors: { id: number; name: string; country: string | null }[];
};

const QUICK_ACTIONS = [
  { id: "dashboard", label: "Go to dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} /> },
  { id: "candidates", label: "All candidates", href: "/candidates", icon: <Users size={16} /> },
  { id: "upload", label: "Upload resume", href: "/candidates/upload", icon: <Plus size={16} /> },
  { id: "newjob", label: "Create new job", href: "/jobs/new", icon: <Plus size={16} /> },
  { id: "newclient", label: "Create new client", href: "/clients/new", icon: <Plus size={16} /> },
  { id: "newvendor", label: "Create new vendor", href: "/vendors/new", icon: <Plus size={16} /> },
  { id: "submissions", label: "All submissions", href: "/submissions", icon: <Briefcase size={16} /> },
  { id: "reports", label: "Reports", href: "/reports", icon: <BarChart3 size={16} /> },
  { id: "notifications", label: "Notifications", href: "/notifications", icon: <Bell size={16} /> },
  { id: "settings", label: "Settings", href: "/settings", icon: <Settings size={16} /> },
  { id: "audit", label: "Audit log", href: "/settings/audit", icon: <ScrollText size={16} /> },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query || query.length < 1) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!r.ok) {
          if (!cancelled) setResults(null);
          return;
        }
        const data = (await r.json()) as Results;
        if (!cancelled) setResults(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink_inverted/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl card overflow-hidden">
        <Command shouldFilter={false} className="bg-surface">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-hairline">
            <Search size={16} className="text-ink-muted shrink-0" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search candidates, jobs, clients, or jump to…"
              className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-ink-muted"
            />
            <kbd className="hidden md:inline-flex items-center px-1.5 h-5 text-[10px] font-medium rounded bg-canvas text-ink-muted">ESC</kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-10 text-sm text-ink-muted text-center">
              {loading ? "Searching…" : query ? "No matches." : "Start typing to search."}
            </Command.Empty>

            {results && results.candidates.length > 0 && (
              <Command.Group heading="Candidates" className="text-[10px] uppercase tracking-wide text-ink-muted px-2 mb-1 mt-2 [&>[cmdk-group-items]]:space-y-0.5 [&>[cmdk-group-items]]:mt-1">
                {results.candidates.map((c) => (
                  <Command.Item
                    key={`cand-${c.id}`}
                    value={`cand-${c.id}-${c.fullName}`}
                    onSelect={() => navigate(`/candidates/${c.id}`)}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm aria-selected:bg-canvas data-[selected=true]:bg-canvas"
                  >
                    <Users size={14} className="text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.fullName}</div>
                      <div className="truncate text-[11px] text-ink-muted">{c.currentTitle || c.refId}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{c.stage.replaceAll("_", " ")}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results && results.jobs.length > 0 && (
              <Command.Group heading="Jobs" className="text-[10px] uppercase tracking-wide text-ink-muted px-2 mb-1 mt-3 [&>[cmdk-group-items]]:space-y-0.5 [&>[cmdk-group-items]]:mt-1">
                {results.jobs.map((j) => (
                  <Command.Item
                    key={`job-${j.id}`}
                    value={`job-${j.id}-${j.title}`}
                    onSelect={() => navigate(`/jobs/${j.id}`)}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm aria-selected:bg-canvas data-[selected=true]:bg-canvas"
                  >
                    <Briefcase size={14} className="text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{j.title}</div>
                      <div className="truncate text-[11px] text-ink-muted">{j.location || "—"}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-ink-muted">{j.status}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results && results.clients.length > 0 && (
              <Command.Group heading="Clients" className="text-[10px] uppercase tracking-wide text-ink-muted px-2 mb-1 mt-3 [&>[cmdk-group-items]]:space-y-0.5 [&>[cmdk-group-items]]:mt-1">
                {results.clients.map((c) => (
                  <Command.Item
                    key={`cli-${c.id}`}
                    value={`cli-${c.id}-${c.name}`}
                    onSelect={() => navigate(`/clients/${c.id}`)}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm aria-selected:bg-canvas data-[selected=true]:bg-canvas"
                  >
                    <Building2 size={14} className="text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="truncate text-[11px] text-ink-muted">{c.industry || "—"}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results && results.vendors.length > 0 && (
              <Command.Group heading="Vendors" className="text-[10px] uppercase tracking-wide text-ink-muted px-2 mb-1 mt-3 [&>[cmdk-group-items]]:space-y-0.5 [&>[cmdk-group-items]]:mt-1">
                {results.vendors.map((v) => (
                  <Command.Item
                    key={`ven-${v.id}`}
                    value={`ven-${v.id}-${v.name}`}
                    onSelect={() => navigate(`/vendors/${v.id}`)}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm aria-selected:bg-canvas data-[selected=true]:bg-canvas"
                  >
                    <Truck size={14} className="text-ink-muted shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{v.name}</div>
                      <div className="truncate text-[11px] text-ink-muted">{v.country || "—"}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!query && (
              <Command.Group heading="Quick actions" className="text-[10px] uppercase tracking-wide text-ink-muted px-2 mt-2 [&>[cmdk-group-items]]:space-y-0.5 [&>[cmdk-group-items]]:mt-1">
                {QUICK_ACTIONS.map((a) => (
                  <Command.Item
                    key={a.id}
                    value={a.label}
                    onSelect={() => navigate(a.href)}
                    className="group flex items-center gap-3 px-3 h-10 rounded-lg cursor-pointer text-sm aria-selected:bg-canvas data-[selected=true]:bg-canvas"
                  >
                    <span className="text-ink-muted">{a.icon}</span>
                    <span className="flex-1">{a.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
        <div className="px-4 h-9 border-t border-hairline flex items-center justify-between text-[10px] text-ink-muted">
          <span>↑↓ to navigate · ↵ to select</span>
          <span className="hidden md:inline"><kbd className="px-1 mr-1 rounded bg-canvas">⌘K</kbd>to toggle</span>
        </div>
      </div>
    </div>
  );
}

export function CommandTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        // Synthesize the keyboard event so the same listener picks it up.
        const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true });
        window.dispatchEvent(evt);
      }}
      className="hidden md:flex items-center gap-2 h-10 pl-3 pr-2 rounded-full bg-surface border border-hairline text-xs text-ink-muted hover:text-ink hover:border-brand-200 transition-colors"
    >
      <Search size={14} />
      <span>Search…</span>
      <kbd className="ml-2 px-1.5 h-5 text-[10px] inline-flex items-center rounded bg-canvas">⌘K</kbd>
    </button>
  );
}
