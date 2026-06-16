import { ChevronDown } from "lucide-react";

/**
 * The dropdown caret for `<details>`/`<summary>` menus. Standardizes what was a
 * mix of bare text glyphs ("▾") and lucide chevrons across the bulk-action
 * menus — same icon, same size, same open-state rotation everywhere, so the
 * affordance reads identically app-wide. Requires the parent `<details>` to
 * carry the `group` class (group-open drives the flip). `aria-hidden` because
 * it's decorative — the summary text already names the control (a bare "▾" was
 * announced literally by screen readers).
 */
export function DropdownCaret({ className = "" }: { className?: string }) {
  return (
    <ChevronDown
      size={14}
      aria-hidden
      className={`text-ink-muted transition-transform group-open:rotate-180 ${className}`}
    />
  );
}
