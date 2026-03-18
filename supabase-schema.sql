create table if not exists public.mm_entries (
  id bigint generated always as identity primary key,
  name text not null,
  team_one text not null,
  team_two text not null,
  created_at timestamptz not null default now()
);

alter table public.mm_entries enable row level security;

create policy "Allow public read" on public.mm_entries
for select using (true);

create policy "Allow public insert" on public.mm_entries
for insert with check (true);
