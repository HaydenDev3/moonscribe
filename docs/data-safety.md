# Data safety, backup, recovery, and sync

> Current release: **1.1.6**.

## Guarantees and non-guarantees

In the web app, manuscript writes are local-first and use IndexedDB. The server is optional. A local save protects against a network failure but not device loss, browser profile removal, disk failure, accidental deletion, or a destructive import. Maintain independent backups.

MoonScribe does not currently claim end-to-end encryption. Passphrase-encrypted export files use Web Crypto; server-side synchronized data is not described as E2EE.

## Save pipeline

Editor changes are debounced, written to the local chapter record, marked for synchronization, and later pushed when a configured server is reachable. Sync batches are triggered by local record writes, initial connection, visibility recovery, and network recovery; ordinary clicks and window focus do not start a sync. Draft recovery uses a separate browser recovery record for selected transient forms. UI copy must distinguish “Saved locally,” “Syncing,” “Synced,” “Offline—changes waiting,” and “Sync problem.”

## Sync conflicts

Stable IDs and timestamps identify records. Deletes use tombstones. When a pending local record also changed remotely, the engine creates a conflict rather than silently overwriting the local pending version. The conflict dialog offers local, remote, or duplicate/save-both resolution depending on record support.

Before public release, chapter conflicts need compare metadata, idempotency/retry tests, account-switch isolation, and multi-device destructive-edit scenarios.

## Trash

Trash is a soft-delete layer. Records retain their stable IDs and supporting data while `trashedAt` is present, so restore can return them to their original workspace. The default retention period is 30 days. Permanent purge deletes the local record and queues the appropriate server tombstone where supported. Novel purge also removes owned child records locally.

## Manual backups

Use Settings to download a complete JSON backup. For sensitive offline storage, choose encrypted backup and retain the passphrase separately. Validate important backups by importing them into a disposable browser profile or staging environment.

Designer palettes, templates, typography, Interior Layout settings, manuscript page-break metadata, and Author Website drafts should be included in the relevant local application/novel records. Verify these surfaces after restore rather than assuming a manuscript-only export contains every presentation setting. The Author Website Follow state is device-local in 1.1.6 and is not a portable social relationship.

## Restore procedure

1. Stop writing and download the current state if possible.
2. Confirm the target backup timestamp and identity.
3. Disconnect or pause sync if restoring an older state could immediately conflict.
4. Restore through Settings and review story/chapter counts.
5. Open representative chapters, world entries, images, and design settings.
6. Re-enable sync and explicitly resolve conflicts.

## Production backup policy

Server SQLite storage requires filesystem-level backups of `DATA_DIR`. Use encrypted, versioned snapshots with tested retention and restore. Back up before schema migration, import, merge, library replacement, bulk delete, and major desktop update. A production runbook must record backup ID, migration version, operator, verification, and rollback result.

## Desktop target

The desktop design requires immediate SQLite transactions, a durable operation queue, periodic retained backups, pre-migration snapshots, and recovery after interrupted writes. This is target architecture, not current behavior.
