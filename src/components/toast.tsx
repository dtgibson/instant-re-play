"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Save / update / delete confirmation (FR-07). role="status" announces it. */
export function Toast({ message, show }: { message: string; show: boolean }) {
  return (
    <div className={cn("toast", show && "show")} role="status" aria-live="polite">
      <span className="tk" aria-hidden="true">
        <Check size={17} strokeWidth={2.2} />
      </span>
      <span>{message}</span>
    </div>
  );
}
