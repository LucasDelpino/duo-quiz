// Lecture défensive d'un rapport IA (table analyses) : rien d'inattendu ne doit casser l'affichage.

const MAX_TEXT = 1200;
const MAX_ITEMS = 12;

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, MAX_TEXT) : null);
const list = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, MAX_ITEMS) : str(v) ? [str(v)] : []);
const pct = (v) => {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Portrait de personnalité rédigé par l'IA (bilan psychologique et comportemental, ludique). */
function personality(v) {
  const o = obj(v);
  const out = {
    resume: str(o.resume),
    traits: list(o.traits),
    comportement: str(o.comportement),
    emotions: str(o.emotions),
    en_couple: str(o.en_couple),
    besoins: list(o.besoins),
    points_forts: list(o.points_forts),
    vigilance: list(o.vigilance),
    conseil: str(o.conseil),
  };
  const filled = Object.values(out).some((x) => (Array.isArray(x) ? x.length : x));
  return filled ? out : null;
}

function player(p) {
  const o = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  return {
    portrait: personality(o.portrait),
    aime: list(o.aime),
    naime_pas: list(o.naime_pas),
    ressenti: str(o.ressenti),
    a_savoir: list(o.a_savoir),
    surprises: list(o.surprises),
  };
}

/** Normalise une ligne `analyses` (avec `content` JSON éventuellement incomplet ou mal formé). */
export function sanitizeAnalysis(row) {
  const r = row && typeof row === 'object' ? row : {};
  let c = r.content;
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch { c = {}; }
  }
  if (!c || typeof c !== 'object' || Array.isArray(c)) c = {};
  const players = c.players && typeof c.players === 'object' ? c.players : {};
  return {
    id: r.id ?? null,
    period_start: typeof r.period_start === 'string' ? r.period_start : null,
    period_end: typeof r.period_end === 'string' ? r.period_end : null,
    compatibility: pct(r.compatibility) ?? pct(c.compatibility),
    summary: str(c.summary),
    compatibility_explained: str(c.compatibility_explained),
    players: { 1: player(players[1] ?? players['1']), 2: player(players[2] ?? players['2']) },
    points_communs: list(c.points_communs),
    differences: list(c.differences),
    a_faire_ensemble: list(c.a_faire_ensemble),
    questions_a_se_poser: list(c.questions_a_se_poser),
    evolution: str(c.evolution),
  };
}

/** Rapports valides triés par fin de période (pour la courbe). */
export function analysesTimeline(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(sanitizeAnalysis)
    .filter((a) => a.period_end && a.compatibility !== null)
    .sort((a, b) => (a.period_end < b.period_end ? -1 : a.period_end > b.period_end ? 1 : 0));
}
