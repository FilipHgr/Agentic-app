/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

/**
 * Testy k #64, AC2: hranice mezi částmi projektu. Hra smí importovat jen
 * sama sebe a sdílenou část, sdílená část nic z her, menu ani `src/main.ts`
 * a zbytek `src/` z hry jen její vstup `src/games/<hra>/index.ts`. Logika
 * (`logic/`) nesmí importovat Phaser. Test projde zdrojové texty, u každého
 * importu dohledá skutečný cílový soubor a hlídá i to, aby každý test ležel
 * v `tests/shared/` nebo v `tests/games/<hra>/`, kde ho pustí skripty po částech.
 */

/** Zdrojové texty všech `.ts` souborů v `src/` podle cesty od kořene repa. */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../src/**/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, text]) => [joinPath('tests/shared/x.ts', path), text]),
);

/** Cesty všech souborů s testy v `tests/` od kořene repa. */
const TEST_FILES: string[] = Object.keys(import.meta.glob('../**/*.test.ts')).map((path) =>
  joinPath('tests/shared/x.ts', path),
);

interface Violation {
  readonly file: string;
  readonly specifier: string;
  readonly rule: string;
}

/** Cesta `specifier` vůči souboru `fromFile`, bez `.` a `..`. */
function joinPath(fromFile: string, specifier: string): string {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.' && part !== '') {
      parts.push(part);
    }
  }
  return parts.join('/');
}

/** Zdroják bez komentářů, aby se nepočítaly importy zmíněné v dokumentaci. */
function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/**
 * Všechny importy souboru: `import … from`, `import type`, `export … from`,
 * import jen kvůli vedlejšímu účinku a dynamický `import()`.
 */
function importsOf(text: string): string[] {
  const code = withoutComments(text);
  const patterns = [
    /^\s*(?:import|export)\s[^;]*?\sfrom\s*['"]([^'"]+)['"]/gm,
    /^\s*import\s*['"]([^'"]+)['"]/gm,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...code.matchAll(pattern)].map((match) => match[1] ?? ''));
}

/** Skutečný cílový soubor relativního importu, nebo `null` u balíčku (např. Phaser). */
function targetOf(
  fromFile: string,
  specifier: string,
  files: Record<string, string>,
): string | null {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = joinPath(fromFile, specifier.split('?')[0] ?? '');
  const candidates = [base, `${base}.ts`, `${base}/index.ts`];
  return candidates.find((candidate) => files[candidate] !== undefined) ?? base;
}

/** Hra, do které soubor patří, nebo `null` mimo hry. */
function gameOf(file: string): string | null {
  return /^src\/games\/([^/]+)\//.exec(file)?.[1] ?? null;
}

function isMenuOrPage(target: string): boolean {
  return target.startsWith('src/menu/') || target === 'src/main.ts';
}

function isPhaser(specifier: string): boolean {
  return specifier === 'phaser' || specifier.startsWith('phaser/');
}

/** Které pravidlo import porušuje, nebo `null`, když je v pořádku. */
function brokenRule(file: string, specifier: string, target: string | null): string | null {
  if (file.split('/').includes('logic') && isPhaser(specifier)) {
    return 'logika importuje Phaser';
  }
  if (target === null) {
    return null;
  }
  const game = gameOf(file);
  const targetGame = gameOf(target);
  if (game !== null) {
    if (targetGame !== null && targetGame !== game) {
      return 'hra importuje jinou hru';
    }
    return isMenuOrPage(target) ? 'hra importuje menu nebo src/main.ts' : null;
  }
  if (file.startsWith('src/shared/') && (targetGame !== null || isMenuOrPage(target))) {
    return 'sdílená část importuje hru, menu nebo src/main.ts';
  }
  if (targetGame !== null && target !== `src/games/${targetGame}/index.ts`) {
    return 'z hry se importuje jen její index.ts';
  }
  return null;
}

/** Všechna porušení hranic v souborech `files` (cesta od kořene repa → text). */
function findViolations(files: Record<string, string>): Violation[] {
  return Object.entries(files).flatMap(([file, text]) =>
    importsOf(text).flatMap((specifier) => {
      const rule = brokenRule(file, specifier, targetOf(file, specifier, files));
      return rule === null ? [] : [{ file, specifier, rule }];
    }),
  );
}

/** Testy, které neleží v `tests/shared/` ani v `tests/games/<hra>/`. */
function misplacedTests(testFiles: readonly string[]): string[] {
  return testFiles.filter(
    (file) => !file.startsWith('tests/shared/') && !/^tests\/games\/[^/]+\//.test(file),
  );
}

/** Soubory hry Počítání a sdílené části pro umělé příklady. */
const FAKE_PROJECT: Record<string, string> = {
  'src/main.ts': "import { GameScene } from './games/counting';",
  'src/games/counting/index.ts': "export { GameScene } from './scenes/GameScene';",
  'src/games/counting/scenes/GameScene.ts':
    "import { gameAreaFor } from '../../../shared/logic/viewportLayout';",
  'src/games/counting/logic/problems.ts': "import { TEXT } from '../../../shared/logic/theme';",
  'src/games/jina/x.ts': 'export const x = 1;',
  'src/shared/logic/viewportLayout.ts': 'export const gameAreaFor = 1;',
  'src/shared/logic/theme.ts': 'export const TEXT = 1;',
};

/** Umělý projekt, ve kterém soubor `file` má navíc import `code`. */
function violationsWith(file: string, code: string): Violation[] {
  const existing = FAKE_PROJECT[file] ?? '';
  return findViolations({ ...FAKE_PROJECT, [file]: `${existing}\n${code}` });
}

describe('AC2: hranice mezi částmi hlídá test', () => {
  it('v src/ žádný soubor neporušuje hranice mezi hrami, sdílenou částí a stránkou', () => {
    expect(findViolations(SOURCES)).toEqual([]);
  });

  it('kontrola opravdu prochází zdrojáky a vidí, že stránka spouští Počítání přes index.ts', () => {
    expect(SOURCES['src/main.ts']).toBeDefined();
    const targets = importsOf(SOURCES['src/main.ts'] ?? '').map((specifier) =>
      targetOf('src/main.ts', specifier, SOURCES),
    );
    expect(targets).toContain('src/games/counting/index.ts');
  });

  it('umělý projekt bez porušení projde', () => {
    expect(findViolations(FAKE_PROJECT)).toEqual([]);
  });

  describe('Počítání nesmí importovat jinou hru', () => {
    it.each([
      ['import', "import { x } from '../../jina/x';"],
      ['import type', "import type { x } from '../../jina/x';"],
      ['export … from', "export { x } from '../../jina/x';"],
      ['import()', "const later = import('../../jina/x');"],
      ['relativní cesta oklikou', "import { x } from './../../counting/../jina/./x';"],
    ])('%s', (_form, code) => {
      expect(violationsWith('src/games/counting/logic/problems.ts', code)).toEqual([
        expect.objectContaining({ rule: 'hra importuje jinou hru' }),
      ]);
    });
  });

  it.each([
    ['menu', "import { menu } from '../../../menu/MenuScene';"],
    ['src/main.ts', "import '../../../main';"],
    ['src/main.ts relativní cestou oklikou', "import '../../../shared/../main.ts';"],
  ])('Počítání nesmí importovat %s', (_name, code) => {
    expect(violationsWith('src/games/counting/scenes/GameScene.ts', code)).toEqual([
      expect.objectContaining({ rule: 'hra importuje menu nebo src/main.ts' }),
    ]);
  });

  describe('sdílená část nesmí importovat Počítání', () => {
    it.each([
      ['vstup hry', "import { GameScene } from '../../games/counting';"],
      ['vnitřní soubor', "import type { Problem } from '../../games/counting/logic/problems';"],
      ['import()', "const later = import('../../games/counting/index');"],
      ['relativní cesta oklikou', "export { x } from './../../games/./counting/logic/problems';"],
      ['menu', "import { menu } from '../../menu/MenuScene';"],
      ['src/main.ts', "import '../../main';"],
    ])('%s', (_form, code) => {
      expect(violationsWith('src/shared/logic/theme.ts', code)).toEqual([
        expect.objectContaining({ rule: 'sdílená část importuje hru, menu nebo src/main.ts' }),
      ]);
    });
  });

  describe('src/main.ts smí z Počítání importovat jen index.ts', () => {
    it.each([
      ['vnitřní soubor', "import { GameScene } from './games/counting/scenes/GameScene';"],
      ['import type', "import type { Problem } from './games/counting/logic/problems';"],
      ['relativní cesta oklikou', "import { x } from './shared/../games/counting/logic/problems';"],
    ])('%s se nesmí', (_form, code) => {
      expect(violationsWith('src/main.ts', code)).toEqual([
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts' }),
      ]);
    });

    it.each([
      ['složka hry', "import { GameScene } from './games/counting';"],
      ['index.ts', "import { GameScene } from './games/counting/index';"],
      [
        'relativní cesta oklikou',
        "import { GameScene } from './shared/../games/counting/index.ts';",
      ],
    ])('%s se smí', (_form, code) => {
      expect(violationsWith('src/main.ts', code)).toEqual([]);
    });
  });

  it('budoucí menu smí z hry importovat jen index.ts', () => {
    const inner = "import { x } from '../games/counting/logic/problems';";
    const entry = "import { GameScene } from '../games/counting';";

    expect(violationsWith('src/menu/MenuScene.ts', inner)).toEqual([
      expect.objectContaining({ rule: 'z hry se importuje jen její index.ts' }),
    ]);
    expect(violationsWith('src/menu/MenuScene.ts', entry)).toEqual([]);
  });

  it.each([
    ['logika Počítání', 'src/games/counting/logic/problems.ts', "import Phaser from 'phaser';"],
    ['sdílená logika', 'src/shared/logic/theme.ts', "import type Phaser from 'phaser';"],
    ['logika přes import()', 'src/shared/logic/theme.ts', "const p = import('phaser');"],
  ])('%s nesmí importovat Phaser', (_name, file, code) => {
    expect(violationsWith(file, code)).toEqual([
      expect.objectContaining({ rule: 'logika importuje Phaser' }),
    ]);
  });

  it('scéna hry Phaser importovat smí', () => {
    const code = "import Phaser from 'phaser';";
    expect(violationsWith('src/games/counting/scenes/GameScene.ts', code)).toEqual([]);
  });

  it('import zmíněný jen v komentáři se nepočítá', () => {
    const code = "// import { x } from '../../jina/x';\n/* import { y } from '../../jina/x'; */";
    expect(violationsWith('src/games/counting/logic/problems.ts', code)).toEqual([]);
  });

  it('každý test leží v tests/shared/ nebo v tests/games/<hra>/, aby ho pustily skripty po částech', () => {
    expect(TEST_FILES).toContain('tests/shared/settings.test.ts');
    expect(TEST_FILES).toContain('tests/games/counting/settings.test.ts');
    expect(misplacedTests(TEST_FILES)).toEqual([]);
  });

  it('test mimo tests/shared/ a tests/games/<hra>/ kontrola najde', () => {
    expect(
      misplacedTests([
        'tests/shared/a.test.ts',
        'tests/games/counting/b.test.ts',
        'tests/c.test.ts',
        'tests/games/d.test.ts',
        'tests/other/e.test.ts',
      ]),
    ).toEqual(['tests/c.test.ts', 'tests/games/d.test.ts', 'tests/other/e.test.ts']);
  });
});
