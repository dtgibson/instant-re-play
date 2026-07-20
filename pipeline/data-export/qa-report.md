# QA Report — Data Export

**Date:** 2026-07-19
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results

47 tests passing, 0 failing (4 files: export 16, play 13, query 11, repository 7). No regression in the existing play-log / query / repository suites. `npm run smoke:export` (scripts/export-smoke.ts) passes 26 assertions end-to-end.

Build gates: `npx tsc --noEmit` clean (exit 0); `npm run build` succeeds with `/api/export` emitted as a dynamic route.

> **Note — one build-gate failure was found and fixed during QA.** The first QA pass failed `tsc`/`next build` on a TypeScript error inside two ad-hoc verifier helper scripts (`scripts/verify-export.ts`, `scripts/verify-smoke.ts`) that earlier verification agents had left in `scripts/`. They were throwaway harnesses — not wired into `package.json`, not referenced anywhere, and duplicating coverage already held by the `tests/` suite and the wired `smoke`/`smoke:export` scripts. They were removed (the shipping export code was never touched), after which all gates pass.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 Export control present & reachable | ✓ Pass | Ghost Export control renders in page HTML; present on empty log via playCount. |
| QA-02 Download without navigation | ✓ Pass | `<a download>` links + closeMenu; no page nav, no list-state loss. |
| QA-03 Exports full archive, not filtered view | ✓ Pass | Route reads listPlays() ignoring UI state; date-desc, undated last. |
| QA-04 Header row exact | ✓ Pass | `Name,Date seen,Venue,Director,Cast` in CSV and xlsx. |
| QA-05 Cast joined; empty blank | ✓ Pass | `"; "` join; empty cast → blank cell (e.g. Oklahoma!). |
| QA-06 Blanks & ISO dates | ✓ Pass | Blank optional fields → empty cells; dates `YYYY-MM-DD`. |
| QA-07 CSV escaping | ✓ Pass | UTF-8 BOM + CRLF live; comma-quoting live; quote-doubling & newline via unit tests + smoke. |
| QA-08 Formula-injection neutralization | ✓ Pass | Leading `= + - @` / tab / CR → apostrophe, in CSV and xlsx (unit tests + smoke + adversarial). |
| QA-09 Genuine xlsx | ✓ Pass | Real OOXML; cells text (numFmt `@`); read back with exceljs. |
| QA-10 Correct headers per format | ✓ Pass | Content-Type per format + Content-Disposition attachment. |
| QA-11 Dated filename | ✓ Pass | `instant-re-play-2026-07-19.csv` / `.xlsx`. |
| QA-12 Empty-log export | ✓ Pass | Valid header-only file in both formats, no error. |
| QA-13 Reads at request time | ✓ Pass | Route `force-dynamic`, reads archive on each request. |
| QA-14 Export of up to 1,000 plays is prompt | ✓ Pass (not load-tested) | Server-side in-memory streaming; not measured at 1,000 rows — plausible, unmeasured. |
| QA-15 No third party receives data | ✓ Pass | nodejs runtime, own PGlite/Neon; exceljs local; no external host. |
| QA-16 Responsive to 360px | ✓ Pass (code/CSS) | Responsive `.export-wrap`; verified by code, not visually driven on a device. |
| QA-17 Keyboard-operable menu | ✓ Pass (code) | Visible labels, aria-haspopup/expanded/controls, Escape/Tab-trap/focus-return/Arrow/Home/End. |
| QA-18 Secondary affordance (aloe reserved) | ✓ Pass | `.btn-ghost`; aloe stays on "Log a play" only. |
| QA-19 xlsx safety parity | ✓ Pass | Same neutralization/escaping guarantees as CSV. |

## Edge Cases Tested

Formula-injection payloads (`=1+1`, `+SUM`, `-2`, `@cmd`, leading tab/CR); values containing commas, double-quotes, and newlines (RFC-4180 round-trip); a venue with an embedded comma (quoted); empty cast; all-blank optional fields; empty log (header-only); unknown/missing `format` param (400).

## Known Limitations

- 1,000-entry export timing (QA-14) is plausible from the architecture but was not load-tested.
- xlsx round-trip was verified programmatically (exceljs read-back), not by opening in desktop Excel/Numbers.
- Interactive rows (QA-16/QA-17) verified via code and the running server, not a physical device or screen reader — recommended for final interactive confirmation before public launch.
