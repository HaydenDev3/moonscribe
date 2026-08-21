# MoonScribe production migration guide

MoonScribe is now set up to support a Supabase-backed live environment without forcing a one-way migration away from the local-first IndexedDB workflow.

## 1. Environment variables

Add these values to your production environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-or-publishable-key>
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
RESEND_API_KEY=<your-resend-api-key>
RESEND_FROM_EMAIL="MoonScribe <noreply@your-domain.com>"
APP_ORIGIN=https://app.your-domain.com
```

Never commit the real secret key. Keep `RESEND_API_KEY` in your deployment environment or secrets manager.

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
