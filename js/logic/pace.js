// Rythme commun : écart de réponses entre les deux joueurs (fonctions pures).
import { other } from './scoring.js';

export const WARN_AFTER = 10; // plus de 10 réponses de retard → pop-up d'alerte
export const BLOCK_AT = 15;   // 15 réponses d'avance → bloqué jusqu'au rattrapage

const int = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.floor(Number(n)) : 0);

/** { me, them } → état : 'ok' | 'ahead' (avance > 10) | 'blocked' (avance ≥ 15) | 'behind' (retard > 10). */
export function paceState(p) {
  if (!p || typeof p !== 'object') return null;
  const warn = int(p.warn_after) || WARN_AFTER;
  const block = int(p.block_at) || BLOCK_AT;
  const me = int(p.me);
  const them = int(p.them);
  const lead = me - them;
  let state = 'ok';
  if (lead >= block) state = 'blocked';
  else if (lead > warn) state = 'ahead';
  else if (-lead > warn) state = 'behind';
  return { me, them, lead, state, warn, block, left: Math.max(0, block - lead) };
}

/** Message affiché selon l'état (null si tout va bien). */
export function paceMessage(s, names, me) {
  if (!s || s.state === 'ok') return null;
  const autre = names?.[other(me)] || 'ton/ta partenaire';
  const n = (k) => `${k} réponse${k > 1 ? 's' : ''}`;
  if (s.state === 'behind') {
    return { emoji: '⏳', title: 'Tu es en retard !', text: `${autre} a ${n(-s.lead)} d’avance sur toi. Rattrape-toi pour que le bilan reste juste — au bout de ${s.block} d’écart, ${autre} sera bloqué·e.`, cta: 'play' };
  }
  if (s.state === 'blocked') {
    return { emoji: '⛔', title: `Attends ${autre} !`, text: `Tu as ${n(s.lead)} d’avance : tu ne peux plus répondre tant que ${autre} ne t’a pas rattrapé·e. C’est pour que vos bilans comparent les mêmes questions.`, cta: null };
  }
  return { emoji: '🏃', title: 'Tu as de l’avance', text: `${n(s.lead)} d’avance sur ${autre}. Encore ${n(s.left)} et tu seras bloqué·e en attendant que ${autre} te rattrape.`, cta: null };
}

export const PACE_POPUP_KEY = 'duo-quiz:pace-popup-at';
