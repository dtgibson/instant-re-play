"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, CircleAlert, Plus, X } from "lucide-react";

import {
  DATE_INVALID_MESSAGE,
  NAME_REQUIRED_MESSAGE,
  normalizePlayInput,
  validatePlayInput,
  type FieldErrors,
  type Play,
  type PlayInput,
} from "@/lib/play";
import { collectFieldValues } from "@/lib/suggest";
import { useOverlayA11y } from "@/lib/use-overlay-a11y";
import { cn } from "@/lib/utils";

import { AutocompleteInput } from "./autocomplete-input";

/**
 * The add / edit drawer. Owns the transient form state; validates name and date
 * client-side for instant inline errors (FR-02/FR-04) while preserving every
 * other entered value; folds a typed-but-not-added actor into the cast on save;
 * and delegates the actual write to `onSubmit`, which re-validates server-side.
 */
export function PlayDrawer({
  open,
  editingPlay,
  plays,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editingPlay: Play | null;
  /** The full in-page archive — the source for self-sourced autocomplete. */
  plays: Play[];
  onClose: () => void;
  onSubmit: (input: PlayInput) => Promise<FieldErrors | null>;
}) {
  const drawerRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);
  const actorInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [playwright, setPlaywright] = useState("");
  const [director, setDirector] = useState("");
  const [actorInput, setActorInput] = useState("");
  const [draftActors, setDraftActors] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  const isEdit = editingPlay !== null;

  // Self-sourced autocomplete: the user's own distinct prior values per field,
  // derived once from the archive already loaded in the page (no round-trip).
  const venueOptions = useMemo(() => collectFieldValues(plays, "venue"), [plays]);
  const playwrightOptions = useMemo(
    () => collectFieldValues(plays, "playwright"),
    [plays],
  );
  const directorOptions = useMemo(
    () => collectFieldValues(plays, "director"),
    [plays],
  );
  const actorOptions = useMemo(() => collectFieldValues(plays, "actor"), [plays]);

  // Prefill (edit) or reset (add) whenever the drawer opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setActorInput("");
    setSaving(false);
    if (editingPlay) {
      setName(editingPlay.name);
      setDate(editingPlay.date);
      setVenue(editingPlay.venue);
      setPlaywright(editingPlay.playwright);
      setDirector(editingPlay.director);
      setDraftActors([...editingPlay.actors]);
    } else {
      setName("");
      setDate("");
      setVenue("");
      setPlaywright("");
      setDirector("");
      setDraftActors([]);
    }
  }, [open, editingPlay]);

  useOverlayA11y({
    active: open,
    containerRef: drawerRef,
    onClose,
    initialFocusRef: nameRef,
  });

  function addActor() {
    const value = actorInput.trim();
    if (!value) {
      actorInputRef.current?.focus();
      return;
    }
    setDraftActors((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setActorInput("");
    actorInputRef.current?.focus();
  }

  function removeActor(index: number) {
    setDraftActors((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;

    // Fold a typed-but-not-added actor into the list on save.
    const pending = actorInput.trim();
    const foldedActors =
      pending && !draftActors.includes(pending)
        ? [...draftActors, pending]
        : draftActors;
    if (pending) {
      setDraftActors(foldedActors);
      setActorInput("");
    }

    const input: PlayInput = {
      name,
      date,
      venue,
      playwright,
      director,
      actors: foldedActors,
    };
    const clientErrors = validatePlayInput(normalizePlayInput(input));
    if (clientErrors) {
      setErrors(clientErrors);
      if (clientErrors.name) nameRef.current?.focus();
      else if (clientErrors.date) dateRef.current?.focus();
      return; // nothing saved; all other entered values preserved
    }

    setErrors({});
    setSaving(true);
    const serverErrors = await onSubmit(input);
    if (serverErrors) {
      setErrors(serverErrors);
      setSaving(false);
      if (serverErrors.name) nameRef.current?.focus();
      else if (serverErrors.date) dateRef.current?.focus();
      return;
    }
    // On success the parent closes the drawer.
  }

  return (
    <>
      <div
        className={cn("scrim", open && "open")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={drawerRef}
        className={cn("drawer", open && "open")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawerTitle"
        aria-hidden={!open}
      >
        <div className="drawer-head">
          <p className="kicker">{isEdit ? "Editing entry" : "New entry"}</p>
          <h2 id="drawerTitle">{isEdit ? "Edit play" : "Log a play"}</h2>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <form
          className="drawer-body"
          id="playForm"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className={cn("field", errors.name && "invalid")}>
            <label htmlFor="fName">
              Play name{" "}
              <span className="req" aria-hidden="true">
                (required)
              </span>
            </label>
            <input
              ref={nameRef}
              className="input"
              id="fName"
              name="name"
              type="text"
              autoComplete="off"
              spellCheck={false}
              aria-required="true"
              aria-invalid={errors.name ? "true" : undefined}
              aria-describedby="errName"
              placeholder="e.g. A Streetcar Named Desire"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <span className="err" id="errName" role="alert">
              <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
              {errors.name ?? NAME_REQUIRED_MESSAGE}
            </span>
          </div>

          <div className={cn("field", errors.date && "invalid")}>
            <label htmlFor="fDate">
              Date seen <span className="opt">optional</span>
            </label>
            <input
              ref={dateRef}
              className="input"
              id="fDate"
              name="date"
              type="date"
              aria-invalid={errors.date ? "true" : undefined}
              aria-describedby="errDate"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="err" id="errDate" role="alert">
              <CircleAlert size={14} strokeWidth={1.8} aria-hidden="true" />
              {errors.date ?? DATE_INVALID_MESSAGE}
            </span>
          </div>

          <div className="field">
            <label htmlFor="fVenue">
              Venue <span className="opt">optional</span>
            </label>
            <AutocompleteInput
              id="fVenue"
              value={venue}
              onChange={setVenue}
              values={venueOptions}
              placeholder="e.g. Almeida Theatre"
            />
          </div>

          {/* Playwright sits just above Director: who wrote it, then who staged it. */}
          <div className="field">
            <label htmlFor="fPlaywright">
              Playwright <span className="opt">optional</span>
            </label>
            <AutocompleteInput
              id="fPlaywright"
              value={playwright}
              onChange={setPlaywright}
              values={playwrightOptions}
              placeholder="e.g. Tennessee Williams"
            />
          </div>

          <div className="field">
            <label htmlFor="fDirector">
              Director <span className="opt">optional</span>
            </label>
            <AutocompleteInput
              id="fDirector"
              value={director}
              onChange={setDirector}
              values={directorOptions}
              placeholder="e.g. Rebecca Frecknall"
            />
          </div>

          <div className="field">
            <span className="lab" id="castLabel">
              Cast{" "}
              <span className="opt">
                optional · add one at a time, order kept
              </span>
            </span>
            <div className="actor-row">
              <label htmlFor="fActor" className="visually-hidden">
                Add an actor
              </label>
              <AutocompleteInput
                id="fActor"
                inputRef={actorInputRef}
                value={actorInput}
                onChange={setActorInput}
                values={actorOptions}
                placeholder="Actor name, then Add"
                ariaDescribedBy="castLabel"
                onEnterWithoutSuggestion={addActor}
              />
              <button
                type="button"
                className="actor-add"
                onClick={addActor}
              >
                <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
                Add
              </button>
            </div>
            {draftActors.length > 0 ? (
              <ul className="actor-list" aria-label="Cast added so far">
                {draftActors.map((actor, i) => (
                  <li key={`${actor}-${i}`}>
                    <span className="pos" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="nm">{actor}</span>
                    <button
                      type="button"
                      className="rm"
                      onClick={() => removeActor(i)}
                      aria-label={`Remove ${actor}`}
                    >
                      <X size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="actor-empty">No cast added yet.</p>
            )}
          </div>
        </form>

        <div className="drawer-foot">
          <button
            type="button"
            className="btn btn-ghost btn-md"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-md"
            form="playForm"
            disabled={saving}
          >
            <Check size={15} strokeWidth={2.2} aria-hidden="true" />
            <span>{isEdit ? "Save changes" : "Save to log"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
