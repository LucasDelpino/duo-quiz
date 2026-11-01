-- ============================================================
-- Migration 005 — réglage commun « Questions coquines 🔥 » (à exécuter une fois, idempotente)
-- spicy : 0 = désactivées, 1 = de temps en temps (défaut), 2 = souvent.
-- ============================================================
alter table public.rooms add column if not exists spicy smallint not null default 1;
alter table public.rooms drop constraint if exists rooms_spicy_check;
alter table public.rooms add constraint rooms_spicy_check check (spicy between 0 and 2);
grant select (spicy) on public.rooms to anon, authenticated;
grant update (spicy) on public.rooms to anon, authenticated;
