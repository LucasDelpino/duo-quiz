-- ============================================================
-- Migration 003 — questions par jour « Illimité » (à exécuter une fois, idempotente)
-- questions_per_day = 0 signifie « illimité » : 3 questions de base par jour, puis le joueur
-- qui a tout répondu peut en tirer d'autres (RPC draw_more), sans limite.
-- L'anonymat est conservé : au plus ~la moitié de questions perso par lot, ordre aléatoire.
-- ============================================================

alter table public.rooms drop constraint if exists rooms_questions_per_day_check;
alter table public.rooms add constraint rooms_questions_per_day_check check (questions_per_day between 0 and 10);

-- Remplit les questions du jour jusqu'à p_want au total, avec au plus p_max_custom questions perso au total.
create or replace function public.fill_rounds(p_room uuid, p_date date, p_want int, p_max_custom int, p_candidates jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  n        int;
  n_custom int;
  cq       public.custom_questions%rowtype;
  cand     jsonb;
begin
  select count(*), count(*) filter (where r.source = 'custom') into n, n_custom
    from public.rounds r where r.room_id = p_room and r.play_date = p_date;

  while n < p_want and n_custom < p_max_custom loop
    select * into cq from public.custom_questions c
     where c.room_id = p_room and not c.used order by c.created_at limit 1;
    exit when not found;
    update public.custom_questions c set used = true where c.id = cq.id;
    insert into public.rounds (room_id, play_date, source, author, text, kind, options, category)
    values (p_room, p_date, 'custom', cq.author, cq.text, cq.kind, cq.options, cq.category);
    n := n + 1; n_custom := n_custom + 1;
  end loop;

  for cand in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    exit when n >= p_want;
    if cand->>'kind' in ('choice','scale','text')
       and char_length(coalesce(cand->>'text','')) between 3 and 300
       and not exists (select 1 from public.rounds r where r.room_id = p_room and r.bank_id = cand->>'id') then
      insert into public.rounds (room_id, play_date, source, bank_id, text, kind, options, category)
      values (p_room, p_date, 'bank', cand->>'id', cand->>'text', cand->>'kind',
              case when cand->'options' = 'null'::jsonb then null else cand->'options' end,
              coalesce(cand->>'category', 'perso'));
      n := n + 1;
    end if;
  end loop;
end $$;
revoke all on function public.fill_rounds(uuid, date, int, int, jsonb) from public, anon, authenticated;

create or replace function public.ensure_rounds(p_date date, p_candidates jsonb)
returns table (id uuid, room_id uuid, play_date date, text text, kind text, options jsonb, category text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  rid    uuid := my_room();
  target int;
begin
  if rid is null then raise exception 'unauthorized'; end if;
  if p_date is null or p_date > current_date + 1 or p_date < current_date - 1 then
    raise exception 'invalid_date';
  end if;
  select case when r.questions_per_day = 0 then 3 else r.questions_per_day end
    into target from public.rooms r where r.id = rid for update;
  perform fill_rounds(rid, p_date, target, greatest(1, target / 2), p_candidates);
  return query
    select r.id, r.room_id, r.play_date, r.text, r.kind, r.options, r.category, r.created_at
      from public.rounds r where r.room_id = rid and r.play_date = p_date order by r.id;
end $$;

-- Mode illimité : tirer p_count questions de plus (1 à 10), seulement si j'ai répondu à toutes celles du jour.
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

revoke all on function public.ensure_rounds(date, jsonb), public.draw_more(date, jsonb, int) from public;
grant execute on function public.ensure_rounds(date, jsonb), public.draw_more(date, jsonb, int) to anon, authenticated;
