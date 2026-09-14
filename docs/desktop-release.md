# MoonScribe Desktop release runbook

The desktop client is bundled by Tauri. Release startup loads `dist` directly,
so Node, Vite, localhost, and a terminal are not required.

## Production secrets

Keep `RESEND_API_KEY`, OAuth client secrets, `OAUTH_STATE_SECRET`,
`TAURI_SIGNING_PRIVATE_KEY`, and its password in the deployment or CI secret
store. Never put them in `VITE_*` variables or commit them.

Passkeys additionally require `WEBAUTHN_ORIGIN=https://www.moonscribe.cc` and
`WEBAUTHN_RP_ID=moonscribe.cc` in the deployed API environment.

### GitHub Actions desktop secrets

Create the updater keypair once with the Tauri signer in a protected local
environment. Keep the private key and password out of the repository. Add the
following repository or environment secrets in GitHub under **Settings →
Secrets and variables → Actions**:

- `TAURI_PUBLIC_KEY` — the public key from the generated updater keypair.
- `TAURI_SIGNING_PRIVATE_KEY` — the complete private updater key.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the updater key password.
- `WINDOWS_CERTIFICATE` — base64-encoded `.pfx`/`.p12` code-signing certificate.
- `WINDOWS_CERTIFICATE_PASSWORD` — password for the Windows certificate.
- `APPLE_CERTIFICATE` — base64-encoded Developer ID `.p12` certificate.
- `APPLE_CERTIFICATE_PASSWORD` — password for the Apple certificate.
- `APPLE_ID` — Apple account used for notarization.
- `APPLE_PASSWORD` — app-specific Apple password.
- `APPLE_TEAM_ID` — Apple Developer team identifier.

The Windows certificate is imported only on the Windows runner. Apple
credentials are consumed only by the macOS runner. Linux packages use checksums
and provenance rather than a private signing secret.

### Windows beta without platform signing

Before the Windows signing certificate is available, publish a beta using a tag
such as `v1.1.7-beta.1`. The Windows beta workflow creates a GitHub prerelease
and NSIS installer using the updater signing key, but the installer itself is
intentionally unsigned. Windows SmartScreen may warn beta testers about it.
Use the stable `v1.1.7` workflow only after a trusted Windows certificate is
configured.

Resend must have a verified sending domain and a sender address on that domain.
Set `APP_ORIGIN`, `API_ORIGIN`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in the
deployed API. The Magic Link route is `POST /api/auth/magic-link`; it returns a
generic response for both known and unknown addresses, stores only a hash of
the one-use 15-minute token, and consumes it at
`POST /api/auth/magic-link/consume`.

## Signed updates

Generate the updater keypair in a protected directory with
`npx tauri signer generate -w <protected-path>/moonscribe.key`. Copy the public
key into `TAURI_PUBLIC_KEY`, and copy the private key and password into the two
`TAURI_SIGNING_*` GitHub secrets. Never commit either key or place them in a
tracked `.env` file.

Generate a Tauri signing key outside the repository, store the private key in
CI, and publish the signed update manifest through the canonical
`https://www.moonscribe.cc/updates` path. The web deployment proxies that path
to the latest stable GitHub release manifest, while the Tauri endpoint keeps
the target, architecture, and current-version parameters for compatibility.
Inject only the public key into the CI build configuration. A build with an
empty public key can launch and show the Updates panel, but must not be
advertised as capable of installing production updates.

The release workflow builds Windows NSIS, macOS DMG, and Linux AppImage/DEB
artifacts from the version tag. It also emits updater metadata, signatures,
checksums, and release notes. Do not run the publishing workflow until all
required signing secrets are present.

On Linux, use `npm run tauri:build:linux` when building locally. The AppImage
toolchain currently needs `NO_STRIP=1` on newer distributions whose system ELF
relocations are not understood by the bundled linuxdeploy strip utility.

## Verification

```text
npm run typecheck
npm test
npm run build
npm run tauri:build
```

Launch each generated executable with the API and Vite servers stopped. Verify
that the auth gateway appears, Guest opens a local Dashboard, a novel remains
editable offline, and the executable stays responsive. Test each platform
package on a clean profile before release.

## Local storage

Desktop uses profile-scoped native SQLite as the authoritative repository.
The compatibility facade supports the indexed queries, cursors, and store
operations used by the shared application. On first launch after upgrading,
it merges the legacy IndexedDB/native-mirror data into SQLite and writes a
per-profile migration marker; later launches do not open IndexedDB.
