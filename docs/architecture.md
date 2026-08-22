# Architecture

## System overview

MoonScribe has four cooperating layers:

1. A React 19 and Vite client renders the writing workspace and routes.
2. IndexedDB, accessed through `idb`, is the authoritative immediate local store in the web application.
3. An optional Node server provides accounts, sessions, collaboration, and record synchronization using SQLite.
4. A Tauri 2 shell can package the same Vite frontend for Windows. The current shell is not yet a native local-first implementation.

The core writing path does not require an account. Signing in adds optional server synchronization; it must not become a prerequisite for opening or editing local work.

## Client structure

- `src/App.tsx` owns top-level routing and application composition.
- `src/context/AppContext.tsx` owns cross-application settings, account/sync state, notifications through toasts, locks, fonts, and conflict state.
- `src/pages/` contains route-level workspaces such as Dashboard, Novel, Moodboard, Analytics, World, and Book Designer.
- `src/components/` contains editor, modal, navigation, command palette, sync, conflict, authentication, and settings UI.
- `src/db/` is the local persistence layer. Modules expose domain operations rather than asking UI components to manipulate IndexedDB directly.
- `src/sync/` serializes records, maintains pending operations, exchanges server records, and creates conflict records.
- `src/utils/` contains import/export, formatting, encryption, recovery, page geometry, sound, word count, and related pure helpers.

## Local database

The browser database is created in `src/db/db.js`. Domain stores are accessed through focused modules such as novels, chapters, entities, world, notes, moodboard, annotations, snapshots, trash, and metadata. Stable IDs travel with records through backup and sync.

Local writes must complete before the interface reports a manuscript as saved. Cloud status is separate: “saved locally” and “synced” are different guarantees.

## Server

`server/index.js` creates a Node HTTP/WebSocket server and a SQLite schema. It implements password/Google/Discord account paths, hashed bearer sessions, email verification and 2FA codes, per-user synchronized records, invitations, membership, presence, and collaboration access checks.

The current user schema stores provider identifiers on `users`. The production target is a stable internal user ID plus normalized `auth_identities` and `passkeys` tables. That migration must preserve existing user IDs and record ownership.

## Editor

The active editor is a large compatibility-oriented component using browser editing APIs, DOM selection management, annotations, comments, page formatting, and autosave. Tiptap packages and a document model exist, but the production editor has not completed a structured-editor migration. A pre-1.0 rewrite would be high risk; selection, undo/redo, paste, entity annotation, and large-document performance require focused regression testing.

## PWA and bundles

Vite builds static assets and `vite-plugin-pwa` generates a service worker. Fonts are bundled. Large design/export dependencies make the primary bundle exceed the desired budget; route-level lazy loading should isolate Three.js and document exporters.

## Desktop boundary

`src-tauri` currently opens the web frontend in a Tauri window and enables the shell plugin. It does not yet provide SQLite, keyring credentials, signed updater, deep links, tray, native notification, file association, or migration backup services. See [desktop.md](desktop.md).

## State scopes

- **Account-synced:** preferences intentionally serialized to the account, once the server schema supports them.
- **Device-only:** window state, local paths, haptics availability, performance overrides, and secure credentials.
- **Novel-specific:** page format, design, manuscript structure, entities, and novel goals.
- **Session-only:** open modal, current settings page, transient search, focus session, and toasts.

New settings must declare a scope and migration/default behavior before being added.

