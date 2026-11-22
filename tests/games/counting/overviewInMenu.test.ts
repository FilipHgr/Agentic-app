/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import { layoutDeviceSettingsPanel } from '../../../src/games/counting/logic/deviceLayout';
import { problemsOf } from '../../../src/games/counting/logic/problems';
import { MAX_NUMBER_OPTIONS } from '../../../src/games/counting/logic/settings';
import { COUNTING_META, COUNTING_OVERVIEW } from '../../../src/games/counting/meta';
import { equationKey, isProblemOf } from '../../../src/shared/logic/overviewProblems';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { dictionariesByLanguage } from '../../shared/textChecks';
import { viewportOf } from '../../shared/viewportFixtures';
import { PANEL_WINDOWS } from './layoutScenes';

/**
 * Testy k #192 AC5: přehled pro rodiče je v hlavním menu, z nastavení
 * Počítání tlačítko Přehled a stránky přehledu zmizely a nastavení vypadá
 * jako před #183. Počítání dál zapisuje záznamy přehledu (to hlídají
 * `weekOverview.test.ts` a `mistakeOverview.test.ts`) a v `meta.ts` popíše,
 * jaké příklady zapisuje, aby je menu přečetlo bez kódu hry.
 */

const COUNTING_TEXT_FILES = dictionariesByLanguage(
  import.meta.glob('../../../src/games/counting/texts/*.ts', { eager: true }),
);

/** Části rozložení nastavení před #183 (commit 2fd48e1^): řady voleb, ✓, vzhled a umístění. */
const SETTINGS_PARTS_BEFORE_183: readonly string[] = [
  'confirm',
  'mode',
  'optionLook',
  'placement',
  'rows',
];

describe('#192 AC5: z nastavení Počítání přehled zmizel', () => {
  it('nastavení nemá v žádném okně tlačítko Přehled, jen řady voleb a ✓ jako před #183', () => {
    for (const window of PANEL_WINDOWS) {
      const layout = layoutDeviceSettingsPanel(gameAreaFor(viewportOf(window)));
      expect(layout, window.name).not.toHaveProperty('overviewButton');
      expect(Object.keys(layout).sort(), window.name).toEqual(SETTINGS_PARTS_BEFORE_183);
    }
  });

  it('texty Počítání už nemají texty přehledu ani stránky Chyby (jsou v textech menu)', () => {
    expect(Object.keys(COUNTING_TEXT_FILES).length).toBeGreaterThan(0);
    for (const [language, texts] of Object.entries(COUNTING_TEXT_FILES)) {
      expect(texts, language).not.toHaveProperty('overview');
      expect(texts, language).not.toHaveProperty('mistakes');
    }
  });
});

describe('#192 AC3: Počítání popíše přehled v meta.ts jako data', () => {
  it('menu dostane popis přehledu z meta.ts Počítání', () => {
    expect(COUNTING_META.overview).toBe(COUNTING_OVERVIEW);
    expect(COUNTING_OVERVIEW.operations).toEqual(['plus', 'minus']);
    expect(COUNTING_OVERVIEW.hints).toBe(true);
  });

  it('popis pokrývá nejvyšší rozsah nastavení a každý příklad, který hra může dát', () => {
    const max = Math.max(...MAX_NUMBER_OPTIONS);
    expect(COUNTING_OVERVIEW.maxNumber).toBe(max);
    const problems = [...problemsOf('plus', max), ...problemsOf('minus', max)];
    const refused = problems
      .map((problem) => equationKey(problem.first, problem.operation, problem.second))
      .filter((key) => !isProblemOf(key, COUNTING_OVERVIEW));
    expect(problems.length).toBeGreaterThan(0);
    expect(refused).toEqual([]);
  });
});
