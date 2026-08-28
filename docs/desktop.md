# Tauri desktop application

## Current status

MoonScribe uses Tauri 2 to package the shared React/Vite frontend. Desktop uses native SQLite as its authoritative repository, with WAL settings, versioned migrations, profile-scoped records, backups, OS keyring credential commands, deep-link plumbing, window-size/position persistence, tray access, native notifications, and backup-before-update hooks. On first launch after the migration, existing IndexedDB and earlier native-mirror records are merged into profile-scoped SQLite records; subsequent desktop reads and writes use SQLite only. Web/PWA builds continue to use IndexedDB.

Release configuration still required includes the GitHub secrets `TAURI_PUBLIC_KEY`, `TAURI_SIGNING_PRIVATE_KEY`, and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, plus full packaged-app QA. Quick Capture is available by Ctrl/Cmd+Shift+K even when the desktop window is unfocused, and from the command palette. The release workflow now refuses to package without the signing secrets and injects the public key into the updater configuration for the build. The installer registers Markdown, DOCX, EPUB, and JSON backup associations; OS-opened Markdown, plain-text, RTF, DOCX, and EPUB files route into the active novel’s chapter importer. JSON backup restore remains available through the dedicated recovery flow.

Discord Rich Presence is opt-in and desktop-only. The bundled Discord Application ID is `1537750421458780170`; `MOONSCRIBE_DISCORD_CLIENT_ID` may override it for development or a future application. The app publishes only generic workspace activity and silently disables the integration when Discord is not available.

## Windows toolchain

Install Rust stable, Node/npm, WebView2, and Visual Studio Build Tools with the Desktop development with C++ workload and Windows SDK. `npm run tauri:build` produces the Windows NSIS installer; MSI packaging is intentionally omitted because the release path is NSIS.

## Local development without port collisions

Start the web/API pair once:

```text
npm run dev
```

The launcher detects MoonScribe services already listening on ports 3001 and 5173 and reuses them. This makes a second `npm run dev` safe and prevents Tauri's `beforeDevCommand` from failing with `EADDRINUSE`. To test the native build while those services are already running, use:

```text
npx tauri dev --no-watch --config '{"build":{"beforeDevCommand":""}}'
```

This isolates the native build test from the web launcher. It still requires the MSVC linker and stops at Rust compilation until Visual Studio Build Tools are installed.

## Target storage design

The frontend should call a repository interface. Web uses IndexedDB; Tauri uses SQLite commands. A manuscript edit commits locally, appends an idempotent sync operation in the same transaction, updates recovery metadata, and returns “Saved locally.” Network sync is asynchronous.

Store auth refresh/session secrets in Windows Credential Manager/macOS Keychain/Linux Secret Service through a maintained keyring plugin. Do not store them in localStorage or plaintext SQLite.

## Deep links

Allow only known routes and validated IDs:

- `moonscribe://auth/callback`
- `moonscribe://magic`
- `moonscribe://novel/{id}`
- `moonscribe://chapter/{id}`
- `moonscribe://invite/{id}`

Reject unexpected hosts, traversal, embedded URLs, oversized parameters, and untrusted redirect destinations.

## Updater and signing

Configure the Tauri updater with HTTPS endpoints and a public signature key in application configuration. Keep the private updater key/password and Windows code-signing certificate in protected CI secrets. CI creates signed installers, update archives, signatures, checksums, SBOM/provenance, and release metadata. The app must reject unsigned/invalid updates and back up SQLite before major migrations.

## Desktop QA

Test clean install, upgrade, downgrade rejection, invalid signature, offline start, interrupted update, retained writing, SQLite recovery, keyring access, deep-link authentication, tray quit, multiple monitors, window restore, sleep/resume, system locale, long paths, file association, and uninstall without deleting user writing unless explicitly confirmed.
