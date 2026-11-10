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
 * #80: pomalé testy rozpoznávání psaní (`*.slow.test.ts`) jsou ve vlastní
 * skupině se skriptem `test:recognition`. Kontrola změn ji pustí jen při
 * změně rozpoznávání, jeho vzorů, pomůcek se vzorky nebo testů skupiny.
 * V prvním řádku je skupina „rozpoznávání“ hned za svou hrou.
 *
 * #117: změna jen dokumentace (`docs/**`, `*.md` kdekoli) nebo nastavení
 * agentů (`.claude/**` kromě `.claude/hooks/`) pustí jen kontroly celku
 * a s jinými změnami se na výběru testů nepodepíše. Změna hooků pustí
 * všechny testy, protože hooky jsou ochrana. Případy dokumentace, které
 * dřív pouštěly všechny testy (#79 AC5, #80 AC5), jsou proto v testech #117.
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
  'test:recognition': 'vitest run .slow.test.ts',
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
  it('změna nastavení, nástrojů, vstupů stránky nebo veřejných souborů pustí všechny testy', () => {
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
        { label: 'soubor v kořeni testů mimo části', paths: ['tests/setup.ts'] },
        { label: 'soubor ve složce her mimo hru', paths: ['src/games/registry.ts'] },
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

/** Testy Počítání, hned za nimi skupina rozpoznávání a kontroly celku (#80). */
const COUNTING_WITH_RECOGNITION: ChangedTestsPlan = {
  headline: 'Testy: counting, rozpoznávání, celek',
  scripts: ['test:counting', 'test:recognition', 'test:whole'],
};

const COUNTING_ONLY: ChangedTestsPlan = {
  headline: 'Testy: counting, celek',
  scripts: ['test:counting', 'test:whole'],
};

describe('#80 AC5: změna rozpoznávání pustí skupinu rozpoznávání', () => {
  it('změna rozpoznávání, jeho vzorů, pomůcek se vzorky nebo testů skupiny pustí testy Počítání a skupinu', () => {
    expectEachPlan(
      [
        {
          label: 'rozpoznávání číslic',
          paths: ['src/games/counting/logic/digitRecognition.ts'],
        },
        { label: 'vzory rozpoznávání', paths: ['src/games/counting/logic/digitTemplates.ts'] },
        { label: 'pomůcka se vzorky', paths: ['tests/games/counting/penDigits.ts'] },
        { label: 'pomůcka s nečíslicemi', paths: ['tests/games/counting/notDigitStrokes.ts'] },
        {
          label: 'test skupiny digitRecognition',
          paths: ['tests/games/counting/digitRecognition.slow.test.ts'],
        },
        {
          label: 'test skupiny phonePortraitRecognition',
          paths: ['tests/games/counting/phonePortraitRecognition.slow.test.ts'],
        },
        {
          label: 'test skupiny twoDigitRecognition',
          paths: ['tests/games/counting/twoDigitRecognition.slow.test.ts'],
        },
        {
          label: 'víc souborů rozpoznávání naráz pustí skupinu jen jednou',
          paths: [
            'src/games/counting/logic/digitRecognition.ts',
            'src/games/counting/logic/digitTemplates.ts',
            'tests/games/counting/penDigits.ts',
            'tests/games/counting/digitRecognition.slow.test.ts',
          ],
        },
      ],
      COUNTING_WITH_RECOGNITION,
    );
  });

  it('změna nástroje na vzory nebo sady vzorků pustí všechny testy', () => {
    expectEachPlan(
      [
        { label: 'nástroj, který vytváří vzory', paths: ['tools/recognition/make_templates.mjs'] },
        { label: 'testovací část sady vzorků', paths: ['data/pendigits/pendigits.tes'] },
        { label: 'trénovací část sady vzorků', paths: ['data/pendigits/pendigits.tra'] },
        {
          label: 'sada vzorků spolu s rozpoznáváním',
          paths: ['data/pendigits/pendigits.tes', 'src/games/counting/logic/digitRecognition.ts'],
        },
      ],
      ALL_TESTS,
    );
  });

  it('jiná změna v Počítání skupinu rozpoznávání nepustí', () => {
    expectEachPlan(
      [
        { label: 'příklady', paths: ['src/games/counting/logic/problems.ts'] },
        { label: 'hvězdičky', paths: ['src/games/counting/logic/stars.ts'] },
        { label: 'vstup hry', paths: ['src/games/counting/index.ts'] },
        { label: 'texty hry', paths: ['src/games/counting/texts/cs.ts'] },
        { label: 'scéna hry', paths: ['src/games/counting/scenes/GameScene.ts'] },
        { label: 'psaní do dvou okének', paths: ['src/games/counting/logic/twoBoxWriting.ts'] },
        { label: 'kolo psaní', paths: ['src/games/counting/logic/writingRound.ts'] },
        { label: 'rozložení podle zařízení', paths: ['src/games/counting/logic/deviceLayout.ts'] },
        { label: 'rozložení obrazovky', paths: ['src/games/counting/logic/screenLayout.ts'] },
        { label: 'rychlý test Počítání', paths: ['tests/games/counting/writingLayout.test.ts'] },
        { label: 'rychlý test psaní', paths: ['tests/games/counting/twoBoxWriting.test.ts'] },
        {
          label: 'snímek testu Počítání',
          paths: ['tests/games/counting/__snapshots__/x.test.ts.snap'],
        },
      ],
      COUNTING_ONLY,
    );
  });

  it('změna v menu nebo jen ve sdílené části skupinu rozpoznávání nepustí', () => {
    const cases: readonly (PlanCase & { readonly expected: ChangedTestsPlan })[] = [
      {
        label: 'menu',
        paths: ['src/menu/logic/menu.ts', 'tests/menu/menuLayout.test.ts'],
        expected: { headline: 'Testy: menu, celek', scripts: ['test:menu', 'test:whole'] },
      },
      {
        label: 'sdílená část, i rozložení podle okna',
        paths: ['src/shared/logic/viewportLayout.ts', 'tests/shared/deviceLayout.test.ts'],
        expected: { headline: 'Testy: shared, celek', scripts: ['test:shared', 'test:whole'] },
      },
      {
        label: 'menu a sdílená část',
        paths: ['src/menu/logic/menu.ts', 'src/shared/logic/settings.ts'],
        expected: {
          headline: 'Testy: shared, menu, celek',
          scripts: ['test:shared', 'test:menu', 'test:whole'],
        },
      },
    ];
    for (const { label, paths, expected } of cases) {
      expect(planChangedTests(paths, SCRIPTS), label).toEqual(expected);
    }
  });
});

describe('#80 AC6: okrajové případy skupiny rozpoznávání', () => {
  it('nový soubor označený jako pomalý pustí skupinu bez dalšího zápisu', () => {
    expectEachPlan(
      [
        {
          label: 'nový pomalý soubor Počítání',
          paths: ['tests/games/counting/brandNewRecognition.slow.test.ts'],
        },
        {
          label: 'nový pomalý soubor v podsložce testů Počítání',
          paths: ['tests/games/counting/recognition/strokes.slow.test.ts'],
        },
      ],
      COUNTING_WITH_RECOGNITION,
    );
  });

  it('změna hry i rozpoznávání pustí testy Počítání i skupinu, skupina hned za svou hrou', () => {
    const cases: readonly (PlanCase & { readonly expected: ChangedTestsPlan })[] = [
      {
        label: 'příklady a rozpoznávání',
        paths: [
          'src/games/counting/logic/problems.ts',
          'src/games/counting/logic/digitRecognition.ts',
        ],
        expected: COUNTING_WITH_RECOGNITION,
      },
      {
        label: 'rychlý test Počítání a pomůcka se vzorky v obráceném pořadí',
        paths: ['tests/games/counting/penDigits.ts', 'tests/games/counting/writingLayout.test.ts'],
        expected: COUNTING_WITH_RECOGNITION,
      },
      {
        label: 'sdílená část, menu, Počítání a vzory rozpoznávání',
        paths: ['src/games/counting/logic/digitTemplates.ts', 'src/menu/a.ts', 'src/shared/a.ts'],
        expected: {
          headline: 'Testy: shared, menu, counting, rozpoznávání, celek',
          scripts: ['test:shared', 'test:menu', 'test:counting', 'test:recognition', 'test:whole'],
        },
      },
      {
        label: 'druhá hra a rozpoznávání: skupina za Počítáním, ne na konci',
        paths: ['src/games/shapes/a.ts', 'src/games/counting/logic/digitRecognition.ts'],
        expected: {
          headline: 'Testy: counting, rozpoznávání, shapes, celek',
          scripts: ['test:counting', 'test:recognition', 'test:shapes', 'test:whole'],
        },
      },
    ];
    for (const { label, paths, expected } of cases) {
      expect(planChangedTests(paths, SCRIPTS), label).toEqual(expected);
    }
  });
});

/** Jen kontroly celku, stejně jako bez změn (#79 AC6). */
const WHOLE_ONLY: ChangedTestsPlan = { headline: 'Testy: celek', scripts: ['test:whole'] };

/** Změněná dokumentace a nastavení agentů z AC3 (#117). */
const DOCUMENTATION_CASES: readonly PlanCase[] = [
  { label: 'deník rozhodnutí', paths: ['docs/rozhodnuti.md'] },
  { label: 'jiný soubor v docs', paths: ['docs/navrhy/menu.png'] },
  { label: 'popis projektu', paths: ['README.md'] },
  { label: 'šablona issue', paths: ['.github/ISSUE_TEMPLATE/user-story.md'] },
  { label: 'popis ve složce her', paths: ['src/games/README.md'] },
  { label: 'popis sady vzorků', paths: ['data/pendigits/README.md'] },
  { label: 'agent', paths: ['.claude/agents/x.md'] },
  { label: 'skill', paths: ['.claude/skills/novy-ukol/SKILL.md'] },
];

describe('#117 AC3: změna jen dokumentace pustí jen kontroly celku', () => {
  it('změna jen dokumentace, souborů .md nebo nastavení agentů pustí jen kontroly celku', () => {
    expectEachPlan(
      [
        ...DOCUMENTATION_CASES,
        {
          label: 'víc souborů dokumentace a nastavení agentů naráz',
          paths: ['docs/rozhodnuti.md', '.claude/skills/novy-ukol/SKILL.md', 'README.md'],
        },
      ],
      WHOLE_ONLY,
    );
  });

  it('dokumentace spolu se změnou části pustí stejné testy jako změna té části samotná', () => {
    const partChanges: readonly (PlanCase & { readonly expected: ChangedTestsPlan })[] = [
      {
        label: 'menu',
        paths: ['src/menu/logic/menu.ts'],
        expected: { headline: 'Testy: menu, celek', scripts: ['test:menu', 'test:whole'] },
      },
      {
        label: 'sdílená část',
        paths: ['src/shared/logic/settings.ts'],
        expected: { headline: 'Testy: shared, celek', scripts: ['test:shared', 'test:whole'] },
      },
      {
        label: 'hra',
        paths: ['src/games/counting/logic/problems.ts'],
        expected: COUNTING_ONLY,
      },
      {
        label: 'rozpoznávání',
        paths: ['src/games/counting/logic/digitRecognition.ts'],
        expected: COUNTING_WITH_RECOGNITION,
      },
      {
        label: 'sdílená část a menu',
        paths: ['src/menu/a.ts', 'src/shared/a.ts'],
        expected: {
          headline: 'Testy: shared, menu, celek',
          scripts: ['test:shared', 'test:menu', 'test:whole'],
        },
      },
    ];
    for (const partChange of partChanges) {
      for (const documentation of DOCUMENTATION_CASES) {
        const docsFirst = [...documentation.paths, ...partChange.paths];
        const docsLast = [...partChange.paths, ...documentation.paths];
        expect(
          planChangedTests(docsFirst, SCRIPTS),
          `${documentation.label} před změnou: ${partChange.label}`,
        ).toEqual(partChange.expected);
        expect(
          planChangedTests(docsLast, SCRIPTS),
          `${documentation.label} za změnou: ${partChange.label}`,
        ).toEqual(partChange.expected);
      }
    }
  });

  it('dokumentace spolu se změnou mimo části dál pustí všechny testy', () => {
    expectEachPlan(
      [
        { label: 'deník a nastavení projektu', paths: ['docs/rozhodnuti.md', 'package.json'] },
        { label: 'nastavení buildu a pravidla projektu', paths: ['vite.config.ts', 'CLAUDE.md'] },
        {
          label: 'skill a nástroj',
          paths: ['.claude/skills/novy-ukol/SKILL.md', 'tools/voice/make_voice.mjs'],
        },
        {
          label: 'popis a sada vzorků',
          paths: ['data/pendigits/README.md', 'data/pendigits/pendigits.tes'],
        },
        {
          label: 'deník, menu a CI',
          paths: ['docs/rozhodnuti.md', 'src/menu/a.ts', '.github/workflows/ci.yml'],
        },
        {
          label: 'agent a hra bez skriptu',
          paths: ['.claude/agents/x.md', 'src/games/puzzle/a.ts'],
        },
      ],
      ALL_TESTS,
    );
  });

  it('soubor, který jen připomíná dokumentaci, pustí dál všechny testy', () => {
    expectEachPlan(
      [
        { label: 'složka podobná docs', paths: ['docsx/a.md.ts'] },
        { label: 'soubor docs v kořeni bez složky', paths: ['docs'] },
        { label: 'soubor s .md uprostřed názvu', paths: ['tools/readme.md.mjs'] },
        { label: 'složka podobná .claude', paths: ['.claudex/settings.json'] },
      ],
      ALL_TESTS,
    );
  });
});

describe('#117 AC4: změna hooků pustí všechny testy', () => {
  it('změna v hoocích pustí všechny testy, i spolu s dokumentací nebo částí', () => {
    expectEachPlan(
      [
        { label: 'hook před commitem', paths: ['.claude/hooks/pre-commit.sh'] },
        { label: 'hook v podsložce', paths: ['.claude/hooks/lib/run.mjs'] },
        // V nastavení Claude Code je, které hooky se spouštějí, proto patří k hookům.
        { label: 'nastavení Claude Code', paths: ['.claude/settings.json'] },
        { label: 'místní nastavení Claude Code', paths: ['.claude/settings.local.json'] },
        // CLAUDE.md čte test hlasu jazyků (voiceScriptLanguages.test.ts).
        { label: 'pravidla projektu čtená testem', paths: ['CLAUDE.md'] },
        { label: 'pravidla projektu a deník', paths: ['CLAUDE.md', 'docs/rozhodnuti.md'] },
        { label: 'popis hooků', paths: ['.claude/hooks/README.md'] },
        { label: 'hook a deník', paths: ['docs/rozhodnuti.md', '.claude/hooks/stop.sh'] },
        {
          label: 'hook a nastavení Claude Code',
          paths: ['.claude/settings.json', '.claude/hooks/stop.sh'],
        },
        { label: 'hook a menu', paths: ['src/menu/a.ts', '.claude/hooks/pre-commit.sh'] },
      ],
      ALL_TESTS,
    );
  });
});

/**
 * #119 (otázka 3): pomalé testy Omalovánek (matice těsných tahů,
 * `tests/games/coloring/*.slow.test.ts`) jsou ve vlastní skupině se
 * skriptem `test:coloring:slow`. `test:coloring` je vynechává, kontrola
 * změn je pustí hned za testy Omalovánek jen při změně ukládání obrázku
 * (`colorLayerCode.ts`, `savedPicture.ts`), pomůcek matice nebo testů
 * skupiny. V prvním řádku je skupina „ukládání obrázku“.
 */
const SCRIPTS_WITH_COLORING: Readonly<Record<string, string>> = {
  ...SCRIPTS,
  'test:coloring':
    "vitest run tests/games/coloring/ tests/shared/boundaries.test.ts --exclude '**/*.slow.test.ts'",
  'test:coloring:slow': "vitest run tests/games/coloring/ --exclude '**/!(*.slow).test.ts'",
};

const COLORING_WITH_SAVING: ChangedTestsPlan = {
  headline: 'Testy: coloring, ukládání obrázku, celek',
  scripts: ['test:coloring', 'test:coloring:slow', 'test:whole'],
};

const COLORING_ONLY: ChangedTestsPlan = {
  headline: 'Testy: coloring, celek',
  scripts: ['test:coloring', 'test:whole'],
};

describe('#119: změna ukládání obrázku pustí pomalé testy Omalovánek', () => {
  it('změna ukládání obrázku, pomůcek matice nebo testů skupiny pustí testy Omalovánek a skupinu', () => {
    expectEachPlan(
      [
        { label: 'kódování vrstvy barev', paths: ['src/games/coloring/logic/colorLayerCode.ts'] },
        { label: 'záznam obrázku', paths: ['src/games/coloring/logic/savedPicture.ts'] },
        {
          label: 'pomůcka matice těsných tahů',
          paths: ['tests/games/coloring/tightStrokesHelpers.ts'],
        },
        {
          label: 'kontroly matice těsných tahů',
          paths: ['tests/games/coloring/tightStrokesChecks.ts'],
        },
        {
          label: 'test skupiny vodorovných tahů',
          paths: ['tests/games/coloring/tightStrokesHorizontal.slow.test.ts'],
        },
        {
          label: 'test skupiny svislých tahů',
          paths: ['tests/games/coloring/tightStrokesVertical.slow.test.ts'],
        },
        {
          label: 'nový pomalý soubor Omalovánek i v podsložce',
          paths: ['tests/games/coloring/saving/brandNew.slow.test.ts'],
        },
        {
          label: 'víc souborů ukládání naráz pustí skupinu jen jednou',
          paths: [
            'src/games/coloring/logic/colorLayerCode.ts',
            'src/games/coloring/logic/savedPicture.ts',
            'tests/games/coloring/tightStrokesHelpers.ts',
          ],
        },
        {
          label: 'jiná změna Omalovánek spolu s ukládáním',
          paths: [
            'src/games/coloring/logic/palette.ts',
            'src/games/coloring/logic/colorLayerCode.ts',
          ],
        },
      ],
      COLORING_WITH_SAVING,
      SCRIPTS_WITH_COLORING,
    );
  });

  it('jiná změna v Omalovánkách pomalé testy Omalovánek nepustí', () => {
    expectEachPlan(
      [
        { label: 'malování', paths: ['src/games/coloring/logic/coloring.ts'] },
        { label: 'paleta', paths: ['src/games/coloring/logic/palette.ts'] },
        { label: 'scéna', paths: ['src/games/coloring/scenes/ColoringScene.ts'] },
        {
          label: 'rychlý test záznamu',
          paths: ['tests/games/coloring/tightStrokesRecord.test.ts'],
        },
        {
          label: 'pevný záznam p4',
          paths: ['tests/games/coloring/legacyP4RecordFixture.ts'],
        },
      ],
      COLORING_ONLY,
      SCRIPTS_WITH_COLORING,
    );
  });

  it('pomalé testy Omalovánek nepustí skupinu rozpoznávání a rozpoznávání nepustí pomalé testy Omalovánek', () => {
    const cases: readonly (PlanCase & { readonly expected: ChangedTestsPlan })[] = [
      {
        label: 'pomalý soubor Omalovánek',
        paths: ['tests/games/coloring/tightStrokesVertical.slow.test.ts'],
        expected: COLORING_WITH_SAVING,
      },
      {
        label: 'rozpoznávání psaní',
        paths: ['src/games/counting/logic/digitRecognition.ts'],
        expected: COUNTING_WITH_RECOGNITION,
      },
      {
        label: 'ukládání obrázku i rozpoznávání: každá skupina hned za svou hrou',
        paths: [
          'src/games/counting/logic/digitRecognition.ts',
          'src/games/coloring/logic/savedPicture.ts',
        ],
        expected: {
          headline: 'Testy: coloring, ukládání obrázku, counting, rozpoznávání, celek',
          scripts: [
            'test:coloring',
            'test:coloring:slow',
            'test:counting',
            'test:recognition',
            'test:whole',
          ],
        },
      },
    ];
    for (const { label, paths, expected } of cases) {
      expect(planChangedTests(paths, SCRIPTS_WITH_COLORING), label).toEqual(expected);
    }
  });

  it('bez skriptu pomalých testů Omalovánek pustí změna ukládání obrázku všechny testy', () => {
    const withoutSlow: Record<string, string> = { ...SCRIPTS_WITH_COLORING };
    delete withoutSlow['test:coloring:slow'];
    expectEachPlan(
      [{ label: 'kódování vrstvy barev', paths: ['src/games/coloring/logic/colorLayerCode.ts'] }],
      ALL_TESTS,
      withoutSlow,
    );
  });

  it('změna ukládání obrázku spolu s dokumentací pustí stejné testy jako samotná', () => {
    expectEachPlan(
      [
        {
          label: 'ukládání obrázku a deník',
          paths: ['docs/rozhodnuti.md', 'src/games/coloring/logic/savedPicture.ts'],
        },
      ],
      COLORING_WITH_SAVING,
      SCRIPTS_WITH_COLORING,
    );
  });
});
