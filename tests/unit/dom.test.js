import { describe, it, expect, vi } from 'vitest';
import { h, clear } from '../../js/ui/dom.js';

describe('dom.h', () => {
  it('crée des éléments avec attributs, enfants et événements', () => {
    const onClick = vi.fn();
    const el = h('button', { class: 'btn', 'aria-pressed': true, hidden: false, title: null, onClick }, 'OK', null, ['!', h('span', {}, 1)]);
    expect(el.outerHTML).toBe('<button class="btn" aria-pressed="">OK!<span>1</span></button>');
    el.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("n'interprète pas le HTML du texte", () => {
    expect(h('p', {}, '<b>x</b>').innerHTML).toBe('&lt;b&gt;x&lt;/b&gt;');
  });

  it('vide un élément', () => {
    const el = h('div', {}, h('i'), h('i'));
    expect(clear(el).childNodes.length).toBe(0);
  });
});
