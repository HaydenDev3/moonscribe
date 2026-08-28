# Product and user guide

## First run

MoonScribe can be used locally without creating an account. Complete onboarding, choose an appearance, create or import a story, optionally set a goal, and begin writing. Local-first means changes are written to this device first; it does not replace an independent backup.

## Dashboard and library

Home is the writing launchpad. Continue Writing opens the most relevant recent chapter. Progress cards summarize current activity. Recently touched chapters return to recent work. Attention items should appear only for actionable conflicts, backup reminders, continuity issues, or sync problems.

Library is the story collection. Search and sort stories, switch grid/list presentation, create a novel, or use each story's contextual actions. Deleting sends supported records to Trash; confirm a backup before bulk or irreversible operations.

## Writing and chapters

Open a story and select a chapter from its binder. The editor supports titles, paragraphs, headings, lists, links, highlights, scene breaks, page breaks, comments, entity references, focus/typewriter modes, and manuscript formatting. Autosave is local. The visible sync state reports cloud progress independently.

Use `Ctrl+S` for an explicit save and `Ctrl+K` for the command/search palette. Browser undo/redo remains part of the current editor; verify complex formatting operations after large paste or annotation changes.

## Worldbuilding

Characters hold identity, appearance, personality, motivation, arc, aliases, and custom fields. Places, factions, artefacts, creatures, general world entries, relationships, glossary, timeline, milestones, and continuity tools connect planning information to the manuscript. Entity highlights are aids, not manuscript text, and can be disabled.

## Planning and visual workspaces

The Corkboard organizes scene summaries. Moodboard stores visual references, notes, positions, and connectors. Book Designer controls cover, spine, interior layout, trim, typography, ornaments, and previews. Preview output must be checked against exported output before publication.

## Journal, insights, archive, and replay

Writing Journal stores dated reflections. Analytics summarizes words and sessions. Archive/branches and snapshot replay help inspect previous states. These are recovery aids; they are not substitutes for a downloadable backup.

## Import and export

Supported export paths include MoonScribe JSON, Markdown, HTML, EPUB, DOCX, plain text, and print/PDF flows where exposed. Import validates supported content and should be preceded by a backup. A MoonScribe backup includes application stores; encrypted backups require the passphrase and cannot be recovered without it.

## Accounts and sync

Password, Discord, and Google server paths exist when configured. Magic Link is available when Resend is configured on the server. A local library may conflict with the signed-in cloud library; export a safety copy before replacement or merge operations. Passkey UI remains unavailable until its server endpoint is implemented.

## Recovery

If a form or editor offers recovered content, review it before discarding. For a damaged or unwanted import, stop editing, export the current state if possible, and restore a known backup through Settings. Never overwrite the only good copy.

## Accessibility and responsive use

Keyboard navigation, focus styles, reduced motion, contrast, readable font, larger targets, transparency reduction, and colour-vision preferences are available in varying depth. Phone layouts use fluid editing instead of attempting to preserve desktop paper geometry. Critical release QA still requires screen-reader and full device-matrix verification.
# MoonScribe user guide · 1.1

> **Write softly. Keep every version.**

MoonScribe is a local-first writing studio. The interface is intentionally compact: the manuscript tree is the source of truth for chapters, folders, and media, while the editor remains the place for uninterrupted writing.

## The manuscript tree

- New folders are created at the manuscript root.
- Drag a chapter or folder onto another folder to place it inside.
- While dragging, use **Move outside folder** to return an item to the manuscript root.
- Media is a normal manuscript folder. Its children use image thumbnails and can be opened or deleted from the context menu.

Structural folder moves are treated as outline changes and are merged automatically. Prose edits still receive a conflict review when two devices changed the same chapter.

## Designer controls

The **Guides** control toggles print-safe guides on the active preview. It is independent from the book environment, trim size, surface selector, freeze, and full-screen controls.

## Motion and sound

Open Settings → Sound to enable or disable interface categories and adjust their volumes independently. Motion follows the system reduced-motion preference, so animations become still when requested.

## Offline and sync

Write offline, export locally, and reconnect when ready. Sync status is shown in the account pill. A sync conflict is reserved for meaningful content differences; ordinary folder reordering should never interrupt the writing session.
