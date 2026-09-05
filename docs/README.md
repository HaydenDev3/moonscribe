# MoonScribe documentation

Current release: **1.1.5** (5 September 2026).

This release adds the repository boundary and canonical structured-document foundation while retaining the 1.1.4 Author Website workspace, public author routes, responsive themes, draft and publish controls, and contextual editor scroll-rail previews.

MoonScribe is a local-first novel-writing, worldbuilding, planning, and book-design application. This handbook documents the product as it exists, its trust boundaries, and the work required for a public 1.0 release.

## Start here

- [Product and user guide](user-guide.md) — stories, chapters, editor, worldbuilding, planning, design, export, and recovery.
- [Settings reference](settings.md) — every settings area, persistence scope, and unavailable capability.
- [Architecture](architecture.md) — web, local database, sync server, React state, PWA, and Tauri shell.
- [Data safety and sync](data-safety.md) — autosave, IndexedDB, drafts, backups, conflicts, and recovery procedures.
- [Security model](security.md) — authentication, authorization, secrets, imported content, sessions, and known gaps.
- [Server and API](server-guide.md) — local operation and HTTP/sync-server behavior.
- [Deployment and operations](deployment.md) — production environment, reverse proxy, email, backups, monitoring, and rollback.
- [Desktop application](desktop.md) — current Tauri status, toolchain, packaging, and the required native roadmap.
- [Development guide](development.md) — setup, commands, repository map, quality gates, and contribution conventions.
- [Release candidate audit](release-candidate-audit.md) — current blockers and the complete 1.0 QA checklist.
- [Production migration](production-migration.md) — Supabase migration notes and public configuration.

## Current release status

The web app stores manuscripts in IndexedDB; the desktop shell uses native SQLite as its authoritative profile-scoped repository and provides OS keychain credentials, window state, tray behavior, global Quick Capture, notifications, backups, guarded restore, and WebAuthn passkeys. Automated tests, TypeScript, web build, lint, and native compile gates pass. MoonScribe must not yet be represented as production-ready 1.0 until the updater has real production signing credentials and full packaged accessibility/device QA is recorded.

## Documentation principles

- Documentation describes implemented behavior, not intended mockups.
- Features without a complete backend/native flow are explicitly marked unavailable.
- Local-first does not mean “backed up.” Writers should keep independent exports.
- No claim of end-to-end encryption is made. Optional backup files can be passphrase-encrypted.
- Commands assume PowerShell on Windows unless otherwise stated.
