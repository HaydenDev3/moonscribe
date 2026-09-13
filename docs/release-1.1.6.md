# MoonScribe 1.1.6 release note

**Current release · 9 September 2026**

MoonScribe 1.1.6 connects identity, sync, writing, and book-production work into a more coherent local-first workspace. The release improves the foundations behind accounts and collaboration while making the Designer, Interior Layout, manuscript proof, and Author Website surfaces materially more usable.

## Product highlights

### Book Designer

- Live 3D cover colours now respond immediately when a palette or gradient changes.
- Restored and expanded cover palette families, including light, dark, warm, cool, green, violet, and metallic directions.
- Added functional cover templates that apply a complete visual treatment while leaving manuscript text unchanged.
- Added larger ornament and scene-break libraries across floral, fantasy, royal, mystical, and minimal styles.
- Expanded text controls for font, size, weight, case, letter spacing, visibility, and title colour.
- Added additional title effects, including glow, warm, sharp, lifted, emboss, neon, and outline treatments.
- Front, spine, and back surfaces can be edited and previewed independently.
- Replaced the desktop production dropdown with the shared custom selector and made dense tool rails scrollable.
- Palette swatches use fixed circular sizing and compact two-row layouts instead of stretching with the panel.

### Interior Layout and manuscript proof

- Added custom controls for page size, orientation, margins, gutter, body typography, chapter headings, paragraph spacing, headers, footers, page numbers, ornaments, and preview guides.
- Drop caps now follow the chapter-level setting and disappear completely when disabled.
- The two-page proof is generated from distinct paginated chapter content; page one is not duplicated into page two.
- Preview spacing, text alignment, paper margins, and positioning were tuned for a more credible print proof.
- Manuscript page breaks now use a clearer visual treatment with margin context rather than looking like an unexplained dark divider.

### Author Website builder

- Hero content, book cards, responsive Desktop/Tablet/Mobile preview, draft state, and publish controls are connected to real builder state.
- Builder controls use the shared custom selector instead of native select menus.
- The Follow control persists locally and exposes an accessible pressed/following state. A server-backed social graph is intentionally not claimed in this release.

### Identity, sync, and workspace foundations

## Identity and account connections

- Added explicit primary-provider account semantics.
- Profile pictures now come from the primary account connector only.
- Discord avatar hashes are normalized to usable CDN URLs at the server boundary.
- Linked Discord and Google providers remain secondary sign-in methods.
- Provider linking no longer silently merges an already-owned provider account.
- Added safe disconnection for secondary providers while protecting the primary connector.
- Fixed Account Centre and Settings modal overlap.

## Writing workspace

- Added global command palette actions for Dashboard, Quick Capture, Sync now, and Settings.
- Expanded global search across novels, chapters, characters, notes, worldbuilding, glossary, relationships, and media.
- Fixed sync requests being triggered by ordinary window focus or click interactions.
- Added responsive References sidebar positioning beside the desktop editor.
- Added recoverable Trash behavior for supported records, including novels.

## Live Share beta

- Existing collaborators can open the last synchronized manuscript when the owner is away.
- Owner-away rooms are explicitly read-only; shared edits resume when the owner reconnects.
- Share APIs now return structured room, permission, expiry, capacity, and realtime failure codes.
- Supabase Realtime remains optional; the server presence channel is used as the fallback.
- Live Share remains restricted to Beta Testers, Developers, and Admins for this release.

## Verification

- Typecheck, lint, production build, and the full automated test suite pass.
- A clean-browser validation reached the current development HTML shell without the stale production service-worker asset.
- The web source scan reports no native select menus outside the shared custom selector component.
- The production build still reports a large-main-chunk warning; this is accepted for 1.1.6 and remains a follow-up optimization item.
- The Designer was manually checked for palette updates, template application, custom selector rendering, scrollable rails, circular swatch sizing, and expanded Effects/Elements controls.
- Interior Layout was manually checked for distinct preview pages, margin/spacing alignment, custom selectors, and per-chapter drop-cap toggling.
- Historical `1.1.5` release notes remain available in `docs/release-1.1.5.md`.

## Known boundaries

- Local-first storage is not the same as backup; writers should export independent copies.
- The Author Website Follow state is local to the device in this release and is not a cross-user social relationship.
- Live Share remains beta-gated and owner-away rooms are read-only.
- Production desktop distribution still requires real updater signing credentials and packaged accessibility/device QA.
