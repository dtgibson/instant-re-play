# PR Description — README App Screenshot

## Summary

- adds a current screenshot of the real desktop Play Log populated with the
  project's 14 built-in sample plays
- stores the repository image at `docs/instant-re-play-play-log.png`
- places the screenshot after the README introduction so visitors can see the
  product before reading the detailed behavior

## Scope

Documentation only. No application code, sample data, authentication, schema,
or design-system files were changed.

## Capture safety

The screenshot was captured from a local Next.js development server using an
isolated temporary PGlite directory. `DATABASE_URL` and the Supabase/allowlist
variables were absent, so the app used its development-only synthetic user and
could not access a production or personal archive.

## Verification

- seeded 14 plays into the temporary PGlite archive with `npm run seed`
- opened the real unfiltered `/` Play Log at a 1920 × 820 desktop viewport,
  framing the masthead, controls, and four representative rows
- suppressed the Next.js development-tools portal in the capture browser only;
  no application source or runtime behavior was modified
- visually inspected the PNG for the masthead, core controls, populated rows,
  browser-chrome-free composition, and absence of transient UI
- verified the README's relative image path resolves to the checked-in PNG
