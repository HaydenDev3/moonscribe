# MoonScribe 1.0 release-candidate audit

Audit date: 2026-08-22

## Release decision

**Historical audit snapshot.** This document records an earlier pre-release assessment. For the current desktop/native status, see [desktop.md](desktop.md) and run `npm run desktop:release-check`; the audit findings below should not be read as a current inventory without re-verification.

## Release blockers

### BLOCKER

- A Google OAuth client ID and secret were present in `.env.example`. They have been removed, but the secret must be revoked in Google Cloud and replaced. Git history and distributed copies must be reviewed.
- Magic Link endpoints, hashed one-use link tokens, and the branded Magic Link email are not implemented by `server/index.js`.
- Passkey registration/login endpoints and credential storage are not implemented. Settings currently labels Passkey as coming soon; the auth UI must not imply it works when no handler is available.
- The requested unified identity model (`users`, `auth_identities`, `passkeys`) is absent. Provider linking, safe unlinking, reauthentication, and reviewed account merging are therefore absent.
- The Tauri application is a minimal web wrapper. It has no desktop SQLite data layer, secure credential storage, deep links, updater, signing configuration, tray, notification plugin, file associations, window-state persistence, or migration backups.
- The Tauri CSP is `null`.
- A Windows installer could not be produced on the audit machine because the MSVC linker (`link.exe`) is not installed.

### HIGH

- The production lint gate now passes with zero errors. There are 52 cleanup warnings (mostly unused code and Fast Refresh file layout) that should trend to zero before the final release candidate.
- The editor still uses `document.execCommand` and direct `innerHTML` mutation extensively. This is release-risk debt for selection, undo/redo, annotation, and collaborative cursor stability.
- The sync server describes and implements timestamp-based record merging. Manuscript conflicts have a review UI, but destructive multi-device and account-switch cases need end-to-end tests before release.
- Several rich-content surfaces render HTML. Some use `sanitizeStoredHtml`; every import, sync, preview, replay, print, and export boundary still needs a documented sanitization test.
- There is no persistent notification/announcement data model, Resend webhook processing, or verified webhook signatures.
- Automatic scheduled local backups, retention, pre-migration backups, crash recovery review, and `.moonscribe` packaging are incomplete.
- The main JavaScript bundle is about 1.66 MB minified (about 452 KB gzip) and the main CSS is about 530 KB. Route-level splitting remains incomplete.
- No device matrix or automated accessibility audit has been completed for the required phone, tablet, laptop, desktop, and ultrawide sizes.

### MEDIUM

- Important preferences and draft recovery still assume browser `localStorage`. Manuscripts use IndexedDB, but desktop settings/recovery need a native durable abstraction.
- The Resend layer currently supports verification/security codes, account updates, and reminders only. The requested template catalogue is incomplete.
- The sounds module centralizes semantic synthesized feedback, but persistent ambient assets, route-persistent dual-source crossfade, and device haptic availability UX require manual verification.
- The production bundle warning threshold is exceeded and the PWA precache is about 7.65 MB.

### LOW

- Package and Tauri versions remain `0.1.0`, which is appropriate while blockers remain.
- README still describes a browser/PWA product more accurately than a production desktop application.

## Verified fixes and existing strengths

- Removed the exposed Google OAuth values from `.env.example`.
- Fixed the auth redesign's TypeScript contract for optional method badges.
- Passwords are hashed server-side with salted `scrypt`; comparisons use timing-safe equality.
- OAuth state is signed and short-lived; server records and collaboration access are scoped by user.
- Session listing, other-session revocation, local IndexedDB storage, backups, encrypted backup export, sync conflict UI, and HTML sanitization utilities exist.
- Dashboard, Settings, Auth, feedback, and production-migration files contain a substantial in-progress redesign. Existing uncommitted work was preserved.

## Architecture summary

### Authentication

Current: one `users` row contains password and provider-specific columns; bearer session tokens are stored hashed server-side. Discord, Google, password, email verification, email 2FA, session listing, and revocation have server routes.

Required before 1.0: normalize provider records into `auth_identities`; add hashed, expiring, one-use Magic Link records; add WebAuthn challenge and passkey tables; add connection/unlink/recovery invariants; and implement an authenticated, backed-up merge transaction. Magic Link requests must always return a generic response.

### Desktop

Current: React/Vite output loaded by a Tauri 2 window with the shell plugin.

Required: a versioned SQLite repository and migration layer, immediate local transaction for manuscript edits, durable sync queue, keyring-backed credentials, deep-link allowlist, window-state persistence, tray/shortcuts/notifications, file handling, automatic backups, and a signed updater. The frontend should consume a storage interface shared by IndexedDB and the Tauri adapter rather than fork the UI.

### Sync and data safety

Current: local IndexedDB, pending sync metadata, tombstones, retries, backup import/export, and explicit conflict records exist.

Required: chapter-aware conflict policy, idempotency and stale-write tests, safe account switching, scheduled retained backups, pre-operation backups, restore validation, migration journaling, crash recovery review, and desktop SQLite-to-cloud queue tests.

## Security summary

- Production dependency audit: **0 known vulnerabilities** (`npm audit --omit=dev --audit-level=moderate`).
- Rotate the leaked Google OAuth secret before any deployment.
- Set an explicit Tauri CSP and least-privilege capabilities; do not ship with `csp: null`.
- Keep Resend and OAuth secrets server-only. Never use `VITE_` prefixes for them.
- Add Magic Link throttling/token hashing and WebAuthn challenge expiry.
- Add Resend webhook signature verification and suppression handling.
- Complete import HTML/file validation, safe deep-link validation, CSRF review, and authorization tests for every private route.

## Build status

| Gate | Status | Evidence |
| --- | --- | --- |
| Unit/integration tests | PASS | 31 files, 192 tests |
| TypeScript | PASS | `tsc --noEmit` |
| Web production build | PASS WITH WARNING | 1.66 MB main JS chunk |
| Production dependency audit | PASS | 0 vulnerabilities |
| Lint | PASS WITH WARNINGS | 0 errors, 52 warnings |
| Windows/Tauri package | BLOCKED | MSVC `link.exe` missing; desktop feature blockers remain |

## Database migration notes

Do not mutate the production schema ad hoc. Add a monotonically versioned migration table and make every migration transactional. Back up the local/cloud database before identity normalization or destructive migrations. The identity migration should create `auth_identities`, backfill Discord/Google/email identities without changing user IDs, enforce `(provider, provider_user_id)` uniqueness, validate collisions, and only then remove legacy provider columns in a later release.

## Required environment variables

Required server values: `APP_ORIGIN`, `OAUTH_STATE_SECRET`, `DATA_DIR`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.

Provider values: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.

Deployment controls: `CORS_ORIGINS`, `TRUST_PROXY`, `PORT`, `ALLOW_DEV_TUNNELS`, and the one-time `CLAIM_LEGACY_RECORDS_ON_FIRST_ACCOUNT` switch.

Optional public browser values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SYNC_SERVER`. Only public/publishable values may use `VITE_`.

Future desktop updater configuration also requires a public signature key in Tauri config and protected CI secrets for the private signing key/password. Never commit the private updater or Windows code-signing keys.

## DNS and Resend setup

1. Choose a production sending subdomain and add the SPF and DKIM records supplied by Resend.
2. Complete domain verification in Resend; add DMARC with monitoring before moving to an enforcement policy.
3. Configure verified senders for general, security, and notification mail.
4. Configure a server-side webhook endpoint and its signing secret; verify every signature before processing delivered, bounced, failed, complained, or suppressed events.
5. Do not use opens for security decisions. Test bounce and complaint suppression in staging.

## Deployment sequence

1. Revoke and rotate the exposed Google OAuth secret.
2. Complete blockers and run the full release gate in CI.
3. Provision a persistent backed-up server data volume and encrypted environment secrets.
4. Set the exact production origin/CORS allowlist and trusted-proxy policy.
5. Run versioned database migrations against a copy, verify counts, then back up production before rollout.
6. Deploy the server, verify health/auth/email/webhooks, then deploy the immutable web assets.
7. Exercise fresh-account and existing-account flows before enabling public traffic.
8. Build Windows packages only from a pinned CI image with Visual Studio Build Tools, Rust, WebView2 prerequisites, code signing, and retained build provenance.

## Tauri updater and signing setup

1. Implement and configure the Tauri updater plugin with HTTPS endpoints and a committed public verification key.
2. Store the updater private key/password and Windows certificate only in protected CI secrets.
3. Produce signed update artifacts and signatures from CI; reject unsigned or invalid manifests.
4. Back up SQLite before app/database migrations and retain rollback-compatible data.
5. Test stable-channel install, update, failed download, invalid signature, offline restart, and data preservation on a clean Windows VM.

## First-release QA checklist

- [ ] Rotate leaked OAuth secret and scan history
- [ ] Discord, Google, password, Magic Link, and passkey sign-in
- [ ] Provider link/unlink, last-method protection, merge, logout, and revocation
- [ ] Resend domain, templates, bounce handling, and webhook signatures
- [ ] Autosave, offline edits, reconnect, conflicts, account switching, backup, restore, import, and export
- [ ] Desktop SQLite, keyring, deep links, OAuth callback, updater, notifications, tray, window restore, and signed installers
- [ ] Dashboard, Auth, Settings, Editor, Designer, Moodboard, mobile, and tablet manual journeys
- [ ] No dead/fake controls, duplicate close buttons, broken scroll containers, or silent async failures
- [x] Unit/integration tests pass
- [x] TypeScript passes
- [x] Web production build succeeds
- [x] Production dependency audit reports zero known vulnerabilities
- [x] Lint critical errors are zero
- [ ] Accessibility critical issues are zero
- [ ] Browser console/runtime errors are zero
- [ ] Performance budgets and large-novel input latency pass

## Recommended version

Keep `0.1.0` (pre-release) while the blockers remain. Use `1.0.0-rc.1` only after every BLOCKER is closed and the complete QA matrix passes; promote the identical tested artifacts to `1.0.0`.

## Draft release notes

MoonScribe's current pre-release brings a redesigned calm writing dashboard, expanded settings and sign-in surfaces, local-first manuscript storage, backup and encrypted export tools, multi-device sync conflict review, book design and worldbuilding workspaces, and centralized sound feedback. This build is not yet a public 1.0: Magic Link/passkey identity flows, native local-first desktop storage, signed updates, and final release QA remain in progress.
