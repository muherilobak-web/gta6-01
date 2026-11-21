// Vice Point — dossier entrypoint.
// Copies the game and its screenshots into the output directory, then
// builds the submission dossier from that output directory and writes
// it as dossier.json. Node stdlib only; no network, no timestamps,
// so the dossier is byte-identical across runs.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(new URL('.', import.meta.url).pathname);
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const CAPS = {
  text_max_bytes: 163840,
  max_images: 4,
  dossier_max_bytes: 1572864,
  index_html_max_bytes: 1048576,
  game_path_max_bytes: 1000,
};

function copyDir(name) {
  const src = join(root, name);
  if (!existsSync(src)) {
    console.log(`skip: ${name}/ not present`);
    return false;
  }
  cpSync(src, join(outDir, name), { recursive: true });
  console.log(`copied ${name}/`);
  return true;
}

function main() {
  mkdirSync(outDir, { recursive: true });
  for (const child of readdirSync(outDir)) {
    rmSync(join(outDir, child), { recursive: true, force: true });
  }
  copyDir('game');
  copyDir('screenshots');
  const dossier = buildDossier(outDir, CAPS);
  const dossierPath = join(outDir, 'dossier.json');
  writeFileSync(dossierPath, dossier, 'utf8');
  const size = statSync(dossierPath).size;
  console.log(`dossier written: ${dossierPath} (${size} bytes)`);
  if (size > 1572864) {
    console.error('dossier exceeds 1.5 MiB cap');
    process.exit(1);
  }
}

main();
