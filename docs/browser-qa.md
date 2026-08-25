# Browser QA report

Test date: 2026-08-22 19:04 AEST

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

## Follow-up coverage required before 1.0

- Complete an account-backed run through onboarding, dashboard, Settings, Library, Journal, Insights, editor, Moodboard, Designer, import/export, backup/restore, and logout.
- Exercise desktop/tablet sizes and keyboard-only navigation.
- Add a browser automation suite for auth failure states, offline writes, sync conflicts, restore preview, and no-silent-failure async paths.
- Re-run with production environment variables and verified OAuth/email providers.

## Extended sweep

The public landing surface was reloaded at 320×720, 375×812, 390×844, 430×932, 768×1024, 1024×768, and 1440×900. Each viewport reported zero browser console warnings/errors and no horizontal overflow beyond the scrollbar width. Direct `#dashboard` access without a session redirected to `#/?signin=1` and opened the auth dialog without console errors.

The editor, Designer, Settings, sync, backup, and restore journeys remain unverified in this run because no browser session is signed in and no credentials were supplied.
