// Audits de fin de projet : anonymat, secrets, budget JS (SPEC §3, §9).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execSync } from 'node:child_process';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const appJs = walk('js').filter((f) => f.endsWith('.js'));
const read = (f) => readFileSync(f, 'utf8');

describe('audit anonymat', () => {
  it('aucun écran ni composant ne lit source / author / bank_id d’un round', () => {
    const ui = appJs.filter((f) => !f.startsWith('js/api/'));
    for (const f of ui) expect(read(f), f).not.toMatch(/\.(source|author|bank_id)\b|\[['"](source|author|bank_id)['"]\]/);
  });

  it('les adaptateurs ne renvoient jamais ces colonnes pour un round', () => {
    const supa = read('js/api/supabase.js');
    expect(supa.match(/ROUND_COLS = '([^']+)'/)[1]).toBe('id, room_id, play_date, text, kind, options, category, created_at');
    const code = supa.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/select\(\s*['"]\*['"]/);
    expect(read('js/api/memory.js')).toMatch(/const ROUND_COLUMNS = \['id', 'room_id', 'play_date', 'text', 'kind', 'options', 'category', 'created_at'\]/);
  });

  it('aucun affichage par date de création', () => {
    for (const f of appJs.filter((x) => x.startsWith('js/views/'))) expect(read(f), f).not.toMatch(/created_at/);
  });
});

describe('audit secrets', () => {
  it('config.js ne contient que l’URL et la clé anon (rôle « anon »)', () => {
    const cfg = read('js/config.js');
    const key = cfg.match(/SUPABASE_ANON_KEY = '([^']*)'/)[1];
    if (key) {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      expect(payload.role).toBe('anon');
    }
    expect(cfg).not.toMatch(/service_role/);
  });

  // Un secret = un vrai corps de clé, pas une simple mention du préfixe (ex. dans le Journal).
  // Motif assemblé en morceaux : ce fichier, lui aussi suivi par git, ne doit pas se détecter lui-même.
  const SECRET_PATTERN = new RegExp(['-----BEGIN [A-Z ]*PRIVATE KEY-----', 'sk' + '_live_[A-Za-z0-9]{16,}'].join('|'));

  it('le motif détecte une vraie clé mais pas une mention du préfixe', () => {
    const prefix = 'sk' + '_live_';
    expect(prefix + 'a1B2c3D4e5F6g7H8i9J0').toMatch(SECRET_PATTERN);
    expect(`le motif \`${prefix}\` du Journal`).not.toMatch(SECRET_PATTERN);
  });

  it('aucun secret journalisé ni commité', () => {
    for (const f of appJs) expect(read(f), f).not.toMatch(/console\.\w+\([^)]*secret/i);
    const tracked = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter((f) => !/\.(png|woff2)$/.test(f) && f !== 'package-lock.json');
    for (const f of tracked) {
      const text = read(f);
      expect(text, f).not.toMatch(SECRET_PATTERN);
      // Tout JWT commité doit être une clé publique « anon », jamais « service_role ».
      for (const jwt of text.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) || []) {
        expect(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role, f).toBe('anon');
      }
    }
  });
});

describe('budget JS', () => {
  it('JS applicatif (hors supabase-js et modules démo/dev) < 120 Ko transférés', () => {
    const prod = appJs.filter((f) => !/vendor\.js|memory\.js|demo-data\.js|styleguide\.js/.test(f));
    const raw = prod.reduce((n, f) => n + statSync(f).size, 0);
    const gz = gzipSync(Buffer.concat(prod.map((f) => readFileSync(f)))).length;
    expect(gz).toBeLessThan(120 * 1024);
    expect(raw).toBeLessThan(160 * 1024); // garde-fou sur la taille brute (commentaires compris)
  });
});
