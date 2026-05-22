-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables to recreate (order matters because of foreign keys)
drop table if exists public.chat_messages cascade;
drop table if exists public.swap_proposals cascade;
drop table if exists public.swap_requests cascade;
drop table if exists public.flight_duties cascade;
drop table if exists public.profiles cascade;

-- 1. PROFILES TABLE
create table public.profiles (
    id text primary key,
    email text unique not null,
    name text not null,
    username text,
    rank text not null check (rank in ('captain', 'first_officer')),
    base text not null default 'BEY',
    qualifications text[] not null default '{}'::text[]
);

-- Enable RLS
alter table public.profiles enable row level security;
create policy "Allow public read access to profiles" on public.profiles for select using (true);
create policy "Allow all write access to profiles" on public.profiles for all using (true) with check (true);

-- 2. FLIGHT DUTIES TABLE
create table public.flight_duties (
    id text primary key,
    pilot_id text references public.profiles(id) on delete cascade,
    duty_type text not null check (duty_type in ('flight', 'standby', 'simulator', 'off', 'training')),
    flight_number text,
    origin text,
    destination text,
    departure_time timestamptz,
    arrival_time timestamptz,
    reporting_time timestamptz,
    release_time timestamptz,
    block_time_mins integer,
    aircraft_type text,
    day_number integer not null
);

alter table public.flight_duties enable row level security;
create policy "Allow public read access to flight_duties" on public.flight_duties for select using (true);
create policy "Allow all write access to flight_duties" on public.flight_duties for all using (true) with check (true);

-- 3. SWAP REQUESTS TABLE
create table public.swap_requests (
    id text primary key,
    pilot_id text references public.profiles(id) on delete cascade,
    flight_id text references public.flight_duties(id) on delete cascade,
    preferred_destination text not null,
    preferred_date_range_start text not null,
    preferred_date_range_end text not null,
    notes text,
    status text not null check (status in ('open', 'matched', 'cancelled')),
    created_at timestamptz default now()
);

alter table public.swap_requests enable row level security;
create policy "Allow public read access to swap_requests" on public.swap_requests for select using (true);
create policy "Allow all write access to swap_requests" on public.swap_requests for all using (true) with check (true);

-- 4. SWAP PROPOSALS TABLE
create table public.swap_proposals (
    id text primary key,
    request_id text references public.swap_requests(id) on delete cascade,
    proposer_id text references public.profiles(id) on delete cascade,
    proposed_flight_id text references public.flight_duties(id) on delete cascade,
    status text not null check (status in ('pending', 'accepted', 'rejected')),
    legality_check_passed boolean not null default true,
    legality_notes text,
    created_at timestamptz default now()
);

alter table public.swap_proposals enable row level security;
create policy "Allow public read access to swap_proposals" on public.swap_proposals for select using (true);
create policy "Allow all write access to swap_proposals" on public.swap_proposals for all using (true) with check (true);

-- 5. CHAT MESSAGES TABLE
create table public.chat_messages (
    id text primary key,
    room_id text not null,
    sender_id text references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;
create policy "Allow public read access to chat_messages" on public.chat_messages for select using (true);
create policy "Allow all write access to chat_messages" on public.chat_messages for all using (true) with check (true);
