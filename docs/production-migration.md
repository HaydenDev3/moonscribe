# MoonScribe production migration guide

MoonScribe is now set up to support a Supabase-backed live environment without forcing a one-way migration away from the local-first IndexedDB workflow.

## 1. Environment variables

Copy [`.env.example`](../.env.example) to `.env.local` for development, then
configure the same server-only values in your deployment provider's encrypted
environment settings. It includes acquisition links and setup notes for every
supported integration.

The client only needs the following optional public Supabase values:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

`RESEND_API_KEY`, OAuth client secrets, and `OAUTH_STATE_SECRET` are server-only
secrets. Never use a `VITE_` prefix for them and never commit them.

## 2. Supabase tables

Create tables to support cloud migration:

```sql
create table if not exists moonscribe_profiles (
  id text primary key,
  email text,
  username text,
  account_role text default 'user',
  roles jsonb default '[]'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists moonscribe_library (
  id text primary key,
  user_id text not null,
  email text,
  username text,
  payload jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 3. Snapshot migration flow

Use the helper in `src/lib/supabase.ts`:

```ts
import { exportLocalBackupToSupabase } from './lib/supabase'

const result = await exportLocalBackupToSupabase({
  userId: 'user_123',
  email: 'writer@example.com',
  username: 'writer',
  accountRole: 'admin',
  roles: ['user', 'developer'],
  backup: await exportBackup(),
})
```

This creates a profile row and uploads the latest local library snapshot.

## 4. Email-based security features

The server now supports:

- email verification
- 2FA codes sent via Resend
- reminder emails
- account update notices

These endpoints are enabled when `RESEND_API_KEY` is present:

- `POST /api/auth/request-verification`
- `POST /api/auth/verify-email`
- `POST /api/auth/update-account`
- `POST /api/auth/enable-2fa`
- `POST /api/auth/verify-2fa`
- `POST /api/auth/reminder`

## 5. Rollout plan

1. Add the production environment variables.
2. Create the Supabase tables above.
3. Upload the latest local library snapshot for each active account.
4. Verify users by email before enabling full cloud sync.
5. Turn on 2FA for accounts that need higher protection.

This keeps the local-first app intact while giving you a clean path to production sync when you are ready.
