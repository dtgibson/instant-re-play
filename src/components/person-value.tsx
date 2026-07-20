"use client";

import { ExternalLink } from "lucide-react";

import { imdbUrl } from "@/lib/play";
import type { FilterType } from "@/lib/query";
import { cn } from "@/lib/utils";

/**
 * A person's name in the log: the name itself is the click-to-filter affordance
 * (a dotted "sill" underline — shape, not colour), and a *separate*, visually
 * distinct boxed external-link icon opens an IMDb name-search in a new tab
 * (FR-18). Two elements, two hit areas: one click never does both. The
 * affordance distinction is shape + icon, never colour alone (NFR-04).
 */
export function PersonValue({
  type,
  name,
  active,
  onFilter,
}: {
  type: Extract<FilterType, "playwright" | "director" | "actor">;
  name: string;
  active: boolean;
  onFilter: (type: FilterType, value: string) => void;
}) {
  return (
    <span className="person">
      <button
        type="button"
        className={cn("fval", active && "is-active")}
        onClick={() => onFilter(type, name)}
        aria-pressed={active}
      >
        {name}
      </button>
      <a
        className="imdb"
        href={imdbUrl(name)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Search IMDb for ${name} (opens in a new tab)`}
        title={`Search IMDb for ${name}`}
      >
        <ExternalLink size={11} strokeWidth={1.7} aria-hidden="true" />
      </a>
    </span>
  );
}
