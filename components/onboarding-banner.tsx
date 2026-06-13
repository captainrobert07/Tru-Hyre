"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "truhyre-onboarding-dismissed-v1";

export function OnboardingBanner({ firstName }: { firstName: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  return (
    <div className="card p-5 mb-6 bg-brand-50 border-brand-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand-900">Welcome to Tru Hyre, {firstName} 👋</div>
          <p className="text-xs text-brand-800 mt-1 max-w-2xl">
            Start by <Link href="/candidates/upload" className="underline">uploading a resume</Link> or{" "}
            <Link href="/jobs/new" className="underline">creating a job</Link>. Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-brand-200 text-[10px]">⌘K</kbd> anywhere to search.
            Admins can turn features on or off under <Link href="/settings/features" className="underline">Settings → Features</Link>.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="text-xs text-brand-700 hover:text-brand-900 shrink-0">Dismiss</button>
      </div>
    </div>
  );
}
