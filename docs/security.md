# Security model

## Trust boundaries

The browser client is untrusted from the server's perspective. Every private server operation must derive the user from a valid session and enforce ownership or membership. Client-side hiding is not authorization.

## Authentication

Passwords are salted and hashed with Node `scrypt`; verification uses timing-safe comparison. Bearer tokens are random and stored hashed in SQLite with expiry, session ID, device label, and last-seen time. Google and Discord OAuth use signed, expiring state. Production OAuth should add PKCE where supported and exact callback/origin allowlists.

Magic Link is implemented through the server Resend integration when the deployment has `RESEND_API_KEY` and `RESEND_FROM_EMAIL` configured. Passkey authentication uses WebAuthn with required user verification, origin and relying-party binding, five-minute one-use challenges, discoverable credentials, and authenticator signature-counter updates. Production should set `WEBAUTHN_ORIGIN=https://moonscribe.cc` and `WEBAUTHN_RP_ID=moonscribe.cc`; `WEBAUTHN_RP_NAME` is optional. Production Magic Link tokens are random, hashed at rest, one-use, short-lived, generic on request, and rate-limited.

## Authorization and tenancy

Synchronized records are keyed by user, store, and stable record ID. Collaboration uses novel ownership/membership and live-host checks. Collision and cross-account tests are required for every new record endpoint.

## Sessions and recovery

Users can list sessions and revoke other sessions. Sensitive identity/provider/passkey/email changes must require recent reauthentication. A provider may not be silently transferred between accounts, and the final recovery method may not be removed.

## Secrets

`RESEND_API_KEY`, OAuth client secrets, `OAUTH_STATE_SECRET`, updater private keys, and code-signing credentials are server/CI secrets. Never expose them with a `VITE_` prefix. A Google OAuth secret was removed from `.env.example` on 2026-08-22 and must be revoked and rotated.

## Content and files

Imported/stored HTML must pass `sanitizeStoredHtml` before interactive rendering. URLs are allowlisted by protocol. File type, size, decoded image dimensions, archive entries, and filenames need validation. Object URLs and image buffers must be released after use.

## Browser and desktop policy

The server emits security headers. The Tauri configuration uses a self-restricted CSP with explicit asset, network, and IPC allowances. Desktop capabilities must use least privilege, validate deep links, keep tokens in the OS keyring, and reject unsigned updates.

## Email

Resend calls are server-only. A production webhook must verify signatures before recording delivery, bounce, failure, complaint, or suppression. Opens must never authorize or alter security state.

## Vulnerability management

Run `npm audit --omit=dev --audit-level=moderate`, Rust advisory scanning, secret scanning, static analysis, and signed reproducible builds in CI. Dependency audit reported zero known production vulnerabilities on 2026-08-22; that result expires as advisories change.
