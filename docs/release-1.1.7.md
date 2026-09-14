# MoonScribe 1.1.7 release note

**Current release · 14 September 2026**

MoonScribe 1.1.7 is the web-focused quality release for dependable writing, book production, author websites, and local-first recovery.

## Highlights

- Responsive and accessible Book Designer and Interior Layout controls, including accurate browser proof export of presentation settings.
- Author Website draft, preview, publish, edit, live-view, and unpublish flow.
- Global Media Library presentation and mobile UX over the existing local-first media system, including real storage usage, project associations, search/filter/sort, uploads, grid/list views, metadata, multi-select, and reusable asset insertion.
- Account-scoped local storage, offline pending edits, reconnect handling, conflict protection, recoverable Trash, and backup round-trip coverage.
- Route-level lazy loading for Designer, Interior Layout, Author Website, and Three.js surfaces.
- Compact tablet and square-screen sidebar controls with separated logo and collapse targets, plus responsive Scene Context, editor toolbar, footer, and chapter-menu layering fixes.

## Verification

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `npm test` — PASS (275 tests across 48 files)
- `npm run build` — PASS
- `npm run bundle-report` — PASS; the main entry is 483.5 KB (495.1 KB raw, 159.0 KB gzip), with Three.js, Novel, and document export isolated into lazy chunks.
- `agent-browser` — PASS for isolated browser launch, redirect handling, sign-in accessibility snapshot, and screenshot capture; it could not reuse the separate authenticated in-app browser context.
- Signed-in in-app browser — dashboard smoke check PASS; full authenticated journey results are recorded in `docs/browser-qa.md`.
- Signed-in in-app browser — chapter sidebar context-menu action PASS after the stacking-layer fix; “Edit” opens Chapter settings while the sidebar remains open.

## Web production-readiness digest

**Status: READY FOR FINAL RELEASE STEPS.**

The automated web gate is green, and the dashboard/authenticated shell smoke check passes. All scoped web functional and visual release gates are now cleared.

Writing recovery → Trash/history → restore, account switching, manuscript/presentation-settings file-picker round trips, and offline reconnect/sync have now been verified in the browser and are cleared as release blockers.

The verified flows required a configured authenticated web session and, for sync, two browser/device contexts. Desktop packaging and desktop-only iterations are outside this web release decision. The entry bundle is materially smaller, with Three.js and exporters isolated, but remains a future performance follow-up rather than a current release blocker.
