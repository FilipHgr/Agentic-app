/**
 * Kontrola změn `npm run test:changed` (#79): z cest, kterými se pracovní
 * kopie liší od posledního commitu, určí, které testovací skripty se pustí.
 * Pouštějí se testy dotčených částí (sdílená část, menu, jednotlivé hry)
 * a vždy kontroly celku (`test:whole`). Změna mimo všechny části nebo ve
 * hře bez vlastního skriptu `test:<hra>` pustí všechny testy (`test`).
 * Skupina pomalých testů hry (rozpoznávání psaní v Počítání, #80,
 * a ukládání obrázku v Omalovánkách, #119) se pustí jen při změně souborů,
 * kterých se týká.
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
const RESERVED_GAME_IDS: ReadonlySet<string> = new Set([
  'changed',
  'whole',
  'shared',
  'menu',
  'recognition',
]);

/**
 * Skupina pomalých testů jedné hry s vlastním skriptem (#80). Pouští se
 * navíc k testům hry, jen při změně souborů, kterých se týká. V prvním
 * řádku i v pořadí skriptů je hned za svou hrou.
 */
interface SlowTestGroup {
  readonly gameId: string;
  readonly label: string;
  readonly script: string;
  readonly matches: (path: string) => boolean;
}

/** Soubory, na kterých závisí pomalé testy rozpoznávání psaní (#80, AC5). */
const RECOGNITION_PATHS: ReadonlySet<string> = new Set([
  'src/games/counting/logic/digitRecognition.ts',
  'src/games/counting/logic/digitTemplates.ts',
  'tests/games/counting/penDigits.ts',
  'tests/games/counting/notDigitStrokes.ts',
]);

/** Pomalý soubor testů Počítání, i v podsložce. */
const COUNTING_SLOW_TEST = /^tests\/games\/counting\/.+\.slow\.test\.ts$/;

/**
 * Soubory, na kterých závisí pomalé testy ukládání obrázku Omalovánek
 * (matice těsných tahů, #119): kódování vrstvy barev, záznam obrázku
 * a pomůcky matice.
 */
const PICTURE_SAVING_PATHS: ReadonlySet<string> = new Set([
  'src/games/coloring/logic/colorLayerCode.ts',
  'src/games/coloring/logic/savedPicture.ts',
  'tests/games/coloring/tightStrokesHelpers.ts',
  'tests/games/coloring/tightStrokesChecks.ts',
]);

/** Pomalý soubor testů Omalovánek, i v podsložce. */
const COLORING_SLOW_TEST = /^tests\/games\/coloring\/.+\.slow\.test\.ts$/;

const SLOW_TEST_GROUPS: readonly SlowTestGroup[] = [
  {
    gameId: 'counting',
    label: 'rozpoznávání',
    script: 'test:recognition',
    matches: (path) => RECOGNITION_PATHS.has(path) || COUNTING_SLOW_TEST.test(path),
  },
  {
    gameId: 'coloring',
    label: 'ukládání obrázku',
    script: 'test:coloring:slow',
    matches: (path) => PICTURE_SAVING_PATHS.has(path) || COLORING_SLOW_TEST.test(path),
  },
];

/**
 * Soubory dokumentace, které čte některý test, a proto nejsou dokumentace
 * (CLAUDE.md kontroluje test hlasu jazyků v Počítání).
 */
const DOCUMENTS_READ_BY_TESTS: ReadonlySet<string> = new Set(['CLAUDE.md']);

/**
 * Dokumentace a nastavení agentů (#117 AC3): soubory `docs/**`, `*.md`
 * a složky agentů a skillů v `.claude/` testy nespouští. Hooky a ostatní
 * nastavení Claude Code (které hooky běží, povolené příkazy) jsou ochrana
 * a dál pustí všechny testy (#117 AC4).
 */
function isDocumentation(path: string): boolean {
  if (DOCUMENTS_READ_BY_TESTS.has(path) || path.startsWith('.claude/hooks/')) {
    return false;
  }
  if (path.startsWith('.claude/agents/') || path.startsWith('.claude/skills/')) {
    return true;
  }
  if (path.startsWith('.claude/')) {
    return false;
  }
  return path.startsWith('docs/') || path.endsWith('.md');
}

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
  const slowGroups = new Set<SlowTestGroup>();

  for (const path of changedPaths) {
    if (isDocumentation(path)) {
      continue;
    }
    for (const group of SLOW_TEST_GROUPS) {
      if (group.matches(path)) {
        slowGroups.add(group);
      }
    }
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
  for (const group of slowGroups) {
    if (!Object.hasOwn(scripts, group.script)) {
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
    for (const group of SLOW_TEST_GROUPS) {
      if (group.gameId === id && slowGroups.has(group)) {
        labels.push(group.label);
        plannedScripts.push(group.script);
      }
    }
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
