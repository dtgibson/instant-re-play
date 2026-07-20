"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";

import type { Play } from "@/lib/play";
import { useOverlayA11y } from "@/lib/use-overlay-a11y";
import { cn } from "@/lib/utils";

/**
 * Delete confirmation (FR-09): an explicit, focus-trapped alertdialog. "Keep
 * it" declines and leaves the entry untouched; "Delete" removes it permanently
 * (no undo). Focus lands on the safe choice first.
 */
export function ConfirmDialog({
  open,
  play,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  play: Play | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useOverlayA11y({
    active: open,
    containerRef: confirmRef,
    onClose: onCancel,
    initialFocusRef: cancelRef,
  });

  const target = play
    ? `${play.name}${play.venue ? `  ·  ${play.venue}` : ""}`
    : "";

  return (
    <div
      className={cn("confirm-scrim", open && "open")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={confirmRef}
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmTitle"
        aria-describedby="confirmDesc"
      >
        <p className="kicker">Delete entry</p>
        <h3 id="confirmTitle">Delete this play?</h3>
        <p id="confirmDesc">
          This removes the production from your archive permanently. This
          can&rsquo;t be undone.
        </p>
        {play && <p className="target">{target}</p>}
        <div className="confirm-foot">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost btn-md"
            onClick={onCancel}
          >
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger btn-md"
            onClick={onConfirm}
          >
            <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
