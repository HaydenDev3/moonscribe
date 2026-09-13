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

### Designer and cover production

The Designer's Cover step includes functional templates, palette families, text layers, custom font/size/weight/case controls, shadow effects, ornaments, scene-break marks, and separate front, spine, and back surfaces. Select a palette to update the live 3D book immediately. Use the surface controls when artwork or text should differ between the front, spine, and back.

The Text, Elements, and Effects rails are scrollable on smaller workspaces. Colour swatches remain circular and keyboard accessible. Template actions change the cover treatment without changing manuscript text.

### Interior Layout and manuscript proofing

Interior Layout is the print-oriented companion to the editor. Choose a page preset, orientation, margins, gutter, typography, chapter treatment, headers/footers, page numbers, ornaments, and preview guides. Drop caps are controlled per chapter; disabling them removes the opening-letter treatment rather than leaving a stale visual effect behind.

The proof view paginates the actual chapter content into separate pages. It does not copy page one into page two. The manuscript editor's page breaks use a dedicated visual card with clearer spacing and margin context so a break is distinguishable from ordinary empty space.

### Author Website

The Author Website builder edits real author and novel data. Use Desktop, Tablet, and Mobile preview modes to inspect responsive layout. Hero text, book cards, draft state, and publishing controls are persisted through the builder state. Follow is a local persistent interaction with an accessible `Following` state; this release does not claim a server-backed social graph.

## Journal, insights, archive, and replay

Writing Journal stores dated reflections. Analytics summarizes words and sessions. Archive/branches and snapshot replay help inspect previous states. These are recovery aids; they are not substitutes for a downloadable backup.

## Import and export

Supported export paths include MoonScribe JSON, Markdown, HTML, EPUB, DOCX, plain text, and print/PDF flows where exposed. Import validates supported content and should be preceded by a backup. A MoonScribe backup includes application stores; encrypted backups require the passphrase and cannot be recovered without it.

## Trash and recovery

Supported deleted records move to Trash instead of disappearing immediately. Trash items are recoverable for 30 days, after which they are purged automatically. Use the global `/trash` page for library-wide recovery or the novel's Archive → Trash workspace for a single project. Permanent deletion removes the record and cannot be undone; export a backup before emptying Trash.

## Accounts, identity, and sync

Password, Discord, Google, Magic Link, and passkey server paths exist when configured. The first provider used to create an account is the primary connector. Linked providers are additional sign-in methods and do not replace the primary connector or its profile picture. A local library may conflict with the signed-in cloud library; export a safety copy before replacement or library replacement operations.

Use `Ctrl/Cmd + K` to open the global command palette. It searches novels, chapters, characters, notes, worldbuilding, glossary, relationships, and media. It also provides quick actions for dashboard, Quick Capture, Sync now, and Settings.

## Recovery

If a form or editor offers recovered content, review it before discarding. For a damaged or unwanted import, stop editing, export the current state if possible, and restore a known backup through Settings. Never overwrite the only good copy.

## References and workspaces

The editor's References sidebar surfaces notes, characters, world entries, and links connected to the current chapter. On desktop it occupies a dedicated column beside the editor; on narrower layouts it becomes a stacked panel. Planning, Collect, Design, Review, and Archive sections are workspace modes inside the current novel.

## Accessibility and responsive use

Keyboard navigation, focus styles, reduced motion, contrast, readable font, larger targets, transparency reduction, and colour-vision preferences are available in varying depth. Phone layouts use fluid editing instead of attempting to preserve desktop paper geometry. Critical release QA still requires screen-reader and full device-matrix verification.
