# QA Report — README App Screenshot

## Result

**PASS.** The attempt-2 replacement removes the Next.js development-tools
badge while preserving the approved sample archive, framing, dimensions, and
interface composition. All documentation acceptance criteria now pass.

## Attempt history

- **Attempt 1 — FAIL:** the screenshot contained the circular Next.js
  development-tools badge in the lower-left corner.
- **Attempt 2 — PASS:** the replacement was inspected at full resolution. The
  development badge is absent, and no other debug or transient UI is visible.

## Automated verification

- Command: `npm test -- --run`
- Result: **PASS**
- Vitest files: **7 passed**
- Vitest tests: **104 passed**
- Duration: 3.30s (attempt-2 rerun)

## Documentation acceptance criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Checked-in PNG exists under `docs/` | PASS | `docs/instant-re-play-play-log.png` exists and decodes as an RGB PNG. |
| README embeds it after the introduction and before `## How it works` | PASS | The image is on README line 7, between the introductory copy and the section heading. |
| Relative image link resolves | PASS | `docs/instant-re-play-play-log.png` resolves from the repository root. |
| Useful fallback/alt text | PASS | “Instant Re-Play Play Log populated with sample theatre visits” identifies both the product view and its populated state. |
| Uses representative sample data | PASS | The image shows the synthetic `dev@localhost` session, a 14-play archive, and representative theatre entries rather than personal account data. |
| Shows the normal unfiltered Play Log | PASS | The masthead, empty search field, archive count, Stats, Export, Log a Play, column headers, and four populated rows are visible. No active filter is shown. |
| No browser chrome or transient product UI | PASS | No browser frame, toast, drawer, modal, or focus ring is visible. |
| No debug UI | PASS | Full-resolution inspection of the attempt-2 PNG confirms that the Next.js development-tools badge is absent and no debug overlay is visible. |

## Image inspection

- Dimensions: **1920 × 820**, matching the documented capture dimensions.
- Encoding: 8-bit RGB, non-interlaced PNG.
- Composition: the core desktop shell is centered and readable, with the
  masthead, primary controls, archive metadata, column labels, and four play
  rows visible at useful scale.
- The tight Director/Cast boundary in some rows is visible, but is treated as a
  **non-blocking existing limitation** of the shipped 1180px shell. The image
  otherwise truthfully represents the current app.
- The lower-left area is now clean; the attempt-1 Next.js development-tools
  badge has been removed without cropping or disrupting the composition.

## Scope containment

**PASS.** Git status shows no changes under application source, auth, database
schema/migrations, seed scripts/data, tests, public product assets, package
manifests, or the design system. The product change is confined to:

- `README.md`
- `docs/instant-re-play-play-log.png`
- documentation artifacts under `pipeline/readme-app-screenshot/`

No app behavior, authentication, schema, sample seed data, or product design
was changed.

## Final disposition

Approved for the next Weft stage. No QA follow-up is required.
