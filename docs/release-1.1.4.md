# MoonScribe 1.1.4 release note

Released 5 September 2026.

## Included

- Free Author Website builder with Moonlight, Parchment, Ember, and Midnight themes.
- Explicitly selected public books and public journal posts; manuscript chapters and private metadata remain private.
- Responsive live preview, local image resizing, draft persistence, publishing, and public routes at `/@username` and `/@username/about`.
- Mobile dashboard header consistency across Home, Library, and Journal.
- Contextual editor scroll rail previews with nearby text, characters, places, and reading position.

## API routes

- `GET /api/author-website` — authenticated draft.
- `POST /api/author-website` — authenticated draft save.
- `POST /api/author-website/publish` — authenticated publish.
- `POST /api/author-website/unpublish` — authenticated unpublish.
- `GET /api/public/author/:username` — published public site.
