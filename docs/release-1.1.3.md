# MoonScribe 1.1.3 release note

## Release status

This update may be published as a product update with the policy pages clearly labeled as product-grounded drafts. The policies are not represented as independently reviewed legal documents.

## Included

- Premium shared UI foundation and responsive mobile chrome.
- Improved print proofing, synchronized chapter sorting, folder-aware proof navigation, and active chapter tracking.
- Optional chapter titles, ornaments, and per-chapter drop caps.
- Print-safe entity highlights for characters, places, factions, creatures, and artefacts.
- Additional room environments, trim sizes, and device preview frames.
- More resilient 3D environment fallback behavior.
- Faster PWA precache generation by omitting legacy WOFF duplicates while retaining WOFF2 assets.

## Before calling it a fully production-ready release

- Configure and protect the real Tauri updater signing keypair.
- Obtain written independent legal review of the policy drafts; see `docs/legal-review-handoff.md`.
- Run the final production environment, updater, and mobile browser checks.
