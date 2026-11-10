import { describe, expect, it } from 'vitest';

import { lineSizeWave, touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { PALETTE } from '../../../src/games/coloring/logic/palette';
import { COLOR_BUTTON_STYLE, LINE_SIZE_WAVE_STYLE } from '../../../src/games/coloring/logic/theme';
import { COLOR_TOOLS } from '../../../src/games/coloring/logic/toolColors';
import { LINE_SIZES, lineSizeWaveLook } from '../../../src/games/coloring/logic/toolPanel';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { contrastRatio } from '../../../src/shared/logic/theme';
import { MIN_TAP_GAP, MIN_TAP_SIDE } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  gapBetween,
  heightOf,
  isInside,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { PLANNED_LINE_SIZES, coloringCase, coloringCases } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { ALL_SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';

/**
 * Testy rozložení a vzhledu k #112 (tři tlačítka tloušťky čáry
 * v Omalovánkách místo přepínače): AC1 (tlačítka v hlavičce kroku
 * nástrojů, pořadí od nejtenčí, kam patří dotyk), AC3 (vlnka: poměr
 * tlouštěk 3 : 5 : 10, nejtenčí aspoň 3 CSS px, leží v tlačítku, kontrast
 * nebo obrys), AC4 (64 px, 8 px od sousedů i od čáry hlavičky, rozložení
 * 10 nástrojů beze změny) a část AC5 (dotyk do mezery). Každé pravidlo je
 * jeden test, který v cyklu projde všechna okna z `coloringLayoutScenes.ts`
 * (iPad, telefon na šířku i na výšku, hranice, úzký iPad a okna z plochy);
 * případ je popsaný ve zprávě `expect`. Společná pravidla (64 px, 8 px, nic
 * se nepřekrývá, vejde se, panel stejně velký v obou krocích a jako na
 * obrázcích) běží s tlačítky tloušťky i v `coloringLayoutRules.test.ts`
 * a `panelStepsLayoutRules.test.ts`.
 *
 * Nahrazuje testy přepínače s tečkou z #91 (`lineSizeLayoutRules.test.ts`):
 * „ťuknutí na přepínač jde na přepínač“, „se zavřeným panelem ani v kroku
 * barev ťuknutí na místo přepínače velikost nepřepne“, „tečka leží celá
 * v přepínači“ a „tečka je u malé nejmenší a u velké největší“.
 *
 * Od #118 jsou tlačítka čtyři (nejtenčí, malá, střední, velká) a pravidla
 * běží pro všechna čtyři: poměr vlnek je 1,5 : 3 : 5 : 10 (schválení
 * obrázků vlastníkem 2026-11-10), na výšku zabírají tlačítka všechna
 * 4 místa hlavičky. Nová pravidla #118 (vlnka aspoň 1,5× předchozí,
 * nejtenčí aspoň 1,5 CSS px, rozměr panelu) jsou
 * v `thinnestLineSizeLayoutRules.test.ts`.
 *
 * Ze schválených obrázků W1–W4: tlačítko 76 px na iPadu a 64 px na
 * telefonu, mezera 8 px, na telefonu na výšku tlačítka na prvních 3 ze
 * 4 míst hlavičky (od #118 na všech 4 místech), vybraná tloušťka s modrým okrajem 5 px jako vybraný
 * nástroj, obrys #1D1D1F u barev pod 3 : 1 vůči #E5F0FF (7 z 12 barev).
 *
 * Navržené rozhraní:
 * - `coloringLayout.ts`:
 *   - `ColoringLayout.sizeButtons: readonly LayoutRect[]` tlačítka
 *     tloušťky (od #118 čtyři) v pořadí `LINE_SIZES` (nejtenčí, malá,
 *     střední, velká), místo
 *     `sizeToggle`; `colorStepTool` je stejný obdélník jako `sizeButtons[0]`,
 *   - `TouchTarget` `{ kind: 'lineSize'; size: LineSize }` místo
 *     `{ kind: 'sizeToggle' }`, jen v kroku nástrojů,
 *   - `lineSizeWave(button: LayoutRect, size: LineSize): LineSizeWave`
 *     s `LineSizeWave { points: readonly { x: number; y: number }[];
 *     lineWidth: number }`: střední čára vlnky zleva doprava a tloušťka
 *     čáry (kulaté konce) v herních jednotkách; nahrazuje `sizeToggleDot`.
 * - `toolPanel.ts`:
 *   - `lineSizeWaveLook(view: { tool: ToolId; color: number | null }):
 *     { color: string; outlined: boolean }` barva vlnky (`#RRGGBB`) podle
 *     toho, co ukazuje úchyt (`game.handleView()`), a jestli má obrys.
 * - `theme.ts`:
 *   - `LINE_SIZE_WAVE_STYLE { neutralColor: '#1D1D1F'; outlineColor:
 *     '#1D1D1F'; outlineWidthCss: number }` (obrys kreslený vně čáry).
 */

/** Tolerance na zaokrouhlení v herních jednotkách i CSS px. */
const TOLERANCE = 1e-6;

/**
 * Poměr tlouštěk vlnek nejtenčí : malá : střední : velká (#112 AC3, od #118
 * s nejtenčí 1,5 podle schválení obrázků) a tolerance 10 %.
 */
const WAVE_RATIO: Readonly<Record<LineSize, number>> = {
  tiny: 1.5,
  small: 3,
  medium: 5,
  large: 10,
};
const WAVE_RATIO_TOLERANCE = 0.1;

/** Vlnka malé tloušťky je silná aspoň tolik CSS px (#112 AC3; od #118 nejtenčí 1,5 CSS px). */
const MIN_WAVE_CSS = 3;

/** Odstup vlnky od vnitřní hrany okraje tlačítka jako díl strany (#112 AC3). */
const WAVE_INSET_SHARE = 0.1;

/** Pozadí tlačítka, vůči kterému se měří kontrast vlnky (#112 AC3). */
const BUTTON_BACKGROUND = '#E5F0FF';
const MIN_CONTRAST = 3;
const DARK = '#1D1D1F';

/** Nejtenčí obrys vlnky v CSS px (#112 AC3). */
const MIN_OUTLINE_CSS = 1;

/**
 * Barvy pod 3 : 1 vůči #E5F0FF podle výpočtu WCAG na obrázku W3: oranžová,
 * žlutá, zelená, růžová, tělová, šedá a světle modrá. Otázka 8 v issue
 * uvádí jen žlutou, světle modrou a tělovou; podle ní rozhoduje test
 * kontrastu, tento seznam ho jen kontroluje.
 */
const OUTLINED_COLORS = ['orange', 'yellow', 'green', 'pink', 'skin', 'gray', 'lightBlue'];

/** Telefon na šířku ze schválených obrázků (stejný jako v `panelStepsLayoutRules.test.ts`). */
const IPHONE_LANDSCAPE_MOCKUP: TestWindow = {
  name: '844×390 iPhone 13–15 na šířku (výřez 47, lišta 21)',
  width: 844,
  height: 390,
  safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
};

/**
 * Dnešní rozložení 10 nástrojů na schválených obrázcích (#112 AC4 „se
 * nemění“): strana místa a levý horní roh 1. nástroje od rohu panelu
 * v CSS px. iPad: okraj 12, hlavička 76 + mezera 16; telefon 64 + 16.
 */
const TODAY_TOOL_GRID: ReadonlyArray<{
  window: TestWindow;
  side: number;
  left: number;
  top: number;
}> = [
  { window: IPAD_WINDOWS[0] as TestWindow, side: 76, left: 12, top: 104 },
  { window: IPHONE_LANDSCAPE_MOCKUP, side: 64, left: 92, top: 12 },
  { window: PHONE_PORTRAIT_WINDOWS[0] as TestWindow, side: 64, left: 12, top: 92 },
];

const MOCKUP_TOLERANCE = 0.5;

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function casesIn(panel: ColoringCase['panel']): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === panel);
}

/**
 * Okna v kroku nástrojů; každé musí mít všechna tlačítka tloušťky (od #118 čtyři), aby
 * pravidla nad nimi neprošla naprázdno.
 */
function toolStepCases(): ColoringCase[] {
  const tools = casesIn('tools');
  for (const testCase of tools) {
    expect(testCase.sizeButtons.length, `${testCase.scene.label}: tlačítek tloušťky`).toBe(
      PLANNED_LINE_SIZES,
    );
  }
  return tools;
}

/** Hlavička je řada nahoře (iPad, na výšku), nebo sloupec vlevo (telefon na šířku). */
function headerKind(testCase: ColoringCase): 'row' | 'column' {
  return testCase.area.mode === 'phoneLandscape' ? 'column' : 'row';
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function sideOf(rect: LayoutRect): number {
  return Math.min(rect.width, rect.height);
}

/** Každé okno v kroku nástrojů s každým tlačítkem tloušťky. */
function buttonCases(): Array<{
  testCase: ColoringCase;
  button: LayoutRect;
  size: LineSize;
  name: string;
}> {
  return toolStepCases().flatMap((testCase) =>
    ALL_SIZES.map((size, index) => ({
      testCase,
      size,
      button: testCase.layout.sizeButtons[index] as LayoutRect,
      name: `${testCase.scene.label}, ${SIZE_NAMES[size]}`,
    })),
  );
}

/** Obdélník, který zabírá vlnka i s tloušťkou čáry a případným obrysem. */
function waveBounds(points: ReadonlyArray<{ x: number; y: number }>, reach: number): LayoutRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs) - reach;
  const top = Math.min(...ys) - reach;
  return {
    left,
    top,
    width: Math.max(...xs) + reach - left,
    height: Math.max(...ys) + reach - top,
  };
}

/** Má řada hodnot uvnitř aspoň jeden vrchol i jedno údolí (vlnka jde nahoru i dolů)? */
function goesUpAndDown(values: readonly number[]): boolean {
  let peak = false;
  let valley = false;
  for (let index = 1; index < values.length - 1; index += 1) {
    const [before, here, after] = [values[index - 1], values[index], values[index + 1]] as const;
    if (before === undefined || here === undefined || after === undefined) {
      continue;
    }
    peak ||= here > before && here >= after;
    valley ||= here < before && here <= after;
  }
  return peak && valley;
}

describe('#112 AC1: tlačítka tloušťky v hlavičce kroku nástrojů', () => {
  // Upraveno k #118 AC1: tlačítek je od #118 čtyři (`PLANNED_LINE_SIZES`).
  it('ve všech oknech jsou v hlavičce 4 tlačítka tloušťky na místě přepínače', () => {
    for (const testCase of toolStepCases()) {
      const { label } = testCase.scene;
      expect(testCase.layout.sizeButtons.length, `${label}: tlačítek tloušťky`).toBe(
        PLANNED_LINE_SIZES,
      );
      testCase.sizeButtons.forEach((button, index) => {
        expect(
          isInside(button, testCase.panelBox),
          `${label}: tlačítko ${index + 1} v panelu`,
        ).toBe(true);
      });
    }
  });

  it('tlačítka jsou v hlavičce, ne v těle: od nástrojů je dělí čára hlavičky', () => {
    for (const testCase of toolStepCases()) {
      testCase.sizeButtons.forEach((button, index) => {
        const name = `${testCase.scene.label}: tlačítko ${index + 1}`;
        if (headerKind(testCase) === 'row') {
          expect(button.bottom, `${name} nad čárou`).toBeLessThanOrEqual(
            testCase.divider.top + TOLERANCE,
          );
        } else {
          expect(button.right, `${name} vlevo od čáry`).toBeLessThanOrEqual(
            testCase.divider.left + TOLERANCE,
          );
        }
      });
    }
  });

  it('na iPadu a na výšku jdou tlačítka zleva doprava od nejtenčí, na telefonu na šířku shora dolů', () => {
    for (const testCase of toolStepCases()) {
      const kind = headerKind(testCase);
      const buttons = testCase.sizeButtons;
      buttons.slice(1).forEach((button, offset) => {
        const previous = buttons[offset] as Box;
        const name = `${testCase.scene.label}: tlačítko ${offset + 2} za ${offset + 1}`;
        if (kind === 'row') {
          expect(button.left, `${name}, vpravo`).toBeGreaterThan(previous.right - TOLERANCE);
          expect(Math.abs(button.top - previous.top), `${name}, v jedné řadě`).toBeLessThanOrEqual(
            TOLERANCE,
          );
        } else {
          expect(button.top, `${name}, pod ním`).toBeGreaterThan(previous.bottom - TOLERANCE);
          expect(
            Math.abs(button.left - previous.left),
            `${name}, v jednom sloupci`,
          ).toBeLessThanOrEqual(TOLERANCE);
        }
      });
    }
  });

  // Upraveno k #118 AC1: 4 tlačítka na všech 4 místech hlavičky.
  it('tlačítka stojí na místech hlavičky nad sloupci (vedle řádků) nástrojů', () => {
    for (const testCase of toolStepCases()) {
      const { layout } = testCase;
      const columns = new Set(layout.toolSlots.map((slot) => slot.left)).size;
      layout.sizeButtons.forEach((button, index) => {
        const name = `${testCase.scene.label}: tlačítko ${index + 1}`;
        const aligned =
          headerKind(testCase) === 'row'
            ? layout.toolSlots[index]
            : layout.toolSlots[index * columns];
        expect(aligned, `${name}: místo v těle`).toBeDefined();
        if (aligned === undefined) {
          return;
        }
        expect(sideOf(button), `${name}: strana jako nástroj`).toBeCloseTo(sideOf(aligned), 6);
        if (headerKind(testCase) === 'row') {
          expect(button.left, `${name}: nad sloupcem ${index + 1}`).toBeCloseTo(aligned.left, 6);
        } else {
          expect(button.top, `${name}: vedle řádku ${index + 1}`).toBeCloseTo(aligned.top, 6);
        }
      });
    }
  });

  it('ťuknutí na tlačítko v kroku nástrojů jde na jeho tloušťku: nejtenčí, malá, střední, velká', () => {
    for (const { testCase, button, size, name } of buttonCases()) {
      const { x, y } = center(button);
      expect(touchTargetAt(testCase.layout, 'tools', x, y), name).toEqual({
        kind: 'lineSize',
        size,
      });
    }
  });

  // Upraveno k #118 AC1: před malou je nejtenčí.
  it('pořadí tlačítek v rozložení je stejné jako pořadí tlouštěk od nejtenčí', () => {
    expect(LINE_SIZES).toEqual(['tiny', 'small', 'medium', 'large']);
  });

  it('se zavřeným panelem ťuknutí na místo tlačítek tloušťku nezmění', () => {
    for (const testCase of casesIn('closed')) {
      testCase.layout.sizeButtons.forEach((button, index) => {
        const { x, y } = center(button);
        expect(
          touchTargetAt(testCase.layout, 'closed', x, y).kind,
          `${testCase.scene.label}: místo tlačítka ${index + 1}`,
        ).not.toBe('lineSize');
      });
    }
  });

  // Upraveno k #118: míst hlavičky jsou 4.
  it('v kroku barev je na 1. místě vybraný nástroj a ťuknutí na místa 2 až 4 nic nevybere', () => {
    for (const testCase of casesIn('colors')) {
      const { layout } = testCase;
      layout.sizeButtons.forEach((button, index) => {
        const { x, y } = center(button);
        const expected = index === 0 ? { kind: 'backToTools' } : { kind: 'panel' };
        expect(
          touchTargetAt(layout, 'colors', x, y),
          `${testCase.scene.label}: místo ${index + 1} hlavičky`,
        ).toEqual(expected);
      });
    }
  });
});

describe('#112 AC3: vlnka ukazuje tloušťku', () => {
  it('vlnka je krátká vodorovná čára, která jde nahoru i dolů', () => {
    for (const { button, size, name } of buttonCases()) {
      const { points } = lineSizeWave(button, size);
      expect(points.length, `${name}: bodů vlnky`).toBeGreaterThanOrEqual(3);
      const xs = points.map((point) => point.x);
      const bounds = waveBounds(points, 0);
      expect(
        xs.every((x, index) => index === 0 || x > (xs[index - 1] ?? x) - TOLERANCE),
        `${name}: vlnka jde zleva doprava`,
      ).toBe(true);
      expect(bounds.width, `${name}: vlnka je širší než vysoká`).toBeGreaterThan(bounds.height);
      expect(goesUpAndDown(points.map((point) => point.y)), `${name}: vlnka se vlní`).toBe(true);
    }
  });

  // Upraveno k #118 AC3 (schválení obrázků): poměr 1,5 : 3 : 5 : 10 se 4 vlnkami.
  it('tloušťky čar vlnek jsou ve všech oknech v poměru 1,5 : 3 : 5 : 10 s tolerancí 10 %', () => {
    for (const testCase of toolStepCases()) {
      const widths = ALL_SIZES.map((size, index) => {
        const button = testCase.layout.sizeButtons[index] as LayoutRect;
        return lineSizeWave(button, size).lineWidth;
      });
      const large = widths[ALL_SIZES.indexOf('large')] ?? 0;
      expect(large, `${testCase.scene.label}: velká vlnka je vidět`).toBeGreaterThan(0);
      ALL_SIZES.forEach((size, index) => {
        const expected = WAVE_RATIO[size] / WAVE_RATIO.large;
        const actual = (widths[index] ?? 0) / large;
        expect(
          Math.abs(actual - expected),
          `${testCase.scene.label}: ${SIZE_NAMES[size]} : velká je ${actual.toFixed(3)} místo ${expected}`,
        ).toBeLessThanOrEqual(expected * WAVE_RATIO_TOLERANCE + TOLERANCE);
      });
    }
  });

  // Upraveno k #118 AC3: nejtenčí je od #118 nová vlnka (aspoň 1,5 CSS px
  // v `thinnestLineSizeLayoutRules.test.ts`), malá zůstává aspoň 3 CSS px.
  it('čára vlnky malé tloušťky je ve všech oknech silná aspoň 3 CSS px', () => {
    for (const testCase of toolStepCases()) {
      const button = testCase.layout.sizeButtons[ALL_SIZES.indexOf('small')] as LayoutRect;
      const css = lineSizeWave(button, 'small').lineWidth * testCase.area.scale;
      expect(
        css,
        `${testCase.scene.label}: vlnka malé ${css.toFixed(2)} px`,
      ).toBeGreaterThanOrEqual(MIN_WAVE_CSS - TOLERANCE);
    }
  });

  it('celá vlnka i s obrysem leží v tlačítku aspoň 10 % strany od vnitřní hrany označeného okraje', () => {
    for (const { testCase, button, size, name } of buttonCases()) {
      const { scale } = testCase.area;
      const wave = lineSizeWave(button, size);
      // Obrys může mít kterákoli barva, proto se počítá vždy (kreslí se vně čáry).
      const reach = wave.lineWidth / 2 + LINE_SIZE_WAVE_STYLE.outlineWidthCss / scale;
      const bounds = waveBounds(wave.points, reach);
      // Označené tlačítko má silnější okraj než neoznačené, počítá se s ním.
      const border = COLOR_BUTTON_STYLE.selectedBorderWidthCss / scale;
      const inset = border + WAVE_INSET_SHARE * sideOf(button);
      const margins: Array<[string, number]> = [
        ['vlevo', bounds.left - button.left],
        ['nahoře', bounds.top - button.top],
        ['vpravo', button.left + button.width - (bounds.left + bounds.width)],
        ['dole', button.top + button.height - (bounds.top + bounds.height)],
      ];
      for (const [side, margin] of margins) {
        expect(
          margin,
          `${name}: odstup ${side} ${(margin * scale).toFixed(1)} px`,
        ).toBeGreaterThanOrEqual(inset - TOLERANCE);
      }
    }
  });

  it('obrys vlnky je tmavý #1D1D1F a silný aspoň 1 CSS px', () => {
    expect(LINE_SIZE_WAVE_STYLE.outlineColor).toBe(DARK);
    expect(LINE_SIZE_WAVE_STYLE.outlineWidthCss).toBeGreaterThanOrEqual(MIN_OUTLINE_CSS);
  });

  it('u malovacího nástroje má vlnka barvu nástroje ve všech 12 barvách palety', () => {
    for (const tool of COLOR_TOOLS) {
      PALETTE.forEach((color, index) => {
        expect(
          lineSizeWaveLook({ tool, color: index }).color.toUpperCase(),
          `${TOOL_NAMES[tool]}, ${color.id}`,
        ).toBe(color.hex.toUpperCase());
      });
    }
  });

  it('u gumy a duhy je vlnka tmavá #1D1D1F bez obrysu', () => {
    for (const tool of ['eraser', 'rainbow'] as const) {
      const look = lineSizeWaveLook({ tool, color: null });
      expect(look.color.toUpperCase(), TOOL_NAMES[tool]).toBe(DARK);
      expect(look.outlined, `${TOOL_NAMES[tool]}: obrys`).toBe(false);
    }
  });

  it('vlnka má vůči #E5F0FF kontrast aspoň 3 : 1, jinak ji obepíná tmavý obrys, ve všech barvách', () => {
    for (const tool of COLOR_TOOLS) {
      PALETTE.forEach((color, index) => {
        const look = lineSizeWaveLook({ tool, color: index });
        const contrast = contrastRatio(look.color, BUTTON_BACKGROUND);
        const name = `${TOOL_NAMES[tool]}, ${color.id} (kontrast ${contrast.toFixed(2)})`;
        expect(look.outlined, name).toBe(contrast < MIN_CONTRAST);
        if (look.outlined) {
          expect(
            contrastRatio(LINE_SIZE_WAVE_STYLE.outlineColor, BUTTON_BACKGROUND),
            `${name}: obrys je vidět`,
          ).toBeGreaterThanOrEqual(MIN_CONTRAST);
        }
      });
    }
  });

  it('obrys mají právě oranžová, žlutá, zelená, růžová, tělová, šedá a světle modrá', () => {
    const outlined = PALETTE.filter(
      (_, index) => lineSizeWaveLook({ tool: 'brush', color: index }).outlined,
    ).map((color) => color.id);
    expect([...outlined].sort()).toEqual([...OUTLINED_COLORS].sort());
  });

  it('tlačítko tloušťky má pozadí #E5F0FF, vůči kterému se kontrast měří', () => {
    expect(COLOR_BUTTON_STYLE.background.toUpperCase()).toBe(BUTTON_BACKGROUND);
  });
});

describe('#112 AC4: rozložení tlačítek tloušťky', () => {
  it('každé tlačítko tloušťky má ve všech oknech aspoň 64 × 64 CSS px', () => {
    for (const testCase of toolStepCases()) {
      testCase.sizeButtons.forEach((button, index) => {
        const name = `${testCase.scene.label}: tlačítko ${index + 1}`;
        expect(widthOf(button), `${name}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
        expect(heightOf(button), `${name}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE - TOLERANCE);
      });
    }
  });

  it('tlačítko je od sousedního tlačítka aspoň 8 px', () => {
    for (const testCase of toolStepCases()) {
      const buttons = testCase.sizeButtons;
      buttons.slice(1).forEach((button, offset) => {
        expect(
          gapBetween(buttons[offset] as Box, button),
          `${testCase.scene.label}: tlačítka ${offset + 1} a ${offset + 2}`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      });
    }
  });

  it('každé tlačítko je od čáry hlavičky aspoň 8 px', () => {
    for (const testCase of toolStepCases()) {
      testCase.sizeButtons.forEach((button, index) => {
        const gap = gapBetween(button, testCase.divider);
        expect(
          gap,
          `${testCase.scene.label}: tlačítko ${index + 1} od čáry ${gap.toFixed(2)} px`,
        ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
      });
    }
  });

  it('tlačítka tloušťky se celá vejdou do viditelné plochy', () => {
    for (const testCase of toolStepCases()) {
      testCase.sizeButtons.forEach((button, index) => {
        expect(
          isInside(button, testCase.visible),
          `${testCase.scene.label}: tlačítko ${index + 1}`,
        ).toBe(true);
      });
    }
  });

  it('10 nástrojů zůstává na stejných místech jako prvních 10 barev kroku barev', () => {
    for (const testCase of casesIn('tools')) {
      testCase.layout.toolSlots.forEach((slot, index) => {
        expect(slot, `${testCase.scene.label}: nástroj ${index + 1}`).toEqual(
          testCase.layout.paletteColors[index],
        );
      });
    }
  });

  it('rozložení 10 nástrojů je jako dnes: iPad 76 px od 12, 104; telefon na šířku 64 px od 92, 12; na výšku 64 px od 12, 92', () => {
    for (const { window, side, left, top } of TODAY_TOOL_GRID) {
      const testCase = coloringCase(window, 'tools');
      const first = testCase.tools[0] as Box;
      const { label } = testCase.scene;
      expect(Math.abs(widthOf(first) - side), `${label}: strana nástroje`).toBeLessThanOrEqual(
        MOCKUP_TOLERANCE,
      );
      expect(
        Math.abs(first.left - testCase.panelBox.left - left),
        `${label}: 1. nástroj od levého okraje panelu`,
      ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
      expect(
        Math.abs(first.top - testCase.panelBox.top - top),
        `${label}: 1. nástroj od horního okraje panelu`,
      ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
    }
  });
});

describe('#112 AC5: dotyk mimo tlačítka tloušťky', () => {
  it('dotyk do mezery mezi tlačítky tloušťky nic nevybere a nemaluje', () => {
    for (const testCase of toolStepCases()) {
      const { layout } = testCase;
      layout.sizeButtons.slice(1).forEach((button, offset) => {
        const previous = layout.sizeButtons[offset] as LayoutRect;
        const point =
          headerKind(testCase) === 'row'
            ? {
                x: (previous.left + previous.width + button.left) / 2,
                y: button.top + button.height / 2,
              }
            : {
                x: button.left + button.width / 2,
                y: (previous.top + previous.height + button.top) / 2,
              };
        expect(
          touchTargetAt(layout, 'tools', point.x, point.y),
          `${testCase.scene.label}: mezera za tlačítkem ${offset + 1}`,
        ).toEqual({ kind: 'panel' });
      });
    }
  });

  // Nahrazuje „dotyk na prázdné 4. místo hlavičky na výšku nic nevybere“
  // (#112 AC5): od #118 AC1 je na 4. místě tlačítko velké tloušťky.
  it('na výšku je na 4. místě hlavičky tlačítko velké tloušťky, prázdné místo v hlavičce není', () => {
    const portrait = toolStepCases().filter(
      (testCase) =>
        headerKind(testCase) === 'row' &&
        new Set(testCase.layout.toolSlots.map((slot) => slot.left)).size === PLANNED_LINE_SIZES,
    );
    expect(portrait.length, 'okna se 4 místy v hlavičce').toBeGreaterThan(0);
    for (const testCase of portrait) {
      const { layout } = testCase;
      const fourth = layout.toolSlots[3] as LayoutRect;
      const header = layout.sizeButtons[0] as LayoutRect;
      const point = { x: fourth.left + fourth.width / 2, y: header.top + header.height / 2 };
      expect(
        touchTargetAt(layout, 'tools', point.x, point.y),
        `${testCase.scene.label}: 4. místo hlavičky`,
      ).toEqual({ kind: 'lineSize', size: 'large' });
    }
  });
});
