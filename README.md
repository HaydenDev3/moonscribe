# Moonscribe

> *A quiet, private place to write.*

Moonscribe is a local-first, offline-capable writing app built for long-form fiction. It runs entirely in the browser as a Progressive Web App — your work lives in IndexedDB on your device, with optional sync to a self-hosted server. No accounts required to write.

---

## What's been built

### Core editor

A rich-text chapter editor built on a native `contenteditable` element — no third-party editor framework.

- **Formatting toolbar** — bold, italic, underline, strikethrough, superscript, subscript, text colour, highlight colour, headings (H1–H3), blockquote, lists (ordered/unordered), alignment, links, comments, undo/redo
- **Font controls** — font family picker (Literata, Lora, Cormorant Garamond, Source Serif 4, Georgia, and more), font size, line spacing
- **Scene breaks** — dedicated `* * *` separator element, styled by the active design theme
- **Manual page breaks** — insertable `<hr>`-style page break that the pagination engine respects
- **Typewriter mode** — dims all paragraphs except the one being written; JS keeps the focused line vertically centred
- **Focus mode** — hides the sidebar and toolbar chrome so only the words remain
- **Typewriter scroll** — the active line stays at a comfortable vertical position as you write
- **Command palette** — `Ctrl+K` quick-access to app actions and navigation
- **AI assist** — inline AI writing button in the toolbar (connected to a server-side AI endpoint)
- **Word / character count** — live counts in the status bar with daily goal progress
- **Session word count** — tracks words added in the current session
- **Auto-save** — debounced save on every keystroke; saves to IndexedDB
- **Draft recovery** — if a session ends unexpectedly, unsaved content is recovered on next open

### Pagination

- **Page size selector** — None (continuous scroll), A4, A5, Letter, Legal
- **Visual page mode** — canvas constrains to the selected page width with correct proportions
- **Auto page-break engine** — measures rendered paragraph heights and inserts visual break indicators at overflow points; respects manual breaks and scene breaks; keeps headings with their following block
- **Break bar UI** — shows page number labels at each break; styled as a gap between physical pages
- **Persisted preference** — selected page size is remembered across sessions via `localStorage`

### Manuscript structure

- **Multiple novels** — each novel is isolated; the dashboard lists all novels with word count and chapter count
- **Chapter management** — create, rename, reorder (drag-and-drop), delete, and restore chapters; chapters live in a sidebar list
- **Chapter library** — slide-out panel showing all chapters with word counts for quick navigation
- **Corkboard** — card-based chapter overview; cards show scene context (POV, where, time, tone, beat); drag to reorder
- **Scene context bar** — per-chapter metadata (POV, where, time, tone, beat) editable at the top of the editor
- **Read mode** — distraction-free full-screen reading view of a chapter
- **Print view** — paginated print-ready layout of the full manuscript

### World-building tools

- **Characters** — character profiles with name, aliases, role, description, traits, relationships, notes, and avatar colour; linked to the editor via name highlighting
- **Relationships** — visual constellation map (`Three.js`) showing character connections; relationship entries store type, description, and strength
- **Worldbuilding** — free-form world entries organised by category (geography, culture, history, magic, technology, other)
- **Glossary / Term tracker** — define terms, jargon, and proper nouns; the editor automatically underlines matching words and shows a hover card with the definition
- **Continuity tracker** — log continuity notes (events, facts, timelines) per chapter; flag potential errors
- **Moodboard notes** — freeform notes live with visual inspiration in the Moodboard, rather than in a separate sidebar section

### Planning tools

- **Corkboard** — drag-and-drop chapter cards with scene metadata at a glance
- **Timeline** — chronological event log with date, description, and chapter association
- **Milestones** — writing goal milestones with target word counts and deadline dates

### Design system

- **Design themes** — five premade visual "design packs" (Moonlight, Ember, Moss, Sand, Midnight) that restyle the editor canvas: font pairing, background colour, text colour, accent colour
- **Dark / Amoled / Light themes** — app-level theme toggle; each design has a matching dark variant
- **Drag-to-apply designs** — designs can be dragged from the palette directly onto the canvas or the book preview
- **Book Designer** — a dedicated page with three tabs:
  - *Cover* — pick a cover style, title colour, and ornament; see a live rendered book cover
  - *3D mockup* — Three.js 3D book cover preview with lighting and shadows
  - *Pages* — preview how the interior page will look with the active design applied
- **Moodboard** — drag-and-drop image board for visual inspiration; images stored as base64 in IndexedDB

### Export & import

- **Export modal** — export a chapter or the full manuscript as:
  - Markdown (`.md`)
  - Plain text (`.txt`)
  - HTML (`.html`)
  - EPUB (`.epub`) — full EPUB 3 package with metadata, cover, and chapter files zipped together
  - DOCX (`.docx`) — Microsoft Word format via the `docx` library
  - PDF — browser print dialog with the print-view stylesheet applied
- **Import** — import a Markdown file and split into chapters by heading level; import RTF files
- **Backup / restore** — export the entire database as a JSON bundle; restore from a bundle; optional AES-GCM passphrase encryption on backups (PBKDF2-SHA-256, 600k iterations for new backups, Web Crypto API)
- **Encrypted backups** — passphrase-protected; no key is stored, no recovery path
- **Account recovery** — Discord sign-in can be completed again on a replacement device; password recovery is intentionally not offered without a verified email channel. Keep an encrypted local backup as the recovery path for writing data.

### Sync

- **Local-first sync engine** — all writes go to IndexedDB first, flagged as `pendingSync`; a background engine pushes pending records to a self-hosted Express server and pulls remote changes
- **Last-writer-wins merge** — records are reconciled by `updatedAt` timestamp
- **Tombstones** — deletes travel as tombstone records so they propagate across devices
- **Conflict detection** — detects when the same record has been modified on two devices since the last sync; surfaces a conflict resolution modal
- **Auth** — password accounts use scrypt hashes and expiring bearer tokens; Discord uses the server-side authorization-code flow and a short-lived one-use handoff
- **Sessions** — each device receives its own rotating session token; account settings can sign out all other devices

### Annotations

- **Inline comments** — select text and add a private comment; the comment is anchored to the text via a `data-comment-id` span; shown in a slide-out annotations panel
- **Comment status** — open / resolved; resolved comments are hidden but preserved

### Version history

- **Automatic snapshots** — a snapshot of the chapter HTML is saved on every significant edit (debounced); up to 50 snapshots per chapter retained
- **History panel** — browse snapshots with word count and timestamp; restore any snapshot
- **Session replay** — replay the writing session keystroke-by-keystroke at adjustable speed

### Security & privacy

- **App lock** — set a PIN or passphrase; the app locks after a configurable idle timeout; a lock screen covers all content until unlocked
- **Per-novel lock** — individual novels can be locked independently of the global app lock
- **Weekly backup nudge** — a reminder prompt appears weekly if no backup has been taken recently
- **Encryption** — backup files can be AES-GCM encrypted with a user-supplied passphrase; all crypto runs in the browser via the Web Crypto API

### Analytics

- **Daily word count** — words written per day, tracked in IndexedDB
- **Writing streaks** — current streak and longest streak calculated from daily logs
- **Session statistics** — words per session, average session length
- **Charts** — bar charts of daily word count over the past 30 days
- **Readability metrics** — Flesch reading ease and estimated reading time for each chapter

### Search

- **Full-text search** — searches across all chapters, notes, and world entries for the active novel; results are highlighted and linked to the source page

### Reference pane

- **Slide-out reference panel** — opens alongside the editor showing character profiles, world entries, and glossary terms at a glance without leaving the writing view

### Infrastructure

- **PWA** — installable as a desktop/mobile app via `vite-plugin-pwa`; service worker caches the app shell for offline use
- **IndexedDB** — all data (novels, chapters, characters, world, notes, annotations, snapshots, stats, glossary, continuity, milestones, timeline) is stored locally via the `idb` library
- **Express server** — a lightweight `server/index.js` handles sync endpoints and an AI proxy; not required for local-only use
- **Test suite** — Vitest unit and integration tests covering the database layer, sync engine, export utilities, encryption, and UI components

---

## Tech stack

| Layer | Choice |
|---|---|
| UI framework | React 19 |
| Routing | React Router 7 (HashRouter, no server config needed) |
| Build tool | Vite 8 |
| Storage | IndexedDB via `idb` |
| 3D rendering | Three.js |
| PWA | `vite-plugin-pwa` |
| Fonts | Fontsource (Inter, Literata, Lora, Cormorant Garamond) |
| Icons | Font Awesome 7 |
| Export: DOCX | `docx` |
| Crypto | Web Crypto API (PBKDF2 + AES-GCM) |
| Tests | Vitest + happy-dom |
| Server | Node.js + Express |

---

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The app works entirely offline — the server is only needed for sync.

To run the sync server:

```bash
npm run server
```

For Discord sign-in, configure these environment variables on the server (never commit a client secret):

```text
DISCORD_CLIENT_SECRET=the-rotated-secret-from-Discord
DISCORD_CLIENT_ID=your-discord-application-id
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
APP_ORIGIN=https://your-moonscribe-domain.example
CORS_ORIGINS=https://your-moonscribe-domain.example
```

`DISCORD_CLIENT_SECRET` is required for Discord sign-in. Set `VITE_SYNC_SERVER` in a separate frontend deployment when the app and sync server use different origins.

For an older server database that contains unowned records, export and review it before migration. Automatic claiming is disabled by default; a server owner may set `CLAIM_LEGACY_RECORDS_ON_FIRST_ACCOUNT=true` only for a one-time, trusted migration.

---

## Project status

Early development. All data is stored locally; breaking changes to the IndexedDB schema may require a manual data export and re-import between versions.
