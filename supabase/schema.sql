-- Fams: schema, row-level security and storage policies.
--
-- Run this once in the Supabase SQL editor. It is idempotent, so re-running it
-- after a change is safe.
--
-- The shape is deliberately simple: a tree is a document, and people and
-- partnerships are rows of JSON keyed by the ids the app already generates.
-- The app loads a whole tree anyway, so there is nothing to gain from
-- normalising fields the database never queries — and it means adding a field
-- to a Person needs no migration.

-- ---------------------------------------------------------------- tables ---

create table if not exists public.trees (
  id             uuid primary key default gen_random_uuid(),
  name           text not null default 'My Family',
  owner_id       uuid not null references auth.users (id) on delete cascade,
  home_person_id text,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

do $$ begin
  create type public.tree_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

create table if not exists public.tree_members (
  tree_id    uuid not null references public.trees (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.tree_role not null default 'viewer',
  -- Denormalised: clients cannot read auth.users, and a member list that
  -- cannot show who the members are is not a member list.
  email      text,
  created_at timestamptz not null default now(),
  primary key (tree_id, user_id)
);

alter table public.tree_members add column if not exists email text;

-- Invitations are by email because the invitee may not have an account yet.
create table if not exists public.tree_invites (
  id          uuid primary key default gen_random_uuid(),
  tree_id     uuid not null references public.trees (id) on delete cascade,
  email       text not null,
  role        public.tree_role not null default 'viewer',
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (tree_id, email)
);

create table if not exists public.people (
  tree_id    uuid not null references public.trees (id) on delete cascade,
  id         text not null,
  data       jsonb not null,
  updated_at bigint not null default 0,
  deleted_at bigint,
  primary key (tree_id, id)
);

create table if not exists public.unions (
  tree_id    uuid not null references public.trees (id) on delete cascade,
  key        text not null,
  data       jsonb not null,
  updated_at bigint not null default 0,
  deleted_at bigint,
  primary key (tree_id, key)
);

create index if not exists people_tree_updated_idx on public.people (tree_id, updated_at);
create index if not exists unions_tree_updated_idx on public.unions (tree_id, updated_at);
create index if not exists tree_invites_email_idx on public.tree_invites (lower(email));

-- ------------------------------------------------------------- functions ---

-- SECURITY DEFINER so the membership check does not re-enter the policies on
-- tree_members, which would recurse forever.
create or replace function public.tree_role_of(target uuid)
returns public.tree_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.tree_members
  where tree_id = target and user_id = auth.uid()
  limit 1
$$;

create or replace function public.can_read_tree(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tree_role_of(target) is not null
$$;

create or replace function public.can_write_tree(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tree_role_of(target) in ('owner', 'editor')
$$;

create or replace function public.is_tree_owner(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tree_role_of(target) = 'owner'
$$;

-- The creator is always the first member, otherwise they could not read back
-- the tree they just made.
create or replace function public.add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.tree_members (tree_id, user_id, role, email)
  values (new.id, new.owner_id, 'owner', (select email from auth.users where id = new.owner_id))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trees_add_owner on public.trees;
create trigger trees_add_owner after insert on public.trees
for each row execute function public.add_owner_membership();

-- Accepting an invitation is the only way to join a tree you cannot yet read,
-- so it runs as definer and checks the caller's own verified email.
create or replace function public.accept_tree_invites()
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
  invite record;
begin
  caller_email := nullif(auth.jwt() ->> 'email', '');
  if caller_email is null then return; end if;

  for invite in
    select * from public.tree_invites
    where lower(email) = lower(caller_email) and accepted_at is null
  loop
    insert into public.tree_members (tree_id, user_id, role, email)
    values (invite.tree_id, auth.uid(), invite.role, caller_email)
    on conflict (tree_id, user_id) do update set role = excluded.role, email = excluded.email;

    update public.tree_invites set accepted_at = now() where id = invite.id;
    return next invite.tree_id;
  end loop;
end $$;

-- --------------------------------------------------------------- policies ---

alter table public.trees         enable row level security;
alter table public.tree_members  enable row level security;
alter table public.tree_invites  enable row level security;
alter table public.people        enable row level security;
alter table public.unions        enable row level security;

drop policy if exists trees_read   on public.trees;
drop policy if exists trees_insert on public.trees;
drop policy if exists trees_update on public.trees;
drop policy if exists trees_delete on public.trees;

create policy trees_read   on public.trees for select using (public.can_read_tree(id));
create policy trees_insert on public.trees for insert with check (owner_id = auth.uid());
create policy trees_update on public.trees for update using (public.can_write_tree(id));
create policy trees_delete on public.trees for delete using (owner_id = auth.uid());

drop policy if exists members_read   on public.tree_members;
drop policy if exists members_write  on public.tree_members;
drop policy if exists members_leave  on public.tree_members;

create policy members_read  on public.tree_members for select using (public.can_read_tree(tree_id));
create policy members_write on public.tree_members for all
  using (public.is_tree_owner(tree_id)) with check (public.is_tree_owner(tree_id));
-- Anybody may remove themselves.
create policy members_leave on public.tree_members for delete using (user_id = auth.uid());

drop policy if exists invites_read on public.tree_invites;
drop policy if exists invites_write on public.tree_invites;

-- You can see invitations to trees you administer, and your own by email.
create policy invites_read on public.tree_invites for select using (
  public.is_tree_owner(tree_id)
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
create policy invites_write on public.tree_invites for all
  using (public.is_tree_owner(tree_id)) with check (public.is_tree_owner(tree_id));

drop policy if exists people_read  on public.people;
drop policy if exists people_write on public.people;
create policy people_read  on public.people for select using (public.can_read_tree(tree_id));
create policy people_write on public.people for all
  using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));

drop policy if exists unions_read  on public.unions;
drop policy if exists unions_write on public.unions;
create policy unions_read  on public.unions for select using (public.can_read_tree(tree_id));
create policy unions_write on public.unions for all
  using (public.can_write_tree(tree_id)) with check (public.can_write_tree(tree_id));

-- --------------------------------------------------------------- storage ---

-- Private bucket: photographs of somebody's family are nobody else's business.
insert into storage.buckets (id, name, public)
values ('portraits', 'portraits', false)
on conflict (id) do nothing;

drop policy if exists portraits_read   on storage.objects;
drop policy if exists portraits_write  on storage.objects;
drop policy if exists portraits_delete on storage.objects;

-- Objects are stored as <tree_id>/<person_id>/<uuid>.<ext>, so the first path
-- segment is the tree whose membership decides access.
create policy portraits_read on storage.objects for select using (
  bucket_id = 'portraits' and public.can_read_tree(((storage.foldername(name))[1])::uuid)
);
create policy portraits_write on storage.objects for insert with check (
  bucket_id = 'portraits' and public.can_write_tree(((storage.foldername(name))[1])::uuid)
);
create policy portraits_delete on storage.objects for delete using (
  bucket_id = 'portraits' and public.can_write_tree(((storage.foldername(name))[1])::uuid)
);
