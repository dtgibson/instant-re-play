"use client";

import { Fragment } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { formatDate, isFuture, type Play } from "@/lib/play";
import type { ActiveFilter, FilterType } from "@/lib/query";
import { cn } from "@/lib/utils";

import { PersonValue } from "./person-value";

/**
 * One logged play, rendered as a floating plaster plane (FR-10). Blank optional
 * fields are omitted entirely — the field label appears only when a value
 * exists, so nothing reads as placeholder data (FR-03).
 */
export function PlayRow({
  play,
  filter,
  settling,
  removing,
  onFilter,
  onEdit,
  onDelete,
}: {
  play: Play;
  filter: ActiveFilter | null;
  settling: boolean;
  removing: boolean;
  onFilter: (type: FilterType, value: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const d = formatDate(play.date);
  const future = isFuture(play.date);
  const venueActive =
    filter?.type === "venue" && filter.value === play.venue;

  return (
    <li
      className={cn("entry", settling && "settling", removing && "removing")}
      data-id={play.id}
      role="row"
    >
      <div className="cell cell-date" role="cell">
        <span className="celllabel">Seen</span>
        {d ? (
          <>
            <span className="d-dm">
              {d.day} {d.mon}
            </span>
            <span className="d-yr">{d.year}</span>
          </>
        ) : (
          <span className="d-none">Undated</span>
        )}
      </div>

      <div className="cell cell-name" role="rowheader">
        <h3 className="playname">{play.name}</h3>
        {future && <span className="future-tag">Upcoming</span>}
      </div>

      <div className="cell cell-venue" role="cell">
        {play.venue && (
          <>
            <span className="celllabel">Venue</span>
            <span className="valwrap">
              <button
                type="button"
                className={cn("fval", "venue", venueActive && "is-active")}
                onClick={() => onFilter("venue", play.venue)}
                aria-pressed={venueActive}
              >
                {play.venue}
              </button>
            </span>
          </>
        )}
      </div>

      <div className="cell cell-writer" role="cell">
        {play.playwright && (
          <>
            <span className="celllabel">Written by</span>
            <span className="valwrap">
              <PersonValue
                type="playwright"
                name={play.playwright}
                active={
                  filter?.type === "playwright" &&
                  filter.value === play.playwright
                }
                onFilter={onFilter}
              />
            </span>
          </>
        )}
      </div>

      <div className="cell cell-dir" role="cell">
        {play.director && (
          <>
            <span className="celllabel">Director</span>
            <span className="valwrap">
              <PersonValue
                type="director"
                name={play.director}
                active={
                  filter?.type === "director" &&
                  filter.value === play.director
                }
                onFilter={onFilter}
              />
            </span>
          </>
        )}
      </div>

      <div className="cell cell-cast" role="cell">
        {play.actors.length > 0 && (
          <>
            <span className="celllabel">Cast</span>
            <span className="valwrap cast-line">
              {play.actors.map((actor, i) => (
                <Fragment key={`${actor}-${i}`}>
                  {i > 0 && (
                    <span className="cast-sep" aria-hidden="true">
                      {", "}
                    </span>
                  )}
                  <PersonValue
                    type="actor"
                    name={actor}
                    active={
                      filter?.type === "actor" && filter.value === actor
                    }
                    onFilter={onFilter}
                  />
                </Fragment>
              ))}
            </span>
          </>
        )}
      </div>

      <div className="cell cell-actions" role="cell">
        <button
          type="button"
          className="iconbtn"
          onClick={() => onEdit(play.id)}
          aria-label={`Edit ${play.name}`}
        >
          <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />
          <span className="btn-txt">Edit</span>
        </button>
        <button
          type="button"
          className="iconbtn danger"
          onClick={() => onDelete(play.id)}
          aria-label={`Delete ${play.name}`}
        >
          <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />
          <span className="btn-txt">Delete</span>
        </button>
      </div>
    </li>
  );
}
