# MoonScribe

<p align="center">
  <img src="docs/moonscribe-banner.svg" width="100%" alt="MoonScribe banner" />
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Installable-FFB000?logo=pwa&logoColor=white" />
</p>

> A private, local-first writing studio for long-form fiction, worldbuilding, collaboration, and book design.

MoonScribe gives novelists one calm place to draft a manuscript, understand its story world, collaborate with another writer, and design the finished book. Writing starts locally in the browser and can optionally sync to the self-hosted Node/SQLite service.

## What it includes

### Write

- Rich-text chapter editor with headings, lists, links, highlights, scene breaks, and page breaks.
- Focus and typewriter modes, autosave, draft recovery, word counts, search, analytics, and chapter history.
- Export workflows for Markdown, HTML, EPUB, DOCX, and print-oriented output.

### Plan and remember

- Character cards, relationships, glossary, timeline, continuity, milestones, moodboards, and corkboard planning.
- Story-aware reference tools that keep important details near the manuscript.

### Design

- Cover presets, palettes, typography, ornaments, spine/back-cover controls, trim settings, and print preview.
- Three-dimensional book mockup preview for checking the finished object before export.

### Sync and security

- Local-first IndexedDB storage with offline-safe drafts and backup/restore tools.
- Optional account sync, multi-device sessions, private collaboration rooms, presence, and realtime record updates.
- Email/password, Discord OAuth, Google OAuth, email verification, email 2FA, app lock, session revocation, account disabling, and administrator controls.
- Admin users can manage roles, disable or restore non-admin accounts, and permanently delete non-admin accounts with audited confirmation.

## Architecture

| Area | Technology |
| --- | --- |
| Web UI | React 19, TypeScript, Vite 8 |
| Web routing | React Router 7; crawlable routes on web, hash routing in desktop runtime |
| Local storage | IndexedDB through `idb` |
| Sync API | Node.js HTTP server with SQLite (`node:sqlite`) |
| Realtime | WebSocket presence, notifications, and collaboration updates |
| Book preview | Three.js |
| PWA | `vite-plugin-pwa` |
| Exports | Markdown, HTML, EPUB, DOCX, PDF/print workflows |
| Email | Resend |
| Tests | Vitest, happy-dom, Node integration tests |

## Run locally

Requirements: Node.js 24 or newer and npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The development helper starts Vite and the sync server together. To run the API alone:

```bash
npm run server
```

The local API listens on port `3001` by default and stores SQLite data under `DATA_DIR`.

## Environment configuration

`.env.example` is the source of truth for available variables. The minimum production values are:

```env
APP_ORIGIN=https://moonscribe.cc
API_ORIGIN=https://moonscribe.cc
OAUTH_STATE_SECRET=<long-random-server-secret>
DATA_DIR=/app/data
RESEND_API_KEY=<server-only-resend-key>
```

Optional provider credentials enable Discord and Google sign-in. Keep OAuth secrets, the Resend key, and `OAUTH_STATE_SECRET` server-only; never prefix them with `VITE_`.

Generate the OAuth state secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

For local development, use `APP_ORIGIN=http://localhost:5173` and `API_ORIGIN=http://localhost:3001`. For production, use HTTPS origins and register the exact callback paths with each OAuth provider:

```text
https://your-api-host/auth/discord/callback
https://your-api-host/auth/google/callback
```

## Railway deployment

MoonScribe’s backend is a stateful Node/SQLite service with WebSockets. Deploy the included Dockerfile to Railway as one service.

1. Create a Railway service from this repository.
2. Use the included `railway.json` and Dockerfile.
3. Create a Railway Volume and mount it at `/app/data`.
4. Set `DATA_DIR=/app/data`.
5. Configure the production environment variables from `.env.example`.
6. Use `/api/health` as the health-check path.
7. Keep the service at one replica; SQLite is not a multi-replica database.
8. Attach the HTTPS domain and set `APP_ORIGIN`/`API_ORIGIN` to the final public origin.
9. Register the final OAuth callback URLs and verify the Resend sending domain.

The Dockerfile intentionally does not contain a Docker `VOLUME` instruction. Persistence belongs to the Railway Volume so it can be managed, backed up, and restored by Railway.

Vercel can host the static frontend, but the current sync API should remain on a stateful host unless the backend is migrated to a managed database and a realtime service. See [deployment documentation](docs/deployment.md) for the production runbook.

## Verify before release

Run the release checks from the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
```

The server integration suite covers authentication, authorization, account lifecycle, rate limiting, record isolation, collaboration permissions, realtime sync, realtime notifications, health checks, disabling, restoring, and deletion cleanup.

For a live deployment, additionally verify:

- `GET /api/health` returns database health.
- HTTPS redirects and secure callback URLs work.
- Email verification, password reset/notification delivery, and 2FA arrive through Resend.
- Two separate sessions see the same collaboration update.
- Railway Volume data survives a redeploy.
- Backups can be restored before allowing real manuscripts onto the service.

## Public routes

The web app includes crawlable public pages for trust and search indexing:

- `/privacy`
- `/terms`
- `/cookies`
- `/acceptable-use`
- `/community`
- `/contact`

SEO metadata, Open Graph previews for Discord/Facebook, X/Twitter card metadata, `robots.txt`, and `sitemap.xml` are included in the web build.

## Documentation

- [Documentation index](docs/README.md)
- [Deployment and operations](docs/deployment.md)
- [Server guide and API reference](docs/server-guide.md)
- [Security notes](docs/security.md)
- [Data safety and backups](docs/data-safety.md)
- [Release-candidate audit](docs/release-candidate-audit.md)
- [Browser QA notes](docs/browser-qa.md)

## Data and licensing

The browser library is local-first, but synced data is stored by the configured server. Back up `DATA_DIR` and export important manuscripts before migrations, bulk deletion, or infrastructure changes.

This repository’s exact license terms should be checked before redistribution or commercial deployment.

## Why it exists

MoonScribe is for the long-form work that needs more than a blank document: the unfinished chapter, the complicated character, the world that keeps growing, and the finished book waiting at the end.
