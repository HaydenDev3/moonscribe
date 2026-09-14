# MoonScribe documentation

Current release: **1.1.7** (14 September 2026).

MoonScribe 1.1.7 is the current release: a local-first writing workspace with responsive Designer and Interior Layout surfaces, print-aware manuscript previews, an author-site builder, reliable sync and recovery flows, primary-provider identity linking, normalized profile avatars, account connection recovery, global command actions, recoverable Trash, and a responsive References sidebar.

MoonScribe is a local-first novel-writing, worldbuilding, planning, and book-design application. This handbook documents the product as it exists, its trust boundaries, and the work required for a public 1.0 release.

## Choose a path

### Using MoonScribe

- [Product and user guide](user-guide.md) — the complete path from first run to writing, planning, design, export, publishing, and recovery.
- [Settings reference](settings.md) — settings areas, persistence scope, privacy controls, and unavailable capabilities.
- [Data safety and sync](data-safety.md) — autosave, IndexedDB, drafts, backups, conflicts, Trash, and recovery procedures.

### Building and operating MoonScribe

- [Development guide](development.md) — setup, commands, web-only development, quality gates, and contribution conventions.
- [Architecture](architecture.md) — web app, local database, sync server, React state, PWA, and Tauri boundary.
- [Server and API](server-guide.md) — local operation, authentication, sync, collaboration, and HTTP routes.
- [Deployment and operations](deployment.md) — production environment, reverse proxy, email, backups, monitoring, and rollback.
- [Production migration](production-migration.md) — Supabase migration notes and public configuration.

### Trust, release, and platform notes

- [Security model](security.md) — authentication, authorization, secrets, imported content, sessions, and known gaps.
- [Browser QA report](browser-qa.md) — browser coverage, clean-profile validation, and remaining manual journeys.
- [1.1.7 release notes](release-1.1.7.md) — shipped features, verification, and release boundaries.
- [Release-candidate audit](release-candidate-audit.md) — historical 1.0 readiness audit; use the 1.1.7 release notes for current status.
- [Desktop application](desktop.md) — current Tauri status, toolchain, packaging, and native roadmap.
- [Desktop release runbook](desktop-release.md) — signing, updater, packaging, and release verification.
- [Legal review handoff](legal-review-handoff.md) — product claims and review context.

Historical release notes: [1.1.3](release-1.1.3.md), [1.1.4](release-1.1.4.md), [1.1.5](release-1.1.5.md), and [1.1.6](release-1.1.6.md).

## 1.1.7 feature map

### Writing and print

- The manuscript editor has clearer page-break cards, visible paper margins, improved spacing/alignment, and print-oriented page geometry.
- Interior Layout uses custom Tailwind-styled controls for page size, typography, chapter styles, headers, footers, page numbers, ornaments, margins, and per-chapter drop caps.
- The live proof paginates chapter content into distinct pages, preventing the first page from being repeated on the second page.

### Book Designer

- Cover colours update the live 3D mockup immediately, including palette gradients and independently editable front, spine, and back surfaces.
- The Designer includes custom selectors, restored palette families, functional cover templates, a larger ornament/scene-break library, expanded text settings, and additional shadow effects.
- Designer rails and colour palettes are responsive, scrollable, and sized around fixed circular swatches rather than stretched native controls.

### Author Website

- Hero content, book data, responsive preview modes, local draft/publish state, and custom builder controls are wired to real application state.
- Follow is a persistent local interaction with accessible pressed state; a server-backed social graph is not claimed yet.

### Workspace foundations

- Account Centre now understands primary versus secondary identity providers and keeps profile imagery provider-safe.
- Sync avoids ordinary focus/click-triggered requests and exposes clearer local/cloud states.
- The command palette includes Dashboard, Quick Capture, Sync now, and Settings actions.
- Supported deleted records move through recoverable Trash, and References becomes a responsive editor-side workspace.

For the release boundary and verification record, read [release-1.1.7.md](release-1.1.7.md).

## Current release status

The web release is the primary 1.1.7 validation target. The current gate passes TypeScript, lint, the full automated test suite, production build, dependency audit, and the native-select source scan. Route-level lazy loading is in place; remaining bundle-budget work is tracked in the 1.1.7 release notes.

The web app stores manuscripts in IndexedDB. The desktop shell uses native SQLite as its authoritative profile-scoped repository and provides OS keychain credentials, window state, tray behavior, global Quick Capture, notifications, backups, guarded restore, and WebAuthn passkeys. Desktop distribution still requires real updater signing credentials and packaged accessibility/device QA.

## Documentation principles

- Documentation describes implemented behavior, not intended mockups.
- Features without a complete backend/native flow are explicitly marked unavailable.
- Local-first does not mean “backed up.” Writers should keep independent exports.
- No claim of end-to-end encryption is made. Optional backup files can be passphrase-encrypted.
- Commands assume a POSIX shell unless otherwise stated; PowerShell users should translate path and environment-variable syntax.
- Links in this handbook are relative to the `docs/` directory. Keep feature behavior in the user guide, operational behavior in the server/deployment guides, and release-specific changes in release notes.
