import { afterEach, describe, expect, it } from 'vitest';

import {
  commitAll,
  createRepo,
  moveRepoFile,
  removeRepo,
  removeRepoFile,
  runChangedTests,
  stageAll,
  writeRepoFile,
} from './changedTestsRepo.mjs';
import type { FakeScript } from './changedTestsRepo.mjs';

/**
 * Testy k #79, AC4, AC6 a AC8: skript kontroly `npm run test:changed`
 * (`tools/test/runChangedTests.ts`) se pouští v dočasném git repozitáři,
 * jehož `package.json` má místo testů podvržené skripty. Ty jen vypíšou, že
 * běžely, nebo selžou. Podle toho, které skripty běžely, se pozná, co
 * kontrola za změnu považuje (AC4, AC6), a jestli selhání testu kontrolu
 * zablokuje (AC8).
 */

/** Repozitáře vytvořené v testu, po testu se smažou. */
const repos: string[] = [];

function newRepo(failing: readonly FakeScript[] = []): string {
  const dir = createRepo(failing);
  repos.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of repos.splice(0)) {
    removeRepo(dir);
  }
});

/** Spouští se git a npm, test proto potřebuje víc času než běžný. */
const SLOW = 30_000;
/** Spouští se git a npm pro víc případů, test proto potřebuje víc času. */
const VERY_SLOW = 90_000;

interface RepoCase {
  readonly label: string;
  /** Podvržené skripty, které v repozitáři selžou. */
  readonly failing?: readonly FakeScript[];
  /** Co se v repozitáři po prvním commitu změní. */
  readonly change: (dir: string) => void;
}

interface ExpectedRun {
  readonly firstLine: string;
  readonly ran: readonly FakeScript[];
}

/** Ověří, že kontrola po změně v každém případu vypíše a pustí `expected`. */
function expectEachRun(cases: readonly RepoCase[], expected: ExpectedRun): void {
  for (const { label, failing, change } of cases) {
    const dir = newRepo(failing);
    change(dir);
    const run = runChangedTests(dir);
    expect(run.firstLine, label).toBe(expected.firstLine);
    expect(run.ran, label).toEqual(expected.ran);
  }
}

const MENU_RUN: ExpectedRun = { firstLine: 'Testy: menu, celek', ran: ['test:menu', 'test:whole'] };
const WHOLE_RUN: ExpectedRun = { firstLine: 'Testy: celek', ran: ['test:whole'] };

describe('#79 AC4: za změnu se počítá všechno od posledního commitu', () => {
  it(
    'každý druh změny souboru menu pustí testy menu',
    () => {
      expectEachRun(
        [
          {
            label: 'nepřipravená změna',
            change: (dir) => writeRepoFile(dir, 'src/menu/logic/menu.ts'),
          },
          {
            label: 'změna připravená ke commitu',
            change: (dir) => {
              writeRepoFile(dir, 'src/menu/logic/menu.ts');
              stageAll(dir);
            },
          },
          {
            label: 'nový nesledovaný soubor',
            change: (dir) => writeRepoFile(dir, 'src/menu/logic/newFile.ts'),
          },
          {
            label: 'nový nesledovaný test v nové složce',
            change: (dir) => writeRepoFile(dir, 'tests/menu/sub/new.test.ts'),
          },
          {
            label: 'smazaný soubor',
            change: (dir) => removeRepoFile(dir, 'tests/menu/menu.test.ts'),
          },
          {
            label: 'smazaný soubor připravený ke commitu',
            change: (dir) => {
              removeRepoFile(dir, 'tests/menu/menu.test.ts');
              stageAll(dir);
            },
          },
        ],
        MENU_RUN,
      );
    },
    VERY_SLOW,
  );

  it(
    'připravené i nepřipravené změny a přejmenování pustí testy všech dotčených částí',
    () => {
      expectEachRun(
        [
          {
            label: 'menu připravené ke commitu, sdílená část nepřipravená',
            change: (dir) => {
              writeRepoFile(dir, 'src/menu/logic/menu.ts');
              stageAll(dir);
              writeRepoFile(dir, 'src/shared/logic/settings.ts');
            },
          },
          {
            label: 'přejmenování z menu do sdílené části (stará i nová cesta)',
            change: (dir) =>
              moveRepoFile(dir, 'src/menu/logic/menu.ts', 'src/shared/logic/menu.ts'),
          },
        ],
        {
          firstLine: 'Testy: shared, menu, celek',
          ran: ['test:shared', 'test:menu', 'test:whole'],
        },
      );
    },
    VERY_SLOW,
  );

  it(
    'změna, která už je v commitu, se nepočítá',
    () => {
      expectEachRun(
        [
          {
            label: 'změna menu po commitu',
            change: (dir) => {
              writeRepoFile(dir, 'src/menu/logic/menu.ts');
              commitAll(dir);
            },
          },
        ],
        WHOLE_RUN,
      );
    },
    SLOW,
  );

  it(
    'nesledovaný soubor mimo části pustí všechny testy',
    () => {
      expectEachRun(
        [
          // Dokumentace od #117 pustí jen kontroly celku, proto nástroj a nastavení.
          { label: 'nový nástroj', change: (dir) => writeRepoFile(dir, 'tools/novy.mjs') },
          {
            label: 'změněné nastavení buildu',
            change: (dir) => writeRepoFile(dir, 'vite.config.ts'),
          },
        ],
        { firstLine: 'Testy: všechny', ran: ['test'] },
      );
    },
    VERY_SLOW,
  );
});

describe('#79 AC6: okrajové případy v repozitáři', () => {
  it(
    'bez změn nebo jen s ignorovanými soubory se pustí jen kontroly celku',
    () => {
      expectEachRun(
        [
          { label: 'bez změn', change: () => {} },
          {
            label: 'soubor v dist/',
            change: (dir) => writeRepoFile(dir, 'dist/assets/index.js'),
          },
          {
            label: 'jiný ignorovaný soubor ve složce menu',
            change: (dir) => {
              writeRepoFile(dir, '.gitignore', 'node_modules/\ndist/\n*.log\n');
              commitAll(dir);
              writeRepoFile(dir, 'src/menu/debug.log');
            },
          },
        ],
        WHOLE_RUN,
      );
    },
    VERY_SLOW,
  );
});

describe('#79 AC8: selhání testu kontrolu zablokuje', () => {
  it(
    'když všechny spuštěné testy projdou, kontrola skončí úspěchem',
    () => {
      const cases: readonly RepoCase[] = [
        { label: 'bez změn', change: () => {} },
        { label: 'změna menu', change: (dir) => writeRepoFile(dir, 'src/menu/logic/menu.ts') },
        { label: 'všechny testy', change: (dir) => writeRepoFile(dir, 'tools/build/plugin.ts') },
      ];
      for (const { label, change } of cases) {
        const dir = newRepo();
        change(dir);
        expect(runChangedTests(dir).status, label).toBe(0);
      }
    },
    VERY_SLOW,
  );

  it(
    'když kterýkoli spuštěný test selže, kontrola skončí neúspěchem a ukáže výstup testů',
    () => {
      const cases: readonly (RepoCase & { readonly failing: readonly FakeScript[] })[] = [
        {
          label: 'selžou testy menu',
          failing: ['test:menu'],
          change: (dir) => writeRepoFile(dir, 'src/menu/logic/menu.ts'),
        },
        {
          label: 'selžou kontroly celku, testy menu projdou',
          failing: ['test:whole'],
          change: (dir) => writeRepoFile(dir, 'src/menu/logic/menu.ts'),
        },
        {
          label: 'selžou kontroly celku bez změn',
          failing: ['test:whole'],
          change: () => {},
        },
        {
          label: 'selžou testy sdílené části při změně sdílené části a menu',
          failing: ['test:shared'],
          change: (dir) => {
            writeRepoFile(dir, 'src/shared/logic/settings.ts');
            writeRepoFile(dir, 'src/menu/logic/menu.ts');
          },
        },
        {
          label: 'selžou testy hry',
          failing: ['test:counting'],
          change: (dir) => writeRepoFile(dir, 'src/games/counting/index.ts'),
        },
        {
          label: 'selžou všechny testy po změně nástroje',
          failing: ['test'],
          change: (dir) => writeRepoFile(dir, 'tools/build/plugin.ts'),
        },
      ];
      for (const { label, failing, change } of cases) {
        const dir = newRepo(failing);
        change(dir);
        const run = runChangedTests(dir);
        expect(run.status, label).not.toBe(0);
        for (const script of failing) {
          expect(run.output, label).toContain(`CHYBA ${script}\n`);
        }
      }
    },
    VERY_SLOW,
  );
});
