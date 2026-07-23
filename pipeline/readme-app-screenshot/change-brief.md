# Change Brief — README App Screenshot

## What is changing
Add one current, representative screenshot of the populated Play Log to the
project README. Use the existing `npm run seed` sample archive, run the real app
locally, and capture the normal unfiltered desktop log at a viewport wide
enough to show the interface clearly. Store the image as a repository asset
(under `docs/`) and embed it immediately after the README introduction, before
`## How it works`, with concise descriptive alt text.

## Why now
The README explains the product and its behavior well, but a GitHub visitor
cannot currently see the interface without installing and running the app. A
truthful screenshot makes the design and the core archive experience legible at
a glance.

## User-facing impact
Documentation only. GitHub visitors see the populated Play Log near the top of
the README. The application, its sample data, authentication, persistence, and
runtime behavior do not change.

## Design pass
Not needed. This uses the shipped interface and the existing approved sample
archive without redesigning either. The work is capture composition and README
placement, not a new or changed product surface.

## Decisions touched
- **README presentation** — adds a visual product overview between the opening
  description and the detailed behavior sections.
- **Repository assets** — establishes `docs/instant-re-play-play-log.png` as a
  checked-in documentation image referenced with a relative Markdown path so it
  renders on GitHub and repository forks.
- No product, schema, auth, design-system, deployment, or seed-data decisions
  change.

## What done looks like
- The local archive is populated using the existing `npm run seed` sample data;
  no production or personal archive data appears in the image.
- The screenshot is captured from the running app in its normal unfiltered
  state and visibly includes the masthead, primary controls, and enough populated
  play rows to communicate the interface.
- The image is crisp and readable at GitHub's README width, with no browser
  chrome, debug UI, transient toast, open drawer, focus ring, or clipped core
  controls.
- `README.md` embeds the checked-in PNG directly after the introduction and
  before `## How it works`, using useful alt text.
- The relative image link resolves from the repository and the README remains
  clear when the image cannot be loaded.
