import { describe, expect, it } from 'vitest';

import {
  layoutDeviceOverview,
  layoutDeviceSettingsPanel,
} from '../../../src/games/counting/logic/deviceLayout';
import { overviewBars } from '../../../src/games/counting/logic/overviewLayout';
import { OVERVIEW_STYLE } from '../../../src/games/counting/logic/theme';
import { countingTexts } from '../../../src/games/counting/texts/countingTexts';
import { PAGE_BACKGROUND, contrastRatio } from '../../../src/shared/logic/theme';
import { LANGUAGES } from '../../../src/shared/texts/languages';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS, LAYOUT_RULES, textFitViolations } from '../../shared/layoutRules';
import type { LayoutScene } from '../../shared/layoutRules';
import { viewportOf } from '../../shared/viewportFixtures';
import { panelCssPlacement, cssBoxOf } from './parentPanelCss';
import {
  OVERVIEW_BUTTON_NAME,
  OVERVIEW_SAMPLES,
  PANEL_WINDOWS,
  overviewScenes,
  settingsScenes,
} from './layoutScenes';

/**
 * Testy k #183 AC3 a AC7: rozložení přehledu pro rodiče a tlačítko
 * Přehled v nastavení. Pravidla rozložení (`tests/shared/layoutRules.ts`)
 * jdou v cyklu přes všechna okna panelů (iPad, telefon na šířku i na výšku,
 * hranice, z plochy), zkušební týdny (plný, běžný, jediný den, prázdný)
 * a jazyky; jedno pravidlo je jeden test. Na telefonu platí rozložení
 * nastavení S (ťukací plochy 8 px od okraje, volný roh kolečka).
 */

const WINDOWS = [...PANEL_WINDOWS, ...HOME_SCREEN_WINDOWS];

/** Na telefonu na výšku nejvýš tolik CSS px mezi nadpisem a grafem (review #183). */
const MAX_TITLE_TO_CHART_GAP = 24;

let cached: LayoutScene[] | undefined;
function scenes(): LayoutScene[] {
  cached ??= overviewScenes(WINDOWS);
  return cached;
}

describe('#183 AC7: přehled dodrží společná pravidla rozložení', () => {
  for (const [ruleName, rule] of Object.entries(LAYOUT_RULES)) {
    it(`${ruleName} ve všech oknech, týdnech i jazycích`, () => {
      expect(scenes().length).toBe(WINDOWS.length * Object.keys(OVERVIEW_SAMPLES).length * 2);
      for (const scene of scenes()) {
        expect(rule(scene), scene.label).toEqual([]);
      }
    });
  }

  it('texty včetně zkratek dnů a nejdelších čísel se vejdou v češtině i angličtině', () => {
    for (const scene of scenes()) {
      expect(textFitViolations(scene), scene.label).toEqual([]);
    }
  });

  it('tlačítko Zpět je ťukací plocha aspoň 64 px', () => {
    for (const scene of scenes()) {
      const back = scene.items.find((item) => item.name === 'Zpět');
      expect(back?.tappable, scene.label).toBe(true);
    }
  });
});

describe('#183 AC7: graf má 7 sloupečků ve dvou odstínech a pod nimi součet za týden', () => {
  it('v každém okně je 7 sloupečků se zkratkou dne pod každým', () => {
    for (const window of WINDOWS) {
      const layout = layoutDeviceOverview(gameAreaFor(viewportOf(window)));
      const bars = overviewBars(layout, OVERVIEW_SAMPLES['běžný týden'] ?? fail());
      expect(bars, window.name).toHaveLength(7);
      expect(layout.days, window.name).toHaveLength(7);
      bars.forEach((bar, index) => {
        const day = layout.days[index] ?? fail();
        expect(Math.abs(bar.solved.x - day.x), `${window.name}, den ${index}`).toBeLessThan(0.01);
        expect(bar.solved.y + bar.solved.height / 2, window.name).toBeLessThanOrEqual(
          day.y - day.height / 2,
        );
      });
    }
  });

  it('sloupečky jdou zleva od nejstaršího dne po dnešek a nepřekrývají se', () => {
    for (const window of WINDOWS) {
      const layout = layoutDeviceOverview(gameAreaFor(viewportOf(window)));
      const bars = overviewBars(layout, OVERVIEW_SAMPLES['plný týden'] ?? fail());
      for (let index = 1; index < bars.length; index += 1) {
        const previous = bars[index - 1] ?? fail();
        const current = bars[index] ?? fail();
        expect(
          current.solved.x - current.solved.width / 2,
          `${window.name}, sloupeček ${index}`,
        ).toBeGreaterThan(previous.solved.x + previous.solved.width / 2);
      }
    }
  });

  it('výška sloupečku odpovídá počtu, tmavší část napoprvé je uvnitř sloupečku vyřešených', () => {
    const overview = OVERVIEW_SAMPLES['běžný týden'] ?? fail();
    for (const window of WINDOWS) {
      const layout = layoutDeviceOverview(gameAreaFor(viewportOf(window)));
      const bars = overviewBars(layout, overview);
      const most = Math.max(...overview.days.map((day) => day.solved));
      bars.forEach((bar, index) => {
        const day = overview.days[index] ?? fail();
        const where = `${window.name}, den ${index}`;
        expect(bar.solved.height, where).toBeCloseTo(
          (layout.chart.maxBarHeight * day.solved) / most,
          5,
        );
        expect(bar.firstTry.height, where).toBeCloseTo(
          (layout.chart.maxBarHeight * day.firstTry) / most,
          5,
        );
        // Obě části stojí na stejné základně, napoprvé je nejvýš tak vysoká jako vyřešené.
        expect(bar.firstTry.y + bar.firstTry.height / 2, where).toBeCloseTo(
          bar.solved.y + bar.solved.height / 2,
          5,
        );
        expect(bar.firstTry.height, where).toBeLessThanOrEqual(bar.solved.height);
        expect(bar.firstTry.width, where).toBe(bar.solved.width);
      });
    }
  });

  it('den s 0 příklady nemá sloupeček, jen počet 0', () => {
    const overview = OVERVIEW_SAMPLES['běžný týden'] ?? fail();
    const layout = layoutDeviceOverview(gameAreaFor(viewportOf(WINDOWS[0] ?? fail())));
    const bars = overviewBars(layout, overview);
    expect(overview.days[1]?.solved).toBe(0);
    expect(bars[1]?.solved.height).toBe(0);
    expect(bars[1]?.firstTry.height).toBe(0);
  });

  it('součet za týden je pod sloupečky a zkratkami dnů', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const layout = layoutDeviceOverview(area);
      const placement = panelCssPlacement(area, layout.placement);
      const daysBottom = Math.max(...layout.days.map((day) => cssBoxOf(day, placement).bottom));
      for (const total of layout.totals) {
        expect(cssBoxOf(total, placement).top, window.name).toBeGreaterThanOrEqual(daysBottom);
      }
    }
  });

  it('oba odstíny jsou vidět na pozadí stránky a jdou od sebe rozeznat', () => {
    expect(contrastRatio(OVERVIEW_STYLE.solvedColor, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(OVERVIEW_STYLE.firstTryColor, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(OVERVIEW_STYLE.solvedColor, OVERVIEW_STYLE.firstTryColor),
    ).toBeGreaterThanOrEqual(1.5);
  });

  it('na telefonu na výšku je nadpis hned nad grafem, bez prázdného místa mezi nimi', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      if (area.mode !== 'phonePortrait') {
        continue;
      }
      const layout = layoutDeviceOverview(area);
      const placement = panelCssPlacement(area, layout.placement);
      const titleBottom = cssBoxOf(layout.title, placement).bottom;
      const chartTop = cssBoxOf(
        {
          x: (layout.chart.left + layout.chart.right) / 2,
          y: layout.chart.top,
          width: layout.chart.right - layout.chart.left,
          height: 0,
        },
        placement,
      ).top;
      expect(chartTop - titleBottom, window.name).toBeGreaterThanOrEqual(0);
      expect(chartTop - titleBottom, window.name).toBeLessThanOrEqual(MAX_TITLE_TO_CHART_GAP);
    }
  });

  it('bez dat je místo grafu na středu nápis „Zatím žádné příklady“', () => {
    for (const window of WINDOWS) {
      const layout = layoutDeviceOverview(gameAreaFor(viewportOf(window)));
      const { chart, empty } = layout;
      expect(empty.y, window.name).toBeGreaterThan(chart.top);
      expect(empty.y, window.name).toBeLessThan(chart.baseline);
      expect(empty.x - empty.width / 2, window.name).toBeGreaterThanOrEqual(chart.left - 0.01);
      expect(empty.x + empty.width / 2, window.name).toBeLessThanOrEqual(chart.right + 0.01);
    }
  });
});

describe('#183 AC7: texty přehledu v cs i en', () => {
  it('česky: Přehled, Zpět, bez dat „Zatím žádné příklady“ a zkratky dnů od pondělí', () => {
    const texts = countingTexts('cs').overview;
    expect(texts.button).toBe('Přehled');
    expect(texts.back).toBe('Zpět');
    expect(texts.empty).toBe('Zatím žádné příklady');
    expect(texts.legendNotFirstTry).toBe('Po chybě nebo s nápovědou');
    expect(texts.legendFirstTry).toBe('Napoprvé');
    expect(texts.dayNames).toEqual(['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']);
  });

  it('anglicky: Overview, Back, prázdný přehled a zkratky dnů od pondělí', () => {
    const texts = countingTexts('en').overview;
    expect(texts.button).toBe('Overview');
    expect(texts.back).toBe('Back');
    expect(texts.title).toBe('Problems solved in the last 7 days');
    expect(texts.empty).toBe('No problems yet');
    expect(texts.legendNotFirstTry).toBe('After a mistake or hint');
    expect(texts.legendFirstTry).toBe('First try');
    expect(texts.dayNames).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('každý jazyk má 7 různých zkratek dnů a žádný text přehledu není prázdný', () => {
    for (const language of LANGUAGES) {
      const texts = countingTexts(language).overview;
      expect(new Set(texts.dayNames).size, language).toBe(7);
      for (const [key, value] of Object.entries(texts)) {
        const values = Array.isArray(value) ? value : [value];
        for (const text of values) {
          expect(String(text).trim(), `${language}: ${key}`).not.toBe('');
        }
      }
    }
  });
});

describe('#183 AC3: v nastavení je tlačítko Přehled', () => {
  it('nastavení má ve všech oknech tlačítko Přehled, které se nepřekrývá s volbami ani s ✓', () => {
    for (const scene of settingsScenes(WINDOWS)) {
      const button = scene.items.find((item) => item.name === OVERVIEW_BUTTON_NAME);
      expect(button?.tappable, scene.label).toBe(true);
      expect(LAYOUT_RULES['nic se nepřekrývá']?.(scene), scene.label).toEqual([]);
      expect(LAYOUT_RULES['mezera mezi plochami aspoň 8 px']?.(scene), scene.label).toEqual([]);
      expect(LAYOUT_RULES['ťukací plocha aspoň 64 px']?.(scene), scene.label).toEqual([]);
    }
  });

  it('nápis na tlačítku Přehled se vejde v češtině i angličtině', () => {
    for (const window of WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const layout = layoutDeviceSettingsPanel(area);
      const placement = panelCssPlacement(area, layout.placement);
      const button = layout.overviewButton;
      for (const language of LANGUAGES) {
        const scene: LayoutScene = {
          label: `${window.name}, ${language}`,
          free: { left: 0, right: window.width, top: 0, bottom: window.height },
          items: [
            {
              name: OVERVIEW_BUTTON_NAME,
              box: cssBoxOf(button, placement),
              texts: [
                {
                  text: countingTexts(language).overview.button,
                  fontSize: button.fontSize * placement.scale,
                },
              ],
            },
          ],
        };
        expect(textFitViolations(scene), scene.label).toEqual([]);
      }
    }
  });
});

function fail(): never {
  throw new Error('chybí očekávaná část rozložení');
}
