// « Love report » : jauge (rapport IA le plus récent, sinon score direct), portraits, sections IA, courbe.
import { h } from '../ui/dom.js';
import { card } from '../ui/card.js';
import { gauge } from '../ui/gauge.js';
import { messageFor } from '../api/errors.js';
import { getApi } from '../context.js';
import { loadGame, players, textFor } from '../game.js';
import { compatibility, labelFor } from '../logic/compat.js';
import { analysesTimeline } from '../logic/analysis.js';
import { FACET_LABELS } from '../logic/custom.js';
import { formatShort, todayParis } from '../logic/dates.js';

const bar = (label, value, testid) => h('div', { class: 'bar-row', 'data-testid': testid },
  h('div', { class: 'row bar-head' }, h('span', {}, label), h('strong', {}, value === null ? '—' : `${value} %`)),
  h('div', { class: 'bar', style: `--v:${value ?? 0}%`, role: 'img', 'aria-label': `${label} : ${value ?? 0} %` }, h('i')));

const items = (arr) => (arr.length ? h('ul', { class: 'love-list' }, arr.map((x) => h('li', {}, x))) : null);

function section(title, content, testid) {
  const body = [content].flat().filter(Boolean);
  return body.length ? card([h('h2', {}, title), ...body], { 'data-testid': testid }) : null;
}

function liveCard(c) {
  if (!c.unlocked) {
    return card([
      h('h2', {}, 'Score en direct'),
      h('p', { 'data-testid': 'locked' }, `Encore ${c.remaining} question${c.remaining > 1 ? 's' : ''} à jouer ensemble pour débloquer votre score 🔒`),
    ], { 'data-testid': 'live' });
  }
  const facets = Object.entries(c.facets).map(([f, v]) => bar(`Ça parle de ${FACET_LABELS[f]}`, v.score, `facet-${f}`));
  return card([
    h('h2', {}, `Score en direct : ${c.score} %`),
    h('p', { class: 'muted' }, `${c.label} · sur ${c.complete} questions jouées à deux`),
    bar('Accords', c.accords, 'accords'),
    bar('Connaissance mutuelle', c.knowledge, 'knowledge'),
    bar('Équilibre', c.balance, 'balance'),
    facets.length ? h('h3', {}, 'Par thème') : null,
    ...facets,
  ], { 'data-testid': 'live' });
}

/** Portrait psychologique et comportemental de l'autre joueur (rapport IA le plus récent qui en contient un). */
function personalityCard(timeline, p, names) {
  const n = names[p];
  const latest = [...timeline].reverse().find((a) => a.players?.[p]?.portrait);
  const pr = latest?.players[p].portrait;
  if (!pr) {
    return card([
      h('h2', {}, `Portrait de ${n} 🔮`),
      h('p', { class: 'muted', 'data-testid': 'portrait-pending' }, `Le portrait psychologique de ${n} sera dressé par l’IA dans le prochain Love report (chaque soir vers 19 h 30), à partir de ses réponses et de la façon dont vous vous devinez.`),
    ], { 'data-testid': `portrait-${p}` });
  }
  const para = (title, text) => (text ? h('div', { class: 'portrait-block' }, h('h3', {}, title), h('p', {}, text)) : null);
  const lst = (title, arr) => (arr.length ? h('div', { class: 'portrait-block' }, h('h3', {}, title), items(arr)) : null);
  return card([
    h('h2', {}, `Portrait de ${n} 🔮`),
    pr.resume ? h('p', { class: 'portrait-resume', 'data-testid': 'portrait-resume' }, pr.resume) : null,
    pr.traits.length ? h('div', { class: 'row portrait-traits' }, pr.traits.map((t) => h('span', { class: 'chip chip--gold' }, t))) : null,
    para('Son comportement', pr.comportement),
    para('Ses émotions', pr.emotions),
    para('En couple', pr.en_couple),
    lst('Ce dont il·elle a besoin', pr.besoins),
    lst('Ses points forts', pr.points_forts),
    lst('Points de vigilance', pr.vigilance),
    para('Le conseil pour le·la rendre heureux·se', pr.conseil),
    latest.period_end ? h('p', { class: 'small muted' }, `D’après vos réponses jusqu’au ${formatShort(latest.period_end)}`) : null,
  ].filter(Boolean), { 'data-testid': `portrait-${p}` });
}

/** Courbe de compatibilité semaine après semaine (SVG). */
export function curve(timeline) {
  if (timeline.length < 2) return null;
  const W = 300; const H = 120; const pad = 16;
  const x = (i) => pad + (i * (W - 2 * pad)) / (timeline.length - 1);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'curve', role: 'img', 'aria-label': `Évolution : ${timeline.map((a) => `${a.compatibility} %`).join(', ')}` });
  svg.append(el('polyline', { points: timeline.map((a, i) => `${x(i)},${y(a.compatibility)}`).join(' '), class: 'curve-line' }));
  timeline.forEach((a, i) => {
    svg.append(el('circle', { cx: x(i), cy: y(a.compatibility), r: 4, class: 'curve-dot' }));
    const t = el('text', { x: x(i), y: y(a.compatibility) - 8, 'text-anchor': 'middle', class: 'curve-label' });
    t.textContent = `${a.compatibility}`;
    svg.append(t);
  });
  return card([
    h('h2', {}, 'Semaine après semaine'),
    svg,
    h('p', { class: 'small muted' }, timeline.map((a) => formatShort(a.period_end)).join(' · ')),
  ], { 'data-testid': 'curve' });
}

function aiSections(ai, names) {
  if (!ai) return [];
  const playerCards = [1, 2].map((p) => {
    const P = ai.players[p];
    return section(`${names[p]} selon l’analyse`, [
      P.aime.length ? [h('h3', {}, 'Aime'), items(P.aime)] : null,
      P.naime_pas.length ? [h('h3', {}, 'N’aime pas'), items(P.naime_pas)] : null,
      P.ressenti ? [h('h3', {}, 'En ce moment'), h('p', {}, P.ressenti)] : null,
      P.a_savoir.length ? [h('h3', {}, 'À savoir'), items(P.a_savoir)] : null,
      P.surprises.length ? [h('h3', {}, 'Surprises'), items(P.surprises)] : null,
    ].flat(2), `ai-player-${p}`);
  });
  return [
    section('Le résumé de la semaine', [ai.summary && h('p', {}, ai.summary), ai.compatibility_explained && h('p', { class: 'muted' }, ai.compatibility_explained)], 'ai-summary'),
    ...playerCards,
    section('Vos points communs', items(ai.points_communs), 'ai-common'),
    section('Vos différences', items(ai.differences), 'ai-diff'),
    section('À faire ensemble', items(ai.a_faire_ensemble), 'ai-todo'),
    section('Questions à se poser', items(ai.questions_a_se_poser), 'ai-questions'),
    section('Évolution', ai.evolution && h('p', {}, ai.evolution), 'ai-evolution'),
  ];
}

export async function render() {
  let game;
  let rows;
  try {
    const api = await getApi();
    [game, rows] = await Promise.all([loadGame({ to: todayParis() }), api.listAnalyses()]);
  } catch (error) {
    return h('section', { class: 'view stack', 'data-view': 'love' }, h('h1', {}, 'Love report'), card(h('p', { role: 'alert' }, messageFor(error))));
  }
  const { names, them } = players();
  const live = compatibility(game);
  const timeline = analysesTimeline(rows);
  const ai = timeline.at(-1) ?? null;
  const value = ai ? ai.compatibility : live.score;
  const source = ai ? `Analyse du ${formatShort(ai.period_start || ai.period_end)} au ${formatShort(ai.period_end)}` : live.unlocked ? 'Score calculé en direct' : null;

  return h('section', { class: 'view stack', 'data-view': 'love' },
    h('h1', {}, 'Love report 💞'),
    card([
      value === null
        ? h('p', { class: 'center', 'data-testid': 'gauge-locked' }, `Encore ${live.remaining} question${live.remaining > 1 ? 's' : ''} pour débloquer votre compatibilité 🔒`)
        : gauge({ value, label: labelFor(value) }),
      source ? h('p', { class: 'small muted center', 'data-testid': 'gauge-source' }, source) : null,
    ], { variant: 'gold', 'data-testid': 'gauge-card' }),
    ...aiSections(ai, names),
    liveCard(live),
    personalityCard(timeline, them, names),
    curve(timeline),
    h('p', { class: 'small muted center disclaimer' }, 'Analyse ludique, pas une vérité scientifique 😉'),
  );
}
