/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

/**
 * Testy k #64, AC2: hranice mezi částmi projektu. Hra smí importovat jen
 * sama sebe a sdílenou část, sdílená část nic z her, menu ani `src/main.ts`
 * a zbytek `src/` z hry jen její vstup `src/games/<hra>/index.ts`. Logika
 * (`logic/`) nesmí importovat Phaser. Test projde zdrojové texty, u každého
 * importu dohledá skutečný cílový soubor a hlídá i to, aby každý test ležel
 * v `tests/shared/`, `tests/menu/` nebo v `tests/games/<hra>/`, kde ho pustí
 * skripty po částech.
 *
 * #67: přibývá menu (`src/menu/`) a seznam her vedle vstupu stránky
 * (`src/gameList.ts`). Menu smí importovat sdílenou část a seznam her, ale
 * žádný vnitřní soubor hry. Seznam her importuje hry, proto ho hry ani
 * sdílená část importovat nesmějí, stejně jako menu a `src/main.ts`.
 *
 * #67, rozhodnutí o `meta.ts`: menu potřebuje název, kategorii a symbol hry
 * dřív, než se hra stáhne. Proto smí zvenku kromě `index.ts` importovat ještě
 * `src/games/<hra>/meta.ts`. Ten sám smí importovat jen texty své hry
 * (`texts/`) a sdílenou část, nic dalšího z hry ani Phaser.
 *
 * #74 AC5: rozhodnutí o přístupu ke hrám (`src/shared/logic/gameAccess.ts`)
 * a místní zdroj stavu předplatného (`src/shared/logic/subscriptionSource.ts`)
 * nesmějí používat síť, úložiště ani adresu stránky a smějí importovat jen
 * sdílenou část (žádnou hru, menu, stránku ani balíček).
 *
 * #122: `meta.ts` smí navíc importovat obrázek dlaždice své hry
 * `./tile.webp`, bez dotazu. Jiný obrázek hry, obrázek s dotazem, obrázek
 * jiné hry ani přímý import `tile.webp` z menu nebo seznamu her se nesmí.
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
  return target.startsWith('src/menu/') || target === 'src/main.ts' || target === 'src/gameList.ts';
}

function isPhaser(specifier: string): boolean {
  return specifier === 'phaser' || specifier.startsWith('phaser/');
}

/** Pravidlo pro `meta.ts` hry (#67, #122). */
const META_RULE = 'meta.ts hry importuje z hry víc než texty a obrázek dlaždice';

/**
 * Co smí `meta.ts` importovat ze své hry: texty jazyků (#67) a obrázek
 * dlaždice `tile.webp` (#122), ten jen bez dotazu (`?raw`, `?url`…),
 * protože dotaz mění, co se do startovního souboru dostane.
 */
function isAllowedInMeta(target: string, specifier: string, game: string): boolean {
  if (target.startsWith(`src/games/${game}/texts/`)) {
    return true;
  }
  return target === `src/games/${game}/tile.webp` && !specifier.includes('?');
}

/** Které pravidlo import porušuje, nebo `null`, když je v pořádku. */
function brokenRule(file: string, specifier: string, target: string | null): string | null {
  if (file.split('/').includes('logic') && isPhaser(specifier)) {
    return 'logika importuje Phaser';
  }
  if (isGameMeta(file) && isPhaser(specifier)) {
    return 'meta.ts hry importuje Phaser';
  }
  if (target === null) {
    return null;
  }
  const game = gameOf(file);
  const targetGame = gameOf(target);
  if (isGameMeta(file) && game !== null && targetGame === game) {
    return isAllowedInMeta(target, specifier, game) ? null : META_RULE;
  }
  if (game !== null) {
    if (targetGame !== null && targetGame !== game) {
      return 'hra importuje jinou hru';
    }
    return isMenuOrPage(target) ? 'hra importuje menu nebo src/main.ts' : null;
  }
  if (file.startsWith('src/shared/') && (targetGame !== null || isMenuOrPage(target))) {
    return 'sdílená část importuje hru, menu nebo src/main.ts';
  }
  if (targetGame !== null && !isGameEntry(target, targetGame)) {
    return 'z hry se importuje jen její index.ts nebo meta.ts';
  }
  return null;
}

/** Vstupy hry, které smí importovat zbytek `src/`: celá hra a její údaje pro menu. */
function isGameEntry(target: string, game: string): boolean {
  return target === `src/games/${game}/index.ts` || target === `src/games/${game}/meta.ts`;
}

/** Je soubor `meta.ts` hry (údaje pro menu, #67)? */
function isGameMeta(file: string): boolean {
  return /^src\/games\/[^/]+\/meta\.ts$/.test(file);
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

/** Testy, které neleží v `tests/shared/`, `tests/menu/` ani v `tests/games/<hra>/`. */
function misplacedTests(testFiles: readonly string[]): string[] {
  return testFiles.filter(
    (file) =>
      !file.startsWith('tests/shared/') &&
      !file.startsWith('tests/menu/') &&
      !/^tests\/games\/[^/]+\//.test(file),
  );
}

/** Soubory hry Počítání a sdílené části pro umělé příklady. */
const FAKE_PROJECT: Record<string, string> = {
  'src/main.ts': "import { GameScene } from './games/counting';",
  'src/games/counting/index.ts': "export { GameScene } from './scenes/GameScene';",
  'src/games/counting/scenes/GameScene.ts':
    "import { gameAreaFor } from '../../../shared/logic/viewportLayout';",
  'src/games/counting/logic/problems.ts': "import { TEXT } from '../../../shared/logic/theme';",
  'src/games/counting/meta.ts': "import cs from './texts/cs';",
  'src/games/counting/texts/cs.ts': 'export default { title: 1 };',
  'src/games/jina/x.ts': 'export const x = 1;',
  'src/gameList.ts':
    "import { COUNTING_META } from './games/counting/meta';\nexport const GAMES = [() => import('./games/counting')];",
  'src/menu/logic/menu.ts': "import { findGame } from '../../shared/logic/gameRegistry';",
  'src/shared/logic/gameRegistry.ts': 'export const findGame = 1;',
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

  // #67: Počítání se od menu nespouští ze `src/main.ts`, ale ze seznamu her.
  it('kontrola opravdu prochází zdrojáky a vidí, že seznam her stahuje Počítání přes index.ts a menu zná jeho meta.ts', () => {
    expect(SOURCES['src/gameList.ts']).toBeDefined();
    const targets = importsOf(SOURCES['src/gameList.ts'] ?? '').map((specifier) =>
      targetOf('src/gameList.ts', specifier, SOURCES),
    );
    expect(targets).toContain('src/games/counting/index.ts');
    expect(targets).toContain('src/games/counting/meta.ts');
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
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
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
      expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
    ]);
    expect(violationsWith('src/menu/MenuScene.ts', entry)).toEqual([]);
  });

  describe('#67: menu a seznam her', () => {
    it('seznam her smí stáhnout hru přes její index.ts dynamickým import()', () => {
      expect(
        violationsWith('src/gameList.ts', "const later = import('./games/counting/index');"),
      ).toEqual([]);
    });

    it('seznam her smí importovat meta.ts hry (název, kategorie a symbol pro menu)', () => {
      expect(
        violationsWith('src/gameList.ts', "import { COUNTING_META } from './games/counting/meta';"),
      ).toEqual([]);
    });

    it.each([
      ['texty hry', "import cs from './games/counting/texts/cs';"],
      ['soubor s podobným jménem', "import { x } from './games/counting/metaData';"],
      ['meta.ts v podsložce', "import { x } from './games/counting/logic/meta';"],
    ])('seznam her nesmí kromě index.ts a meta.ts importovat ani %s', (_name, code) => {
      expect(violationsWith('src/gameList.ts', code)).toEqual([
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
      ]);
    });

    it('meta.ts hry smí importovat texty své hry a sdílenou část', () => {
      expect(
        violationsWith(
          'src/games/counting/meta.ts',
          "import type { GameMeta } from '../../shared/logic/gameRegistry';",
        ),
      ).toEqual([]);
    });

    it.each([
      ['logiku hry', "import { x } from './logic/problems';"],
      ['scénu hry', "import { GameScene } from './scenes/GameScene';"],
      ['vstup hry index.ts', "import { GameScene } from './index';"],
    ])('meta.ts hry nesmí importovat %s', (_name, code) => {
      expect(violationsWith('src/games/counting/meta.ts', code)).toEqual([
        expect.objectContaining({ rule: META_RULE }),
      ]);
    });

    it('#122: meta.ts hry smí importovat obrázek dlaždice své hry ./tile.webp', () => {
      expect(
        violationsWith('src/games/counting/meta.ts', "import tile from './tile.webp';"),
      ).toEqual([]);
    });

    it.each([
      ['obrázek ze složky pictures', "import cat from './pictures/cat.svg';"],
      ['ikonu ze složky icons', "import brush from './icons/brush.svg';"],
      ['obrázek dlaždice v jiném formátu', "import tile from './tile.png';"],
      ['tile.webp v podsložce', "import tile from './assets/tile.webp';"],
    ])('#122: meta.ts hry nesmí importovat jiný obrázek hry (%s)', (_name, code) => {
      expect(violationsWith('src/games/counting/meta.ts', code)).toEqual([
        expect.objectContaining({ rule: META_RULE }),
      ]);
    });

    it.each([
      ['?raw', "import tile from './tile.webp?raw';"],
      ['?url', "import tile from './tile.webp?url';"],
      ['?inline', "import tile from './tile.webp?inline';"],
      ['prázdný dotaz', "import tile from './tile.webp?';"],
    ])('#122: meta.ts hry nesmí importovat obrázek dlaždice s dotazem %s', (_name, code) => {
      expect(violationsWith('src/games/counting/meta.ts', code)).toEqual([
        expect.objectContaining({ rule: META_RULE }),
      ]);
    });

    it.each([
      ['meta.ts', 'src/games/counting/meta.ts', "import tile from '../jina/tile.webp';"],
      [
        'scéna',
        'src/games/counting/scenes/GameScene.ts',
        "import tile from '../../jina/tile.webp';",
      ],
    ])('#122: hra nesmí importovat obrázek dlaždice jiné hry (%s)', (_name, file, code) => {
      expect(violationsWith(file, code)).toEqual([
        expect.objectContaining({ rule: 'hra importuje jinou hru' }),
      ]);
    });

    it.each([
      ['menu', 'src/menu/logic/menu.ts', "import tile from '../../games/counting/tile.webp';"],
      ['seznam her', 'src/gameList.ts', "import tile from './games/counting/tile.webp';"],
      ['src/main.ts', 'src/main.ts', "import tile from './games/counting/tile.webp';"],
    ])('#122: %s nesmí importovat tile.webp hry přímo, jen přes meta.ts', (_name, file, code) => {
      expect(violationsWith(file, code)).toEqual([
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
      ]);
    });

    it('#122: kontrola vidí, že meta.ts každé hry v src/ importuje obrázek dlaždice ./tile.webp', () => {
      const metas = Object.keys(SOURCES).filter(isGameMeta);
      expect(metas.length).toBeGreaterThan(0);
      for (const file of metas) {
        expect(importsOf(SOURCES[file] ?? ''), file).toContain('./tile.webp');
      }
    });

    it('meta.ts hry nesmí importovat Phaser', () => {
      expect(violationsWith('src/games/counting/meta.ts', "import Phaser from 'phaser';")).toEqual([
        expect.objectContaining({ rule: 'meta.ts hry importuje Phaser' }),
      ]);
    });

    it('seznam her nesmí importovat vnitřní soubor hry', () => {
      expect(
        violationsWith('src/gameList.ts', "import { x } from './games/counting/logic/problems';"),
      ).toEqual([
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
      ]);
    });

    it.each([
      ['sdílenou část', "import { gameAreaFor } from '../../shared/logic/viewportLayout';"],
      ['seznam her', "import { GAMES } from '../../gameList';"],
      ['seznam her přes import type', "import type { GAMES } from '../../gameList';"],
    ])('menu smí importovat %s', (_name, code) => {
      expect(violationsWith('src/menu/logic/menu.ts', code)).toEqual([]);
    });

    it.each([
      ['vnitřní soubor hry', "import { x } from '../../games/counting/logic/problems';"],
      ['texty hry', "import cs from '../../games/counting/texts/cs';"],
      [
        'vnitřní soubor přes import()',
        "const later = import('../../games/counting/scenes/GameScene');",
      ],
    ])('menu nesmí importovat %s', (_name, code) => {
      expect(violationsWith('src/menu/logic/menu.ts', code)).toEqual([
        expect.objectContaining({ rule: 'z hry se importuje jen její index.ts nebo meta.ts' }),
      ]);
    });

    it('sdílená část nesmí importovat seznam her', () => {
      expect(
        violationsWith(
          'src/shared/logic/gameRegistry.ts',
          "import { GAMES } from '../../gameList';",
        ),
      ).toEqual([
        expect.objectContaining({ rule: 'sdílená část importuje hru, menu nebo src/main.ts' }),
      ]);
    });

    it('hra nesmí importovat seznam her', () => {
      expect(
        violationsWith(
          'src/games/counting/scenes/GameScene.ts',
          "import { GAMES } from '../../../gameList';",
        ),
      ).toEqual([expect.objectContaining({ rule: 'hra importuje menu nebo src/main.ts' })]);
    });

    it('logika menu nesmí importovat Phaser', () => {
      expect(violationsWith('src/menu/logic/menu.ts', "import Phaser from 'phaser';")).toEqual([
        expect.objectContaining({ rule: 'logika importuje Phaser' }),
      ]);
    });
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

  it('každý test leží v tests/shared/, tests/menu/ nebo v tests/games/<hra>/, aby ho pustily skripty po částech', () => {
    expect(TEST_FILES).toContain('tests/shared/settings.test.ts');
    expect(TEST_FILES).toContain('tests/menu/gameRegistry.test.ts');
    expect(TEST_FILES).toContain('tests/games/counting/settings.test.ts');
    expect(misplacedTests(TEST_FILES)).toEqual([]);
  });

  it('test mimo tests/shared/, tests/menu/ a tests/games/<hra>/ kontrola najde', () => {
    expect(
      misplacedTests([
        'tests/shared/a.test.ts',
        'tests/menu/f.test.ts',
        'tests/games/counting/b.test.ts',
        'tests/c.test.ts',
        'tests/games/d.test.ts',
        'tests/other/e.test.ts',
      ]),
    ).toEqual(['tests/c.test.ts', 'tests/games/d.test.ts', 'tests/other/e.test.ts']);
  });
});

/** Soubory, které rozhodují o odemčení her a dodávají stav předplatného (#74). */
const ACCESS_FILES = ['src/shared/logic/gameAccess.ts', 'src/shared/logic/subscriptionSource.ts'];

/**
 * Co rozhodnutí o přístupu ani místní zdroj nesmějí použít: síť, úložiště,
 * adresu stránky (přepnutí zámku adresou) a spouštění kódu z řetězců.
 */
const FORBIDDEN_IN_ACCESS: ReadonlyArray<readonly [string, RegExp]> = [
  ['fetch', /\bfetch\b/],
  ['XMLHttpRequest', /\bXMLHttpRequest\b/],
  ['WebSocket', /\bWebSocket\b/],
  ['EventSource', /\bEventSource\b/],
  ['sendBeacon', /\bsendBeacon\b/],
  ['navigator', /\bnavigator\b/],
  ['Worker', /\b(?:Shared|Service)?Worker\b/],
  ['adresa serveru', /\b(?:https?|wss?):\/\//],
  ['localStorage', /\blocalStorage\b/],
  ['sessionStorage', /\bsessionStorage\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['cookie', /\bcookie\b/],
  ['adresa stránky', /\blocation\b/],
  ['import.meta.env', /\bimport\.meta\b/],
  ['eval', /\beval\b|\bnew\s+Function\b/],
];

/** Porušení pravidel #74 AC5 v souborech přístupu z `files`. */
function accessViolations(files: Record<string, string>): Violation[] {
  return ACCESS_FILES.flatMap((file) => {
    const text = files[file];
    if (text === undefined) {
      return [{ file, specifier: '', rule: 'soubor přístupu chybí' }];
    }
    const code = withoutComments(text);
    const forbidden = FORBIDDEN_IN_ACCESS.filter(([, pattern]) => pattern.test(code)).map(
      ([name]) => ({ file, specifier: name, rule: 'přístup používá síť, úložiště nebo adresu' }),
    );
    const imports = importsOf(text)
      .filter((specifier) => {
        const target = targetOf(file, specifier, files);
        return target === null || !target.startsWith('src/shared/');
      })
      .map((specifier) => ({ file, specifier, rule: 'přístup importuje něco mimo sdílenou část' }));
    return [...forbidden, ...imports];
  });
}

/** Umělý projekt se soubory přístupu bez porušení. */
const FAKE_ACCESS: Record<string, string> = {
  ...FAKE_PROJECT,
  'src/shared/logic/gameAccess.ts': 'export const isGameUnlocked = 1;',
  'src/shared/logic/subscriptionSource.ts':
    "import type { SubscriptionSource } from './gameAccess';\nexport const ALL = 1;",
};

describe('#74 AC5: rozhodnutí o přístupu ani místní zdroj nic neposílají ven', () => {
  it('rozhodnutí o přístupu a místní zdroj nepoužívají síť ani úložiště a neimportují hru ani menu', () => {
    for (const file of ACCESS_FILES) {
      expect(SOURCES[file], file).toBeDefined();
    }
    expect(accessViolations(SOURCES)).toEqual([]);
  });

  it('umělé soubory přístupu bez porušení projdou', () => {
    expect(accessViolations(FAKE_ACCESS)).toEqual([]);
  });

  it.each([
    ['fetch', 'fetch("/stav");'],
    ['XMLHttpRequest', 'new XMLHttpRequest();'],
    ['WebSocket', 'new WebSocket(adresa);'],
    ['sendBeacon', 'navigator.sendBeacon(adresa);'],
    ['adresa serveru', "const url = 'https://obchod.example/stav';"],
    ['localStorage', "localStorage.setItem('predplatne', 'ne');"],
    ['adresa stránky', "const zamceno = location.search.includes('zamek');"],
    ['import.meta.env', 'const vyvoj = import.meta.env.DEV;'],
  ])('kontrola najde %s v místním zdroji', (_name, code) => {
    const file = 'src/shared/logic/subscriptionSource.ts';
    const files = { ...FAKE_ACCESS, [file]: `${FAKE_ACCESS[file] ?? ''}\n${code}` };
    expect(accessViolations(files)).toContainEqual(
      expect.objectContaining({ file, rule: 'přístup používá síť, úložiště nebo adresu' }),
    );
  });

  it.each([
    ['hru', "import { x } from '../../games/counting';"],
    ['menu', "import { menu } from '../../menu/logic/menu';"],
    ['seznam her', "import { GAMES } from '../../gameList';"],
    ['balíček', "import Phaser from 'phaser';"],
    ['import()', "const later = import('../../games/counting/meta');"],
  ])('kontrola najde import %s v rozhodnutí o přístupu', (_name, code) => {
    const file = 'src/shared/logic/gameAccess.ts';
    const files = { ...FAKE_ACCESS, [file]: `${FAKE_ACCESS[file] ?? ''}\n${code}` };
    expect(accessViolations(files)).toContainEqual(
      expect.objectContaining({ file, rule: 'přístup importuje něco mimo sdílenou část' }),
    );
  });

  it('zmínka o síti jen v komentáři se nepočítá', () => {
    const file = 'src/shared/logic/gameAccess.ts';
    const files = {
      ...FAKE_ACCESS,
      [file]: '/** Nic neposílá přes fetch. */\nexport const x = 1;',
    };
    expect(accessViolations(files)).toEqual([]);
  });
});
