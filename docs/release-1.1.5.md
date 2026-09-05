# MoonScribe 1.1.5 release note

Released 5 September 2026.

## Included

- Shared repository boundary for local reads, writes, deletes, queries, transactions, and profile switching.
- Canonical structured-document representation generated from existing sanitized HTML.
- Compatibility HTML retained for existing chapters, exports, and rollback paths.
- Deterministic plain-text extraction for future search and print consumers.
- Proof tests for repository delegation, structured-document conversion, formatting, lists, links, scene breaks, page breaks, and sanitization.
- Consistent 1.1.5 version metadata across the web package, desktop manifest, README, documentation, and Settings release history.

## Compatibility and status

This is a foundation release. The existing editor, sync engine, and print renderer remain active while the structured editor, durable operation queue, and measured print pipeline are developed behind compatibility-preserving seams.

Existing record IDs, backup formats, routes, and local-first behavior remain unchanged.
