"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Export control (FR-01/FR-02, NFR-03/04/05) — a calm SECONDARY ghost button
 * seated to the LEFT of the aloe "Log a play" (the aloe accent stays reserved
 * for the one primary action). It opens an origin-aware floating-plane menu
 * offering two formats as plain `<a download>` links to the export route, so a
 * choice triggers a real browser download WITHOUT navigating the page or
 * discarding the list's search / filter / sort state (FR-02).
 *
 * Keyboard (design-spec): open via click / ArrowDown / ArrowUp / Enter / Space;
 * Arrow / Home / End cycle the two items; Tab is trapped between them; Escape
 * closes and returns focus to the trigger; an outside pointer-down or a viewport
 * resize dismisses it. The open animation and chevron spin are CSS-driven with a
 * full prefers-reduced-motion fallback (see globals.css).
 */
export function ExportMenu({ playCount }: { playCount: number }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items = useCallback(
    () =>
      Array.from(
        menuRef.current?.querySelectorAll<HTMLAnchorElement>(
          '[role="menuitem"]',
        ) ?? [],
      ),
    [],
  );

  const reduced = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const focusItem = useCallback(
    (index: number) => {
      const list = items();
      if (!list.length) return;
      const n = list.length;
      list[((index % n) + n) % n]?.focus();
    },
    [items],
  );

  const openMenu = useCallback(() => {
    setOpen(true);
    window.setTimeout(() => focusItem(0), reduced() ? 0 : 20);
  }, [focusItem]);

  const closeMenu = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) btnRef.current?.focus();
  }, []);

  // Outside pointer-down and viewport resize dismiss the open menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) openMenu();
      else focusItem(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openMenu();
      window.setTimeout(() => focusItem(-1), reduced() ? 0 : 20);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        closeMenu(true);
      }
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const list = items();
    const n = list.length;
    if (!n) return;
    const idx = list.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(idx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(idx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(n - 1);
    } else if (e.key === "Tab") {
      // Trap Tab between the two items (design-spec).
      e.preventDefault();
      focusItem(idx + (e.shiftKey ? -1 : 1));
    }
  }

  const scopeCaption =
    playCount === 0
      ? "Your archive is empty. You’ll still get a valid header-only file."
      : `Your whole archive, all ${playCount} ${
          playCount === 1 ? "play" : "plays"
        }, not just what’s shown.`;

  return (
    <div className="export-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className="btn btn-ghost btn-lg export-btn"
        id="exportBtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="exportMenu"
        onClick={() => (open ? closeMenu(true) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <Download size={17} strokeWidth={1.9} aria-hidden="true" />
        Export
        <ChevronDown
          className="chev"
          size={14}
          strokeWidth={2.1}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn("export-menu", open && "open")}
        id="exportMenu"
        ref={menuRef}
        role="menu"
        aria-label="Choose an export format"
        onKeyDown={onMenuKeyDown}
      >
        <p className="export-menu-head" id="exportMenuHead">
          Download a copy
        </p>

        <a
          className="export-item"
          role="menuitem"
          tabIndex={-1}
          href="/api/export?format=csv"
          download=""
          onClick={() => closeMenu(true)}
        >
          <span className="export-ico" aria-hidden="true">
            <FileText size={20} strokeWidth={1.6} />
          </span>
          <span className="export-copy">
            <span className="export-lbl">Download CSV</span>
            <span className="export-hint">
              Spreadsheet-ready plain text, opens anywhere
            </span>
          </span>
        </a>

        <a
          className="export-item"
          role="menuitem"
          tabIndex={-1}
          href="/api/export?format=xlsx"
          download=""
          onClick={() => closeMenu(true)}
        >
          <span className="export-ico" aria-hidden="true">
            <FileSpreadsheet size={20} strokeWidth={1.6} />
          </span>
          <span className="export-copy">
            <span className="export-lbl">Download Excel (.xlsx)</span>
            <span className="export-hint">Opens in Excel or Numbers</span>
          </span>
        </a>

        <p className="export-foot" id="exportFoot">
          <span className="ef-ico" aria-hidden="true">
            <Check size={14} strokeWidth={1.8} />
          </span>
          <span id="exportFootText">{scopeCaption}</span>
        </p>
      </div>
    </div>
  );
}
