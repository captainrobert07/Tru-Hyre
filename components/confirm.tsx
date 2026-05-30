"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

type ConfirmOpts = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Require typing this string before confirm enables. */
  typeToConfirm?: string;
};

type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{
    opts: ConfirmOpts;
    resolve: (v: boolean) => void;
  } | null>(null);
  const [typed, setTyped] = useState("");

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setPending({ opts, resolve });
      }),
    [],
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
    setTyped("");
  };

  const opts = pending?.opts;
  const typeOk = !opts?.typeToConfirm || typed.trim() === opts.typeToConfirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink_inverted/40 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative w-full max-w-md card p-6">
            <button
              onClick={() => close(false)}
              className="absolute top-3 right-3 size-8 inline-flex items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-canvas"
              aria-label="Close"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-4 mb-3">
              <span
                className={`size-10 rounded-xl2 flex items-center justify-center shrink-0 ${
                  opts.destructive ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"
                }`}
              >
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold leading-tight">{opts.title}</h2>
                {opts.description && (
                  <div className="text-sm text-ink-soft mt-1.5 leading-relaxed">{opts.description}</div>
                )}
              </div>
            </div>
            {opts.typeToConfirm && (
              <div className="mt-3">
                <label className="text-xs text-ink-muted">
                  Type <span className="font-mono text-ink">{opts.typeToConfirm}</span> to confirm
                </label>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="input mt-1.5 h-9 text-sm"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => close(false)}
                className="btn-ghost text-sm h-9 px-4"
                type="button"
              >
                {opts.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                disabled={!typeOk}
                className={`text-sm h-9 px-4 rounded-full font-medium transition-colors disabled:opacity-50 ${
                  opts.destructive ? "bg-red-600 text-white hover:bg-red-700" : "bg-ink_inverted text-white hover:bg-ink"
                }`}
                type="button"
              >
                {opts.confirmLabel || (opts.destructive ? "Delete" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
