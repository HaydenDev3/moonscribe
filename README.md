<div align="center">

<img src="docs/moonscribe-banner.svg" width="100%" alt="MoonScribe — a moonlit writing studio" />

# MoonScribe

### A calm, local-first studio for stories that take time.

<p>
  <a href="https://github.com/HaydenDev3/moonscribe"><img alt="Version 1.1.6" src="https://img.shields.io/badge/release-1.1.6-8b7cf6?style=for-the-badge&logo=starship&logoColor=white" /></a>
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=111827" />
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="PWA installable" src="https://img.shields.io/badge/PWA-installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

<p><a href="#-the-studio">Explore</a> · <a href="#-quick-start">Quick start</a> · <a href="docs/README.md">Documentation</a> · <a href="https://github.com/HaydenDev3/moonscribe/issues">Issues</a></p>

</div>

> **The quiet promise:** your manuscript remains yours, even when the network disappears.

MoonScribe keeps drafting, story memory, planning, collaboration, and finished-book design in one focused workspace. It is useful offline first, syncs when you want it to, and makes the path from first sentence to print-ready cover feel continuous.

## ✦ The studio

<table><tr>
<td width="33%"><h3>✍ Write</h3>Rich-text chapters, focus and typewriter modes, autosave, recovery, search, comments, analytics, history, and export.</td>
<td width="33%"><h3>🧭 Remember</h3>Characters, relationships, glossary, timeline, continuity, milestones, moodboards, corkboards, and references.</td>
<td width="33%"><h3>✦ Design</h3>Cover templates, palettes, typography effects, ornaments, trim settings, print previews, and a live 3D book.</td>
</tr></table>

### What arrived in 1.1.6

- **Designer workspace:** live cover colour updates, restored palette families, custom selectors, cover templates, ornaments, scene-break marks, typography settings, shadow effects, responsive controls, and independently editable front, spine, and back surfaces.
- **Interior Layout:** custom controls for page size, typography, chapter styling, headers, footers, page numbers, ornaments, margins, and per-chapter drop caps. The two-page proof uses distinct paginated content instead of duplicating the first page.
- **Manuscript pages:** clearer page-break treatment, visible page margins, improved spacing and alignment, and print-oriented paper geometry.
- **Author Website:** editable hero content, responsive desktop/tablet/mobile preview, real book data, custom controls, local draft/publish states, and a persistent Follow interaction.
- **Workspace foundations:** primary-provider identity linking, provider-safe profile imagery, account connection recovery, global command actions, reliable sync triggers, recoverable Trash, and the responsive References sidebar.

<details><summary><strong>See the complete 1.1.6 release notes</strong></summary>

Read [docs/release-1.1.6.md](docs/release-1.1.6.md) for the full feature inventory, behavior notes, verification status, and known release boundaries.

</details>

## ◌ Local-first by design

MoonScribe writes to the local repository first. Account sync is optional, cloud status is separate from local save status, and exports remain the writer’s safest independent backup.

```text
write → save locally → keep working offline → sync when available → export when it matters
```

No end-to-end encryption claim is made. Passphrase-encrypted backups use Web Crypto; keep the passphrase separately from the backup.

## 🚀 Quick start

**Requirements:** Node.js 24+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:5173](http://localhost:5173). The development launcher starts the Vite frontend and the optional sync server together. Run only the API with `npm run server`.

### Release checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
```

The current automated gate covers TypeScript, lint, production build, and the full test suite. Headless runs may report expected WebGL and browser-storage warnings. Treat an unavailable npm audit endpoint as inconclusive and rerun it in a networked release environment.

## 🧩 Built with

| Layer | Choice |
| --- | --- |
| Web UI | React 19, TypeScript, Vite 8 |
| Routing | React Router 7, web routes, desktop hash routing |
| Local storage | IndexedDB through `idb` |
| Sync | Node.js HTTP server, SQLite, and WebSockets |
| Book preview | Three.js |
| Exports | Markdown, HTML, EPUB, DOCX, and print-oriented output |
| Desktop | Tauri 2 |
| Verification | Vitest, happy-dom, and Node integration tests |

### ✨ Motion reference

The README and product surfaces take visual cues from [React Bits LogoLoop](https://reactbits.dev/animations/logo-loop), an animated logo-strip pattern suited to lightweight technology and partner marquees. Keep motion subtle, optional, and respectful of reduced-motion preferences when adapting it to MoonScribe.

## 📚 Documentation map

- [Documentation index](docs/README.md)
- [1.1.6 release notes](docs/release-1.1.6.md)
- [Product and user guide](docs/user-guide.md)
- [Settings reference](docs/settings.md)
- [Architecture](docs/architecture.md)
- [Development guide](docs/development.md)
- [Data safety and recovery](docs/data-safety.md)
- [Server and API guide](docs/server-guide.md)
- [Deployment runbook](docs/deployment.md)
- [Desktop application](docs/desktop.md)
- [Security notes](docs/security.md)

## 🛡️ Deployment note

The included Dockerfile supports a stateful Railway deployment. Mount a volume at `/app/data`, set `DATA_DIR=/app/data`, configure the values in `.env.example`, use `/api/health` as the health check, and keep SQLite-backed production at one replica. See the [deployment runbook](docs/deployment.md) before publishing.

## 🌙 Why it exists

MoonScribe is for the unfinished chapter, the complicated character, the world that keeps growing, and the finished book waiting at the end.

<div align="center"><sub>Made for the stories that take time.</sub></div>
