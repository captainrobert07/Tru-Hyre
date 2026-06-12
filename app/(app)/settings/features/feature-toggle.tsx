"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFeatureFlagAction } from "./actions";

export function FeatureToggle({
  featureKey,
  label,
  enabled: initialEnabled,
}: {
  featureKey: string;
  label: string;
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    start(async () => {
      const r = await setFeatureFlagAction(featureKey, next);
      if (!r.ok) {
        setEnabled(!next); // roll back
        toast.error(r.error || "Could not update.");
        return;
      }
      toast.success(`${label} ${next ? "enabled" : "disabled"}`);
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${label}`}
      onClick={toggle}
      disabled={pending}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        enabled ? "bg-brand-500" : "bg-hairline"
      }`}
    >
      <span
        className={`inline-block size-5 transform rounded-full bg-white shadow-card transition-transform ${
          enabled ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
