import { describe, expect, it } from 'vitest';

import {
  handleColorDot,
  handleFace,
  lineSizeWave,
  touchTargetAt,
} from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { MIN_EDGE_DISTANCE } from '../../shared/layoutRules';
import { SMALLEST_PHONE, boundsOf, heightOf, widthOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import {
  COLORING_WINDOWS,
  PLANNED_LINE_SIZES,
  coloringCase,
  coloringCases,
  isLandscapeArea,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { ALL_SIZES, SIZE_NAMES } from './lineSizeHelpers';

/**
 * Testy rozložení k #118 (čtyři tloušťky čáry v Omalovánkách s novou
 * nejtenčí): AC1 (4 tlačítka v hlavičce od nejtenčí, kam patří dotyk),
 * AC3 (vlnky rostou od nejtenčí aspoň 1,5×, nejtenčí aspoň 1,5 CSS px,
 * kolečko barvy v úchytu u nejtenčí jako u malé) a AC4 (rozměr a tvar
 * panelu, panel ve viditelné ploše, na výšku beze změny). Každé pravidlo je
 * jeden test, který v cyklu projde všechna okna z `coloringLayoutScenes.ts`
 * (iPad, telefon na šířku i na výšku, hranice, úzký iPad a okna z plochy);
 * případ je popsaný ve zprávě `expect`.
 *
 * Pravidla z #112, která od #118 platí pro všechna 4 tlačítka (64 px,
 * 8 px od sousedů i od čáry hlavičky, vlnka jde nahoru i dolů a leží
 * v tlačítku, kontrast nebo obrys, dotyk do mezery), běží se 4 tlačítky
 * v `lineSizeButtonsLayoutRules.test.ts`; společná pravidla (nic se
 * nepřekrývá, 4 px od okraje, panel stejně velký v obou krocích, nepřekryje
 * domeček, úchyt, Zpět ani nedávné barvy) v `coloringLayoutRules.test.ts`
 * a `panelStepsLayoutRules.test.ts`.
 *
 * Platí poslední schválení vlastníka (komentář k issue 2026-11-10):
 * nejtenčí vlnka má 1,5 CSS px, poměr vlnek je 1,5 : 3 : 5 : 10, a přesné
 * rozměry panelu z doporučení reviewera (iPad 352 × 360, telefon 312 × 304,
 * v okně 744×296 296 × 288).
 *
 * Navržené rozhraní: žádné nové, jen `ColoringLayout.sizeButtons` má
 * 4 obdélníky v pořadí `LINE_SIZES` (nejtenčí, malá, střední, velká),
 * `lineSizeWave(button, 'tiny')`, `handleColorDot(handle, 'tiny')`
 * a `touchTargetAt` vrací `{ kind: 'lineSize', size: 'tiny' }`.
 */

/** Tolerance na zaokrouhlení v herních jednotkách i CSS px. */
const TOLERANCE = 1e-6;

/** Každá vlnka je aspoň 1,5× silnější než předchozí (#118 AC3). */
const MIN_WAVE_STEP = 1.5;

/** Nejtenčí vlnka má aspoň 1,5 CSS px (#118 AC3 po schválení obrázků). */
const MIN_TINY_WAVE_CSS = 1.5;

/** Rozměry panelu z AC4 (CSS px) a tolerance zaokrouhlení. */
const MOCKUP_TOLERANCE = 0.5;
const IPAD_PANEL = { width: 352, height: 360 };
const PHONE_LANDSCAPE_PANEL = { width: 312, height: 304 };
const SMALLEST_PHONE_PANEL = { width: 296, height: 288 };

/** Tvar těla panelu (sloupce × řady barev) podle AC4. */
const IPAD_BODY = { columns: 4, rows: 3 };
const PHONE_LANDSCAPE_BODY = { columns: 3, rows: 4 };
const PORTRAIT_BODY = { columns: 4, rows: 3 };

/**
 * Panel na výšku před #118 (CSS px okna), změřený na dnešním rozložení před
 * změnou (2026-11-10): AC4 „na výšku zůstává panel stejný jako dnes“.
 */
const PORTRAIT_PANELS_TODAY: Readonly<
  Record<string, { left: number; top: number; width: number; height: number }>
> = {
  '390×844 iPhone 13–15 (výřez 47, lišta 34)': { left: 43, top: 418, width: 304, height: 312 },
  '390×664 iPhone v Safari s lištou': { left: 43, top: 272, width: 304, height: 312 },
  '360×780 Samsung s Chromem': { left: 28, top: 388, width: 304, height: 312 },
  '375×667 iPhone SE': { left: 35.5, top: 275, width: 304, height: 312 },
  '430×932 iPhone Pro Max (výřez 59, lišta 34)': { left: 63, top: 506, width: 304, height: 312 },
  '360×620 nejmenší telefon na výšku': { left: 28, top: 228, width: 304, height: 312 },
  '414×622 iPhone 8 Plus v Safari s lištami': { left: 55, top: 230, width: 304, height: 312 },
  '499×932 těsně pod hranicí šířky': { left: 97.5, top: 540, width: 304, height: 312 },
  '375×1180 úzký iPad (Split View)': { left: 35.5, top: 788, width: 304, height: 312 },
  'iPhone 430×932 na výšku z plochy (výřez 59, lišta 34)': {
    left: 63,
    top: 506,
    width: 304,
    height: 312,
  },
  'iPhone 393×852 na výšku z plochy (výřez 59, lišta 34)': {
    left: 44.5,
    top: 426,
    width: 304,
    height: 312,
  },
};

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function casesIn(panel: ColoringCase['panel']): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === panel);
}

/** Okna v kroku nástrojů; každé musí mít 4 tlačítka, aby pravidla neprošla naprázdno. */
function toolStepCases(): ColoringCase[] {
  const tools = casesIn('tools');
  for (const testCase of tools) {
    expect(testCase.layout.sizeButtons.length, `${testCase.scene.label}: tlačítek`).toBe(
      ALL_SIZES.length,
    );
  }
  return tools;
}

function stepCases(): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel !== 'closed');
}

/** Hlavička je řada nahoře (iPad, na výšku), nebo sloupec vlevo (telefon na šířku). */
function headerKind(testCase: ColoringCase): 'row' | 'column' {
  return testCase.area.mode === 'phoneLandscape' ? 'column' : 'row';
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Kolik různých sloupců a řad mají plochy `boxes` (podle levé a horní hrany). */
function gridShape(boxes: readonly Box[]): { columns: number; rows: number } {
  const round = (value: number): string => value.toFixed(2);
  return {
    columns: new Set(boxes.map((box) => round(box.left))).size,
    rows: new Set(boxes.map((box) => round(box.top))).size,
  };
}

function expectPanelSize(
  testCase: ColoringCase,
  expected: { width: number; height: number },
): void {
  const { label } = testCase.scene;
  const width = widthOf(testCase.panelBox);
  const height = heightOf(testCase.panelBox);
  expect(
    Math.abs(width - expected.width),
    `${label}: šířka panelu ${width} místo ${expected.width} px`,
  ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
  expect(
    Math.abs(height - expected.height),
    `${label}: výška panelu ${height} místo ${expected.height} px`,
  ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
}

/** Telefon na šířku ze schválených obrázků (stejný jako v `panelStepsLayoutRules.test.ts`). */
const IPHONE_LANDSCAPE_MOCKUP: TestWindow = {
  name: '844×390 iPhone 13–15 na šířku (výřez 47, lišta 21)',
  width: 844,
  height: 390,
  safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
};

describe('#118 AC1: čtyři tlačítka tloušťky v hlavičce kroku nástrojů', () => {
  it('ve všech oknech jsou v hlavičce 4 tlačítka tloušťky', () => {
    expect(PLANNED_LINE_SIZES, 'obsah panelu podle AC1').toBe(ALL_SIZES.length);
    for (const testCase of toolStepCases()) {
      expect(testCase.sizeButtons.length, testCase.scene.label).toBe(ALL_SIZES.length);
    }
  });

  it('ťuknutí na tlačítko jde na jeho tloušťku: nejtenčí, malá, střední, velká', () => {
    for (const testCase of toolStepCases()) {
      ALL_SIZES.forEach((size, index) => {
        const button = testCase.layout.sizeButtons[index] as LayoutRect;
        const { x, y } = center(button);
        expect(
          touchTargetAt(testCase.layout, 'tools', x, y),
          `${testCase.scene.label}: tlačítko ${index + 1}`,
        ).toEqual({ kind: 'lineSize', size });
      });
    }
  });

  it('nejtenčí je na iPadu a na výšku úplně vlevo, na telefonu na šířku úplně nahoře', () => {
    for (const testCase of toolStepCases()) {
      const [tiny, ...others] = testCase.sizeButtons;
      if (tiny === undefined) {
        continue;
      }
      others.forEach((button, offset) => {
        const name = `${testCase.scene.label}: nejtenčí před tlačítkem ${offset + 2}`;
        if (headerKind(testCase) === 'row') {
          expect(tiny.right, name).toBeLessThanOrEqual(button.left + TOLERANCE);
        } else {
          expect(tiny.bottom, name).toBeLessThanOrEqual(button.top + TOLERANCE);
        }
      });
    }
  });

  it('se zavřeným panelem ani v kroku barev nejde na místě nejtenčí vybrat tloušťku', () => {
    for (const testCase of [...casesIn('closed'), ...casesIn('colors')]) {
      const button = testCase.layout.sizeButtons[0];
      expect(button, `${testCase.scene.label}: místo nejtenčí`).toBeDefined();
      if (button === undefined) {
        continue;
      }
      const { x, y } = center(button);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, x, y).kind,
        testCase.scene.label,
      ).not.toBe('lineSize');
    }
  });
});

describe('#118 AC3: vlnky a kolečko barvy v úchytu', () => {
  it('vlnky jsou ve všech oknech od nejtenčí silnější, každá aspoň 1,5× předchozí', () => {
    for (const testCase of toolStepCases()) {
      const widths = ALL_SIZES.map(
        (size, index) =>
          lineSizeWave(testCase.layout.sizeButtons[index] as LayoutRect, size).lineWidth,
      );
      widths.slice(1).forEach((width, offset) => {
        const thinner = widths[offset] ?? 0;
        const name = `${testCase.scene.label}: ${SIZE_NAMES[ALL_SIZES[offset + 1] ?? 'large']} : ${SIZE_NAMES[ALL_SIZES[offset] ?? 'tiny']}`;
        expect(thinner, `${name}, tenčí vlnka je vidět`).toBeGreaterThan(0);
        expect(
          width / thinner,
          `${name} je ${(width / thinner).toFixed(3)}`,
        ).toBeGreaterThanOrEqual(MIN_WAVE_STEP - TOLERANCE);
      });
    }
  });

  it('čára nejtenčí vlnky je ve všech oknech silná aspoň 1,5 CSS px', () => {
    for (const testCase of toolStepCases()) {
      const button = testCase.layout.sizeButtons[0] as LayoutRect;
      const css = lineSizeWave(button, 'tiny').lineWidth * testCase.area.scale;
      expect(
        css,
        `${testCase.scene.label}: nejtenčí vlnka ${css.toFixed(2)} px`,
      ).toBeGreaterThanOrEqual(MIN_TINY_WAVE_CSS - TOLERANCE);
    }
  });

  it('u nejtenčí je kolečko barvy v úchytu stejně velké a na stejném místě jako u malé', () => {
    for (const testCase of cases()) {
      const { handle } = testCase.layout;
      expect(handleColorDot(handle, 'tiny'), testCase.scene.label).toEqual(
        handleColorDot(handle, 'small'),
      );
    }
  });

  it('u nejtenčí je ikona nástroje v úchytu na stejném místě jako u malé', () => {
    for (const testCase of cases()) {
      const { handle } = testCase.layout;
      expect(handleFace(handle, 'tiny'), testCase.scene.label).toEqual(handleFace(handle, 'small'));
    }
  });
});

describe('#118 AC4: rozměr a tvar panelu', () => {
  it('panel je v obou krocích celý ve viditelné ploše aspoň 4 px od okraje', () => {
    for (const testCase of stepCases()) {
      const { panelBox, visible } = testCase;
      const margins: Array<[string, number]> = [
        ['vlevo', panelBox.left - visible.left],
        ['vpravo', visible.right - panelBox.right],
        ['nahoře', panelBox.top - visible.top],
        ['dole', visible.bottom - panelBox.bottom],
      ];
      for (const [side, margin] of margins) {
        expect(
          margin,
          `${testCase.scene.label}: odstup ${side} ${margin.toFixed(2)} px`,
        ).toBeGreaterThanOrEqual(MIN_EDGE_DISTANCE - 0.01);
      }
    }
  });

  it('na iPadu na šířku má panel v obou krocích 352 × 360 px', () => {
    const ipad = stepCases().filter(
      (testCase) => testCase.area.mode === 'tablet' && isLandscapeArea(testCase.area),
    );
    expect(ipad.length, 'okna iPadu na šířku').toBeGreaterThan(0);
    for (const testCase of ipad) {
      expectPanelSize(testCase, IPAD_PANEL);
    }
  });

  it('na telefonu na šířku má panel 312 × 304 px, v okně 744×296 296 × 288 px', () => {
    for (const panel of ['tools', 'colors'] as const) {
      expectPanelSize(coloringCase(IPHONE_LANDSCAPE_MOCKUP, panel), PHONE_LANDSCAPE_PANEL);
      expectPanelSize(coloringCase(SMALLEST_PHONE, panel), SMALLEST_PHONE_PANEL);
    }
    const roomy = stepCases().filter(
      (testCase) =>
        testCase.area.mode === 'phoneLandscape' &&
        heightOf(testCase.visible) >= PHONE_LANDSCAPE_PANEL.height + 2 * MIN_EDGE_DISTANCE,
    );
    expect(roomy.length, 'telefony na šířku s místem na celý panel').toBeGreaterThan(0);
    for (const testCase of roomy) {
      expectPanelSize(testCase, PHONE_LANDSCAPE_PANEL);
    }
  });

  it('tělo panelu je na iPadu na šířku 4 × 3, na telefonu na šířku 3 × 4 a na výšku 4 × 3', () => {
    for (const testCase of casesIn('colors')) {
      const expected = !isLandscapeArea(testCase.area)
        ? PORTRAIT_BODY
        : testCase.area.mode === 'phoneLandscape'
          ? PHONE_LANDSCAPE_BODY
          : IPAD_BODY;
      expect(gridShape(testCase.colors), `${testCase.scene.label}: sloupce × řady barev`).toEqual(
        expected,
      );
    }
  });

  it('hlavička je stejně dlouhá jako tělo, panel nemá prázdné místo', () => {
    for (const testCase of casesIn('tools')) {
      const header = boundsOf(testCase.sizeButtons);
      const body = boundsOf(coloringCase(testCase.window, 'colors').colors);
      const { label } = testCase.scene;
      if (headerKind(testCase) === 'row') {
        expect(
          Math.abs(widthOf(header) - widthOf(body)),
          `${label}: šířka hlavičky a těla`,
        ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
      } else {
        expect(
          Math.abs(heightOf(header) - heightOf(body)),
          `${label}: výška hlavičky a těla`,
        ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
      }
    }
  });

  it('na výšku je panel ve všech oknech na stejném místě a stejně velký jako dnes', () => {
    const portrait = COLORING_WINDOWS.filter(
      (window) => !isLandscapeArea(coloringCase(window, 'tools').area),
    );
    expect(
      portrait.map((window) => window.name).sort(),
      'okna na výšku jsou ta, ve kterých se panel měřil',
    ).toEqual(Object.keys(PORTRAIT_PANELS_TODAY).sort());
    for (const window of portrait) {
      const today = PORTRAIT_PANELS_TODAY[window.name];
      for (const panel of ['tools', 'colors'] as const) {
        const { panelBox, scene } = coloringCase(window, panel);
        const actual = {
          left: panelBox.left,
          top: panelBox.top,
          width: widthOf(panelBox),
          height: heightOf(panelBox),
        };
        for (const key of ['left', 'top', 'width', 'height'] as const) {
          expect(
            Math.abs(actual[key] - (today?.[key] ?? Number.NaN)),
            `${scene.label}: ${key} ${actual[key]} místo ${String(today?.[key])} px`,
          ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
        }
      }
    }
  });
});
