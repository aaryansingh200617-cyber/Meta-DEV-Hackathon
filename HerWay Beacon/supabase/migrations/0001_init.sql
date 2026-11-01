-- Saheli Journey — PostgreSQL schema for Supabase.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Notes
--  * All ids are text (the app mints uuid-based ids; profiles.id is the Supabase auth user id).
--  * Timestamps are stored as ISO-8601 text on purpose: the app compares/sorts them as strings and
--    round-trips them exactly. Switch to timestamptz if you prefer, and adjust the driver accordingly.
--  * The Next.js server talks to Postgres with the SERVICE ROLE key and enforces authorization in the
--    API layer. RLS below is defence-in-depth: it blocks any direct anon/authenticated access except
--    "read my own rows", and nothing is writable from the client.

create table if not exists profiles (
  id text primary key,
  email text unique not null,
  name text not null,
  password_hash text,
  role text not null default 'traveller',
  demo boolean not null default false,
  created_at text not null,
  consent_version text not null,
  consent_at text not null,
  settings jsonb not null
);

create table if not exists contacts (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  name text not null,
  relationship text not null default '',
  phone_enc text,              -- AES-256-GCM, encrypted by the app
  email_enc text,
  tier int not null check (tier between 1 and 3),
  status text not null check (status in ('pending','accepted','declined','revoked')),
  token_version int not null default 1,
  token_expires_at text not null,
  consented_at text,
  seeded boolean not null default false,
  created_at text not null
);
create index if not exists contacts_user_idx on contacts(user_id);

create table if not exists push_subscriptions (
  id text primary key,
  contact_id text not null references contacts(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at text not null
);
create index if not exists push_contact_idx on push_subscriptions(contact_id);

create table if not exists journeys (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  status text not null check (status in ('active','completed','cancelled','expired')),
  mode text not null,
  origin jsonb not null,
  destination jsonb not null,
  route jsonb not null,
  started_at text not null,
  expected_arrival_at text not null,
  grace_minutes int not null,
  ended_at text,
  end_reason text,
  overdue_at text,
  checkin_interval_s int not null,
  checkin_window_s int not null,
  next_checkin_due_at text,
  missed_streak int not null default 0,
  max_missed int not null,
  auto_alert_on_missed boolean not null,
  auto_alert_on_overdue boolean not null,
  escalation_share_location boolean not null,
  deviation_enabled boolean not null,
  deviation_threshold_m int not null,
  deviation_response_s int not null,
  auto_alert_on_deviation boolean not null,
  deviation_state text not null,
  deviation_since text,
  deviation_prompt_expires_at text,
  deviation_snooze_until text,
  escalate_after_s int not null,
  last_location jsonb,
  arrival_suggested boolean not null default false,
  simulated boolean not null default false,
  shared jsonb not null default '[]',
  summary jsonb,
  purge_after text,
  trail_purged_at text
);
create index if not exists journeys_user_idx on journeys(user_id, started_at desc);
create index if not exists journeys_active_idx on journeys(status) where status = 'active';

create table if not exists locations (
  id text primary key,
  journey_id text not null references journeys(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision,
  at text not null,
  simulated boolean not null default false
);
create index if not exists locations_journey_idx on locations(journey_id, at);

create table if not exists checkins (
  id text primary key,
  journey_id text not null references journeys(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  due_at text not null,
  window_ends_at text not null,
  status text not null check (status in ('pending','confirmed','missed')),
  responded_at text
);
create index if not exists checkins_journey_idx on checkins(journey_id, status);

-- Access grants: who may see status / live location for a journey. Revoked when it ends, or expires.
create table if not exists grants (
  id text primary key,
  journey_id text not null references journeys(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  scope text not null check (scope in ('status','location')),
  created_at text not null,
  expires_at text not null,
  revoked_at text,
  revoked_reason text
);
create index if not exists grants_contact_idx on grants(contact_id);
create index if not exists grants_journey_idx on grants(journey_id);

create table if not exists events (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  journey_id text references journeys(id) on delete cascade,
  at text not null,
  type text not null,
  actor text not null,
  message text not null,
  data jsonb
);
create index if not exists events_journey_idx on events(journey_id, at);

create table if not exists relays (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  journey_id text references journeys(id) on delete cascade,
  kind text not null,
  message text not null default '',
  status text not null check (status in ('open','acknowledged','resolved','unanswered','cancelled')),
  groups jsonb not null,
  step int not null default 0,
  escalate_after_s int not null,
  last_step_at text not null,
  created_at text not null,
  resolved_at text,
  include_location boolean not null default false
);
create index if not exists relays_status_idx on relays(status);

create table if not exists relay_notifications (
  id text primary key,
  relay_id text not null references relays(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  step int not null,
  channel text not null check (channel in ('in_app','web_push','sms_sim')),
  status text not null check (status in ('queued','sent','delivered','acknowledged','failed','simulated','skipped')),
  detail text,
  sent_at text,
  delivered_at text,
  acknowledged_at text
);
create index if not exists relay_notif_relay_idx on relay_notifications(relay_id);
create index if not exists relay_notif_contact_idx on relay_notifications(contact_id);

create table if not exists relay_actions (
  id text primary key,
  relay_id text not null references relays(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  contact_id text not null references contacts(id) on delete cascade,
  action text not null,
  note text,
  at text not null
);

create table if not exists observations (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  kind text not null,
  value text not null,
  lat double precision not null,
  lng double precision not null,
  observed_at text not null,
  source text not null,
  note text
);
create index if not exists observations_geo_idx on observations(lat, lng);

create table if not exists consent_log (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  kind text not null,
  detail text not null,
  at text not null
);

-- ── Row level security ────────────────────────────────────────────────────────
alter table profiles            enable row level security;
alter table contacts            enable row level security;
alter table push_subscriptions  enable row level security;
alter table journeys            enable row level security;
alter table locations           enable row level security;
alter table checkins            enable row level security;
alter table grants              enable row level security;
alter table events              enable row level security;
alter table relays              enable row level security;
alter table relay_notifications enable row level security;
alter table relay_actions       enable row level security;
alter table observations        enable row level security;
alter table consent_log         enable row level security;

-- A signed-in traveller may READ only their own rows. No client-side writes at all.
create policy "own profile"      on profiles            for select using (auth.uid()::text = id);
create policy "own contacts"     on contacts            for select using (auth.uid()::text = user_id);
create policy "own journeys"     on journeys            for select using (auth.uid()::text = user_id);
create policy "own locations"    on locations           for select using (auth.uid()::text = user_id);
create policy "own checkins"     on checkins            for select using (auth.uid()::text = user_id);
create policy "own grants"       on grants              for select using (auth.uid()::text = user_id);
create policy "own events"       on events              for select using (auth.uid()::text = user_id);
create policy "own relays"       on relays              for select using (auth.uid()::text = user_id);
create policy "own relay notifs" on relay_notifications for select using (auth.uid()::text = user_id);
create policy "own relay actions" on relay_actions      for select using (auth.uid()::text = user_id);
create policy "own consent log"  on consent_log         for select using (auth.uid()::text = user_id);
-- push_subscriptions and observations: no client policies → service role only.

-- ── Optional: run the backend engine from the database (serverless deployments) ──
-- select cron.schedule('saheli-tick', '* * * * *',
--   $$ select net.http_get('https://YOUR-APP/api/cron/tick', headers => jsonb_build_object('Authorization','Bearer YOUR_CRON_SECRET')) $$);
