"use client";

import { useTransition } from "react";
import { Eye, KeyRound, Power, MoreHorizontal } from "lucide-react";
import { useConfirm } from "@/components/confirm";

export function UserRowActions({
  userId,
  email,
  isActive,
  isMe,
  onImpersonate,
  onDeactivate,
  onReset,
}: {
  userId: number;
  email: string;
  isActive: boolean;
  isMe: boolean;
  onImpersonate: () => Promise<void>;
  onDeactivate: () => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();

  const handleImpersonate = async () => {
    if (isMe) return;
    const ok = await confirm({
      title: `Impersonate ${email}?`,
      description: "You'll see the app as this user for up to 1 hour. Every action is audited under your name.",
      confirmLabel: "Start impersonation",
    });
    if (!ok) return;
    start(() => onImpersonate());
  };

  const handleDeactivate = async () => {
    const ok = await confirm({
      title: `${isActive ? "Deactivate" : "Reactivate"} ${email}?`,
      description: isActive
        ? "Disabled users can't sign in. They keep all their data and audit history."
        : "Reactivating restores sign-in access.",
      destructive: isActive,
      confirmLabel: isActive ? "Deactivate" : "Reactivate",
    });
    if (!ok) return;
    start(() => onDeactivate());
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: `Force-reset password for ${email}?`,
      description: "Sets a new temporary password. The temp value is shown in the audit log so you can copy it. The user should change it on next login.",
      destructive: true,
      confirmLabel: "Reset password",
    });
    if (!ok) return;
    start(() => onReset());
  };

  return (
    <details className="relative" onClick={(e) => e.stopPropagation()}>
      <summary className="list-none cursor-pointer size-7 rounded-full hover:bg-canvas inline-flex items-center justify-center text-ink-muted hover:text-ink select-none">
        <MoreHorizontal size={14} />
      </summary>
      <div className="absolute right-0 top-full mt-1.5 w-48 card p-1 z-30">
        <button
          type="button"
          disabled={pending || isMe}
          onClick={handleImpersonate}
          className="w-full text-left text-xs px-3 h-8 rounded-md hover:bg-canvas inline-flex items-center gap-2 disabled:opacity-40"
        >
          <Eye size={12} /> Impersonate
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={handleReset}
          className="w-full text-left text-xs px-3 h-8 rounded-md hover:bg-canvas inline-flex items-center gap-2"
        >
          <KeyRound size={12} /> Force password reset
        </button>
        <button
          type="button"
          disabled={pending || isMe}
          onClick={handleDeactivate}
          className={`w-full text-left text-xs px-3 h-8 rounded-md hover:bg-canvas inline-flex items-center gap-2 disabled:opacity-40 ${isActive ? "text-red-700" : ""}`}
        >
          <Power size={12} /> {isActive ? "Deactivate" : "Reactivate"}
        </button>
        <span className="block text-[10px] text-ink-muted px-3 pt-1.5 pb-1">user #{userId}</span>
      </div>
    </details>
  );
}
