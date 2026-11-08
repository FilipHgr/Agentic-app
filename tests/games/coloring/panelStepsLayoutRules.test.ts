import { describe, expect, it } from 'vitest';

import { touchTargetAt } from '../../../src/games/coloring/logic/coloringLayout';
import type { LayoutRect } from '../../../src/games/coloring/logic/coloringLayout';
import { MIN_TAP_GAP, MIN_TAP_SIDE } from '../../shared/layoutRules';
import {
  IPAD_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  boundsOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import {
  COLORING_WINDOWS,
  COLOR_STEP_TOOL_NAME,
  MAX_STEP_PLACES,
  PLANNED_COLORS,
  PLANNED_TOOLS,
  SIZE_TOGGLE_NAME,
  coloringCase,
  coloringCases,
  colorName,
  toolName,
} from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';

/**
 * Testy rozložení k #105 (panel Omalovánek ve dvou krocích: nejdřív
 * nástroj, pak barva). AC6: pravidla z #96 AC6 platí pro oba kroky ve všech
 * oknech, krok se vejde, nic nepřekryje a panel má v obou krocích stejný
 * rozměr. K tomu rozložení ze schválených obrázků (komentář vlastníka
 * k issue): krok má nejvýš 13 ploch, v hlavičce je v kroku nástrojů
 * přepínač velikosti a v kroku barev vybraný nástroj, obojí na stejném
 * místě. Na iPadu a na výšku je hlavička řada nahoře, na telefonu na šířku
 * sloupec vlevo, od těla ji dělí čára. A část AC1, AC2, AC4 a AC5, která
 * patří rozložení: kam v kterém kroku patří dotyk.
 *
 * Testy nahrazují testy plného panelu s 23 plochami z #96
 * (`toolPanelLayoutRules.test.ts`). Každé pravidlo je jeden test, který
 * v cyklu projde všechna okna z `coloringLayoutScenes.ts` (iPad, telefon na
 * šířku i na výšku, hranice, úzký iPad a okna z plochy); případ je
 * popsaný ve zprávě `expect`. Společná pravidla (64 px, 8 px, nic se
 * nepřekrývá, vejde se) běží na stejných obrazovkách i v
 * `coloringLayoutRules.test.ts` pro zavřený panel a oba kroky.
 *
 * Navržené rozhraní (`coloringLayout.ts`, `toolPanel.ts`):
 * - `PanelView = 'closed' | 'tools' | 'colors'` (`toolPanel.ts`),
 * - `touchTargetAt(layout, panel: PanelView, x, y): TouchTarget`, nový cíl
 *   `{ kind: 'backToTools' }` (vybraný nástroj na prvním místě kroku barev),
 * - `ColoringLayout.colorStepTool: LayoutRect` vybraný nástroj v hlavičce
 *   kroku barev, stejný obdélník jako `sizeToggle`,
 * - `ColoringLayout.panelDivider` čára mezi hlavičkou a tělem,
 * - `toolSlots` (10) a `paletteColors` (12) jsou tělo kroku nástrojů
 *   a kroku barev na stejném místě panelu.
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

/** Okraj panelu kolem ploch kroku je nejvýš tento (stejně jako dnes, CSS px). */
const MAX_PANEL_PADDING = 12;

/** Rozměry panelu na schválených obrázcích v CSS px (tolerance zaokrouhlení). */
const MOCKUP_TOLERANCE = 0.5;

/** Telefon na šířku z obrázku `panel-telefon-sirka.png`: iPhone 13–15 bez lišty Safari. */
const IPHONE_LANDSCAPE_MOCKUP: TestWindow = {
  name: '844×390 iPhone 13–15 na šířku (výřez 47, lišta 21)',
  width: 844,
  height: 390,
  safeArea: { top: 0, right: 47, bottom: 21, left: 47 },
};

/** Schválené obrázky: okno a rozměr panelu (šířka × výška) v obou krocích. */
const APPROVED_PANELS: ReadonlyArray<{ window: TestWindow; width: number; height: number }> = [
  { window: IPAD_WINDOWS[0] as TestWindow, width: 268, height: 444 },
  { window: IPHONE_LANDSCAPE_MOCKUP, width: 384, height: 232 },
  { window: PHONE_PORTRAIT_WINDOWS[0] as TestWindow, width: 304, height: 312 },
];

let cached: ColoringCase[] | undefined;

function cases(): ColoringCase[] {
  cached ??= coloringCases();
  return cached;
}

function stepCases(): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel !== 'closed');
}

function casesIn(panel: ColoringCase['panel']): ColoringCase[] {
  return cases().filter((testCase) => testCase.panel === panel);
}

/** Hlavička kroku: přepínač velikosti, nebo vybraný nástroj (CSS px). */
function headerOf(testCase: ColoringCase): Box {
  return testCase.panel === 'tools' ? testCase.sizeToggle : testCase.colorStepTool;
}

/** Tělo kroku: 10 nástrojů, nebo 12 barev (CSS px). */
function bodyOf(testCase: ColoringCase): readonly Box[] {
  return testCase.panel === 'tools' ? testCase.tools : testCase.colors;
}

/** Plochy kroku v herních jednotkách, hlavička první. */
function stepRects(testCase: ColoringCase): LayoutRect[] {
  const { layout } = testCase;
  return testCase.panel === 'tools'
    ? [layout.sizeToggle, ...layout.toolSlots]
    : [layout.colorStepTool, ...layout.paletteColors];
}

/** Ťukací plochy kroku podle názvů v obrazovce (bez pozadí panelu). */
function stepItemNames(testCase: ColoringCase): string[] {
  return testCase.scene.items
    .filter((item) => item.tappable === true)
    .map((item) => item.name)
    .filter((name) => /^(barva \d+|nástroj \d+|přepínač velikosti|vybraný nástroj)$/.test(name));
}

/** Je hlavička řada nahoře (iPad, na výšku), nebo sloupec vlevo (telefon na šířku)? */
function expectedHeader(testCase: ColoringCase): 'row' | 'column' {
  return testCase.area.mode === 'phoneLandscape' ? 'column' : 'row';
}

function center(rect: LayoutRect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Body v herních jednotkách rovnoměrně po obdélníku `rect` (kousek od okraje). */
function gridIn(rect: LayoutRect, steps: number): Array<{ x: number; y: number }> {
  const inset = Math.min(rect.width, rect.height) / 1000;
  const points: Array<{ x: number; y: number }> = [];
  for (let row = 0; row <= steps; row += 1) {
    for (let column = 0; column <= steps; column += 1) {
      points.push({
        x: rect.left + inset + ((rect.width - 2 * inset) * column) / steps,
        y: rect.top + inset + ((rect.height - 2 * inset) * row) / steps,
      });
    }
  }
  return points;
}

function containsPoint(rect: LayoutRect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.left &&
    point.x < rect.left + rect.width &&
    point.y >= rect.top &&
    point.y < rect.top + rect.height
  );
}

function where(point: { x: number; y: number }): string {
  return `${Math.round(point.x)}, ${Math.round(point.y)}`;
}

/** Ovládání v pruhu, které panel nesmí překrýt (domeček i s 8 px kolem). */
function stripControls(testCase: ColoringCase): Array<[string, Box]> {
  const homeSurrounding: Box = {
    left: testCase.home.left - MIN_TAP_GAP,
    right: testCase.home.right + MIN_TAP_GAP,
    top: testCase.home.top - MIN_TAP_GAP,
    bottom: testCase.home.bottom + MIN_TAP_GAP,
  };
  return [
    ['domeček a 8 px kolem', homeSurrounding],
    ['úchyt', testCase.handle],
    ['Zpět', testCase.undo],
    ...testCase.recentColors.map((box, index): [string, Box] => [
      `nedávná barva ${index + 1}`,
      box,
    ]),
  ];
}

describe('#105 AC1, AC2: co je v kterém kroku panelu', () => {
  it('zkouší se zavřený panel, krok nástrojů i krok barev ve všech oknech', () => {
    for (const window of COLORING_WINDOWS) {
      const panels = cases()
        .filter((testCase) => testCase.window === window)
        .map((testCase) => testCase.panel)
        .sort();
      expect(panels, window.name).toEqual(['closed', 'colors', 'tools']);
    }
  });

  it('krok nástrojů ukazuje přepínač velikosti a 10 nástrojů, žádnou barvu', () => {
    const expected = [
      SIZE_TOGGLE_NAME,
      ...Array.from({ length: PLANNED_TOOLS }, (_, index) => toolName(index)),
    ];
    for (const testCase of casesIn('tools')) {
      expect(stepItemNames(testCase), `${testCase.scene.label}: plochy kroku`).toEqual(expected);
      expect(testCase.tools.length, `${testCase.scene.label}: míst pro nástroje`).toBe(
        PLANNED_TOOLS,
      );
    }
  });

  it('krok barev ukazuje na prvním místě vybraný nástroj a za ním 12 barev palety', () => {
    const expected = [
      COLOR_STEP_TOOL_NAME,
      ...Array.from({ length: PLANNED_COLORS }, (_, index) => colorName(index)),
    ];
    for (const testCase of casesIn('colors')) {
      expect(stepItemNames(testCase), `${testCase.scene.label}: plochy kroku`).toEqual(expected);
      expect(testCase.colors.length, `${testCase.scene.label}: míst pro barvy`).toBe(
        PLANNED_COLORS,
      );
    }
  });

  it('každý krok má ve všech oknech nejvýš 13 ploch', () => {
    for (const testCase of stepCases()) {
      expect(testCase.stepPlaces.length, `${testCase.scene.label}: plochy kroku`).toBeGreaterThan(
        0,
      );
      expect(
        testCase.stepPlaces.length,
        `${testCase.scene.label}: plochy kroku`,
      ).toBeLessThanOrEqual(MAX_STEP_PLACES);
    }
  });
});

describe('#105 AC6: pravidla rozložení z #96 platí pro oba kroky ve všech oknech', () => {
  it('každá plocha kroku má aspoň 64 × 64 px a leží celá v panelu', () => {
    for (const testCase of stepCases()) {
      testCase.stepPlaces.forEach((place, index) => {
        const name = `${testCase.scene.label}: plocha ${index + 1}`;
        expect(widthOf(place), `${name}, šířka`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        expect(heightOf(place), `${name}, výška`).toBeGreaterThanOrEqual(MIN_TAP_SIDE);
        expect(isInside(place, testCase.panelBox), `${name} v panelu`).toBe(true);
      });
    }
  });

  it('mezi každými dvěma plochami kroku je aspoň 8 px', () => {
    for (const testCase of stepCases()) {
      const places = testCase.stepPlaces;
      places.forEach((first, firstIndex) => {
        places.slice(firstIndex + 1).forEach((second, offset) => {
          expect(
            gapBetween(first, second),
            `${testCase.scene.label}: plochy ${firstIndex + 1} a ${firstIndex + offset + 2}`,
          ).toBeGreaterThanOrEqual(MIN_TAP_GAP - TOLERANCE);
        });
      });
    }
  });

  it('krok se celý vejde do viditelné plochy', () => {
    for (const testCase of stepCases()) {
      const { label } = testCase.scene;
      expect(isInside(testCase.panelBox, testCase.visible), `${label}: panel`).toBe(true);
      testCase.stepPlaces.forEach((place, index) => {
        expect(isInside(place, testCase.visible), `${label}: plocha ${index + 1}`).toBe(true);
      });
    }
  });

  it('krok nepřekryje domeček ani 8 px kolem něj, úchyt, Zpět ani nedávné barvy', () => {
    for (const testCase of stepCases()) {
      for (const [name, control] of stripControls(testCase)) {
        expect(
          overlaps(testCase.panelBox, control),
          `${testCase.scene.label}: panel překrývá ${name}`,
        ).toBe(false);
      }
    }
  });

  it('panel má v kroku nástrojů i v kroku barev stejný rozměr a stejné místo', () => {
    for (const window of COLORING_WINDOWS) {
      const tools = coloringCase(window, 'tools');
      const colors = coloringCase(window, 'colors');
      expect(colors.panelBox, `${window.name}: panel v kroku barev a nástrojů`).toEqual(
        tools.panelBox,
      );
      expect(
        boundsOf(colors.stepPlaces),
        `${window.name}: plochy kroku barev zabírají stejný obdélník jako krok nástrojů`,
      ).toEqual(boundsOf(tools.stepPlaces));
    }
  });

  it('panel není větší, než krok potřebuje: kolem ploch kroku je okraj nejvýš 12 px', () => {
    for (const testCase of stepCases()) {
      const places = boundsOf(testCase.stepPlaces);
      const panel = testCase.panelBox;
      const margins: Array<[string, number]> = [
        ['vlevo', places.left - panel.left],
        ['vpravo', panel.right - places.right],
        ['nahoře', places.top - panel.top],
        ['dole', panel.bottom - places.bottom],
      ];
      for (const [side, margin] of margins) {
        expect(margin, `${testCase.scene.label}: okraj ${side}`).toBeLessThanOrEqual(
          MAX_PANEL_PADDING + TOLERANCE,
        );
      }
    }
  });

  it('panel má rozměr ze schválených obrázků: iPad 268 × 444, telefon na šířku 384 × 232, na výšku 304 × 312 px', () => {
    for (const { window, width, height } of APPROVED_PANELS) {
      for (const panel of ['tools', 'colors'] as const) {
        const testCase = coloringCase(window, panel);
        const { label } = testCase.scene;
        expect(
          Math.abs(widthOf(testCase.panelBox) - width),
          `${label}: šířka panelu ${widthOf(testCase.panelBox)} místo ${width} px`,
        ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
        expect(
          Math.abs(heightOf(testCase.panelBox) - height),
          `${label}: výška panelu ${heightOf(testCase.panelBox)} místo ${height} px`,
        ).toBeLessThanOrEqual(MOCKUP_TOLERANCE);
      }
    }
  });
});

describe('#105: hlavička kroku podle schválených obrázků', () => {
  it('vybraný nástroj v kroku barev je na stejném místě jako přepínač velikosti v kroku nástrojů', () => {
    for (const testCase of cases()) {
      expect(testCase.layout.colorStepTool, testCase.scene.label).toEqual(
        testCase.layout.sizeToggle,
      );
    }
  });

  it('na iPadu a na výšku je hlavička řada nad tělem, na telefonu na šířku sloupec vlevo od těla', () => {
    for (const testCase of stepCases()) {
      const header = headerOf(testCase);
      const body = boundsOf(bodyOf(testCase));
      const kind = expectedHeader(testCase);
      const label = `${testCase.scene.label}: hlavička jako ${kind === 'row' ? 'řada nahoře' : 'sloupec vlevo'}`;
      if (kind === 'row') {
        expect(body.top - header.bottom, `${label}, mezera k tělu`).toBeGreaterThanOrEqual(
          MIN_TAP_GAP - TOLERANCE,
        );
        expect(Math.abs(header.left - body.left), `${label}, zarovnaná vlevo`).toBeLessThanOrEqual(
          TOLERANCE,
        );
      } else {
        expect(body.left - header.right, `${label}, mezera k tělu`).toBeGreaterThanOrEqual(
          MIN_TAP_GAP - TOLERANCE,
        );
        expect(Math.abs(header.top - body.top), `${label}, zarovnaná nahoře`).toBeLessThanOrEqual(
          TOLERANCE,
        );
      }
    }
  });

  it('hlavičku od těla dělí čára uvnitř panelu, která nepřekrývá žádnou plochu kroku', () => {
    for (const testCase of stepCases()) {
      const { label } = testCase.scene;
      const header = headerOf(testCase);
      const body = boundsOf(bodyOf(testCase));
      const line = testCase.divider;
      expect(isInside(line, testCase.panelBox), `${label}: čára v panelu`).toBe(true);
      if (expectedHeader(testCase) === 'row') {
        expect(widthOf(line) > heightOf(line), `${label}: čára vodorovně`).toBe(true);
        expect(line.top, `${label}: čára pod hlavičkou`).toBeGreaterThanOrEqual(
          header.bottom - TOLERANCE,
        );
        expect(line.bottom, `${label}: čára nad tělem`).toBeLessThanOrEqual(body.top + TOLERANCE);
      } else {
        expect(heightOf(line) > widthOf(line), `${label}: čára svisle`).toBe(true);
        expect(line.left, `${label}: čára vpravo od hlavičky`).toBeGreaterThanOrEqual(
          header.right - TOLERANCE,
        );
        expect(line.right, `${label}: čára vlevo od těla`).toBeLessThanOrEqual(
          body.left + TOLERANCE,
        );
      }
      testCase.stepPlaces.forEach((place, index) => {
        expect(overlaps(line, place), `${label}: čára na ploše ${index + 1}`).toBe(false);
      });
    }
  });
});

describe('#105 AC2, AC4, AC5: kam patří dotyk v krocích panelu', () => {
  it('v kroku nástrojů ťuknutí na nástroj jde na ten nástroj a na přepínač na přepínač velikosti', () => {
    for (const testCase of casesIn('tools')) {
      const { layout } = testCase;
      layout.toolSlots.forEach((slot, index) => {
        const { x, y } = center(slot);
        expect(
          touchTargetAt(layout, 'tools', x, y),
          `${testCase.scene.label}: nástroj ${index + 1}`,
        ).toEqual({ kind: 'tool', index });
      });
      const toggle = center(layout.sizeToggle);
      expect(
        touchTargetAt(layout, 'tools', toggle.x, toggle.y),
        `${testCase.scene.label}: přepínač`,
      ).toEqual({ kind: 'sizeToggle' });
    }
  });

  it('v kroku barev ťuknutí na barvu jde na tu barvu a na vybraný nástroj vrátí panel k nástrojům', () => {
    for (const testCase of casesIn('colors')) {
      const { layout } = testCase;
      layout.paletteColors.forEach((slot, index) => {
        const { x, y } = center(slot);
        expect(
          touchTargetAt(layout, 'colors', x, y),
          `${testCase.scene.label}: barva ${index + 1}`,
        ).toEqual({ kind: 'color', index });
      });
      const back = center(layout.colorStepTool);
      expect(
        touchTargetAt(layout, 'colors', back.x, back.y),
        `${testCase.scene.label}: vybraný nástroj`,
      ).toEqual({ kind: 'backToTools' });
    }
  });

  it('v kroku nástrojů nejde vybrat barvu a v kroku barev nástroj ani velikost', () => {
    const allowed: Record<'tools' | 'colors', readonly string[]> = {
      tools: ['tool', 'sizeToggle', 'panel'],
      colors: ['color', 'backToTools', 'panel'],
    };
    for (const testCase of stepCases()) {
      const step = testCase.panel === 'tools' ? 'tools' : 'colors';
      for (const point of gridIn(testCase.layout.panel, 40)) {
        const { kind } = touchTargetAt(testCase.layout, step, point.x, point.y);
        expect(
          allowed[step],
          `${testCase.scene.label}: dotyk v ${where(point)} je ${kind}`,
        ).toContain(kind);
      }
    }
  });

  it('dotyk na prázdné místo nebo do mezery panelu v obou krocích nic nevybere a nemaluje', () => {
    for (const testCase of stepCases()) {
      const places = stepRects(testCase);
      const empty = gridIn(testCase.layout.panel, 40).filter(
        (point) => !places.some((place) => containsPoint(place, point)),
      );
      expect(empty.length, `${testCase.scene.label}: body mimo plochy kroku`).toBeGreaterThan(0);
      for (const point of empty) {
        expect(
          touchTargetAt(testCase.layout, testCase.panel, point.x, point.y),
          `${testCase.scene.label}: dotyk v ${where(point)}`,
        ).toEqual({ kind: 'panel' });
      }
    }
  });

  it('se zavřeným panelem nejde na místě panelu vybrat nástroj, barvu, velikost ani návrat', () => {
    const panelKinds = ['tool', 'color', 'sizeToggle', 'backToTools', 'panel'];
    for (const testCase of casesIn('closed')) {
      for (const point of gridIn(testCase.layout.panel, 40)) {
        const { kind } = touchTargetAt(testCase.layout, 'closed', point.x, point.y);
        expect(
          panelKinds,
          `${testCase.scene.label}: dotyk v ${where(point)} je ${kind}`,
        ).not.toContain(kind);
      }
    }
  });

  it('Zpět a obě nedávné barvy jdou ťuknout se zavřeným panelem i v obou krocích', () => {
    for (const testCase of cases()) {
      const undo = center(testCase.layout.undoButton);
      expect(
        touchTargetAt(testCase.layout, testCase.panel, undo.x, undo.y),
        `${testCase.scene.label}: Zpět`,
      ).toEqual({ kind: 'undo' });
      testCase.layout.recentColors.forEach((recent, index) => {
        const { x, y } = center(recent);
        expect(
          touchTargetAt(testCase.layout, testCase.panel, x, y),
          `${testCase.scene.label}: nedávná barva ${index + 1}`,
        ).toEqual({ kind: 'recentColor', index });
      });
    }
  });
});
