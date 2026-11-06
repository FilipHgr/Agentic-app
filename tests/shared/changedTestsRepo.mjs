/**
 * Pomocník k testům #79 (`changedTestsScript.test.ts`): dočasný git repozitář
 * s podvrženými testovacími skripty a spuštění kontroly `test:changed`
 * (`tools/test/runChangedTests.ts`) v něm. Je v JavaScriptu, protože
 * projekt nemá typy Node a testy v TypeScriptu by s nimi neprošly `tsc`.
 * Typy k němu jsou v `changedTestsRepo.d.mts`.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

const RUNNER = fileURLToPath(new URL('../../tools/test/runChangedTests.ts', import.meta.url));

/** Testovací skript, který jen vypíše, že běžel, a skončí úspěchem. */
function passingScript(name) {
  return `node -e "console.log('BEH ${name}')"`;
}

/** Testovací skript, který vypíše svou chybu a skončí neúspěchem. */
function failingScript(name) {
  return `node -e "console.log('BEH ${name}'); console.log('CHYBA ${name}'); process.exit(1)"`;
}

const SCRIPT_NAMES = ['test', 'test:shared', 'test:menu', 'test:counting', 'test:whole'];

/** Skripty pro `package.json`; skripty v `failing` selžou. */
function scriptsFor(failing) {
  return Object.fromEntries(
    SCRIPT_NAMES.map((name) => [
      name,
      failing.includes(name) ? failingScript(name) : passingScript(name),
    ]),
  );
}

const INITIAL_FILES = {
  '.gitignore': 'node_modules/\ndist/\n',
  'src/shared/logic/settings.ts': 'export const a = 1;\n',
  'src/menu/logic/menu.ts': 'export const b = 2;\n',
  'src/games/counting/index.ts': 'export const c = 3;\n',
  'tests/menu/menu.test.ts': '// test menu\n',
  'docs/rozhodnuti.md': '# Deník\n',
};

function git(dir, ...args) {
  const result = spawnSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd: dir, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} selhal: ${result.stderr}`);
  }
  return result.stdout;
}

export function writeRepoFile(dir, path, content = 'změna\n') {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}

export function removeRepoFile(dir, path) {
  rmSync(join(dir, path));
}

/** Nový repozitář s jedním commitem; skripty v `failing` budou selhávat. */
export function createRepo(failing = []) {
  const dir = mkdtempSync(join(tmpdir(), 'test-changed-'));
  git(dir, 'init', '-q');
  writeRepoFile(
    dir,
    'package.json',
    JSON.stringify({ private: true, scripts: scriptsFor(failing) }, null, 2),
  );
  for (const [path, content] of Object.entries(INITIAL_FILES)) {
    writeRepoFile(dir, path, content);
  }
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'začátek');
  return dir;
}

export function stageAll(dir) {
  git(dir, 'add', '-A');
}

export function commitAll(dir) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'změna');
}

export function moveRepoFile(dir, from, to) {
  mkdirSync(dirname(join(dir, to)), { recursive: true });
  git(dir, 'mv', from, to);
}

export function removeRepo(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** Spustí kontrolu změn v repozitáři tak, jak ji pouští `npm run test:changed`. */
export function runChangedTests(dir) {
  const result = spawnSync(process.execPath, [RUNNER], { cwd: dir, encoding: 'utf8' });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const ran = SCRIPT_NAMES.filter(
    (name) => stdout.includes(`BEH ${name}\n`) || stderr.includes(`BEH ${name}\n`),
  );
  return {
    status: result.status,
    firstLine: stdout.split('\n')[0] ?? '',
    output: stdout + stderr,
    ran,
  };
}
