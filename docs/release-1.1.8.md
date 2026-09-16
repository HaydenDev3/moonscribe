# MoonScribe 1.1.8 release note

**Code-complete · in verification · 16 September 2026**

MoonScribe 1.1.8 extends the 1.1.7 web quality release with project-level customisation, collaboration safety, recovery hardening, and the native desktop parity work required to move beyond a web-only release.

## Release status

All scoped code is implemented and committed. The automated suite contains **290 passing tests across 51 files**. Typecheck, lint, production build, bundle gate, and Cargo checks pass.

The release remains **in verification**, not released, until these three gates pass:

- Tauri runtime checks for Designer, Interior Layout, Author Website, and Global Media Library.
- Tauri offline/reconnect/sync/conflict and account/profile-isolation checks using real device contexts.
- Full overlay audit across context menus, media sheets, Designer pickers, Author Website inspectors, dialogs, and mobile drawers.

## Added

- Project-level editor typography, line-height, theme, focus/typewriter behavior, and sync conflict preferences.
- Saved workspace defaults and panel ordering, reusable design presets, per-format export presets, and KDP/IngramSpark trim-and-bleed presets.
- Configurable continuity checking for age, eye colour, relationship status, and aliases, with warn/block severity.
- Versioned fact provenance and persisted continuity conflicts with established-vs-introduced diff information.
- Server-enforced `beta-reader` collaboration role with read-only manuscript access, chapter/paragraph read markers, same-chapter reveal buffering, reactions/highlights, and team-only feedback.
- Spoiler-safe search, chapter navigation, exports, and print preview for beta readers.
- Error-boundary recovery shells around the four desktop-targeted surfaces.
- Non-destructive local-first integrity diagnostics for records, pending sync, tombstones, and accepted server records.
- Pass/fail bundle gate with documented 500 KB raw and 165 KB gzip main-entry limits.
- Dedicated regression coverage for collaboration persistence, beta privacy boundaries, notification deduplication, search restrictions, and recovery diagnostics.

## Updated

- IndexedDB schema and native mirror store lists with a non-destructive migration for collaboration records.
- Backup/import coverage for provenance, conflicts, and read markers.
- Server sync allowlists, shared-room role validation, websocket permissions, and notification delivery.
- Context-menu bounds and stacking behavior for viewport-safe interaction.
- About/version history now lists 1.1.8 first and preserves 1.1.7 as reserved.

## Deferred

The next release retains the first-run template project, visual/UX polish suite, personal style library, advanced notification rules, and automated authenticated browser tooling. Author heatmap analytics and a feedback/bug-report channel are also deferred.

## Verification boundary

Successful packaging does not prove Tauri runtime parity. Web and automated tests do not replace the final desktop surface, offline/isolation, and overlay verification passes listed above.
