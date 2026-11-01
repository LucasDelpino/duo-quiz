// npm run bank : valide data/questions.json (inclus dans npm run check).
import { readFileSync } from 'node:fs';
import { validateBank } from './bank-rules.mjs';

const bank = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf8'));
const errors = validateBank(bank);
if (errors.length) {
  console.error(`✘ Banque invalide (${errors.length} erreur(s)) :\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
const count = (k) => bank.filter((q) => q.kind === k).length;
console.log(`✔ Banque valide : ${bank.length} questions (choice ${count('choice')}, scale ${count('scale')}, text ${count('text')})`);
