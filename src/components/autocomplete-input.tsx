"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { highlightFragment, suggestValues } from "@/lib/suggest";
import { cn } from "@/lib/utils";

/**
 * A text input with a self-sourced suggestion plane (the "From your archive"
 * autocomplete). It is a pure convenience over a normal input: suggestions are
 * the user's own prior values (`values`), matched as a case-insensitive
 * substring, and NOTHING is ever auto-corrected — an unmatched fragment shows no
 * plane and saves exactly as typed.
 *
 * Keyboard-first combobox: ArrowUp/Down move the active row, Enter fills it,
 * Escape dismisses (without closing the surrounding drawer), and typing keeps
 * filtering. Follows the ARIA combobox/listbox pattern (role, aria-expanded,
 * aria-controls, aria-activedescendant) with focus staying on the input. The
 * open transition is CSS and is removed under prefers-reduced-motion (globals).
 */
export function AutocompleteInput({
  id,
  value,
  onChange,
  values,
  placeholder,
  inputRef,
  spellCheck,
  className = "input",
  ariaLabel,
  ariaDescribedBy,
  onEnterWithoutSuggestion,
  cap = 6,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Distinct prior values for this field (from the archive loaded in-page). */
  values: string[];
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  spellCheck?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  /** Called on Enter when no suggestion is active (e.g. the cast "Add"). */
  onEnterWithoutSuggestion?: () => void;
  cap?: number;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const optionId = (i: number) => `${reactId}-opt-${i}`;

  const suggestions = useMemo(
    () => suggestValues(values, value, cap),
    [values, value, cap],
  );
  const showPlane = open && suggestions.length > 0;
  const activeInRange = active >= 0 && active < suggestions.length;

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      localRef.current = node;
      if (inputRef) inputRef.current = node;
    },
    [inputRef],
  );

  function fill(v: string) {
    onChange(v);
    setOpen(false);
    setActive(-1);
    localRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!showPlane) {
          setOpen(true);
          setActive(0);
          return;
        }
        setActive((a) => Math.min(a + 1, suggestions.length - 1));
        return;
      case "ArrowUp":
        if (!showPlane) return;
        e.preventDefault();
        setActive((a) => (a <= 0 ? 0 : a - 1));
        return;
      case "Home":
        if (!showPlane) return;
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        if (!showPlane) return;
        e.preventDefault();
        setActive(suggestions.length - 1);
        return;
      case "Enter":
        if (showPlane && activeInRange) {
          e.preventDefault();
          fill(suggestions[active]);
          return;
        }
        if (onEnterWithoutSuggestion) {
          e.preventDefault();
          onEnterWithoutSuggestion();
        }
        return; // otherwise let the form submit
      case "Escape":
        if (showPlane) {
          // Dismiss the plane WITHOUT letting the drawer's Escape handler close.
          // The drawer listens on `document`; React's delegated listener is on
          // the same root, so stopImmediatePropagation is what actually prevents
          // the drawer's Escape from also firing (plain stopPropagation would
          // not, when both listeners share a target).
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          setOpen(false);
          setActive(-1);
        }
        return; // when closed, let Escape bubble to close the drawer
      default:
        return;
    }
  }

  return (
    <div className="ac-wrap">
      <input
        ref={setRef}
        id={id}
        className={cn(className, showPlane && "is-open")}
        type="text"
        autoComplete="off"
        spellCheck={spellCheck}
        placeholder={placeholder}
        value={value}
        role="combobox"
        aria-expanded={showPlane}
        aria-controls={showPlane ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={
          showPlane && activeInRange ? optionId(active) : undefined
        }
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      {showPlane && (
        <div className="ac">
          <p className="ac-cap">From your archive</p>
          <ul className="ac-list" id={listboxId} role="listbox" aria-label={ariaLabel ? `${ariaLabel} suggestions` : "Suggestions from your archive"}>
            {suggestions.map((s, i) => (
              <li
                key={s}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={cn("ac-item", i === active && "active")}
                // mousedown (not click) so the fill runs before the input blurs
                onMouseDown={(e) => {
                  e.preventDefault();
                  fill(s);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="dotm" aria-hidden="true" />
                <span className="ac-txt">
                  {highlightFragment(s, value).map((part, pi) =>
                    part.match ? (
                      <mark key={pi}>{part.text}</mark>
                    ) : (
                      <span key={pi}>{part.text}</span>
                    ),
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="ac-hint" aria-hidden="true">
            <kbd>&uarr;</kbd> <kbd>&darr;</kbd> choose{" · "}
            <kbd>Enter</kbd> fill{" · "}
            <kbd>Esc</kbd> dismiss
          </p>
        </div>
      )}
    </div>
  );
}
