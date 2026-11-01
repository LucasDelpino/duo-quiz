import { describe, it, expect } from 'vitest';
import { splitRounds, RECENT_MAX } from '../../js/logic/home.js';

const T = '2026-11-01';
const Y = '2026-10-31';
const r = (id, d = T, kind = 'choice') => ({ id, play_date: d, kind, text: id, options: null, category: 'gouts' });
const ans = (id, p, at) => ({ round_id: id, player: p, self_answer: 'A', guess_other: 'A', created_at: at });

describe('accueil : à jouer en haut, 5 dernières réponses', () => {
  it('ordre et historique tournant', () => {
    const rounds = [r('a'), r('b'), r('c'), r('d', Y), r('e', Y), r('f'), r('g'), r('h'), r('i'), r('t', T, 'text')];
    const answers = [
      ans('b', 1, '2026-11-01T08:00:00Z'), ans('c', 1, '2026-11-01T09:00:00Z'), ans('e', 1, '2026-10-31T09:00:00Z'),
      ans('f', 1, '2026-11-01T10:00:00Z'), ans('g', 1, '2026-11-01T11:00:00Z'), ans('h', 1, '2026-11-01T12:00:00Z'), ans('i', 1, '2026-11-01T13:00:00Z'),
      ans('t', 1, '2026-11-01T14:00:00Z'), ans('t', 2, '2026-11-01T14:30:00Z'),
    ];
    const { pending, recent } = splitRounds(rounds, answers, [], 1, T);
    // à jouer : aujourd'hui (a), validation à faire (t), puis retards (d)
    expect(pending.map((x) => x.id)).toEqual(['a', 't', 'd']);
    // 5 plus récentes, la dernière répondue en premier ; b (la plus ancienne) sort de l'historique
    expect(recent.map((x) => x.id)).toEqual(['i', 'h', 'g', 'f', 'c']);
    expect(RECENT_MAX).toBe(5);
  });
});
