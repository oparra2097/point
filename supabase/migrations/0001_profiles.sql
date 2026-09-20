-- point: profiles and row-level security
--
-- Run this once against a new Supabase project (SQL Editor -> New query ->
-- paste -> Run), or via `supabase db push` if you use the CLI.
--
-- Supabase owns the auth.users table; we never write to it directly. This adds
-- a public.profiles row per user for the app-visible fields, kept in sync by a
-- trigger so a profile always exists the moment a user is created.

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security is the whole security model here. The client holds a
-- publishable anon key, so without RLS every user could read every row.
-- Enabled first, then narrowed to "your own row only".
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  using ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Insert is normally handled by the trigger below, but this keeps a client-side
-- upsert from failing if the trigger has not fired yet.
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

-- Create the profile row as soon as the auth user exists.
--
-- security definer is required: the trigger runs before any session exists, so
-- it cannot pass its own RLS policies. `set search_path = ''` is not optional
-- with security definer -- without it a caller can shadow the referenced
-- objects and run their own code with the definer's privileges, so every
-- identifier below is schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email aligned when a user confirms an email change, which
-- Supabase applies to auth.users only.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email, updated_at = now()
     where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Touch updated_at on every profile write.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
