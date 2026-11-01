-- ============================================================
-- Migration 004 — rythme commun (à exécuter une fois, idempotente)
-- Écart de réponses entre les deux joueurs (toutes questions confondues) :
--   • plus de 10 réponses de retard → l'app prévient le joueur en retard (pop-up) ;
--   • 15 réponses d'avance → le joueur en avance est bloqué (ni réponse, ni nouveau tirage)
--     jusqu'à ce que l'autre le rattrape. Garanti côté serveur.
-- ============================================================

-- Compteurs pour l'app : { me, them, warn_after, block_at }.
create or replace function public.pace() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'me',   (select count(*) from public.answers a where a.room_id = my_room() and a.player = my_player()),
    'them', (select count(*) from public.answers a where a.room_id = my_room() and a.player <> my_player()),
    'warn_after', 10,
    'block_at', 15)
  where my_room() is not null
$$;
revoke all on function public.pace() from public;
grant execute on function public.pace() to anon, authenticated;

-- Avance actuelle d'un joueur (réponses à lui − réponses de l'autre).
create or replace function public.lead_of(p_room uuid, p_player smallint) returns int
language sql stable security definer set search_path = public as $$
  select (count(*) filter (where a.player = p_player) - count(*) filter (where a.player <> p_player))::int
  from public.answers a where a.room_id = p_room
$$;
revoke all on function public.lead_of(uuid, smallint) from public, anon, authenticated;

-- Blocage à l'insertion d'une réponse.
create or replace function public.check_pace() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.rooms r where r.id = new.room_id for update; -- sérialise les réponses d'une partie
  if lead_of(new.room_id, new.player) >= 15 then
    raise exception 'too_far_ahead';
  end if;
  return new;
end $$;
drop trigger if exists answers_pace on public.answers;
create trigger answers_pace before insert on public.answers
  for each row execute function public.check_pace();

-- draw_more : également refusé au joueur bloqué.
create or replace function public.draw_more(p_date date, p_candidates jsonb, p_count int default 3)
returns table (id uuid, room_id uuid, play_date date, text text, kind text, options jsonb, category text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  rid      uuid := my_room();
  me       smallint := my_player();
  qpd      int;
  n        int;
  n_custom int;
  cnt      int := least(10, greatest(1, coalesce(p_count, 3)));
begin
  if rid is null then raise exception 'unauthorized'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 1 then
    raise exception 'invalid_date';
  end if;
  select r.questions_per_day into qpd from public.rooms r where r.id = rid for update;
  if qpd <> 0 then raise exception 'not_unlimited'; end if;
  if lead_of(rid, me) >= 15 then raise exception 'too_far_ahead'; end if;
  if exists (select 1 from public.rounds r where r.room_id = rid and r.play_date = p_date
               and not exists (select 1 from public.answers a where a.round_id = r.id and a.player = me)) then
    raise exception 'finish_first';
  end if;
  select count(*), count(*) filter (where r.source = 'custom') into n, n_custom
    from public.rounds r where r.room_id = rid and r.play_date = p_date;
  perform fill_rounds(rid, p_date, n + cnt, n_custom + greatest(1, cnt / 2), p_candidates);
  return query
    select r.id, r.room_id, r.play_date, r.text, r.kind, r.options, r.category, r.created_at
      from public.rounds r where r.room_id = rid and r.play_date = p_date order by r.id;
end $$;
revoke all on function public.draw_more(date, jsonb, int) from public;
grant execute on function public.draw_more(date, jsonb, int) to anon, authenticated;
