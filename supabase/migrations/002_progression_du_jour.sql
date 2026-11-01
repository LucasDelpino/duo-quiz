-- ============================================================
-- Migration 002 — indicateur « qui a joué aujourd'hui » (à exécuter une fois, idempotente)
-- Renvoie seulement des COMPTEURS (jamais le contenu des réponses) : l'anti-triche est préservé.
-- ============================================================
create or replace function public.day_progress(p_date date)
returns table (player smallint, answered int, total int, last_answer_at timestamptz)
language sql stable security definer set search_path = public as $$
  with r as (
    select id from public.rounds where room_id = my_room() and play_date = p_date
  ), p as (select unnest(array[1,2])::smallint as player)
  select p.player,
         (select count(*)::int from public.answers a where a.round_id in (select id from r) and a.player = p.player),
         (select count(*)::int from r),
         (select max(a.created_at) from public.answers a where a.room_id = my_room() and a.player = p.player)
  from p
  where my_room() is not null
$$;

revoke all on function public.day_progress(date) from public;
grant execute on function public.day_progress(date) to anon, authenticated;
