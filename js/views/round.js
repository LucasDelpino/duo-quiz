// Un round : réponse en 2 étapes (Toi / Et l'autre ?), attente, révélation animée, validation `text`.
import { h, clear } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card, flipCard, reveal } from '../ui/card.js';
import { categoryChip } from '../ui/status.js';
import { confetti } from '../ui/confetti.js';
import { vibrate, prefersReducedMotion } from '../ui/motion.js';
import { play } from '../ui/sound.js';
import { toast } from '../ui/toast.js';
import { errorBox, busy } from '../ui/form.js';
import { messageFor } from '../api/errors.js';
import { getApi, go } from '../context.js';
import { players, textFor, answerLabel, nextRoundId, loadRoom, drawMoreToday } from '../game.js';
import { answersOf, judgmentsOf, roundStatus, pointFor } from '../logic/scoring.js';
import { formatDay } from '../logic/dates.js';
import { paceState, paceMessage } from '../logic/pace.js';

const SEEN_KEY = 'duo-quiz:revealed';

function seen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); }
}
function markSeen(id) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen(), id].slice(-500))); } catch { /* sans importance */ }
}

async function loadRound(id) {
  const api = await getApi();
  const round = (await api.listRounds()).find((r) => String(r.id) === String(id));
  if (!round) return null;
  const [answers, judgments] = await Promise.all([api.listAnswers([round.id]), api.listJudgments([round.id])]);
  return { round, answers, judgments };
}

/** Saisie d'une réponse selon le type ; `onChange(value|null)`. `viewer` = joueur dont on lit la réponse. */
function answerInput(round, viewer, names, onChange, idPrefix) {
  if (round.kind === 'choice') {
    const buttons = (round.options || []).map((opt) => {
      const b = h('button', { type: 'button', class: 'option', 'aria-pressed': 'false', 'data-value': opt }, textFor(opt, viewer, names));
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        onChange(opt);
      });
      return b;
    });
    return h('div', { class: 'options', role: 'group', 'aria-label': 'Choix' }, buttons);
  }
  if (round.kind === 'scale') {
    const buttons = [1, 2, 3, 4, 5].map((n) => {
      const b = h('button', { type: 'button', class: 'option', 'aria-pressed': 'false', 'data-value': String(n), 'aria-label': `${n} sur 5` }, String(n));
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        onChange(String(n));
      });
      return b;
    });
    return h('div', { class: 'scale', role: 'group', 'aria-label': 'Note de 1 à 5' }, buttons);
  }
  const id = `${idPrefix}-text`;
  const ta = h('textarea', { id, class: 'textarea', maxlength: 500, rows: 4, enterkeyhint: 'done', 'aria-label': 'Ta réponse', placeholder: 'Écris ici…' });
  ta.addEventListener('input', () => onChange(ta.value.trim() ? ta.value.trim() : null));
  return ta;
}

function questionCard(round, viewer, names, extra) {
  return card([
    categoryChip(round.category),
    h('p', { class: 'q-text', 'data-testid': 'question' }, textFor(round.text, viewer, names)),
    extra,
  ], { variant: 'question' });
}

/** Étapes 1/2 et 2/2, puis envoi unique. */
function playFlow(root, data, ctx) {
  const { round } = data;
  const { me, them, names } = ctx;
  const state = { self: null, guess: null };

  const stepOne = () => {
    const next = button('Suivant', { block: true, size: 'lg', disabled: true, 'data-testid': 'next' });
    next.addEventListener('click', stepTwo);
    clear(root).append(
      h('p', { class: 'step-label', 'data-testid': 'step' }, 'Étape 1/2 · Toi'),
      questionCard(round, me, names, answerInput(round, me, names, (v) => { state.self = v; next.disabled = !v; }, 'self')),
      next);
  };

  const stepTwo = () => {
    const err = errorBox();
    const send = button('Envoyer', { block: true, size: 'lg', disabled: true, 'data-testid': 'send' });
    send.addEventListener('click', async () => {
      err.show(null);
      try {
        await busy(send, async () => (await getApi()).submitAnswer(round.id, state.self, state.guess));
        go(location.hash);
      } catch (error) {
        err.show(messageFor(error));
      }
    });
    clear(root).append(
      h('p', { class: 'step-label', 'data-testid': 'step' }, `Étape 2/2 · Et ${names[them]} ?`),
      // Pour deviner, on lit la question comme l'autre la voit ({autre} = moi).
      questionCard(round, them, names, [
        h('p', { class: 'muted' }, `Devine ce que ${names[them]} a répondu.`),
        answerInput(round, them, names, (v) => { state.guess = v; send.disabled = !v; }, 'guess'),
      ]),
      h('p', { class: 'small muted center' }, 'Envoi unique et définitif : pas de retour en arrière après validation.'),
      err, send,
      button('← Modifier ma réponse', { variant: 'ghost', block: true, onClick: stepOne }));
  };

  stepOne();
}

function waitingView(data, ctx) {
  const { round, answers } = data;
  const { me, them, names } = ctx;
  const mine = answersOf(round.id, answers)[me];
  return [
    questionCard(round, me, names),
    card([
      h('p', { class: 'title center', 'data-testid': 'waiting' }, `${names[them]} n’a pas encore répondu 🤫`),
      h('p', { class: 'muted center' }, 'Tu verras sa réponse dès que ce sera fait.'),
      h('dl', { class: 'recap' },
        h('dt', {}, 'Ta réponse'), h('dd', {}, answerLabel(round, mine.self_answer, me, names)),
        h('dt', {}, 'Ta prédiction'), h('dd', {}, answerLabel(round, mine.guess_other, them, names))),
    ]),
    nextButton(round.id),
  ];
}

function judgeCard(data, ctx) {
  const { round, answers } = data;
  const { me, them, names } = ctx;
  const a = answersOf(round.id, answers);
  const err = errorBox();
  const vote = (correct) => async (e) => {
    err.show(null);
    try {
      await busy(e.currentTarget, async () => (await getApi()).judge(round.id, correct));
      toast(correct ? `Point pour ${names[them]} ✅` : 'Noté ❌', { type: correct ? 'success' : 'info' });
      go(location.hash);
    } catch (error) {
      err.show(messageFor(error));
    }
  };
  return card([
    h('h2', {}, `${names[them]} a-t-il/elle bien deviné ?`),
    h('p', { class: 'small muted' }, 'Ta réponse :'),
    h('p', { class: 'title' }, answerLabel(round, a[me].self_answer, me, names)),
    h('p', { class: 'small muted' }, `Sa prédiction :`),
    h('p', { class: 'title' }, answerLabel(round, a[them].guess_other, me, names)),
    err,
    h('div', { class: 'judge-buttons' },
      button('Bien vu ✅', { variant: 'teal', size: 'lg', 'data-testid': 'judge-yes', onClick: vote(true) }),
      button('Raté ❌', { variant: 'coral', size: 'lg', 'data-testid': 'judge-no', onClick: vote(false) })),
  ], { variant: 'gold', 'data-testid': 'judge' });
}

function pointLine(pt, who, names) {
  if (pt === null) return h('p', { class: 'point point--pending' }, `${names[who]} : en attente de validation ⏳`);
  return h('p', { class: `point ${pt ? 'point--win' : 'point--miss'}`, 'data-testid': `point-${who}` },
    pt ? `${names[who]} : +1 point 🎯` : `${names[who]} : raté 🙈`);
}

function revealView(data, ctx) {
  const { round, answers, judgments } = data;
  const { me, them, names } = ctx;
  const a = answersOf(round.id, answers);
  const status = roundStatus(round, answers, judgments, me);
  const cards = [
    ['Ta réponse', answerLabel(round, a[me].self_answer, me, names)],
    [`Réponse de ${names[them]}`, answerLabel(round, a[them].self_answer, them, names)],
    ['Ta prédiction', answerLabel(round, a[me].guess_other, them, names)],
    [`Prédiction de ${names[them]}`, answerLabel(round, a[them].guess_other, me, names)],
  ].map(([label, value]) => {
    const f = flipCard({ front: '?', label, back: [h('p', { class: 'small muted' }, label), h('p', { class: 'reveal-value' }, value)] });
    f.dataset.testid = 'reveal-card';
    return f;
  });
  const myPt = pointFor(round, answers, judgments, me);
  const theirPt = pointFor(round, answers, judgments, them);
  const points = h('div', { class: 'points', 'data-testid': 'points', hidden: true }, pointLine(myPt, me, names), pointLine(theirPt, them, names));
  const judged = judgmentsOf(round.id, judgments)[me];

  const animate = async () => {
    const instant = seen().has(round.id) || prefersReducedMotion();
    for (const c of cards) {
      if (instant) c.classList.add('is-flipped');
      else await reveal(c);
    }
    points.hidden = false;
    if (!instant) {
      if (myPt === 1) { vibrate(40); confetti(); play('win'); } else if (myPt === 0) { points.classList.add('shake'); play('miss'); }
    }
    markSeen(round.id);
  };
  queueMicrotask(animate);

  return [
    questionCard(round, me, names),
    h('div', { class: 'reveal-grid' }, cards),
    points,
    status === 'to_judge' ? judgeCard(data, ctx) : null,
    round.kind === 'text' && judged ? h('p', { class: 'small muted center' }, `Tu as jugé : ${judged.correct ? 'bien vu ✅' : 'raté ❌'}`) : null,
    nextButton(round.id),
    button('Retour à l’accueil', { variant: 'ghost', block: true, onClick: () => go('#/today') }),
  ];
}

/** « Question suivante » : la prochaine question à jouer ; en mode illimité, en tire de nouvelles si besoin. */
function nextButton(currentId) {
  const btn = button('Question suivante →', {
    block: true, size: 'lg', 'data-testid': 'next-round',
    onClick: async () => {
      btn.disabled = true;
      try {
        let id = await nextRoundId(currentId);
        if (!id) {
          const room = await loadRoom().catch(() => null);
          if (room?.questions_per_day === 0) {
            await drawMoreToday();
            id = await nextRoundId(currentId);
          }
        }
        if (id) return go(`#/round/${encodeURIComponent(id)}`);
        toast('Plus de question pour l’instant 🎉', { type: 'success' });
        go('#/today');
      } catch (error) {
        btn.disabled = false;
        toast(messageFor(error), { type: 'error' });
      }
    },
  });
  return btn;
}

async function loadPace() {
  try {
    const api = await getApi();
    return api.pace ? paceState(await api.pace()) : null;
  } catch {
    return null;
  }
}

export async function render({ params }) {
  const root = h('section', { class: 'view stack', 'data-view': 'round' });
  let data;
  try {
    data = await loadRound(params.id);
  } catch (error) {
    root.append(card(h('p', { role: 'alert' }, messageFor(error))), button('Retour', { block: true, onClick: () => go('#/today') }));
    return root;
  }
  if (!data) {
    root.append(h('p', { class: 'empty' }, 'Question introuvable.'), button('Retour', { block: true, onClick: () => go('#/today') }));
    return root;
  }
  const ctx = players();
  const status = roundStatus(data.round, data.answers, data.judgments, ctx.me);
  root.dataset.status = status;
  root.dataset.round = data.round.id;
  root.append(h('p', { class: 'small muted' }, formatDay(data.round.play_date)));
  const body = h('div', { class: 'stack' });
  root.append(body);
  const pace = status === 'todo' ? await loadPace() : null;
  if (pace?.state === 'blocked') {
    const msg = paceMessage(pace, ctx.names, ctx.me);
    body.append(card([
      h('p', { class: 'pace-title' }, h('span', { 'aria-hidden': 'true' }, msg.emoji + ' '), h('strong', {}, msg.title)),
      h('p', {}, msg.text),
    ], { variant: 'danger', 'data-testid': 'pace-blocked' }), button('Retour', { variant: 'ghost', block: true, onClick: () => go('#/today') }));
  } else if (status === 'todo') playFlow(body, data, ctx);
  else if (status === 'waiting') body.append(...waitingView(data, ctx));
  else body.append(...revealView(data, ctx).filter(Boolean));
  return root;
}
