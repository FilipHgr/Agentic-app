import { describe, expect, it } from 'vitest';

import { planChangedTests } from '../../tools/test/changedTests';
import type { ChangedTestsPlan } from '../../tools/test/changedTests';

/**
 * Testy k #79: při práci se pouštějí jen testy dotčených částí (sdílená část,
 * menu, jednotlivé hry) a vždy kontroly celku (test hranic a kontrola
 * natvrdo napsaných textů, skript `test:whole`). Změna mimo všechny části
 * pustí všechny testy (`npm test`). Tady se ověřuje čistá logika: ze
 * seznamu změněných cest a skriptů z `package.json` plyne první řádek
 * výstupu a skripty, které se pustí. Jak se změny zjistí z gitu a jak se
 * skripty spustí, ověřuje `changedTestsScript.test.ts`.
 *
 * Každé pravidlo je jeden test, který projde tabulku případů v cyklu.
 * Popis případu je v `expect`, aby selhání ukázalo, který případ selhal.
 */

/** Skripty jako v `package.json`, s druhou hrou `shapes` kvůli AC2. */
const SCRIPTS: Readonly<Record<string, string>> = {
  test: 'vitest run',
  'test:shared': 'vitest run tests/shared/',
  'test:menu': 'vitest run tests/menu/ tests/shared/boundaries.test.ts',
  'test:counting': 'vitest run tests/games/counting/ tests/shared/boundaries.test.ts',
  'test:shapes': 'vitest run tests/games/shapes/ tests/shared/boundaries.test.ts',
  'test:whole': 'vitest run tests/shared/boundaries.test.ts tests/shared/hardcodedTexts.test.ts',
};

const ALL_TESTS: ChangedTestsPlan = { headline: 'Testy: všechny', scripts: ['test'] };

interface PlanCase {
  readonly label: string;
  readonly paths: readonly string[];
}

/** Ověří, že každý případ z tabulky dá stejný plán `expected`. */
function expectEachPlan(
  cases: readonly PlanCase[],
  expected: ChangedTestsPlan,
  scripts: Readonly<Record<string, string>> = SCRIPTS,
): void {
  for (const { label, paths } of cases) {
    expect(planChangedTests(paths, scripts), label).toEqual(expected);
  }
}

describe('#79 AC1: změna jen v menu', () => {
  it('změna zdrojových souborů nebo testů menu pustí jen testy menu a kontroly celku', () => {
    expectEachPlan(
      [
        { label: 'zdrojový soubor menu', paths: ['src/menu/logic/menu.ts'] },
        { label: 'test menu', paths: ['tests/menu/menuLayout.test.ts'] },
        { label: 'pomocný soubor testů menu', paths: ['tests/menu/menuFixtures.ts'] },
        {
          label: 'zdroják i test menu',
          paths: ['src/menu/ui/menuScene.ts', 'tests/menu/menuLayout.test.ts'],
        },
        { label: 'texty menu', paths: ['src/menu/texts/cs.ts'] },
      ],
      { headline: 'Testy: menu, celek', scripts: ['test:menu', 'test:whole'] },
    );
  });
});

describe('#79 AC2: změna jen v hrách', () => {
  it('změna zdrojových souborů nebo testů jedné hry pustí jen testy té hry a kontroly celku', () => {
    expectEachPlan(
      [
        { label: 'zdrojový soubor hry', paths: ['src/games/counting/logic/problems.ts'] },
        { label: 'vstup hry', paths: ['src/games/counting/index.ts'] },
        { label: 'test hry', paths: ['tests/games/counting/problems.test.ts'] },
        {
          label: 'snímek testu hry',
          paths: ['tests/games/counting/__snapshots__/x.test.ts.snap'],
        },
      ],
      { headline: 'Testy: counting, celek', scripts: ['test:counting', 'test:whole'] },
    );
  });

  it('změna dvou her pustí testy obou, hry abecedně podle id', () => {
    expectEachPlan(
      [
        {
          label: 'zdroják jedné a test druhé hry',
          paths: ['src/games/shapes/index.ts', 'tests/games/counting/problems.test.ts'],
        },
        {
          label: 'zdrojáky obou her v obráceném pořadí',
          paths: ['src/games/shapes/a.ts', 'src/games/counting/a.ts'],
        },
      ],
      {
        headline: 'Testy: counting, shapes, celek',
        scripts: ['test:counting', 'test:shapes', 'test:whole'],
      },
    );
  });
});

describe('#79 AC3: změna sdílené části a víc částí naráz', () => {
  it('změna zdrojových souborů nebo testů sdílené části pustí jen její testy a kontroly celku', () => {
    expectEachPlan(
      [
        { label: 'zdrojový soubor sdílené části', paths: ['src/shared/logic/gameAccess.ts'] },
        { label: 'texty sdílené části', paths: ['src/shared/texts/cs.ts'] },
        { label: 'test sdílené části', paths: ['tests/shared/gameAccess.test.ts'] },
        { label: 'pomocný soubor testů sdílené části', paths: ['tests/shared/profileFixtures.ts'] },
      ],
      { headline: 'Testy: shared, celek', scripts: ['test:shared', 'test:whole'] },
    );
  });

  it('změna víc částí pustí testy všech dotčených částí', () => {
    const cases: readonly (PlanCase & { readonly expected: ChangedTestsPlan })[] = [
      {
        label: 'sdílená část a menu',
        paths: ['src/menu/logic/menu.ts', 'src/shared/logic/settings.ts'],
        expected: {
          headline: 'Testy: shared, menu, celek',
          scripts: ['test:shared', 'test:menu', 'test:whole'],
        },
      },
      {
        label: 'menu a hra',
        paths: ['src/games/counting/a.ts', 'tests/menu/a.test.ts'],
        expected: {
          headline: 'Testy: menu, counting, celek',
          scripts: ['test:menu', 'test:counting', 'test:whole'],
        },
      },
      {
        label: 'sdílená část, menu a dvě hry',
        paths: [
          'src/games/shapes/a.ts',
          'src/shared/a.ts',
          'src/games/counting/a.ts',
          'src/menu/a.ts',
        ],
        expected: {
          headline: 'Testy: shared, menu, counting, shapes, celek',
          scripts: ['test:shared', 'test:menu', 'test:counting', 'test:shapes', 'test:whole'],
        },
      },
    ];
    for (const { label, paths, expected } of cases) {
      expect(planChangedTests(paths, SCRIPTS), label).toEqual(expected);
    }
  });

  it('víc souborů jedné části pustí její testy jen jednou', () => {
    expectEachPlan(
      [
        {
          label: 'tři soubory menu a dva soubory hry',
          paths: [
            'src/menu/logic/menu.ts',
            'tests/menu/menuLayout.test.ts',
            'src/menu/ui/menuScene.ts',
            'src/games/counting/a.ts',
            'tests/games/counting/a.test.ts',
          ],
        },
        {
          label: 'stejná cesta dvakrát (přejmenování tam a zpět)',
          paths: ['src/menu/logic/menu.ts', 'src/menu/logic/menu.ts', 'src/games/counting/a.ts'],
        },
      ],
      {
        headline: 'Testy: menu, counting, celek',
        scripts: ['test:menu', 'test:counting', 'test:whole'],
      },
    );
  });
});

describe('#79 AC5: změna mimo všechny části pustí všechny testy', () => {
  it('změna nastavení, nástrojů, vstupů stránky, veřejných souborů nebo dokumentace pustí všechny testy', () => {
    expectEachPlan(
      [
        { label: 'nastavení projektu', paths: ['package.json'] },
        { label: 'závislosti', paths: ['package-lock.json'] },
        { label: 'konfigurace TypeScriptu', paths: ['tsconfig.json'] },
        { label: 'konfigurace buildu', paths: ['vite.config.ts'] },
        { label: 'konfigurace lintu', paths: ['eslint.config.js'] },
        { label: 'formátování', paths: ['.prettierrc'] },
        { label: 'nasazení', paths: ['wrangler.jsonc'] },
        { label: 'CI', paths: ['.github/workflows/ci.yml'] },
        { label: 'nástroj', paths: ['tools/voice/make_voice.mjs'] },
        { label: 'nástroj buildu', paths: ['tools/build/gameImportRetry.ts'] },
        { label: 'sama kontrola změn', paths: ['tools/test/changedTests.ts'] },
        { label: 'seznam her', paths: ['src/gameList.ts'] },
        { label: 'vstup stránky', paths: ['src/main.ts'] },
        { label: 'stránka', paths: ['index.html'] },
        { label: 'veřejný soubor', paths: ['public/licence.txt'] },
        { label: 'nahrávka', paths: ['public/voice/cs/counting/guide-1.mp3'] },
        { label: 'dokumentace', paths: ['docs/rozhodnuti.md'] },
        { label: 'pravidla projektu', paths: ['CLAUDE.md'] },
        { label: 'popis projektu', paths: ['README.md'] },
        { label: 'skill', paths: ['.claude/skills/novy-ukol/SKILL.md'] },
        { label: 'soubor v kořeni testů mimo části', paths: ['tests/setup.ts'] },
        { label: 'soubor ve složce her mimo hru', paths: ['src/games/README.md'] },
        {
          label: 'změna mimo části spolu se změnou menu a sdílené části',
          paths: ['src/menu/logic/menu.ts', 'package.json', 'src/shared/logic/settings.ts'],
        },
      ],
      ALL_TESTS,
    );
  });
});

describe('#79 AC6: okrajové případy', () => {
  it('bez změn se pustí jen kontroly celku', () => {
    expectEachPlan([{ label: 'prázdný seznam změn', paths: [] }], {
      headline: 'Testy: celek',
      scripts: ['test:whole'],
    });
  });

  it('změna hry bez vlastního testovacího skriptu pustí všechny testy', () => {
    expectEachPlan(
      [
        { label: 'zdroják hry bez skriptu', paths: ['src/games/puzzle/index.ts'] },
        { label: 'test hry bez skriptu', paths: ['tests/games/puzzle/puzzle.test.ts'] },
        {
          label: 'hra bez skriptu spolu se hrou se skriptem',
          paths: ['src/games/puzzle/a.ts', 'src/games/counting/a.ts'],
        },
      ],
      ALL_TESTS,
    );
  });

  it('o hře rozhoduje skript, který zrovna v package.json je', () => {
    const withPuzzle = { ...SCRIPTS, 'test:puzzle': 'vitest run tests/games/puzzle/' };
    expectEachPlan(
      [{ label: 'hra puzzle s přidaným skriptem test:puzzle', paths: ['src/games/puzzle/a.ts'] }],
      { headline: 'Testy: puzzle, celek', scripts: ['test:puzzle', 'test:whole'] },
      withPuzzle,
    );
  });
});

describe('#79 AC7: první řádek výstupu', () => {
  it('první řádek má přesný tvar podle toho, co se pouští', () => {
    const cases: readonly (PlanCase & { readonly headline: string })[] = [
      {
        label: 'pořadí shared, menu, hry abecedně a nakonec celek',
        paths: [
          'src/games/shapes/index.ts',
          'tests/menu/menuLayout.test.ts',
          'src/games/counting/index.ts',
          'src/shared/logic/settings.ts',
        ],
        headline: 'Testy: shared, menu, counting, shapes, celek',
      },
      {
        label: 'příklad ze zadání',
        paths: ['src/games/counting/a.ts', 'src/menu/a.ts', 'src/shared/a.ts'],
        headline: 'Testy: shared, menu, counting, celek',
      },
      { label: 'běh všech testů', paths: ['package.json'], headline: 'Testy: všechny' },
      { label: 'bez změn', paths: [], headline: 'Testy: celek' },
    ];
    for (const { label, paths, headline } of cases) {
      expect(planChangedTests(paths, SCRIPTS).headline, label).toBe(headline);
    }
  });
});
