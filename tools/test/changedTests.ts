/**
 * Kontrola změn `npm run test:changed` (#79): z cest, kterými se pracovní
 * kopie liší od posledního commitu, určí, které testovací skripty se pustí.
 * Pouštějí se testy dotčených částí (sdílená část, menu, jednotlivé hry)
 * a vždy kontroly celku (`test:whole`). Změna mimo všechny části nebo ve
 * hře bez vlastního skriptu `test:<hra>` pustí všechny testy (`test`).
 *
 * Čistá logika bez Node API, aby ji kontroloval `tsc`. Změny z gitu zjistí
 * a skripty spustí `runChangedTests.ts`.
 */

export interface ChangedTestsPlan {
  /** První řádek výstupu kontroly, např. „Testy: menu, celek“. */
  readonly headline: string;
  /** Skripty z `package.json`, které se pustí, v tomto pořadí. */
  readonly scripts: readonly string[];
}

export const ALL_TESTS_SCRIPT = 'test';
export const WHOLE_CHECKS_SCRIPT = 'test:whole';

const HEADLINE_PREFIX = 'Testy: ';
const ALL_TESTS_LABEL = 'všechny';
const WHOLE_CHECKS_LABEL = 'celek';

const SHARED_PART = 'shared';
const MENU_PART = 'menu';

const ALL_TESTS_PLAN: ChangedTestsPlan = {
  headline: HEADLINE_PREFIX + ALL_TESTS_LABEL,
  scripts: [ALL_TESTS_SCRIPT],
};

/** Část projektu, do které cesta patří; `null`, když nepatří do žádné. */
type Part =
  | { readonly kind: 'shared' }
  | { readonly kind: 'menu' }
  | { readonly kind: 'game'; readonly id: string };

// Id hry podle CLAUDE.md: malá písmena bez diakritiky (a číslice). Jiná
// složka v src/games/ nebo tests/games/ pustí všechny testy.
const GAME_PATH = /^(?:src|tests)\/games\/([a-z0-9]+)\/.+/;

// Id, která by se kryla s jinými skripty (test:changed by pouštěl sám sebe).
// Taková hra pustí všechny testy.
const RESERVED_GAME_IDS: ReadonlySet<string> = new Set(['changed', 'whole', 'shared', 'menu']);

function partOfPath(path: string): Part | null {
  if (path.startsWith('src/shared/') || path.startsWith('tests/shared/')) {
    return { kind: 'shared' };
  }
  if (path.startsWith('src/menu/') || path.startsWith('tests/menu/')) {
    return { kind: 'menu' };
  }
  const gameMatch = GAME_PATH.exec(path);
  if (gameMatch?.[1] !== undefined) {
    return { kind: 'game', id: gameMatch[1] };
  }
  return null;
}

function gameScript(id: string): string {
  return `test:${id}`;
}

/**
 * Plán kontroly pro změněné cesty (relativní ke kořeni repozitáře, s `/`)
 * a skripty z `package.json`.
 */
export function planChangedTests(
  changedPaths: readonly string[],
  scripts: Readonly<Record<string, string>>,
): ChangedTestsPlan {
  let sharedChanged = false;
  let menuChanged = false;
  const gameIds = new Set<string>();

  for (const path of changedPaths) {
    const part = partOfPath(path);
    if (part === null) {
      return ALL_TESTS_PLAN;
    }
    if (part.kind === 'shared') {
      sharedChanged = true;
    } else if (part.kind === 'menu') {
      menuChanged = true;
    } else if (!RESERVED_GAME_IDS.has(part.id) && Object.hasOwn(scripts, gameScript(part.id))) {
      gameIds.add(part.id);
    } else {
      return ALL_TESTS_PLAN;
    }
  }

  const labels: string[] = [];
  const plannedScripts: string[] = [];
  if (sharedChanged) {
    labels.push(SHARED_PART);
    plannedScripts.push(`test:${SHARED_PART}`);
  }
  if (menuChanged) {
    labels.push(MENU_PART);
    plannedScripts.push(`test:${MENU_PART}`);
  }
  for (const id of [...gameIds].sort()) {
    labels.push(id);
    plannedScripts.push(gameScript(id));
  }
  labels.push(WHOLE_CHECKS_LABEL);
  plannedScripts.push(WHOLE_CHECKS_SCRIPT);

  return { headline: HEADLINE_PREFIX + labels.join(', '), scripts: plannedScripts };
}

/**
 * Cesty z výstupu `git status --porcelain -z`. U přejmenování a kopie
 * vrací novou i starou cestu.
 */
export function pathsFromGitStatus(statusOutput: string): string[] {
  const fields = statusOutput.split('\0');
  const paths: string[] = [];
  let index = 0;
  while (index < fields.length) {
    const entry = fields[index] ?? '';
    index += 1;
    if (entry.length < 4) {
      continue;
    }
    const status = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (status.includes('R') || status.includes('C')) {
      const originalPath = fields[index];
      index += 1;
      if (originalPath !== undefined && originalPath !== '') {
        paths.push(originalPath);
      }
    }
  }
  return paths;
}
