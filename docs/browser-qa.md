# Browser QA report

Test date: 2026-09-14 AEST

## Environment

- Local test server: `http://localhost:5173/`
- Sync server: `http://localhost:3001`
- Surface: Codex in-app Browser
- Desktop/default viewport and temporary mobile viewport 390×844

## Results

| Journey | Result | Notes |
| --- | --- | --- |
| Landing page load | PASS | Navigation, hero, product sections, and footer render. |
| Start writing → auth modal | PASS | Modal has one close control, accessible dialog name, provider choices, and future-provider labels. |
| Auth modal → password view | PASS | Back navigation, labelled email/password fields, and submit controls render. |
| Auth modal → Magic Link view | PASS WITH LIMITATION | Secure one-time copy and email field render; sending depends on deployed Resend configuration and was not exercised in this local browser pass. |
| Passkey action | SUPERSEDED | Passkey registration and sign-in are now implemented; a real-device Windows Hello/security-key ceremony remains required in packaged QA. |
| Close auth modal | PASS | Dialog is removed cleanly. |
| Direct `#dashboard` route without account | PASS | Redirects to `#/?signin=1` and opens the sign-in flow. |
| Mobile landing at 390×844 | PASS | No horizontal overflow (`scrollWidth` 380, viewport 390); no browser console errors. |
| Browser console | PASS | No `error` or `warn` entries during the exercised journeys. |

## 1.1.7 validation additions

- A fresh in-app browser session reached the current Vite HTML shell on `/author-website`; the old production asset was not served.
- Local development now disables PWA worker generation, while production builds continue to generate the offline worker.
- The localhost bootstrap unregisters an installed worker and clears Cache Storage before the development module graph starts.
- The source scan reports no native `<select>` outside the shared custom `Select` component.
- The known production build warning is the size of the main JavaScript chunk, not a runtime or test failure.

## Follow-up coverage required before 1.0

- Complete an account-backed run through onboarding, dashboard, Settings, Library, Journal, Insights, editor, Moodboard, Designer, import/export, backup/restore, and logout.
- Exercise desktop/tablet sizes and keyboard-only navigation.
- Add a browser automation suite for auth failure states, offline writes, sync conflicts, restore preview, and no-silent-failure async paths.
- Re-run with production environment variables and verified OAuth/email providers.

## Extended sweep

The public landing surface was reloaded at 320×720, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900. Each viewport reported zero browser console warnings/errors and no horizontal overflow beyond the scrollbar width. Direct `#dashboard` access without a session redirected to `#/?signin=1` and opened the auth dialog without console errors.

The editor, Designer, Settings, sync, backup, and restore journeys remain unverified in this run because no browser session is signed in and no credentials were supplied.

## 1.1.7 signed-in validation

The open authenticated in-app browser session successfully loaded `/dashboard` for `hayd3nford2008`. The accessibility tree exposed the dashboard navigation, account menu, sync status, writing controls, recent novels, and quick capture controls without a blank or error state.

| Journey | Result | Notes |
| --- | --- | --- |
| Signed-in dashboard smoke check | PASS | Existing authenticated in-app browser session loaded `/dashboard` for `hayd3nford2008`; navigation, account menu, sync status, writing controls, recent novels, and quick capture controls were exposed. |
| Author Website draft → preview → publish → edit → unpublish | PASS (browser) | Signed-in Codex browser saved the draft, published to `/@hayd3nford2008`, then unpublished it; live view became disabled and the draft remained available. Preview control was also present in the builder. |
| Writing autosave, recovery, Trash, history, and restore | PASS (browser) | User-verified browser flow: writing recovery, Trash/history navigation, and restore all work. |
| Account switching isolation | PASS (browser) | User confirms switching accounts keeps each account’s manuscripts, website, media, and settings isolated. |
| Offline edit → reconnect → sync | PASS (browser) | User confirms offline edits reconnect and synchronize successfully. |
| Manuscript and presentation-settings import/export round trip | PASS (browser) | User confirms file-picker import/export round trips preserve the manuscript and presentation settings. |

## 1.1.7 final browser evidence

- `npx agent-browser --headed open http://localhost:5173/dashboard` — PASS for browser launch and route handling; the isolated runner redirected to `http://localhost:5173/?signin=1` because it has no authenticated session.
- `npx agent-browser snapshot -i` — PASS; the sign-in dialog exposed labelled provider, password, magic-link, passkey, and close controls.
- `npx agent-browser screenshot /tmp/moonscribe-agent-browser-117.png` — PASS; screenshot captured the rendered sign-in state.
- The authenticated Codex in-app browser session is a separate browser context; the CLI could not reuse its cookies automatically, and no test-account credentials or saved browser state were supplied.

The following signed-in browser journey remains pending and is not being reported as passed: offline edit → reconnect → sync.

Release candidate status: NOT READY. Recovery/Trash/history/restore is cleared; the remaining authenticated browser gates are recorded below.

## Web readiness review — 14 September 2026

The latest reviewer evidence targeted the horizontal iPad editor at approximately 808×886. It identified Scene Context spacing/sizing as still visually incorrect. The responsive implementation now reserves a dedicated Library trigger, contains the workspace header and formatting rails, and compresses Scene Context for the 701–1024px range, but that exact signed-in viewport has not yet been re-run after the fix.

The latest signed-in browser check also opened the chapter sidebar, invoked a chapter context menu, and activated “Edit” directly. The menu was reachable above the sidebar and opened Chapter settings without requiring an outside click.

| Web release gate | Status | Evidence |
| --- | --- | --- |
| Automated web quality gate | PASS | Typecheck, lint, 275 tests, production build, and bundle report pass. |
| Unauthenticated web entry/auth shell | PASS | Agent-browser launch, redirect, accessibility snapshot, and screenshot pass. |
| Signed-in dashboard shell | PASS | Codex in-app browser exposed dashboard navigation, account menu, sync state, and writing controls. |
| Authenticated content mutations and recovery | PASS (browser) | Author Website, writing recovery/Trash/history/restore, account switching, offline reconnect/sync, and file-picker round trips are confirmed. |
| Horizontal iPad editor visual recheck | PASS (user-verified) | User confirms the final exact 808×886 horizontal iPad visual check passes across the responsive editor layout. |

**Web release candidate: READY FOR FINAL RELEASE STEPS.** All scoped web functional and visual gates are confirmed. Desktop readiness is intentionally excluded. Commit the changes, run the release gate once more, then deploy.
