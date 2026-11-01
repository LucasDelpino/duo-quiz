-- ============================================================
-- Migration 001 — à exécuter UNE fois dans Supabase → SQL Editor (après schema.sql)
-- 1) Anonymat : impossible de savoir si une question vient de la banque ou de l'autre.
-- 2) Rapports de compatibilité rédigés par l'IA (Routine hebdomadaire), visibles des 2 joueurs.
-- Idempotente : peut être relancée sans risque.
-- ============================================================

-- ---------- 1. Anonymat des questions ----------
-- Les colonnes source / author / bank_id ne sont plus lisibles par les joueurs.
revoke select on public.rounds from anon, authenticated;
grant select (id, room_id, play_date, text, kind, options, category, created_at)
  on public.rounds to anon, authenticated;

-- Une question perso n'est visible que par son auteur, même après tirage.
drop policy if exists cq_select on public.custom_questions;
create policy cq_select on public.custom_questions for select
  using (room_id = my_room() and author = my_player());

-- Liste des questions de la banque déjà tirées (pour choisir les candidates) — sans révéler lesquelles sont perso.
create or replace function public.used_bank_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select bank_id from public.rounds where room_id = my_room() and bank_id is not null
$$;

-- Tirage : au plus ~la moitié de questions perso par jour, mélangées avec la banque,
-- ordre renvoyé aléatoire (tri par id uuid). Retour sans les colonnes révélatrices.
drop function if exists public.ensure_rounds(date, jsonb);
create function public.ensure_rounds(p_date date, p_candidates jsonb)
returns table (id uuid, room_id uuid, play_date date, text text, kind text, options jsonb, category text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  rid        uuid := my_room();
  target     int;
  n          int;
  n_custom   int;
  max_custom int;
  cq         public.custom_questions%rowtype;
  cand       jsonb;
begin
  if rid is null then raise exception 'unauthorized'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 1 then
    raise exception 'invalid_date';
  end if;
  select r.questions_per_day into target from public.rooms r where r.id = rid for update;
  max_custom := greatest(1, target / 2);
  select count(*), count(*) filter (where r.source = 'custom') into n, n_custom
    from public.rounds r where r.room_id = rid and r.play_date = p_date;

  while n < target and n_custom < max_custom loop
    select * into cq from public.custom_questions c
     where c.room_id = rid and not c.used order by c.created_at limit 1;
    exit when not found;
    update public.custom_questions c set used = true where c.id = cq.id;
    insert into public.rounds (room_id, play_date, source, author, text, kind, options, category)
    values (rid, p_date, 'custom', cq.author, cq.text, cq.kind, cq.options, cq.category);
    n := n + 1; n_custom := n_custom + 1;
  end loop;

  for cand in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    exit when n >= target;
    if cand->>'kind' in ('choice','scale','text')
       and char_length(coalesce(cand->>'text','')) between 3 and 300
       and not exists (select 1 from public.rounds r where r.room_id = rid and r.bank_id = cand->>'id') then
      insert into public.rounds (room_id, play_date, source, bank_id, text, kind, options, category)
      values (rid, p_date, 'bank', cand->>'id', cand->>'text', cand->>'kind',
              case when cand->'options' = 'null'::jsonb then null else cand->'options' end,
              coalesce(cand->>'category', 'perso'));
      n := n + 1;
    end if;
  end loop;

  return query
    select r.id, r.room_id, r.play_date, r.text, r.kind, r.options, r.category, r.created_at
      from public.rounds r where r.room_id = rid and r.play_date = p_date order by r.id;
end $$;

revoke all on function public.ensure_rounds(date, jsonb), public.used_bank_ids() from public;
grant execute on function public.ensure_rounds(date, jsonb), public.used_bank_ids() to anon, authenticated;

-- ---------- 2. Rapports de compatibilité ----------
create table if not exists public.analyses (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rooms(id) on delete cascade,
  period_start  date not null,
  period_end    date not null,
  compatibility int  not null check (compatibility between 0 and 100),
  content       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (room_id, period_start, period_end)
);
alter table public.analyses enable row level security;
revoke all on public.analyses from anon, authenticated;
grant select on public.analyses to anon, authenticated;
drop policy if exists analyses_select on public.analyses;
create policy analyses_select on public.analyses for select using (room_id = my_room());

-- Clé de l'analyste (Routine Claude). Seul le hash est stocké ; la clé n'est que dans la Routine.
create table if not exists public.analyst_keys (key_hash text primary key);
alter table public.analyst_keys enable row level security;
revoke all on public.analyst_keys from anon, authenticated;
insert into public.analyst_keys (key_hash)
values ('5e7e5b1e5f8a2f7c6b1da2ab4c3437480f575f09f73134bbc2d0a248e2214ef0')
on conflict do nothing;

create or replace function public.analyst_ok(p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.analyst_keys where key_hash = hash_secret(p_key))
$$;

-- Export complet (rounds où les 2 ont répondu) de toutes les parties, pour la période.
create or replace function public.analyst_export(p_key text, p_from date, p_to date) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not analyst_ok(p_key) then raise exception 'unauthorized'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'room_id', ro.id, 'p1_name', ro.p1_name, 'p2_name', ro.p2_name,
      'previous_analyses', (select coalesce(json_agg(json_build_object('period_start', a.period_start, 'period_end', a.period_end,
                              'compatibility', a.compatibility, 'summary', a.content->>'summary') order by a.period_end), '[]')
                            from public.analyses a where a.room_id = ro.id and a.period_end < p_from),
      'rounds', (select coalesce(json_agg(json_build_object(
                    'date', r.play_date, 'question', r.text, 'kind', r.kind, 'options', r.options, 'category', r.category,
                    'answers', (select json_object_agg(an.player, json_build_object('self', an.self_answer, 'guess_other', an.guess_other))
                                from public.answers an where an.round_id = r.id),
                    'judgments', (select coalesce(json_object_agg(j.judge, j.correct), '{}'::json) from public.judgments j where j.round_id = r.id)
                  ) order by r.play_date), '[]')
                 from public.rounds r
                 where r.room_id = ro.id and r.play_date between p_from and p_to
                   and (select count(*) from public.answers an where an.round_id = r.id) = 2)
    )) from public.rooms ro where ro.p2_secret_hash is not null), '[]'::json);
end $$;

create or replace function public.analyst_save(p_key text, p_room uuid, p_from date, p_to date, p_compat int, p_content jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not analyst_ok(p_key) then raise exception 'unauthorized'; end if;
  insert into public.analyses (room_id, period_start, period_end, compatibility, content)
  values (p_room, p_from, p_to, p_compat, p_content)
  on conflict (room_id, period_start, period_end)
  do update set compatibility = excluded.compatibility, content = excluded.content, created_at = now();
end $$;

revoke all on function public.analyst_ok(text), public.analyst_export(text, date, date),
  public.analyst_save(text, uuid, date, date, int, jsonb) from public;
grant execute on function public.analyst_export(text, date, date),
  public.analyst_save(text, uuid, date, date, int, jsonb) to anon, authenticated;

-- ---------- 3. Reconnexion d'un appareil (ex. iPhone : l'app installée ne partage pas le stockage de Safari) ----------
-- L'appareil connecté génère un code (15 min, usage unique) ; le nouvel appareil le saisit et reçoit un NOUVEAU secret
-- (l'ancien appareil est déconnecté).
create table if not exists public.device_links (
  code       text primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player     smallint not null check (player in (1,2)),
  expires_at timestamptz not null
);
alter table public.device_links enable row level security;
revoke all on public.device_links from anon, authenticated;

create or replace function public.create_device_link() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare c text := upper(encode(gen_random_bytes(4), 'hex'));
begin
  if my_room() is null then raise exception 'unauthorized'; end if;
  delete from public.device_links where expires_at < now() or (room_id = my_room() and player = my_player());
  insert into public.device_links values (c, my_room(), my_player(), now() + interval '15 minutes');
  return c;
end $$;

create or replace function public.claim_device_link(p_code text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  s  text := encode(gen_random_bytes(24), 'hex');
  dl public.device_links%rowtype;
begin
  delete from public.device_links where code = upper(trim(p_code)) and expires_at > now() returning * into dl;
  if dl.code is null then raise exception 'invalid_link'; end if;
  if dl.player = 1 then update public.rooms set p1_secret_hash = hash_secret(s) where id = dl.room_id;
  else update public.rooms set p2_secret_hash = hash_secret(s) where id = dl.room_id; end if;
  return json_build_object('room_id', dl.room_id, 'secret', s, 'player', dl.player);
end $$;

revoke all on function public.create_device_link(), public.claim_device_link(text) from public;
grant execute on function public.create_device_link(), public.claim_device_link(text) to anon, authenticated;
