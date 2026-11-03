// QR code (SVG) d'un lien — à scanner avec l'appareil photo.
import qrcode from '../vendor/qrcode.js';

export function qrSvg(text, { cell = 5, margin = 2 } = {}) {
  const qr = qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  return qr.createSvgTag({ cellSize: cell, margin, scalable: true });
}

/** Élément <div> contenant le QR (le contenu vient d'un lien qu'on a construit nous-mêmes). */
export function qrElement(text, label = 'QR code de l’invitation') {
  const el = document.createElement('div');
  el.className = 'qr';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.innerHTML = qrSvg(text);
  return el;
}
