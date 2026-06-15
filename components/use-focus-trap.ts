"use client";

import { useEffect, type RefObject } from "react";

/**
 * Accessible focus management for a modal/dialog (WCAG 2.4.3). When `active`:
 *  - moves focus into the container (first focusable, or the container itself),
 *  - traps Tab / Shift+Tab so focus cycles within the container,
 *  - restores focus to whatever was focused before, when deactivated.
 *
 * Escape-to-close stays the caller's concern (the modals already handle it).
 * Shared so the four modals get identical, tested behaviour rather than four
 * hand-rolled variants.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean, containerRef: RefObject<T | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusableSelector =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Move focus in: first focusable element, else the container itself.
    const first = getFocusable()[0];
    if (first) first.focus();
    else {
      container.setAttribute("tabindex", "-1");
      container.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      // Restore focus to the trigger, if it's still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
