# Moonscribe ✦

A quiet, private place to write — made for two.

A local-first novel-writing and book-design studio. No paywalls, no chapter or
character caps, no export limits. Every word stays in your browser
(IndexedDB), works offline, and can be installed on an iPad or phone as a
Progressive Web App. When you want your novels in more than one place, sign in
with your own account and they're mirrored to the server — each writer's
library stays private to them.

## The flow

1. **Open it and begin** — first launch is a soft welcome (made with love, for
   Storm). One tap creates your first novel and a first chapter.
2. **Write** — a clean, distraction-free editor with basic formatting
   (bold / italic / headings / scene breaks), auto-save, live word count,
   session words and a gentle daily-goal bar. Right-click anything — chapters,
   cards, moodboard tiles — for a quick menu of actions.
3. **Organise** — chapters in parts/volumes with draft/revised/final status,
   character profiles with custom fields, free-form notes linked to chapters
   or characters, and a relationship list with a 3D constellation map. All the
   binder sections open in a panel that slides over the editor, so you never
   lose your place in the manuscript.
4. **Build your world** — a worldbuilding binder with cultures, places,
   history, magic systems and artefacts, plus a moodboard with draggable
   sticky notes and image tiles.
5. **Design** — the Book Designer has a cover studio (subtitle, byline,
   ornament, live 2D preview and an interactive 3D mock-up) plus body
   typography and title-page controls. Sign the title page with your own
   author signature, or drag a premade design pack onto the cover or the pages
   to restyle everything in one move — the same packs drop onto the chapter
   editor from its **Designs** palette. Then one click opens the print view:
   browser "Save as PDF" gives you a formatted book. No printer required.
6. **Export** — the full novel as Markdown, plain text, or a formatted `.docx`
   (title page + chapters). All in-browser; nothing leaves the machine.

## Privacy

- Data lives in your browser's IndexedDB. Offline by default, private by design.
- Back up anytime from **Settings → Download backup**, and restore on any
  other device to move your words there.

## Multi-device sync

Moonscribe can sync between devices through the bundled sync server. It's a
small dependency-free Node server using `node:sqlite` — no extra database to
run. Each writer creates an account (username + password, hashed on the
server), and each account owns its own library.

```bash
npm run server    # starts the sync server on :3001
```

On each device: **Settings → Sign in**, enter the server address and your
username + password (or create an account right there). Your novels are then
mirrored server-side, and **Sync now** (dashboard header) pushes local changes
and pulls the other device's. Deletes sync as tombstones; covers and moodboard
images travel as data-URLs. If two devices edit the same record, the newer
`updatedAt` wins and the loser is re-pushed. A server can hold any number of
writers, each in their own private library.

## Run it

```bash
npm install
npm run dev        # develop at http://localhost:5173 (/api proxies to :3001)
npm test           # unit tests (words, converters, db, sync engine)
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm run server     # run the sync server (used by the app in production)
```

The production build (`dist/`) is fully static: the sync server also serves it,
so one process covers both. The server stores its data (and its generated
secret) under `./data`.

### Self-host with Docker (optional)

```bash
docker build -t moonscribe .
docker run -d -p 8080:3001 -v moonscribe-data:/app/data --name moonscribe moonscribe
# open http://localhost:8080
```

For the PWA to be installable on iPad/phone it must be served over **HTTPS**
(e.g. behind Caddy, nginx + Let's Encrypt, or any static host — the `dist/`
folder is fully static). If you don't need sync, you can serve `dist/` from
any static host and the app runs perfectly on its own.

## Project layout

```
server/         sync server (node:sqlite, per-user accounts, LWW merge)
src/
  db/           IndexedDB schema + repositories (novels, chapters, characters,
                notes, relationships, stats, world, moodboard, meta, backup)
  sync/         sync engine (dirty tracking, serialization, push/pull, auth)
  designs/      premade design packs (cover + page presets)
  utils/        word counting, markdown/text converters, DOCX export,
                name highlighting, download helpers, dates
  context/      global app context (novels, theme, sync, toasts)
  components/   editor, sidebar, context menu, design palette, binder panel,
                auth modal, sync status, settings, icons
  pages/        dashboard, workspace, characters, notes, relationships,
                world, moodboard, analytics, book designer, 3D cover,
                print view, onboarding
  styles/       design tokens (moonstone palette, light + moonlight dark),
                base, app, print
tests/          vitest suites for db, sync, converters, words, binder,
                designer, workspace
```

The design system lives in `styles/tokens.css` — every colour is a variable,
with a complete moonlight dark theme (choose **Settings → Theme**: light,
moonlight, or automatic).
