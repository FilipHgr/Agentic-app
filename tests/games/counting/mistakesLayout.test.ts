import { describe, expect, it } from 'vitest';

import {
  layoutDeviceMistakes,
  layoutDeviceOverview,
} from '../../../src/games/counting/logic/deviceLayout';
import { mistakeOverview, recordHintUsed } from '../../../src/games/counting/logic/mistakeActivity';
import { mistakeLines } from '../../../src/games/counting/logic/mistakesLayout';
import { countingTexts } from '../../../src/games/counting/texts/countingTexts';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { LANGUAGES } from '../../../src/shared/texts/languages';
import { HOME_SCREEN_WINDOWS, LAYOUT_RULES, textFitViolations } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { viewportOf } from '../../shared/viewportFixtures';
import { cssBoxOf, panelCssPlacement } from './parentPanelCss';
import {
  MISTAKES_BUTTON_NAME,
  MISTAKE_SAMPLES,
  OVERVIEW_TODAY,
  PANEL_WINDOWS,
  mistakesScenes,
  overviewScenes,
} from './layoutScenes';

/**
 * Testy k #184: rozložení stránky Chyby v přehledu pro rodiče a tlačítka
 * Chyby v přehledu. Do přehledu vyřešených příkladů (#183) se nové údaje
 * nevešly (na telefonu na šířku zabírá graf celou výšku), proto jsou na
 * druhé stránce za tlačítkem. Pravidla rozložení jdou v cyklu přes všechna
 * okna panelů (iPad, telefon na šířku i na výšku, z plochy), zkušební
 * přehledy (nejdelší texty, běžný, bez častých chyb, prázdný) a oba jazyky;
 * jedno pravidlo je jeden test.
 */

const WINDOWS = [...PANEL_WINDOWS, ...HOME_SCREEN_WINDOWS];

let cached: LayoutScene[] | undefined;
function scenes(): LayoutScene[] {
  cached ??= mistakesScenes(WINDOWS);
  return cached;
}

describe('#184: stránka Chyby dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech, přehledech i jazycích`, () => {
      expect(scenes().length).toBe(WINDOWS.length * Object.keys(MISTAKE_SAMPLES).length * 2);
      for (const scene of scenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('všechny řádky včetně nejdelších čísel a procent se vejdou v češtině i angličtině', () => {
    for (const scene of scenes()) {
      expect(textFitViolations(scene), scene.label).toEqual([]);
    }
  });

  it('Zpět je ťukací plocha aspoň 64 px', () => {
    for (const scene of scenes()) {
      const back = scene.items.find((item) => item.name === 'Zpět');
      expect(back?.tappable, scene.label).toBe(true);
    }
  });

  it('rodič čte shora dolů: nadpis, napoprvé, časté chyby a nápověda', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const layout = layoutDeviceMistakes(area);
      const order = [
        layout.title,
        layout.firstTryHeading,
        ...layout.operations,
        layout.frequentHeading,
        ...layout.frequent,
        layout.hints,
      ];
      for (let index = 1; index < order.length; index += 1) {
        const above = order[index - 1];
        const below = order[index];
        expect(below?.y ?? 0, `${window.name}, řádek ${index}`).toBeGreaterThan(above?.y ?? 0);
      }
      expect(layout.operations, window.name).toHaveLength(2);
      expect(layout.frequent, window.name).toHaveLength(3);
    }
  });

  it('Zpět je na stránce Chyby na středu místa, kde jsou v přehledu Zpět a Chyby', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const mistakes = layoutDeviceMistakes(area);
      const overview = layoutDeviceOverview(area);
      const back = cssBoxOf(mistakes.back, panelCssPlacement(area, mistakes.placement));
      const overviewPlacement = panelCssPlacement(area, overview.placement);
      const pairLeft = cssBoxOf(overview.back, overviewPlacement);
      const pairRight = cssBoxOf(overview.mistakesButton, overviewPlacement);
      const middle = (box: { left: number; right: number }): number => (box.left + box.right) / 2;
      expect(middle(back), window.name).toBeCloseTo((pairLeft.left + pairRight.right) / 2, 3);
      expect(back.top, window.name).toBeCloseTo(pairLeft.top, 3);
      expect(back.bottom, window.name).toBeCloseTo(pairLeft.bottom, 3);
    }
  });

  it('na iPadu je Zpět na stránce Chyby uprostřed panelu (x 512)', () => {
    const layout = layoutDeviceMistakes(gameAreaFor(viewportOf(PANEL_WINDOWS[0] ?? fail())));
    expect(layout.mode).toBe('tablet');
    expect(layout.back.x).toBe(512);
  });

  it('na telefonu na šířku i na výšku má stránka Chyby stejné písmo a řádky 28–32 px od sebe', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      if (area.mode === 'tablet') {
        continue;
      }
      const layout = layoutDeviceMistakes(area);
      const placement = panelCssPlacement(area, layout.placement);
      const css = (value: number): number => value * placement.scale;
      expect(css(layout.title.fontSize), window.name).toBeCloseTo(17, 3);
      expect(css(layout.firstTryHeading.fontSize), window.name).toBeCloseTo(17, 3);
      for (const row of [...layout.operations, ...layout.frequent, layout.hints]) {
        expect(css(row.fontSize), window.name).toBeCloseTo(16, 3);
      }
      const pitch = css((layout.operations[1]?.y ?? 0) - (layout.operations[0]?.y ?? 0));
      expect(pitch, window.name).toBeGreaterThanOrEqual(28);
      expect(pitch, window.name).toBeLessThanOrEqual(32);
    }
  });
});

describe('#184: v přehledu je tlačítko Chyby', () => {
  it('v každém okně, týdnu i jazyce je vedle Zpět tlačítko Chyby aspoň 64 px', () => {
    for (const scene of overviewScenes(WINDOWS)) {
      const button = scene.items.find((item) => item.name === MISTAKES_BUTTON_NAME);
      expect(button?.tappable, scene.label).toBe(true);
      expect(LAYOUT_RULES['ťukací plocha aspoň 64 px']?.(scene), scene.label).toEqual([]);
      expect(LAYOUT_RULES['mezera mezi plochami aspoň 8 px']?.(scene), scene.label).toEqual([]);
      expect(textFitViolations(scene), scene.label).toEqual([]);
    }
  });

  it('nápis tlačítka je česky „Chyby“ a anglicky „Mistakes“', () => {
    expect(countingTexts('cs').mistakes.button).toBe('Chyby');
    expect(countingTexts('en').mistakes.button).toBe('Mistakes');
  });
});

describe('#184: co rodič na stránce Chyby čte', () => {
  it('bez hraní vidí „Zatím žádné příklady“, „Bez častých chyb“ a nápovědu 0', () => {
    const overview = MISTAKE_SAMPLES['prázdný'] ?? fail();
    const texts = countingTexts('cs');
    const lines = mistakeLines(overview, texts.mistakes, texts.overview, 'cs');
    expect(lines.operations).toEqual(['Zatím žádné příklady']);
    expect(lines.frequent).toEqual(['Bez častých chyb']);
    expect(lines.hints).toBe('Nápověda za týden: 0');
  });

  it('běžný týden: sčítání a odčítání zvlášť, dvě časté chyby od nejnovější a nápověda', () => {
    const overview = MISTAKE_SAMPLES['běžný týden'] ?? fail();
    const texts = countingTexts('cs');
    const lines = mistakeLines(overview, texts.mistakes, texts.overview, 'cs');
    expect(lines.title).toBe('Kde se dítě plete (7 dní)');
    expect(lines.operations).toEqual(['Sčítání: 50 % (1/2)', 'Odčítání: 50 % (1/2)']);
    expect(lines.frequent).toEqual(['9 − 3 (2×)', '8 + 5 (2×)']);
    expect(lines.hints).toBe('Nápověda za týden: 1');
  });

  it('anglicky stejné údaje s anglickými texty', () => {
    const overview = MISTAKE_SAMPLES['bez častých chyb'] ?? fail();
    const texts = countingTexts('en');
    const lines = mistakeLines(overview, texts.mistakes, texts.overview, 'en');
    expect(lines.firstTryHeading).toBe('Solved on first try');
    expect(lines.operations).toEqual(['Addition: 50% (1/2)']);
    expect(lines.frequentHeading).toBe('Most frequent mistakes');
    expect(lines.frequent).toEqual(['No frequent mistakes']);
    const hinted = mistakeOverview(recordHintUsed({}, OVERVIEW_TODAY), OVERVIEW_TODAY);
    expect(mistakeLines(hinted, texts.mistakes, texts.overview, 'en').hints).toBe(
      'Hints used this week: 1',
    );
  });

  it('žádný text stránky Chyby není v žádném jazyce prázdný', () => {
    for (const language of LANGUAGES) {
      for (const [key, value] of Object.entries(countingTexts(language).mistakes)) {
        expect(value.trim(), `${language}: ${key}`).not.toBe('');
      }
    }
  });
});

function fail(): never {
  throw new Error('chybí zkušební přehled');
}
