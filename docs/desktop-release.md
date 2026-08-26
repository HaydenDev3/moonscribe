# MoonScribe Desktop release runbook

The desktop client is bundled by Tauri. Release startup loads `dist` directly,
so Node, Vite, localhost, and a terminal are not required.

## Production secrets

Keep `RESEND_API_KEY`, OAuth client secrets, `OAUTH_STATE_SECRET`,
`TAURI_SIGNING_PRIVATE_KEY`, and its password in the deployment or CI secret
store. Never put them in `VITE_*` variables or commit them.

Passkeys additionally require `WEBAUTHN_ORIGIN=https://www.moonscribe.cc` and
`WEBAUTHN_RP_ID=moonscribe.cc` in the deployed API environment.

Passkeys additionally require `WEBAUTHN_ORIGIN=https://www.moonscribe.cc` and
`WEBAUTHN_RP_ID=moonscribe.cc` in the deployed API environment.

Resend must have a verified sending domain and a sender address on that domain.
Set `APP_ORIGIN`, `API_ORIGIN`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in the
deployed API. The Magic Link route is `POST /api/auth/magic-link`; it returns a
generic response for both known and unknown addresses, stores only a hash of
the one-use 15-minute token, and consumes it at
`POST /api/auth/magic-link/consume`.

## Signed updates

Generate a Tauri signing key outside the repository, store the private key in
CI, publish signed NSIS artifacts and the update manifest at the configured
`updates.moonscribe.cc` endpoint, and place only the public key in
`src-tauri/tauri.conf.json`. A build with an empty public key can launch and
show the Updates panel, but must not be advertised as capable of installing
production updates.

## Verification

```text
npm run typecheck
npm test
npm run build
npm run tauri:build
```

Launch the generated executable with the API and Vite servers stopped. Verify
that the auth gateway appears, Guest opens a local Dashboard, a novel remains
editable offline, and the executable stays responsive. Test the NSIS installer
on a clean Windows profile before release.

## Local storage

Desktop uses profile-scoped native SQLite as the authoritative repository.
The compatibility facade supports the indexed queries, cursors, and store
operations used by the shared application. On first launch after upgrading,
it merges the legacy IndexedDB/native-mirror data into SQLite and writes a
per-profile migration marker; later launches do not open IndexedDB.
