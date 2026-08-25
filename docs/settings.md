# Settings reference

Settings opens as an internal application workspace. Normal changes save immediately; destructive changes require confirmation. A “Saved” indicator means the local settings record was updated, not necessarily synchronized to another device.

## Navigation and search

Settings is grouped into General, Experience, Data & Sync, Privacy & Security, Accessibility, and Advanced areas. Search matches setting labels and terms, then opens the relevant section. The production target includes fuzzy matching, setting anchors, internal scrolling, and temporary result highlighting.

## General

- **Overview:** account, current appearance, editor summary, sync state, and quick links.
- **Profile:** display/writer name, biography, language, and timezone.
- **App Connections:** current MoonScribe identity and configured sign-in providers. Discord/Google/password management relies on server support. Signed-in users can register, review, and remove WebAuthn passkeys; supported browsers can use a passkey for passwordless sign-in.

## Experience

- **Appearance:** theme, accent, texture, scale, density, corner treatment, decoration, typography, custom fonts, layout, and sidebar visibility.
- **Editor:** editor font size, line height, measure, drop caps, typewriter assistance, warmth, spelling, and autocorrect. Novel page/design settings remain novel-specific.
- **Writing Experience:** autosave pause, cursor/scroll restoration, last chapter, reminders, and celebration level.
- **Dashboard:** hero, greeting, recent/streak cards, sidebar default, current story, labels, and animation.
- **Sounds & Haptics:** master, interface, writing, notification, and ambient channels. Ambient output is synthesized by the current engine; native haptics depend on browser/device support.

## Data and sync

- **Sync:** account/server connection, current status, offline queue, and conflict guidance.
- **Backups:** JSON and encrypted backup download/restore plus desktop-only native snapshot discovery and guarded restore with a pre-restore safety copy.
- **Import & Export:** currently shares the backup/import implementation with privacy data controls.
- **Storage:** browser-local storage controls exist; detailed category accounting and desktop folder actions are unavailable.

## Privacy and security

- **Lock & Security:** app PIN/passphrase, idle/background behavior, privacy blur, and novel locking.
- **Privacy & Data:** export, encrypted export, import/restore, and destructive local erase.
- **Sessions & Devices:** active server sessions and other-device revocation where signed in.
- **Notifications:** in-app notification-center records, category/email preferences, browser permission, and desktop-native notification preference when running under Tauri.

## Accessibility

Reduced motion, readable font, high contrast, focus rings, larger targets, underlined links, reduced transparency, and colour-vision palettes are stored as application preferences. Keybinds are editable and report conflicts before they are saved.

## Advanced

Performance includes autosave/animation-oriented controls. About identifies the build. Desktop builds expose signed update status, native notifications, tray access, and diagnostics when the corresponding runtime capability is present; GPU status and experimental feature management remain future backend work.

## Persistence and compatibility

Defaults live in `DEFAULT_SETTINGS` in `AppContext.tsx`. Settings are merged with defaults when loaded so older records receive safe values. Schema-changing additions should increment a settings schema version and migrate renamed or transformed keys; never interpret a missing safety setting as permission to enable a risky behavior.

## Destructive controls

Provider removal, passkey removal, restore, full local erase, account deletion, library replacement, and merge must require explicit confirmation and, where account data is involved, recent reauthentication. Removing the final valid sign-in/recovery method is forbidden.
