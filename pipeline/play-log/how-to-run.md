# Seeing the Play Log locally

This is the whole guide — no prior setup knowledge assumed. You do **not** need a
database account, a cloud login, or any environment variables. The app ships with
an embedded database (PGlite) that saves everything to a folder on your own
machine, so it just works.

You need [Node.js](https://nodejs.org) version 24 (or newer) installed. Check with:

```bash
node -v
```

## 1. Install

From the project folder (`instant-re-play`), run once:

```bash
npm install
```

## 2. Start the app

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser. (The dev command starts the
server on **port 3000** by default.)

The first time you open it the archive is **empty on purpose** — you'll see a calm
"Your archive is open" screen inviting you to log your first play. That's the real
first-run experience.

## 3. (Optional) Load the sample log

To see a populated archive immediately — 14 real West End productions, including a
few deliberate edge cases — stop the server (press `Ctrl+C`) and run:

```bash
npm run seed
```

Then start it again with `npm run dev` and refresh the page. You'll now see the
full list. Re-running `npm run seed` is safe — it clears and reloads the sample
data each time. To go back to an empty archive, delete the `.data` folder.

## What to click, and what to expect

- **Log a play** (top-right button) — opens a panel that slides in from the right.
  - The **play name is required**. Try leaving it blank and pressing *Save* — you
    get a friendly inline error and nothing is lost.
  - **Date seen** is optional and must be a real date. Try `2024-02-31` (there's no
    31st of February) — it's rejected. A **future date is fine** — it gets an
    "Upcoming" tag in the list.
  - **Venue** and **Director** are optional.
  - **Cast** is added one name at a time: type a name and press *Add* (or Enter).
    Each actor gets a number and a remove button; order is kept. Leading/trailing
    spaces are trimmed and exact duplicates are ignored automatically.
  - Press *Save to log* — the new entry appears at the top and a small confirmation
    toast slides up.
- **Sort** — on a wide screen, click the **Seen / Production / Venue** column
  headers to sort; click again to flip the direction. On a phone, use the
  **Sort** buttons above the list. The default is date seen, newest first. Entries
  with no value in the sorted field always fall to the bottom.
- **Search** — type in the search box at the top. It filters live across titles,
  venues, directors, and cast, and is case-insensitive (searching `mescal` finds
  *A Streetcar Named Desire*). The little ✕ clears it.
- **Click to filter** — click any **venue**, **director**, or **actor** name in the
  list (they have a dotted underline). The list narrows to everything sharing that
  value, and a banner tells you what you're filtered by. Click **Clear filter**, or
  click the same value again, to turn it off. Only one filter at a time; search and
  a filter combine.
- **IMDb** — next to each **actor and director** name is a small boxed
  external-link icon. Clicking it opens an IMDb name-search in a new tab. Venues
  have no link (by design). Clicking the name filters; clicking the icon opens
  IMDb — they never do both.
- **Edit / Delete** — each row has edit and delete buttons on the right (labeled on
  mobile). Delete asks you to confirm first; there's no undo.
- **It remembers** — everything you add, edit, or delete is saved to disk. Close the
  browser, stop the server, start it again — your archive is exactly as you left it.

## Where the data lives

Locally, your log is stored in the **`.data/pglite`** folder inside the project
(created automatically). It's a real embedded Postgres database. Deleting that
folder resets you to an empty archive.

For a real deployment (e.g. Neon Postgres on Vercel), set `DATABASE_URL` and the
app uses that instead — see `.env.example`.

## Handy commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app at http://localhost:3000 |
| `npm run seed` | Load the 14-entry sample log |
| `npm run build` | Production build |
| `npm run smoke` | Headless check of the data layer + logic |
| `npm test` | Run the test suite |
