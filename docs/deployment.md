# Deployment and operations

## Prerequisites

- Supported current Node.js and npm versions.
- Persistent writable storage for `DATA_DIR`.
- HTTPS application origin and reverse proxy.
- Verified Resend sending domain.
- Google/Discord OAuth applications with exact callback URLs.
- Encrypted secret management and automated database backups.

## Environment

Copy `.env.example` for local development. In production set `APP_ORIGIN=https://moonscribe.cc` and verify `moonscribe.cc` in Resend first. Required production server values are `APP_ORIGIN`, `OAUTH_STATE_SECRET`, `DATA_DIR`, and `RESEND_API_KEY`; the sender is fixed to `MoonScribe <noreply@moonscribe.cc>`. OAuth providers require their client IDs and secrets. Configure `CORS_ORIGINS`, `TRUST_PROXY`, and `PORT` deliberately. `ALLOW_DEV_TUNNELS` and legacy record claiming must remain off except during a controlled operation.

Set `API_ORIGIN` to the public HTTPS origin of the API when it is deployed separately from the web app. This is the exact Google/Discord callback host. If it is omitted in production, MoonScribe derives it from the trusted proxy host; setting it explicitly is preferred.

Only publishable Supabase/browser values may use a `VITE_` prefix. Never place a service-role key, Resend key, or OAuth secret in the Vite environment.

## Build and verify

Run:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
```

Treat lint errors, type errors, failed tests, dependency vulnerabilities at policy threshold, missing assets, and build warnings above the agreed bundle budget as release failures.

## Web rollout

1. Rotate and validate all secrets.
2. Back up and restore-test the production database.
3. Run versioned migrations against a copy.
4. Deploy the server and verify status, auth, authorization, email, and sync.
5. Deploy immutable Vite assets and verify service-worker update behavior.
6. Exercise new/existing account, offline writing, reconnect, backup, restore, and conflict flows.
7. Monitor logs and error rate before widening traffic.

## Email and DNS

Add the SPF and DKIM records supplied by Resend and configure DMARC initially in monitoring mode. Use verified role senders for general, security, and notifications. Add a signed webhook endpoint and test bounce/complaint suppression.

## Monitoring

Collect structured server logs without manuscript bodies, passwords, tokens, email codes, or imported files. Alert on authentication spikes, rate-limit activity, sync failures, backup failures, database errors, and email suppression. Define retention and access controls before enabling production telemetry.

## Rollback

Web assets can roll back to the last immutable release. Server rollback is allowed only if its binary understands the current database version. Restore a database backup only after preserving the failed state for investigation and preventing old clients from overwriting restored data.
