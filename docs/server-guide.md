<div align="center">
  <img src="./moonscribe-banner.svg" width="100%" alt="MoonScribe banner" />
</div>

# MoonScribe server guide

> A practical guide to the sync server, auth flow, routes, and the meanings behind common failure states.

<div align="center">
  <img src="./wave-divider.svg" width="100%" alt="Wave divider" />
</div>

## At a glance

The MoonScribe backend is a lightweight Node.js HTTP + WebSocket service built around SQLite. It is responsible for:

- account creation and bearer-token auth
- Discord and Google OAuth bridge flow
- per-user sync records in IndexedDB terms
- collaborative room access and live presence
- static file serving for the production build

The server is intentionally small and opinionated. It does not depend on a separate database service, and it treats the browser as the trusted client for local writing while enforcing access control server-side.

## How it works

### 1. Request lifecycle

Every incoming request goes through a single Node HTTP server in `server/index.js`.

1. Parse the URL.
2. Route requests under `/auth` and `/api` to the API layer.
3. Check CORS and allowed origins.
4. Run rate limiting for auth and sensitive actions.
5. Authenticate the caller with a bearer token where required.
6. Read/write SQLite tables.
7. Return JSON or redirect the browser to a public app origin.

### 2. Storage model

The server stores records in a SQLite `records` table keyed by:

- `user_id`
- `store`
- `id`

This makes each account own its own data, even when the client fragments a manuscript into many records like chapters, notes, cover data, or world entries.

Important record types are:

- `novels`
- `chapters`
- `characters`
- `notes`
- `relationships`
- `world`
- `moodboard`
- `glossary`
- `annotations`
- `branches`
- `suggestions`

The sync engine uses a last-writer-wins model per record and a `deleted` tombstone flag. The server keeps `updated_at` timestamps and merges the newest value.

### 3. Auth model

Auth tokens are short-lived bearer tokens stored in the `tokens` table.

- `issueToken()` creates a random token and stores a hash.
- `userFromToken()` validates and refreshes active token usage.
- expired tokens are removed on read and startup cleanup.

For local email auth:

- register: `POST /api/auth/register`
- login: `POST /api/auth/login`
- logout: `POST /api/auth/logout`

For OAuth:

- `/auth/discord`
- `/auth/google`
- exchange endpoint calls the provider and issues a MoonScribe token

### 4. Collaboration model

Shared writing uses:

- `share_invites` for one-time invites
- `novel_members` for active access grants
- `share_rooms` for room settings and capacity
- `share_presence` for online/offline state and activity

Role levels:

- `owner`
- `editor`
- `commenter`
- `viewer`

Owner access is always required for room configuration and invite issuance. Shared collaborators can only write if the host is live and the permission set allows it.

### 5. WebSockets

The app opens a WebSocket to `/ws/presence` with a bearer token and novel ID. It is used for:

- live collaborator presence
- room-level signal updates
- record broadcast to collaborators when the owner is editing

The room checks whether the host is online before allowing shared live editing.

---

## API route reference

All routes below return JSON unless specifically noted; OAuth login routes redirect the browser to the provider and back to the app origin.

### Auth and identity

| Method | Route | Purpose | Auth required | Typical failure |
| --- | --- | --- | --- | --- |
| `GET` | `/auth/discord` | Start Discord sign-in | No | `503` if provider not configured |
| `GET` | `/auth/discord/callback` | Finish Discord sign-in | No | OAuth state expired redirect |
| `GET` | `/auth/google` | Start Google sign-in | No | `503` if provider not configured |
| `GET` | `/auth/google/callback` | Finish Google sign-in | No | OAuth state expired redirect |
| `POST` | `/api/auth/oauth/exchange` | Exchange OAuth code for a MoonScribe session token | No | `400` if code invalid or expired |
| `POST` | `/api/auth/discord/exchange` | Same as above for Discord-only flow | No | `400` if sign-in code expired |
| `GET` | `/api/auth/status` | Check whether email / OAuth auth is enabled | No | Usually `200` |
| `POST` | `/api/auth/register` | Create an account | No | `400`, `429` |
| `POST` | `/api/auth/login` | Sign in with username/email + password | No | `401` or `429` |
| `POST` | `/api/auth/logout` | Invalidate current session token | Yes | `401` if no valid token |
| `GET` | `/api/auth/me` | Fetch current account metadata | Yes | `401` |
| `GET` | `/api/auth/sessions` | List all active device sessions | Yes | `401` |
| `POST` | `/api/auth/sessions/revoke` | Revoke a specific session | Yes | `400` or `404` |
| `POST` | `/api/auth/logout-others` | Sign out all other devices | Yes | `401` |

### Shared writing and collaboration

| Method | Route | Purpose | Auth required | Typical failure |
| --- | --- | --- | --- | --- |
| `POST` | `/api/shares/invite` | Generate a collaborate invite for a novel | Yes | `403`, `409`, `400` |
| `POST` | `/api/shares/accept` | Accept a share invite | Yes | `404`, `409`, `423` |
| `GET` | `/api/shares/bootstrap` | Pull full shared manuscript state | Yes | `403`, `423`, `409` |
| `GET` | `/api/shares` | Fetch room ownership, members, and presence | Yes | `403`, `423` |
| `POST` | `/api/shares/room` | Update room capacity/default role | Yes, owner-only | `403`, `400` |
| `POST` | `/api/shares/revoke` | Remove a collaborator | Yes, owner-only | `403` |
| `POST` | `/api/shares/presence` | Publish presence and editor activity | Yes | `403`, `423` |
| `GET` | `/api/shares/presence` | Get current room presence snapshot | Yes | `403` |

### Sync endpoints

| Method | Route | Purpose | Auth required | Typical failure |
| --- | --- | --- | --- | --- |
| `POST` | `/api/sync/push` | Push records to the server | Yes | `400` |
| `GET` | `/api/sync/pull` | Pull changes newer than `since` | Yes | Usually `200` with empty records |

### WebSocket

| Method | Route | Purpose |
| --- | --- | --- |
| `WS` | `/ws/presence` | Live presence and record sync broadcast for a novel |

---

## Route behavior and examples

### `POST /api/auth/register`

Request body:

```json
{
  "username": "stormwriter",
  "password": "super-secret-pass"
}
```

Success response:

```json
{
  "token": "...",
  "accountId": "...",
  "username": "stormwriter"
}
```

Common issues:

- `400` if username or password does not meet the server rules
- `429` if the IP has hit the login rate limit
- `400` if the username already exists

### `POST /api/auth/login`

Request body:

```json
{
  "username": "stormwriter",
  "password": "super-secret-pass"
}
```

Successful responses return a bearer token. The client should send it as:

```http
Authorization: Bearer <token>
```

### `GET /api/auth/me`

Returns the signed-in account profile, including provider metadata.

### `GET /api/sync/pull?since=123456789`

The client should pass the last server timestamp it saw from the server.

Typical response:

```json
{
  "serverTime": 1730000000000,
  "records": [
    {
      "store": "chapters",
      "id": "chapter-1",
      "novelId": "novel-42",
      "updatedAt": 1730000000000,
      "deleted": false,
      "payload": { "title": "Opening" }
    }
  ]
}
```

### `POST /api/sync/push`

Body shape:

```json
{
  "records": [
    {
      "store": "chapters",
      "id": "chapter-1",
      "novelId": "novel-42",
      "updatedAt": 1730000000000,
      "deleted": false,
      "payload": { "title": "Opening" }
    }
  ]
}
```

The server validates:

- record store is on the allowlist
- `id` exists
- `updatedAt` is numeric
- record size is under `MAX_RECORD_BYTES`
- sender has required access for a shared novel

The response includes:

- `accepted`: successfully stored record ids
- `rejected`: malformed or forbidden records
- `serverTime`

---

## HTTP status codes and what they mean

### `200 OK`

The request succeeded.

### `204 No Content`

Used for CORS preflight `OPTIONS` responses.

### `400 Bad Request`

The client sent malformed data or the server rejected the input.

Examples:

- malformed JSON
- missing required fields
- invalid auth OAuth exchange
- invalid record payloads during sync

Fix:

- check request body format
- ensure the token is included when required
- verify record payloads match the expected schema

### `401 Unauthorized`

The request did not include a valid bearer token or the token was expired.

Fix:

- log in again
- refresh the saved token in the client
- make sure the browser sends `Authorization: Bearer ...`

### `403 Forbidden`

The account exists, but the caller does not have the right access.

Examples:

- trying to invite a collaborator without being the owner
- trying to fetch a private share room without access
- trying to update a room you do not own

Fix:

- verify ownership of the current novel
- ask the owner to grant access or invite you
- ensure the account is the same one that owns the manuscript

### `404 Not Found`

The resource was not found or the invite/session no longer exists.

Examples:

- invalid invite code
- revoked session
- unknown route

Fix:

- re-request a fresh invite or sign in again
- check that the route path matches the API contract exactly

### `409 Conflict`

The operation conflicts with the current room state or existing record state.

Examples:

- room at max capacity
- novel has not been synced yet
- duplicate account registration scenario

Fix:

- free up room capacity
- have the host open and save the novel before another client joins
- retry with a different username or sign-in path

### `423 Locked`

The private collaboration room is temporarily unavailable because the host is offline.

Fix:

- have the owner open the book and keep it live
- wait until the host reconnects
- do not push live edits while the owner is offline

### `429 Too Many Requests`

The IP is hitting a rate-limited auth route too often.

Fix:

- wait a short time before retrying
- avoid repeated login attempts in a loop
- consider server-side rate limiter increases only for a trusted deploy

### `503 Service Unavailable`

The server does not have an essential configuration for the requested feature.

Examples:

- Discord or Google OAuth secret missing
- app not configured for the requested provider

Fix:

- configure `DISCORD_CLIENT_SECRET` and/or `GOOGLE_CLIENT_SECRET`
- ensure the frontend app origin matches the configured server origin

---

## Common troubleshooting

### “Not signed in. Create an account or sign in.”

Cause:

- missing bearer token
- token expired
- client kept stale token after logout

Fix:

- call `/api/auth/login` or the OAuth exchange flow again
- clear the stored token and re-authenticate

### “The host is offline. This private writing room is closed.”

Cause:

- the owner is not connected and their presence heartbeat is stale

Fix:

- ask the owner to open the novel
- keep the project open while collaborating

### “This collaborative room has reached its X-user limit.”

Cause:

- invite room is full

Fix:

- increase room size via `/api/shares/room`
- revoke a stale collaborator

### “That invitation is invalid or has expired.”

Cause:

- invite ID was expired or used before

Fix:

- generate a new share link
- check that the invitation is for the exact same novel

### OAuth sign-in fails silently

Cause:

- provider redirect or state mismatch
- server missing the provider secret
- wrong public origin config

Fix:

- verify both the frontend app origin and `APP_ORIGIN`
- ensure the provider callback URLs line up exactly
- confirm the server environment variables are set on the server, not in the browser bundle

---

## Operational tips

### Run locally

```bash
npm install
npm run server
```

Then point the browser to the app as normal. The backend can serve the production build when `dist/` exists.

### Production config checklist

- `APP_ORIGIN` matches public frontend origin
- `CORS_ORIGINS` includes the public web origin
- `DISCORD_CLIENT_SECRET` and `GOOGLE_CLIENT_SECRET` are secret-only env vars
- `PORT` is the public internal port for the backend
- `DATA_DIR` points to a persistent directory for the SQLite database

### Security notes

- secrets are never exposed to the client
- OAuth state tokens are signed and time-bound
- auth tokens are hashed before storage
- CORS is restricted to an allowlist of safe origins
- static files are served with strict security headers

---

## Summary

The MoonScribe backend is a compact sync and collaboration layer built for a local-first writing app. It gives you:

- secure token auth
- local SQLite persistence
- record-level merge syncing
- share-room collaboration with presence and access rules
- OAuth sign-in and server-side protection

It is small, understandable, and intentionally built to sit next to the client app without making the writing experience feel like a heavy enterprise server.

If you are debugging a production issue, start by checking:

1. whether the client sent a valid bearer token
2. whether the user actually owns or belongs to the novel
3. whether the host is live for collaboration
4. whether the requested OAuth provider is configured
5. whether the request body matches the expected JSON contract

<div align="center">
  <img src="./wave-divider.svg" width="100%" alt="Wave divider" />
</div>
