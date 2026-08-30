# ✦ MoonScribe

<p align="center">
  <img src="docs/moonscribe-banner.svg" width="100%" alt="Animated MoonScribe banner with a moonlit writing studio" />
</p>

<p align="center">
  <strong>A private, local-first writing studio for long-form fiction, worldbuilding, collaboration, and book design.</strong>
</p>

<p align="center">
  <a href="https://github.com/HaydenDev3/moonscribe"><img alt="Version 1.1.1" src="https://img.shields.io/badge/version-1.1.1-8b7cf6?style=for-the-badge&logo=semver&logoColor=white" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="PWA installable" src="https://img.shields.io/badge/PWA-installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

<p align="center">
  <a href="#-experience-the-studio">Experience the studio</a> ·
  <a href="#-run-locally">Run locally</a> ·
  <a href="docs/README.md">Read the docs</a> ·
  <a href="https://github.com/HaydenDev3/moonscribe/issues">Report an issue</a>
</p>

> **The quiet promise:** your manuscript remains yours, even when the network disappears.

MoonScribe brings drafting, story memory, collaboration, and finished-book design into one calm workspace. Your work starts in the browser, stays useful offline, and can optionally sync to a self-hosted Node/SQLite service.

## ✨ Experience the studio

| 🖋️ Write | 🧭 Remember | 🎨 Design |
| --- | --- | --- |
| Rich-text chapters, focus mode, typewriter mode, autosave, recovery, search, analytics, history, and export. | Characters, relationships, glossary, timeline, continuity, milestones, moodboards, and corkboard planning. | Cover presets, palettes, typography, ornaments, trim settings, print preview, and a 3D book mockup. |

<details>
<summary><strong>🌙 What makes it feel different?</strong></summary>

- **Local-first by default** — IndexedDB keeps drafts available when the connection is not.
- **Made for the whole arc** — move from first sentence to world bible to finished cover without changing tools.
- **Private collaboration** — optional accounts, rooms, presence, realtime updates, and session controls.
- **A living interface** — animated startup moments, optional interface sounds, accessible focus states, and a visual language designed to stay out of the way.

</details>

### Moodboard workspace

MoonScribe’s Moodboard is a private, local-first creative-direction board for collecting the feeling, texture, palette, and references that guide a story. Add notes, images, links, and colour palettes, then arrange them freely on the atmospheric board.

- Drag tiles to compose the board and use **Smart stack** to group references by type.
- Drag from a tile’s ↗ connect control onto another tile to create a persistent visual relationship.
- Use zoom, pan, fullscreen, and **Fit board** to move from close editing to presentation mode.
- Connections, positions, notes, and references remain available offline through the existing IndexedDB storage.

The board is designed around a curated moodboard workflow: establish a creative direction, gather references, identify reusable visual ingredients, and return to the board as the story develops.

## 🧩 Built with

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Tiptap" src="https://img.shields.io/badge/Tiptap-editor-171717?logo=prosemirror&logoColor=white" />
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-3D-000000?logo=threedotjs&logoColor=white" />
</p>

| Layer | Choice |
| --- | --- |
| Web UI | React 19, TypeScript, Vite 8 |
| Routing | React Router 7; crawlable web routes and desktop hash routing |
| Local storage | IndexedDB through `idb` |
| Sync | Node.js HTTP server, SQLite, and WebSockets |
| Book preview | Three.js |
| Exports | Markdown, HTML, EPUB, DOCX, and print-oriented output |
| Desktop | Tauri |
| Verification | Vitest, happy-dom, Node integration tests |

## 🚀 Run locally

**Requirements:** Node.js 24+ and npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Then open [localhost:5173](http://localhost:5173). The development helper starts the Vite frontend and sync server together. To run the API by itself:

```bash
npm run server
```

## 🛡️ Sync, security, and deployment

Optional account sync supports email/password, Discord OAuth, Google OAuth, email verification, email 2FA, app lock, session revocation, account disabling, and administrator controls. Keep provider secrets and `OAUTH_STATE_SECRET` server-only.

The included Dockerfile is designed for a stateful Railway deployment:

1. Create a Railway service from this repository.
2. Mount a Railway Volume at `/app/data` and set `DATA_DIR=/app/data`.
3. Configure the production values from `.env.example`.
4. Use `/api/health` as the health check.
5. Keep the service at one replica because SQLite is not a multi-replica database.

See the [deployment runbook](docs/deployment.md) for the complete production checklist.

## ✅ Verify before release

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
```

### Current release review

Recommended release: **1.1.2 — Account Centre Polish**.

The latest Account Centre update includes circular profile imagery, live account/security status presentation, spaced danger actions with lightweight hover feedback, and improved profile banner treatment. The shared browser-test fixture race has also been resolved by running the UI test files serially.

Release checks currently pass:

- TypeScript
- ESLint
- Production build
- Full test suite: 40 files, 234 tests

Headless tests may print expected warnings for Three.js WebGL context creation and Node localStorage because they run without a GPU or browser storage implementation. The npm security audit remains inconclusive when the registry audit endpoint is unavailable; rerun it in a networked release environment before publishing.

## 📚 Documentation

- [Documentation index](docs/README.md)
- [User guide](docs/user-guide.md)
- [Development guide](docs/development.md)
- [Deployment and operations](docs/deployment.md)
- [Server guide and API reference](docs/server-guide.md)
- [Security notes](docs/security.md)
- [Data safety and backups](docs/data-safety.md)
- [Release-candidate audit](docs/release-candidate-audit.md)

## 🗺️ Public routes

The web app includes crawlable trust and community pages: `/privacy`, `/terms`, `/cookies`, `/acceptable-use`, `/community`, and `/contact`. SEO metadata, Open Graph previews, X/Twitter cards, `robots.txt`, and `sitemap.xml` are included in the build.

## 💫 Why it exists

MoonScribe is for the long-form work that needs more than a blank document: the unfinished chapter, the complicated character, the world that keeps growing, and the finished book waiting at the end.

<p align="center">
  <sub>Made for the stories that take time.</sub>
</p>
