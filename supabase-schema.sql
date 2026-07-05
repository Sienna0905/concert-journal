create table if not exists public.concert_shows (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.concert_shows enable row level security;

drop policy if exists "Users can read own shows" on public.concert_shows;
create policy "Users can read own shows"
on public.concert_shows
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own shows" on public.concert_shows;
create policy "Users can insert own shows"
on public.concert_shows
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own shows" on public.concert_shows;
create policy "Users can update own shows"
on public.concert_shows
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own shows" on public.concert_shows;
create policy "Users can delete own shows"
on public.concert_shows
for delete
using (auth.uid() = user_id);
