# How to View and Verify — README App Screenshot

## View the result

Open `README.md` in GitHub or another Markdown renderer. The populated Play Log
screenshot appears immediately after the introduction and before
`## How it works`.

The source image is `docs/instant-re-play-play-log.png`.

## Verify the documentation change

From the repository root:

```bash
test -f docs/instant-re-play-play-log.png
grep -F '![Instant Re-Play Play Log populated with sample theatre visits](docs/instant-re-play-play-log.png)' README.md
file docs/instant-re-play-play-log.png
```

The final command should report a 1920 × 820 PNG. Visually confirm that it
shows the normal unfiltered Play Log with the masthead, search, stats, export,
log-a-play control, archive count, and populated play rows. It should contain
no browser chrome, debug overlay, toast, drawer, or focus ring.

## Reproduce the safe local data setup

Choose a new temporary directory, then seed and run with production database
and Supabase variables absent:

```bash
CAPTURE_DIR="$(mktemp -d /tmp/instant-replay-readme.XXXXXX)"
env -u DATABASE_URL -u NEXT_PUBLIC_SUPABASE_URL \
  -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u ALLOWED_EMAILS \
  PGLITE_DATA_DIR="$CAPTURE_DIR/db" npm run seed
env -u DATABASE_URL -u NEXT_PUBLIC_SUPABASE_URL \
  -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u ALLOWED_EMAILS \
  PGLITE_DATA_DIR="$CAPTURE_DIR/db" npm run dev
```

This uses the existing sample archive and development auth bypass. Do not set
`DATABASE_URL` for a documentation capture.
