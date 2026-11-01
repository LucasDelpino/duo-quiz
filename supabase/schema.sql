-- ============================================================
-- DUO QUIZ — schéma Supabase (à exécuter UNE fois dans SQL Editor)
-- Accès : la clé anon publique + un en-tête secret par joueur
-- `x-player-secret` (généré par le serveur, jamais dans le code).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tables ----------
create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  p1_name            text not null check (char_length(p1_name) between 1 and 30),
  p2_name            text check (p2_name is null or char_length(p2_name) between 1 and 30),
  p1_secret_hash     text not null,
  p2_secret_hash     text,
  invite_code        text unique,
  questions_per_day  int  not null default 3 check (questions_per_day between 1 and 10),
  report_period_days int  not null default 7 check (report_period_days between 1 and 90),
  report_start       date not null default current_date,
  created_at         timestamptz not null default now()
);

create table if not exists public.custom_questions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  author     smallint not null check (author in (1,2)),
  text       text not null check (char_length(text) between 3 and 300),
  kind       text not null check (kind in ('choice','scale','text')),
  options    jsonb,
  category   text not null default 'perso',
  used       boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'choice' or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6))
);

create table if not exists public.rounds (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  play_date  date not null,
  source     text not null check (source in ('bank','custom')),
  bank_id    text,
  author     smallint check (author in (1,2)),
  text       text not null,
  kind       text not null check (kind in ('choice','scale','text')),
  options    jsonb,
  category   text not null default 'perso',
  created_at timestamptz not null default now(),
  unique (room_id, bank_id)
);
create index if not exists rounds_room_date on public.rounds(room_id, play_date);

create table if not exists public.answers (
  round_id    uuid not null references public.rounds(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  player      smallint not null check (player in (1,2)),
  self_answer text not null check (char_length(self_answer) between 1 and 500),
  guess_other text not null check (char_length(guess_other) between 1 and 500),
  created_at  timestamptz not null default now(),
  primary key (round_id, player)
);

-- Questions "texte libre" : le joueur concerné valide la prédiction de l'autre.
-- judge = joueur dont la réponse sert de référence ; il juge la prédiction de l'AUTRE.
create table if not exists public.judgments (
  round_id   uuid not null references public.rounds(id) on delete cascade,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  judge      smallint not null check (judge in (1,2)),
  correct    boolean not null,
  created_at timestamptz not null default now(),
  primary key (round_id, judge)
);

-- ---------- Identification du joueur ----------
create or replace function public.hash_secret(s text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(s,''), 'sha256'), 'hex')
$$;

create or replace function public.request_secret() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-player-secret', '')
$$;

create or replace function public.my_room() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.rooms
  where request_secret() <> ''
    and (p1_secret_hash = hash_secret(request_secret()) or p2_secret_hash = hash_secret(request_secret()))
  limit 1
$$;

create or replace function public.my_player() returns smallint
language sql stable security definer set search_path = public as $$
  select case when p1_secret_hash = hash_secret(request_secret()) then 1::smallint else 2::smallint end
  from public.rooms
  where request_secret() <> ''
    and (p1_secret_hash = hash_secret(request_secret()) or p2_secret_hash = hash_secret(request_secret()))
  limit 1
$$;

create or replace function public.i_answered(p_round uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.answers where round_id = p_round and player = my_player() and room_id = my_room())
$$;

create or replace function public.both_answered(p_round uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.answers where round_id = p_round) = 2
$$;

-- ---------- RPC ----------
create or replace function public.create_room(p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  s   text := encode(gen_random_bytes(24), 'hex');
  c   text := upper(encode(gen_random_bytes(4), 'hex'));
  rid uuid;
begin
  insert into public.rooms (p1_name, p1_secret_hash, invite_code)
  values (trim(p_name), hash_secret(s), c) returning id into rid;
  return json_build_object('room_id', rid, 'secret', s, 'player', 1, 'invite_code', c);
end $$;

create or replace function public.join_room(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  s   text := encode(gen_random_bytes(24), 'hex');
  rid uuid;
begin
  update public.rooms
     set p2_name = trim(p_name), p2_secret_hash = hash_secret(s), invite_code = null
   where invite_code = upper(trim(p_code)) and p2_secret_hash is null
  returning id into rid;
  if rid is null then raise exception 'invalid_invite'; end if;
  return json_build_object('room_id', rid, 'secret', s, 'player', 2, 'invite_code', null);
end $$;

-- Garantit le quota de questions du jour (atomique, sans doublon entre les 2 téléphones).
-- Priorité aux questions perso non utilisées, puis aux candidates de la banque fournies par le client.
-- p_candidates : [{id, text, kind, options, category}, ...] déjà mélangées côté client.
create or replace function public.ensure_rounds(p_date date, p_candidates jsonb) returns setof public.rounds
language plpgsql security definer set search_path = public as $$
declare
  rid    uuid := my_room();
  target int;
  n      int;
  cq     public.custom_questions%rowtype;
  cand   jsonb;
begin
  if rid is null then raise exception 'unauthorized'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 1 then
    raise exception 'invalid_date';
  end if;
  select questions_per_day into target from public.rooms where id = rid for update;
  select count(*) into n from public.rounds where room_id = rid and play_date = p_date;

  while n < target loop
    select * into cq from public.custom_questions
     where room_id = rid and not used order by created_at limit 1;
    exit when not found;
    update public.custom_questions set used = true where id = cq.id;
    insert into public.rounds (room_id, play_date, source, author, text, kind, options, category)
    values (rid, p_date, 'custom', cq.author, cq.text, cq.kind, cq.options, cq.category);
    n := n + 1;
  end loop;

  for cand in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    exit when n >= target;
    if cand->>'kind' in ('choice','scale','text')
       and char_length(coalesce(cand->>'text','')) between 3 and 300
       and not exists (select 1 from public.rounds where room_id = rid and bank_id = cand->>'id') then
      insert into public.rounds (room_id, play_date, source, bank_id, text, kind, options, category)
      values (rid, p_date, 'bank', cand->>'id', cand->>'text', cand->>'kind',
              case when cand->'options' = 'null'::jsonb then null else cand->'options' end,
              coalesce(cand->>'category', 'perso'));
      n := n + 1;
    end if;
  end loop;

  return query select * from public.rounds where room_id = rid and play_date = p_date order by created_at;
end $$;

-- ---------- Droits ----------
alter table public.rooms            enable row level security;
alter table public.custom_questions enable row level security;
alter table public.rounds           enable row level security;
alter table public.answers          enable row level security;
alter table public.judgments        enable row level security;

revoke all on public.rooms, public.custom_questions, public.rounds, public.answers, public.judgments from anon, authenticated;
grant select on public.rooms, public.custom_questions, public.rounds, public.answers, public.judgments to anon, authenticated;
grant update (p1_name, p2_name, questions_per_day, report_period_days, report_start) on public.rooms to anon, authenticated;
grant insert on public.custom_questions, public.answers, public.judgments to anon, authenticated;
grant update (correct) on public.judgments to anon, authenticated;

revoke all on function public.create_room(text), public.join_room(text, text), public.ensure_rounds(date, jsonb) from public;
grant execute on function public.create_room(text), public.join_room(text, text), public.ensure_rounds(date, jsonb) to anon, authenticated;

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select using (id = my_room());
drop policy if exists rooms_update on public.rooms;
create policy rooms_update on public.rooms for update using (id = my_room()) with check (id = my_room());

-- Les questions perso de l'autre restent une surprise tant qu'elles ne sont pas tirées.
drop policy if exists cq_select on public.custom_questions;
create policy cq_select on public.custom_questions for select
  using (room_id = my_room() and (author = my_player() or used));
drop policy if exists cq_insert on public.custom_questions;
create policy cq_insert on public.custom_questions for insert
  with check (room_id = my_room() and author = my_player() and used = false);

drop policy if exists rounds_select on public.rounds;
create policy rounds_select on public.rounds for select using (room_id = my_room());

-- Anti-triche : on ne voit la réponse de l'autre qu'après avoir répondu soi-même.
drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers for select
  using (room_id = my_room() and (player = my_player() or i_answered(round_id)));
drop policy if exists answers_insert on public.answers;
create policy answers_insert on public.answers for insert
  with check (room_id = my_room() and player = my_player()
              and exists (select 1 from public.rounds r where r.id = round_id and r.room_id = my_room()));

drop policy if exists judgments_select on public.judgments;
create policy judgments_select on public.judgments for select using (room_id = my_room());
drop policy if exists judgments_insert on public.judgments;
create policy judgments_insert on public.judgments for insert
  with check (room_id = my_room() and judge = my_player() and both_answered(round_id)
              and exists (select 1 from public.rounds r where r.id = round_id and r.room_id = my_room() and r.kind = 'text'));
drop policy if exists judgments_update on public.judgments;
create policy judgments_update on public.judgments for update
  using (room_id = my_room() and judge = my_player()) with check (room_id = my_room() and judge = my_player());
