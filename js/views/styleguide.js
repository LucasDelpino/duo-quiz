// Page démo interne #/styleguide (non liée dans la navigation).
import { h } from '../ui/dom.js';
import { button } from '../ui/buttons.js';
import { card, flipCard, reveal } from '../ui/card.js';
import { confetti } from '../ui/confetti.js';
import { toast } from '../ui/toast.js';
import { animateCount } from '../ui/counter.js';
import { gauge, setGauge } from '../ui/gauge.js';

const SWATCHES = [['Nuit', '#160a2b', '#fff'], ['Prune', '#2a1250', '#fff'], ['Magenta', '#8a1f6f', '#fff'], ['Corail', '#ff6f61'], ['Or', '#ffd166'], ['Turquoise', '#2ec4b6']];

export function render() {
  const score = h('span', { class: 'score', 'data-testid': 'score' }, '0');
  const flip = flipCard({ front: '?', back: h('p', { class: 'title' }, 'Pizza 🍕'), label: 'Réponse de Léa' });
  const g = gauge({ value: 0, label: 'Très complices' });
  let pts = 0;

  return h('section', { class: 'view stack', 'data-view': 'styleguide' },
    h('h1', {}, 'Styleguide'),
    card([h('h2', {}, 'Palette'), h('div', { class: 'styleguide-swatches' },
      SWATCHES.map(([n, bg, fg]) => h('div', { class: 'swatch', style: `background:${bg};color:${fg || '#160a2b'}` }, n)))]),
    card([h('h2', {}, 'Typographie'), h('p', { class: 'title' }, 'Fredoka — titres ronds et gras'), h('p', {}, 'Nunito — texte lisible, accents : é è à ç œ « » ’')]),
    card([h('h2', {}, 'Boutons'), h('div', { class: 'row' },
      button('Valider', { variant: 'primary' }), button('Raté', { variant: 'coral' }), button('Bien vu', { variant: 'teal' }), button('Annuler', { variant: 'ghost' }), button('Désactivé', { disabled: true }))]),
    card([h('span', { class: 'chip' }, 'Goûts'), h('p', { class: 'q-text' }, 'Quel est le plat préféré de Léa ?'),
      h('div', { class: 'options' }, ['Pizza', 'Sushi', 'Raclette'].map((o, i) =>
        h('button', { type: 'button', class: 'option', 'aria-pressed': String(i === 0) }, o)))], { variant: 'question' }),
    card([h('h2', {}, 'Révélation'), flip, button('Retourner', { 'data-testid': 'flip', onClick: () => reveal(flip) })]),
    card([h('h2', {}, 'Points'), h('div', { class: 'row' }, score,
      button('+1', { 'data-testid': 'plus', onClick: () => { pts += 1; animateCount(score, pts); confetti(); } }))]),
    card([h('h2', {}, 'Jauge'), g, button('Remplir à 78 %', { 'data-testid': 'gauge', onClick: () => setGauge(g, 78) })], { variant: 'gold' }),
    card([h('h2', {}, 'Toasts'), h('div', { class: 'row' },
      button('Info', { variant: 'ghost', onClick: () => toast('Question ajoutée 🤫') }),
      button('Succès', { variant: 'teal', 'data-testid': 'toast', onClick: () => toast('Bien vu ✅', { type: 'success' }) }),
      button('Erreur', { variant: 'coral', onClick: () => toast('Code invalide', { type: 'error' }) }))]),
    card([h('h2', {}, 'Champ'), h('div', { class: 'field' }, h('label', { for: 'sg-name' }, 'Ton prénom'),
      h('input', { id: 'sg-name', class: 'input', inputmode: 'text', enterkeyhint: 'done', autocomplete: 'given-name' }))]),
    card([h('h2', {}, 'Facettes'), h('div', { class: 'bar', style: '--v:64%' }, h('i'))]),
  );
}
