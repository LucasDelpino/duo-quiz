// Fabrique de données de jeu pour les tests.
export function game() {
  const rounds = [];
  const answers = [];
  const judgments = [];
  let n = 0;
  const api = {
    rounds, answers, judgments,
    /** round(kind, date, {category, facet, a1:[self, guess], a2:[self, guess], j1, j2}) */
    round(kind, play_date, { category = 'gouts', facet, a1, a2, j1, j2, options } = {}) {
      const id = `r${String(++n).padStart(3, '0')}`;
      rounds.push({ id, room_id: 'room', play_date, text: `Question ${n} ?`, kind, options: options ?? null, category, ...(facet ? { facet } : {}) });
      if (a1) answers.push({ round_id: id, player: 1, self_answer: String(a1[0]), guess_other: String(a1[1]) });
      if (a2) answers.push({ round_id: id, player: 2, self_answer: String(a2[0]), guess_other: String(a2[1]) });
      if (j1 !== undefined) judgments.push({ round_id: id, judge: 1, correct: j1 });
      if (j2 !== undefined) judgments.push({ round_id: id, judge: 2, correct: j2 });
      return api;
    },
  };
  return api;
}
