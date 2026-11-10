/**
 * Pomocník k testům #80 (`recognitionGroup.test.ts`): zjistí, které soubory
 * a testy pouští testovací skript z `package.json`. Skript se nespouští,
 * jen se z něj udělá výpis `vitest list` se stejnými argumenty, takže
 * výsledek odpovídá skutečnému nastavení (konfigurace Vitestu i argumenty
 * skriptu). Je v JavaScriptu, protože projekt nemá typy Node a testy
 * v TypeScriptu by s nimi neprošly `tsc`. Typy jsou v `testScriptsListing.d.mts`.
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { URL, fileURLToPath } from 'node:url';

/** Kořen repozitáře. */
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const VITEST_BIN = join(REPO_ROOT, 'node_modules', '.bin', 'vitest');
const VITEST_RUN = 'vitest run';

/** Konfigurace v kořeni, které můžou ovlivnit výběr souborů testů. */
const CONFIG_FILE = /^(?:vite|vitest)(?:\.[\w-]+)*\.config\.(?:ts|mts|js|mjs)$/;

/**
 * Prostředí pro vnořený Vitest: bez proměnných běžícího Vitestu, které by
 * ho zmátly, a s `CI=true` (žádný interaktivní režim).
 */
function childEnv() {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('VITEST') && key !== 'NODE_OPTIONS' && value !== undefined) {
      env[key] = value;
    }
  }
  env.CI = 'true';
  return env;
}

/** Argumenty skriptu za `vitest run`; skript musí být běh Vitestu. */
function scriptArguments(root, script) {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const command = packageJson.scripts?.[script];
  if (typeof command !== 'string') {
    throw new Error(`skript ${script} v package.json chybí`);
  }
  const trimmed = command.trim();
  if (trimmed !== VITEST_RUN && !trimmed.startsWith(`${VITEST_RUN} `)) {
    throw new Error(`skript ${script} není „${VITEST_RUN} …“, ale „${command}“`);
  }
  const rest = trimmed.slice(VITEST_RUN.length).trim();
  // Bez shellu: znaky shellu ve skriptu se odmítnou, argumenty se jen rozdělí
  // podle mezer a jednoduché uvozovky kolem vzoru se odstraní.
  if (/[;&|$`<>"]/.test(rest)) {
    throw new Error(`skript ${script} obsahuje znaky shellu: „${command}“`);
  }
  return rest
    .split(/\s+/)
    .filter((part) => part !== '')
    .map((part) => part.replace(/^'(.*)'$/, '$1'));
}

function vitestList(root, script, extraArguments) {
  const args = scriptArguments(root, script);
  const result = spawnSync(VITEST_BIN, ['list', ...extraArguments, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: childEnv(),
  });
  if (result.status !== 0) {
    throw new Error(`výpis testů skriptu ${script} selhal:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('tests/'));
}

/** Soubory testů, které skript pustí, seřazené, cesty od kořene. */
export function scriptTestFiles(script, root = REPO_ROOT) {
  return vitestList(root, script, ['--filesOnly']).sort();
}

/**
 * Testy, které skript pustí, jako „skupina > název“ bez souboru (přesunutý
 * test změní soubor, ne název). Stejný název víckrát je ve výsledku víckrát.
 */
export function scriptTestNames(script, root = REPO_ROOT) {
  return vitestList(root, script, []).map((line) => line.split(' > ').slice(1).join(' > '));
}

/** Všechny soubory `*.test.ts` v `tests/`, seřazené, cesty od kořene. */
export function testFilesInRepo(root = REPO_ROOT) {
  return readdirSync(join(root, 'tests'), { recursive: true })
    .map((path) => `tests/${String(path).split('\\').join('/')}`)
    .filter((path) => path.endsWith('.test.ts'))
    .sort();
}

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
}

/** Složky, které konfigurace Vitestu může importovat (plugin buildu z `tools/` bere i `src/`). */
const COPIED_FOLDERS = ['src', 'tools'];

/** Prázdný test, který jde vypsat. */
const PLACEHOLDER_TEST = "import { it } from 'vitest';\n\nit('test', () => {});\n";

/**
 * Dočasná kopie nastavení testů (`package.json`, konfigurace Vitestu,
 * `src/` a `tools/`) s vlastními soubory testů místo skutečných. Je to git
 * repozitář s jedním commitem, takže pracovní kopie je bez změn.
 */
export function createScriptsFixture(testFiles) {
  const dir = mkdtempSync(join(tmpdir(), 'test-scripts-'));
  cpSync(join(REPO_ROOT, 'package.json'), join(dir, 'package.json'));
  for (const name of readdirSync(REPO_ROOT)) {
    if (CONFIG_FILE.test(name)) {
      cpSync(join(REPO_ROOT, name), join(dir, name));
    }
  }
  for (const folder of COPIED_FOLDERS) {
    if (existsSync(join(REPO_ROOT, folder))) {
      cpSync(join(REPO_ROOT, folder), join(dir, folder), { recursive: true });
    }
  }
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
  for (const path of testFiles) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), PLACEHOLDER_TEST);
  }
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'začátek');
  return dir;
}

export function removeScriptsFixture(dir) {
  rmSync(dir, { recursive: true, force: true });
}
