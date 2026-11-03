-- ============================================================
-- Migration 006 — notifications push (à exécuter une fois, idempotente)
-- Chaque téléphone enregistre son abonnement push ; l'Edge Function « notify-partner »
-- prévient l'autre joueur toutes les N réponses (3 par défaut).
-- ============================================================

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  room_id    uuid not null references public.rooms(id) on delete cascade,
  player     smallint not null check (player in (1,2)),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_room on public.push_subscriptions(room_id, player);

-- Nombre de réponses déjà « notifiées » par joueur (pour ne prévenir qu'une fois toutes les N réponses).
create table if not exists public.push_state (
  room_id           uuid not null references public.rooms(id) on delete cascade,
  player            smallint not null check (player in (1,2)),
  notified_at_count int not null default 0,
  primary key (room_id, player)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_state enable row level security;
revoke all on public.push_subscriptions, public.push_state from anon, authenticated;
grant all on public.push_subscriptions, public.push_state to service_role;

-- Le téléphone enregistre (ou met à jour) son abonnement.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_room() is null then raise exception 'unauthorized'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 40 and 200
     or char_length(coalesce(p_auth, '')) not between 10 and 100 then
    raise exception 'invalid_subscription';
  end if;
  insert into public.push_subscriptions (endpoint, room_id, player, p256dh, auth)
  values (p_endpoint, my_room(), my_player(), p_p256dh, p_auth)
  on conflict (endpoint) do update
    set room_id = excluded.room_id, player = excluded.player, p256dh = excluded.p256dh, auth = excluded.auth;
  -- Premier abonnement : on part du nombre de réponses actuel (pas de rafale de notifications).
  insert into public.push_state (room_id, player, notified_at_count)
  select my_room(), p, (select count(*) from public.answers a where a.room_id = my_room() and a.player = p)
  from (values (1::smallint), (2::smallint)) v(p)
  on conflict do nothing;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and room_id = my_room()
$$;

-- Réservée à l'Edge Function (clé service) : faut-il prévenir le partenaire du joueur `p_secret` ?
-- Renvoie { notify, count, from_name, to_player, subscriptions[] } et marque les réponses comme notifiées.
create or replace function public.push_claim(p_secret text, p_every int default 3) returns json
language plpgsql security definer set search_path = public as $$
declare
  ro     public.rooms%rowtype;
  me     smallint;
  n      int;
  last   int;
  every_ int := least(50, greatest(1, coalesce(p_every, 3)));
begin
  select * into ro from public.rooms r
   where coalesce(p_secret, '') <> ''
     and (r.p1_secret_hash = hash_secret(p_secret) or r.p2_secret_hash = hash_secret(p_secret))
   limit 1;
  if ro.id is null then return json_build_object('notify', false, 'reason', 'unauthorized'); end if;
  me := case when ro.p1_secret_hash = hash_secret(p_secret) then 1 else 2 end;

  select count(*) into n from public.answers a where a.room_id = ro.id and a.player = me;
  insert into public.push_state (room_id, player, notified_at_count) values (ro.id, me, 0) on conflict do nothing;
  select s.notified_at_count into last from public.push_state s where s.room_id = ro.id and s.player = me for update;
  if n - last < every_ then
    return json_build_object('notify', false, 'reason', 'threshold', 'pending', n - last);
  end if;
  update public.push_state s set notified_at_count = n where s.room_id = ro.id and s.player = me;

  return json_build_object(
    'notify', true,
    'count', n - last,
    'from_name', case when me = 1 then ro.p1_name else coalesce(ro.p2_name, 'Ton/ta partenaire') end,
    'to_player', 3 - me,
    'subscriptions', coalesce((
      select json_agg(json_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s where s.room_id = ro.id and s.player = 3 - me), '[]'::json));
end $$;

revoke all on function public.save_push_subscription(text, text, text), public.delete_push_subscription(text),
  public.push_claim(text, int) from public;
grant execute on function public.save_push_subscription(text, text, text), public.delete_push_subscription(text)
  to anon, authenticated;
grant execute on function public.push_claim(text, int) to service_role;
