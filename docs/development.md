# Development guide

## Setup

From the repository root:

```text
npm install
npm run dev
```

The development launcher starts the Vite frontend and optional local server according to project configuration. Use `.env.local` for local secrets; it is ignored by Git. Never copy real secrets into `.env.example`.

## Commands

- `npm run dev` — development application.
- `npm run server` — sync/account server.
- `npm test` — Vitest suite.
- `npm run typecheck` — TypeScript without emitting files.
- `npm run lint` — ESLint production gate.
- `npm run build` — Vite/PWA production assets.
- `npm run tauri:dev` — Tauri development shell.
- `npm run tauri:build` — Windows desktop packages when the native toolchain is installed.

## Quality policy

CI must fail on lint errors, type errors, test failures, production build failures, or dependency vulnerabilities at the configured threshold. Warnings remain visible and should trend toward zero. React Compiler diagnostics are migration diagnostics rather than the current runtime lint gate because the editor and Three.js surfaces intentionally use imperative APIs; hook ordering and dependency checks remain errors.

## Editing rules

Keep database access in `src/db`, sync behavior in `src/sync`, and rendering in pages/components. Sanitize stored/imported rich HTML at trust boundaries. Clean up timers, listeners, subscriptions, object URLs, audio nodes, and Three.js resources. Do not add a control unless it changes real state or is explicitly labelled unavailable.

## Tests

Add tests for domain utilities and database operations. High-risk manual journeys include editor selection/undo, large paste, backup/restore, offline reconnect, sync conflict, account switching, provider linking, imported HTML, Moodboard drag/drop, Designer export matching, mobile toolbars, and keyboard-only settings navigation.

## Versioning

Use semantic versions. Keep pre-release versions while release blockers remain. Database and settings migrations are independently versioned and must be forward-tested and rollback-aware.

