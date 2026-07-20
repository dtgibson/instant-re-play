"use client";

import { useEffect, useRef, type RefObject } from "react";

function focusableWithin(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const nodes = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((n) => n.offsetParent !== null);
}

/**
 * Accessibility plumbing shared by the drawer and the confirm dialog (NFR-04):
 * when active, trap Tab focus inside the container, close on Escape, move focus
 * in on open, restore focus to the trigger on close, and lock body scroll.
 * onClose and initialFocusRef are read through refs so the effect only re-runs
 * when `active` flips — never stealing focus on unrelated re-renders.
 */
export function useOverlayA11y(opts: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { active, containerRef } = opts;
  const onCloseRef = useRef(opts.onClose);
  const initialFocusRef = useRef(opts.initialFocusRef);
  onCloseRef.current = opts.onClose;
  initialFocusRef.current = opts.initialFocusRef;

  useEffect(() => {
    if (!active) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(
      () => {
        const target =
          initialFocusRef.current?.current ??
          focusableWithin(containerRef.current)[0];
        target?.focus();
      },
      reduced ? 0 : 60,
    );

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusableWithin(containerRef.current);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef]);
}
