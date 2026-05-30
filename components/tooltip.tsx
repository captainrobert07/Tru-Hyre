import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Pure-CSS tooltip. Wraps any inline element. Renders as
 * `[content][?]` with the [?] icon on hover/focus revealing the
 * tooltip above. Keyboard-accessible (tabIndex=0).
 */
export function InfoTooltip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      tabIndex={0}
      className={cn(
        "group relative inline-flex items-center justify-center size-4 rounded-full bg-canvas text-ink-muted text-[9px] font-bold cursor-help hover:bg-hairline hover:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 align-middle",
        className,
      )}
      aria-label={text}
    >
      ?
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink_inverted text-white text-[11px] font-normal leading-relaxed whitespace-normal w-56 shadow-pop pointer-events-none z-50"
      >
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 size-2 rotate-45 bg-ink_inverted" />
      </span>
    </span>
  );
}

export function Tooltip({
  children,
  text,
  className,
}: {
  children: ReactNode;
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100 transition-opacity duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 rounded-lg bg-ink_inverted text-white text-[11px] font-normal leading-relaxed whitespace-normal min-w-max max-w-xs shadow-pop pointer-events-none z-50"
      >
        {text}
      </span>
    </span>
  );
}
