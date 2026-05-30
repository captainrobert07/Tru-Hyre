"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Variant = "primary" | "ghost";

export function SubmitButton({
  children,
  variant = "primary",
  className,
  pendingLabel,
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  pendingLabel?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={cn(variant === "primary" ? "btn-primary" : "btn-ghost", className)}
      {...rest}
    >
      {pending && (
        <span className="inline-block size-3 rounded-full border-2 border-current border-r-transparent animate-spin" />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
