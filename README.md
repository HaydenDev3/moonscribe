# MoonScribe

<p align="center">
  <img src="docs/moonscribe-banner.svg" width="100%" alt="MoonScribe banner" />
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" />
  <img alt="IndexedDB" src="https://img.shields.io/badge/Storage-IndexedDB-4B5563" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="PWA" src="https://img.shields.io/badge/PWA-Installable-FFB000?logo=pwa&logoColor=white" />
</p>

> A private, local-first writing studio for long-form fiction, worldbuilding, and book design.

MoonScribe is a browser-based writing app built for authors who want a calm place to draft, plan, design, and export without handing their work to a cloud-only platform. Your manuscript lives locally in IndexedDB, with optional sync for collaboration and multi-device flow.

---

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Write in private</h3>
      <ul>
        <li>Rich-text editor with a focused writing experience</li>
        <li>Local-first autosave and draft recovery</li>
        <li>Typewriter, focus, and distraction-free modes</li>
        <li>Word count, analytics, and chapter snapshots</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>Build the book</h3>
      <ul>
        <li>Dedicated cover designer and print preview</li>
        <li>3D mockup, trim settings, and page layout controls</li>
        <li>Interior book styling for chapter headings and body text</li>
        <li>Export to Markdown, HTML, EPUB, DOCX, and print-ready PDF</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>Know your world</h3>
      <ul>
        <li>Characters, continuity, glossary, and timeline tools</li>
        <li>Worldbuilding entries with structure and references</li>
        <li>Reference pane and in-editor contextual metadata</li>
        <li>Relationship mapping and planning tools</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>Stay in control</h3>
      <ul>
        <li>Privacy-first app lock, backup, and restore flow</li>
        <li>Self-hosted sync server and optional collaboration</li>
        <li>Conflict detection and record history</li>
        <li>Installable PWA for desktop and mobile</li>
      </ul>
    </td>
  </tr>
</table>

<p align="center">
  <img src="docs/moonscribe-hero.svg" width="100%" alt="MoonScribe writing studio illustration" />
</p>

---

## Core features

### Writing studio

- Rich chapter editor with formatting controls, headings, lists, links, alignment, and highlight tools
- Typewriter and focus modes for a clean drafting rhythm
- Draft recovery, autosave, session stats, and snapshot history
- Search, analytics, and chapter navigation built around your manuscript

### Book designer

- Live cover styling with presets, palette controls, title effects, shadow options, and ornaments
- 3D book mockup preview for front, spine, and back surfaces
- Interior page styling, trim sizing, margin controls, and print preview
- Exportable cover and manuscript assets in polished publishing formats

### Worldbuilding and planning

- Character profiles, relationships, timeline, continuity, and milestones
- Glossary and reference pane for recurring terms and lore
- Moodboard and visual inspiration tools for concept boards
- Corkboard and chapter planning flows for structure and pacing

### Privacy and sync

- All manuscript data stored locally in IndexedDB by default
- Optional server sync for collaboration and multi-device work
- Backup and restore flow with encrypted export support
- App lock and per-novel protection options for a private workspace

---

## Tech stack

| Layer | Stack |
| --- | --- |
| UI | React 19 + Vite |
| Routing | React Router 7 |
| Storage | IndexedDB via `idb` |
| Rendering | Three.js |
| PWA | `vite-plugin-pwa` |
| Export | Markdown, HTML, EPUB, DOCX, PDF |
| Security | Web Crypto API, backup encryption, app lock |
| Testing | Vitest + happy-dom |

---

## Quick start

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

To run the optional sync server:

```bash
npm run server
```

---

## Project status

MoonScribe is actively evolving as a local-first writing and publishing workspace. It is designed for authors who want a quiet, private drafting environment first, with collaboration and export tools layered on top when needed.

The app is made to feel like a writing desk, a planning board, and a book studio all in one place.

---

## Why it exists

MoonScribe exists for the moments between ideas and stories:

- when the chapter is still foggy and needs a calm drafting space
- when the world needs structure and memory
- when the book wants a cover, a layout, and a final polish
- when privacy matters more than a cloud-only writing platform

This is not just a note app or a generic editor. It is built for the long form.

---

## License

This project is available under the repository’s current license terms. Check the project files for the exact licensing details before shipping or distributing a production build.

---

<p align="center">
  <img src="docs/wave-divider.svg" width="100%" alt="Wave divider" />
</p>
