create table if not exists public.share_rooms (
  novel_id text primary key,
  owner_user_id text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_room_members (
  room_id text not null references public.share_rooms(novel_id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'editor', 'commenter', 'viewer')),
  expires_at timestamptz,
  primary key (room_id, user_id)
);

create table if not exists public.share_document_snapshots (
  novel_id text not null,
  chapter_id text not null,
  snapshot bytea not null,
  state_vector bytea not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (novel_id, chapter_id)
);

create table if not exists public.share_document_updates (
  id bigint generated always as identity primary key,
  novel_id text not null,
  chapter_id text not null,
  update bytea not null,
  client_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists share_document_updates_lookup
  on public.share_document_updates (novel_id, chapter_id, id);

alter table public.share_rooms enable row level security;
alter table public.share_room_members enable row level security;
alter table public.share_document_snapshots enable row level security;
alter table public.share_document_updates enable row level security;

create policy "share room members can read rooms" on public.share_rooms
  for select to authenticated using (
    owner_user_id = (select auth.uid())::text or exists (
      select 1 from public.share_room_members m
      where m.room_id = novel_id and m.user_id = (select auth.uid())::text
        and (m.expires_at is null or m.expires_at > now())
    )
  );

create policy "share members can read membership" on public.share_room_members
  for select to authenticated using (user_id = (select auth.uid())::text or exists (
    select 1 from public.share_rooms r where r.novel_id = room_id and r.owner_user_id = (select auth.uid())::text
  ));

create policy "share members can read snapshots" on public.share_document_snapshots
  for select to authenticated using (exists (
    select 1 from public.share_rooms r where r.novel_id = novel_id and (
      r.owner_user_id = (select auth.uid())::text or exists (
        select 1 from public.share_room_members m where m.room_id = novel_id and m.user_id = (select auth.uid())::text
          and (m.expires_at is null or m.expires_at > now())
      )
    )
  ));

create policy "editors can write snapshots" on public.share_document_snapshots
  for all to authenticated using (exists (
    select 1 from public.share_room_members m where m.room_id = novel_id and m.user_id = (select auth.uid())::text and m.role in ('owner', 'editor')
  ) or exists (
    select 1 from public.share_rooms r where r.novel_id = novel_id and r.owner_user_id = (select auth.uid())::text
  )) with check (exists (
    select 1 from public.share_room_members m where m.room_id = novel_id and m.user_id = (select auth.uid())::text and m.role in ('owner', 'editor')
  ) or exists (
    select 1 from public.share_rooms r where r.novel_id = novel_id and r.owner_user_id = (select auth.uid())::text
  ));

create policy "share members can read updates" on public.share_document_updates
  for select to authenticated using (exists (
    select 1 from public.share_rooms r where r.novel_id = novel_id and (
      r.owner_user_id = (select auth.uid())::text or exists (
        select 1 from public.share_room_members m where m.room_id = novel_id and m.user_id = (select auth.uid())::text
          and (m.expires_at is null or m.expires_at > now())
      )
    )
  ));

create policy "editors can write updates" on public.share_document_updates
  for insert to authenticated with check (exists (
    select 1 from public.share_room_members m where m.room_id = novel_id and m.user_id = (select auth.uid())::text and m.role in ('owner', 'editor')
  ) or exists (
    select 1 from public.share_rooms r where r.novel_id = novel_id and r.owner_user_id = (select auth.uid())::text
  ));

alter publication supabase_realtime add table public.share_rooms;
alter publication supabase_realtime add table public.share_room_members;

grant select on public.share_rooms, public.share_room_members, public.share_document_snapshots, public.share_document_updates to authenticated;
grant insert on public.share_document_updates, public.share_document_snapshots to authenticated;
grant update on public.share_document_snapshots to authenticated;
