import { describe, expect, it } from 'vitest';

import { chooseLayoutMode, gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceSettingsPanel,
  playStateAfterResize,
} from '../../../src/games/counting/logic/deviceLayout';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import type { LayoutMode } from '../../../src/shared/logic/viewportLayout';
import type { PlayState } from '../../../src/games/counting/logic/deviceLayout';
import { createAnswerRound } from '../../../src/games/counting/logic/answerRound';
import { startDotCounting } from '../../../src/games/counting/logic/dotCounting';
import type { GameSettings } from '../../../src/games/counting/logic/settings';
import type { SettingsLayout } from '../../../src/games/counting/logic/settingsLayout';
import {
  CLOSED_SETTINGS,
  chooseOption,
  confirmSettings,
  isSettingsOpen,
  openSettings,
  selectedOptions,
} from '../../../src/games/counting/logic/settingsSession';
import { seededRandom } from './seededRandom';
import { cssBoxOf, cssSettings, panelCssPlacement, todaySettingsCss } from './parentPanelCss';
import {
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  heightOf,
  viewportOf,
  widthOf,
} from '../../shared/viewportFixtures';
import type { Box, Placement, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #59 (nastavení pro rodiče na telefonu, část a): AC1 pro
 * nastavení, AC2 bez pravidel průvodce, AC3 (nastavení na šířku podle
 * S-sirka-nast), nastavení z AC5 (S-vyska-nast), AC6 přes novou funkci
 * a AC7 pro nastavení. Průvodce sem nepatří (část b).
 *
 * Navržené rozhraní: `layoutDeviceSettingsPanel(area)` v `deviceLayout.ts`
 * vrátí rozložení nastavení pro herní plochu `area` a `placement`, kam
 * a jak zmenšené se panel na herní plochu dá (jednotky panelu → jednotky
 * plochy). Na iPadu a ve zmenšených oknech je to dnešní rozložení 1024 × 768
 * a `panelPlacement(area)`. Volby nově nesou `fontSize` a popisek řady
 * `align`. Všechny polohy se tady přepočítají na CSS px a měří od levého
 * horního rohu volné plochy (okno bez výřezu a lišty domů).
 *
 * Ručně: výřez, lišta, otočení s otevřeným nastavením, ořezání popisků,
 * tužka ve volbě (velikost a okraj), ťuknutí na popisek nebo prázdné místo.
 */

/** Zkušební okna z tabulky v #59 (shodná s #54 a #56). */
const LANDSCAPE_WINDOWS: readonly TestWindow[] = PHONE_WINDOWS;
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_PHONE_WINDOWS: readonly TestWindow[] = [...LANDSCAPE_WINDOWS, ...PORTRAIT_WINDOWS];

/** Okna, kde nastavení zůstane jako dnes (AC1, AC6). */
const UNCHANGED_WINDOWS: readonly TestWindow[] = [
  { name: 'iPad 1180×820', width: 1180, height: 820, safeArea: NO_NOTCH },
  { name: 'iPad 1180×760', width: 1180, height: 760, safeArea: NO_NOTCH },
  { name: '932×500 iPad (hranice)', width: 932, height: 500, safeArea: NO_NOTCH },
  { name: 'iPad na výšku 820×1180', width: 820, height: 1180, safeArea: NO_NOTCH },
  { name: '500×932 zmenšené (hranice)', width: 500, height: 932, safeArea: NO_NOTCH },
  { name: '360×619 zmenšené (hranice)', width: 360, height: 619, safeArea: NO_NOTCH },
  { name: 'zmenšené 667×320', width: 667, height: 320, safeArea: NO_NOTCH },
  { name: 'zmenšené 375×553', width: 375, height: 553, safeArea: NO_NOTCH },
];

const BORDER_LANDSCAPE: TestWindow = {
  name: '932×499 hranice na šířku',
  width: 932,
  height: 499,
  safeArea: NO_NOTCH,
};
const BORDER_PORTRAIT_WIDTH: TestWindow = {
  name: '499×932 hranice na výšku',
  width: 499,
  height: 932,
  safeArea: NO_NOTCH,
};
const BORDER_PORTRAIT_HEIGHT: TestWindow = {
  name: '360×620 hranice na výšku',
  width: 360,
  height: 620,
  safeArea: NO_NOTCH,
};

const MIN_TOUCH_SIDE = 64;
const LABEL_FONT_SIZE = 16;
const LANDSCAPE_OPTION_FONT_SIZE = 28;
const PORTRAIT_OPTION_FONT_SIZE = 32;
/** Písmo voleb na iPadu dnes (`SettingsRows`, 84 px na ploše 1024 × 768). */
const TABLET_OPTION_FONT_SIZE = 84;
/** Odhad délky textu: počet znaků × 0,6 × velikost písma. */
const CHARACTER_WIDTH_RATIO = 0.6;

/** Tolerance ±1 px u středění a výpočtu T (AC3, AC5). */
const CENTER_TOLERANCE = 1;
/** Tolerance u pevných čísel: herní plocha telefonu má celé jednotky (nejvýš ¼ px). */
const EXACT_TOLERANCE = 0.5;

interface PhoneSettings {
  readonly layout: SettingsLayout;
  readonly mode: LayoutMode;
  readonly placement: Placement;
  /** Šířka a výška volné plochy v CSS px. */
  readonly width: number;
  readonly height: number;
  readonly free: Box;
}

function settingsFor(window: TestWindow): PhoneSettings {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutDeviceSettingsPanel(area);
  const free = freeAreaOf(window);
  return {
    layout,
    mode: layout.mode,
    placement: panelCssPlacement(area, layout.placement),
    width: widthOf(free),
    height: heightOf(free),
    free,
  };
}

/** Obdélník v CSS px vůči levému hornímu rohu volné plochy. */
function inFree(b: Box, settings: PhoneSettings): Box {
  return {
    left: b.left - settings.free.left,
    right: b.right - settings.free.left,
    top: b.top - settings.free.top,
    bottom: b.bottom - settings.free.top,
  };
}

function slotBox(
  slot: { x: number; y: number; width: number; height: number },
  settings: PhoneSettings,
): Box {
  return inFree(cssBoxOf(slot, settings.placement), settings);
}

function confirmBox(settings: PhoneSettings): Box {
  const { confirm } = settings.layout;
  return slotBox({ ...confirm, width: confirm.size, height: confirm.size }, settings);
}

function rowBoxes(settings: PhoneSettings, rowIndex: number): Box[] {
  const row = settings.layout.rows[rowIndex];
  expect(row).toBeDefined();
  return (row?.options ?? []).map((option) => slotBox(option, settings));
}

function labelBox(settings: PhoneSettings, rowIndex: number): Box {
  const row = settings.layout.rows[rowIndex];
  if (row === undefined) {
    throw new Error(`Řada ${rowIndex} chybí`);
  }
  return slotBox(row.label, settings);
}

function rowBounds(boxes: readonly Box[]): Box {
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    right: Math.max(...boxes.map((b) => b.right)),
    top: Math.min(...boxes.map((b) => b.top)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

function expectNear(
  actual: number,
  expected: number,
  tolerance = EXACT_TOLERANCE,
  where = '',
): void {
  expect(Math.abs(actual - expected), `${where}: ${actual} místo ${expected}`).toBeLessThanOrEqual(
    tolerance,
  );
}

function expectSpan(
  actual: Box,
  horizontal: [number, number] | null,
  vertical: [number, number] | null,
  tolerance = EXACT_TOLERANCE,
  where = '',
): void {
  if (horizontal) {
    expectNear(actual.left, horizontal[0], tolerance, `${where}, levý okraj`);
    expectNear(actual.right, horizontal[1], tolerance, `${where}, pravý okraj`);
  }
  if (vertical) {
    expectNear(actual.top, vertical[0], tolerance, `${where}, horní okraj`);
    expectNear(actual.bottom, vertical[1], tolerance, `${where}, spodní okraj`);
  }
}

function cssFontSize(size: number, settings: PhoneSettings): number {
  return size * settings.placement.scale;
}

// ---------------------------------------------------------------------------
// AC1: kdy se použije které rozložení
// ---------------------------------------------------------------------------

describe('AC1: nastavení dostane rozložení podle toho, jak se hra na telefonu hraje', () => {
  it('na telefonu na šířku jsou řady vlevo a ✓ vpravo, na výšku řady pod sebou a ✓ pod nimi', () => {
    for (const window of LANDSCAPE_WINDOWS) {
      const settings = settingsFor(window);

      expect(chooseLayoutMode(viewportOf(window)), window.name).toBe('phoneLandscape');
      expect(settings.mode, window.name).toBe('phoneLandscape');
      const rows = rowBounds([0, 1, 2].flatMap((index) => rowBoxes(settings, index)));
      expect(confirmBox(settings).left, window.name).toBeGreaterThan(rows.right);
    }
    for (const window of PORTRAIT_WINDOWS) {
      const settings = settingsFor(window);

      expect(chooseLayoutMode(viewportOf(window)), window.name).toBe('phonePortrait');
      expect(settings.mode, window.name).toBe('phonePortrait');
      const rows = rowBounds([0, 1, 2].flatMap((index) => rowBoxes(settings, index)));
      expect(confirmBox(settings).top, window.name).toBeGreaterThan(rows.bottom);
    }
  });
});

describe('AC1: ostatní okna mají nastavení jako dnes', () => {
  it('popisky, volby i ✓ jsou na stejném místě a stejně velké jako dnes, volby mají písmo jako dnes a popisky jsou na středu nad řadou', () => {
    for (const window of UNCHANGED_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const layout = layoutDeviceSettingsPanel(area);

      expect(cssSettings(layout, panelCssPlacement(area, layout.placement)), window.name).toEqual(
        todaySettingsCss(window),
      );
      for (const row of layout.rows) {
        expect(row.label.align, window.name).toBe('center');
        for (const option of row.options) {
          expect(option.fontSize, window.name).toBe(TABLET_OPTION_FONT_SIZE);
        }
      }
    }
  });

  it('hranice: 932×499 má telefonní nastavení a 932×500 nastavení iPadu, 499×932 a 360×620 telefonní, 500×932 a 360×619 zmenšené jako dnes', () => {
    expect(settingsFor(BORDER_LANDSCAPE).mode).toBe('phoneLandscape');
    expect(settingsFor(UNCHANGED_WINDOWS[2] as TestWindow).mode).toBe('tablet');
    expect(settingsFor(BORDER_PORTRAIT_WIDTH).mode).toBe('phonePortrait');
    expect(settingsFor(UNCHANGED_WINDOWS[4] as TestWindow).mode).toBe('scaled');
    expect(settingsFor(BORDER_PORTRAIT_HEIGHT).mode).toBe('phonePortrait');
    expect(settingsFor(UNCHANGED_WINDOWS[5] as TestWindow).mode).toBe('scaled');
  });

  it('při oknu 0 × 0, záporné šířce nebo chybějícím údaji o okně hra nespadne a nastavení je jako dnes', () => {
    for (const { name, viewport } of [
      { name: 'okno 0 × 0', viewport: { width: 0, height: 0, safeArea: NO_NOTCH } },
      { name: 'záporná šířka', viewport: { width: -390, height: 844, safeArea: NO_NOTCH } },
      { name: 'chybějící údaj o okně', viewport: undefined },
    ]) {
      const area = gameAreaFor(viewport);

      expect(() => layoutDeviceSettingsPanel(area), name).not.toThrow();
      const layout = layoutDeviceSettingsPanel(area);
      expect(layout.mode, name).toBe('scaled');
      expect(cssSettings(layout, panelCssPlacement(area, layout.placement)), name).toEqual(
        todaySettingsCss(undefined),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// AC2: společná pravidla pro všechna telefonní okna (bez pravidel průvodce)
// ---------------------------------------------------------------------------

// Že volby i ✓ mají aspoň 64 × 64 px, mezi nimi je aspoň 8 px, jsou aspoň
// 8 px od okraje volné plochy, nic není pod výřezem ani lištou, nic se
// nepřekrývá a do rohu kolečka (x > W − 80, y < 80) nic nezasahuje, hlídají
// od #81 společná pravidla v `countingLayoutRules.test.ts`.

describe('AC2: na telefonu je nastavení čitelné', () => {
  it('popisky řad mají písmo 16 px', () => {
    for (const window of ALL_PHONE_WINDOWS) {
      const settings = settingsFor(window);
      for (const row of settings.layout.rows) {
        expectNear(cssFontSize(row.label.fontSize, settings), LABEL_FONT_SIZE, 0.01, window.name);
      }
    }
  });

  it('volby mají na šířku písmo 28 px a na výšku 32 px', () => {
    for (const [windows, fontSize] of [
      [LANDSCAPE_WINDOWS, LANDSCAPE_OPTION_FONT_SIZE],
      [PORTRAIT_WINDOWS, PORTRAIT_OPTION_FONT_SIZE],
    ] as const) {
      for (const window of windows) {
        const settings = settingsFor(window);
        for (const option of settings.layout.rows.flatMap((row) => row.options)) {
          expectNear(cssFontSize(option.fontSize, settings), fontSize, 0.01, window.name);
        }
      }
    }
  });

  it('popisky řad (Do kolika, Příklady, Odpověď) se podle odhadu délky vejdou do svého pruhu', () => {
    for (const window of ALL_PHONE_WINDOWS) {
      const settings = settingsFor(window);
      settings.layout.rows.forEach((row, index) => {
        const where = `${window.name}, ${row.label.text}`;
        const estimate = row.label.text.length * CHARACTER_WIDTH_RATIO * LABEL_FONT_SIZE;
        expect(estimate, where).toBeLessThanOrEqual(widthOf(labelBox(settings, index)) + 0.01);
        expect(heightOf(labelBox(settings, index)), where).toBeGreaterThanOrEqual(LABEL_FONT_SIZE);
      });
    }
  });
});

describe('AC2: kolečko na telefonu zůstává', () => {
  it('kolečko zůstává jako v #55, plocha 64 × 64 px 8 px od horního a pravého okraje volné plochy', () => {
    for (const window of ALL_PHONE_WINDOWS) {
      const gear = settingsGearFor(viewportOf(window));

      expect(gear.hitSize, window.name).toBe(MIN_TOUCH_SIDE);
      expect(gear.top, window.name).toBe(window.safeArea.top + 8);
      expect(gear.right, window.name).toBe(window.safeArea.right + 8);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3: nastavení na šířku (S-sirka-nast)
// ---------------------------------------------------------------------------

/** Horní okraj první řady na šířku: T = (H − 248) / 2. */
function landscapeTop(height: number): number {
  return (height - 248) / 2;
}

describe('AC3: na telefonu na šířku jsou řady vlevo pod sebou a ✓ vpravo', () => {
  it('řady Do kolika, Příklady a Odpověď jsou pod sebou v tomto pořadí', () => {
    for (const window of LANDSCAPE_WINDOWS) {
      const settings = settingsFor(window);

      expect(
        settings.layout.rows.map((row) => row.kind),
        window.name,
      ).toEqual(['maxNumber', 'operations', 'answerInput']);
      expect(
        settings.layout.rows.map((row) => row.label.text),
        window.name,
      ).toEqual(['Do kolika', 'Příklady', 'Odpověď']);
    }
  });

  it('popisky, volby, řady a ✓ jsou na místech podle S-sirka-nast', () => {
    const columns: [number, number][] = [
      [112, 216],
      [224, 328],
      [336, 440],
    ];
    for (const window of LANDSCAPE_WINDOWS) {
      const settings = settingsFor(window);
      const where = window.name;
      const top = landscapeTop(settings.height);
      const rowSpans: [number, number][] = [
        [top, top + 72],
        [top + 88, top + 160],
        [top + 176, top + 248],
      ];

      // Popisek je v pruhu x 12–100, zarovnaný vpravo a svisle na středu řady.
      settings.layout.rows.forEach((row, index) => {
        const label = labelBox(settings, index);
        const options = rowBounds(rowBoxes(settings, index));
        expectSpan(label, [12, 100], null, EXACT_TOLERANCE, `${where}, popisek ${index + 1}`);
        expect(row.label.align, where).toBe('right');
        expectNear(
          (label.top + label.bottom) / 2,
          (options.top + options.bottom) / 2,
          EXACT_TOLERANCE,
          `${where}, popisek ${index + 1} na středu řady`,
        );
      });
      // Volby mají 104 × 72 px na x 112–216, 224–328 a 336–440, Odpověď zarovnaná vlevo.
      for (const index of [0, 1, 2]) {
        const boxes = rowBoxes(settings, index);
        expect(boxes, `${where}, řada ${index + 1}`).toHaveLength(index === 2 ? 2 : 3);
        boxes.forEach((option, column) => {
          const at = `${where}, řada ${index + 1}, volba ${column + 1}`;
          expectNear(widthOf(option), 104, EXACT_TOLERANCE, at);
          expectNear(heightOf(option), 72, EXACT_TOLERANCE, at);
          expectSpan(option, columns[column] ?? null, null, EXACT_TOLERANCE, at);
        });
      }
      // Řady jsou na y T až T + 72, T + 88 až T + 160 a T + 176 až T + 248, T = (H − 248) / 2.
      rowSpans.forEach((expected, index) => {
        expectSpan(
          rowBounds(rowBoxes(settings, index)),
          null,
          expected,
          CENTER_TOLERANCE,
          `${where}, řada ${index + 1}`,
        );
      });
      // ✓ má 96 × 96 px na x W − 120 až W − 24, svisle na středu a horní okraj aspoň 100 px.
      const confirm = confirmBox(settings);
      const confirmTop = (settings.height - 96) / 2;
      expectNear(widthOf(confirm), 96, EXACT_TOLERANCE, `${where}, ✓`);
      expectNear(heightOf(confirm), 96, EXACT_TOLERANCE, `${where}, ✓`);
      expectSpan(
        confirm,
        [settings.width - 120, settings.width - 24],
        null,
        EXACT_TOLERANCE,
        `${where}, ✓`,
      );
      expectSpan(
        confirm,
        null,
        [confirmTop, confirmTop + 96],
        CENTER_TOLERANCE,
        `${where}, ✓ na středu`,
      );
      expect(confirm.top, `${where}, ✓ mimo roh kolečka`).toBeGreaterThanOrEqual(
        100 - CENTER_TOLERANCE,
      );
    }
  });

  it('vypočtené hodnoty: 744×296 T = 24 a ✓ na y 100–196, 844×340 s výřezem T = 35,5 a ✓ na y 111,5–207,5, 932×499 T = 125,5', () => {
    const smallest = settingsFor(PHONE_WINDOWS[0] as TestWindow);
    expectSpan(rowBounds(rowBoxes(smallest, 0)), null, [24, 96], CENTER_TOLERANCE, '744×296');
    expectSpan(rowBounds(rowBoxes(smallest, 2)), null, [200, 272], CENTER_TOLERANCE, '744×296');
    expectSpan(confirmBox(smallest), [624, 720], [100, 196], CENTER_TOLERANCE, '744×296');

    const window = PHONE_WINDOWS.find((w) => w.width === 844);
    if (!window) {
      throw new Error('Okno 844×340 chybí');
    }
    const iphone = settingsFor(window);
    expectSpan(rowBounds(rowBoxes(iphone, 0)), null, [35.5, 107.5], CENTER_TOLERANCE, '844×340');
    expectSpan(confirmBox(iphone), [630, 726], [111.5, 207.5], CENTER_TOLERANCE, '844×340');

    const border = settingsFor(BORDER_LANDSCAPE);
    expectSpan(rowBounds(rowBoxes(border, 0)), null, [125.5, 197.5], CENTER_TOLERANCE, '932×499');
    expectSpan(rowBounds(rowBoxes(border, 2)), null, [301.5, 373.5], CENTER_TOLERANCE, '932×499');
  });
});

// ---------------------------------------------------------------------------
// AC5: nastavení na výšku (S-vyska-nast)
// ---------------------------------------------------------------------------

describe('AC5: na telefonu na výšku jsou řady pod sebou na středu a ✓ dole u palce', () => {
  it('volby, řady, popisky a ✓ jsou na místech podle S-vyska-nast', () => {
    const rowSpans: [number, number][] = [
      [114, 194],
      [244, 324],
      [374, 454],
    ];
    const labelSpans: [number, number][] = [
      [88, 108],
      [218, 238],
      [348, 368],
    ];
    for (const window of PORTRAIT_WINDOWS) {
      const settings = settingsFor(window);
      const where = window.name;

      // Volby mají 104 × 80 px s mezerou 8 px, řada tří voleb je široká 328 px a vodorovně na středu.
      for (const index of [0, 1, 2]) {
        const at = `${where}, řada ${index + 1}`;
        const boxes = rowBoxes(settings, index);
        expect(boxes, at).toHaveLength(index === 2 ? 2 : 3);
        for (const option of boxes) {
          expectNear(widthOf(option), 104, EXACT_TOLERANCE, at);
          expectNear(heightOf(option), 80, EXACT_TOLERANCE, at);
        }
        boxes.slice(1).forEach((option, i) => {
          const previous = boxes[i] as Box;
          expectNear(option.left - previous.right, 8, EXACT_TOLERANCE, `${at}, mezera`);
        });
        const bounds = rowBounds(boxes);
        expectNear(widthOf(bounds), index === 2 ? 216 : 328, EXACT_TOLERANCE, at);
        expectNear(
          (bounds.left + bounds.right) / 2,
          settings.width / 2,
          CENTER_TOLERANCE,
          `${at}, na středu`,
        );
        // Řady jsou na y 114–194, 244–324 a 374–454.
        expectSpan(bounds, null, rowSpans[index] ?? null, EXACT_TOLERANCE, at);
      }
      // Popisky jsou v pruhu 20 px na y 88–108, 218–238 a 348–368, na středu 6 px nad řadou.
      settings.layout.rows.forEach((row, index) => {
        const at = `${where}, popisek ${index + 1}`;
        const label = labelBox(settings, index);
        const options = rowBounds(rowBoxes(settings, index));

        expectSpan(label, null, labelSpans[index] ?? null, EXACT_TOLERANCE, at);
        expectNear(options.top - label.bottom, 6, EXACT_TOLERANCE, at);
        expectNear((label.left + label.right) / 2, settings.width / 2, CENTER_TOLERANCE, at);
        expect(row.label.align, at).toBe('center');
      });
      // ✓ má 104 × 104 px, je vodorovně na středu a na y H − 120 až H − 16.
      const confirm = confirmBox(settings);
      expectNear(widthOf(confirm), 104, EXACT_TOLERANCE, `${where}, ✓`);
      expectNear(heightOf(confirm), 104, EXACT_TOLERANCE, `${where}, ✓`);
      expectNear(
        (confirm.left + confirm.right) / 2,
        settings.width / 2,
        CENTER_TOLERANCE,
        `${where}, ✓ na středu`,
      );
      expectSpan(
        confirm,
        null,
        [settings.height - 120, settings.height - 16],
        EXACT_TOLERANCE,
        `${where}, ✓`,
      );
    }
  });

  it('vypočtené hodnoty: 360×620 řady na x 16–344, ✓ na y 500–604 a mezera nad ✓ 46 px, 390×844 s výřezem ✓ na y 643–747', () => {
    const settings = settingsFor(BORDER_PORTRAIT_HEIGHT);
    const confirm = confirmBox(settings);

    expectSpan(rowBounds(rowBoxes(settings, 0)), [16, 344], null, CENTER_TOLERANCE, '360×620');
    expectSpan(confirm, [128, 232], [500, 604], CENTER_TOLERANCE, '360×620');
    expectNear(
      confirm.top - rowBounds(rowBoxes(settings, 2)).bottom,
      46,
      EXACT_TOLERANCE,
      '360×620',
    );

    const window = PHONE_PORTRAIT_WINDOWS.find((w) => w.width === 390 && w.height === 844);
    if (!window) {
      throw new Error('Okno 390×844 chybí');
    }
    expectSpan(confirmBox(settingsFor(window)), null, [643, 747], EXACT_TOLERANCE, '390×844');
  });
});

// ---------------------------------------------------------------------------
// AC7: otočení, lišta a okrajové případy (nastavení)
// ---------------------------------------------------------------------------

const LANDSCAPE_IPHONE = PHONE_WINDOWS.find((w) => w.width === 844) as TestWindow;
const PORTRAIT_IPHONE = PHONE_PORTRAIT_WINDOWS.find(
  (w) => w.width === 390 && w.height === 844,
) as TestWindow;
const PORTRAIT_WITH_BAR = PHONE_PORTRAIT_WINDOWS.find(
  (w) => w.width === 390 && w.height === 664,
) as TestWindow;
const SCALED_LANDSCAPE = UNCHANGED_WINDOWS.find((w) => w.width === 667) as TestWindow;
const IPAD = UNCHANGED_WINDOWS[0] as TestWindow;

const SAVED: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };

function cssOf(window: TestWindow): object {
  const settings = settingsFor(window);
  return cssSettings(settings.layout, settings.placement);
}

describe('AC7: po otočení nebo změně lišty se nastavení přepočítá', () => {
  it('při přechodu šířka → výška → zmenšené → iPad → šířka dostane každé okno své rozložení', () => {
    const sequence = [LANDSCAPE_IPHONE, PORTRAIT_IPHONE, SCALED_LANDSCAPE, IPAD, LANDSCAPE_IPHONE];
    const expectedModes: LayoutMode[] = [
      'phoneLandscape',
      'phonePortrait',
      'scaled',
      'tablet',
      'phoneLandscape',
    ];

    expect(sequence.map((window) => settingsFor(window).mode)).toEqual(expectedModes);
  });

  it('po otočení na výšku a zpět na šířku je nastavení stejné jako před otočením', () => {
    const before = cssOf(LANDSCAPE_IPHONE);
    cssOf(PORTRAIT_IPHONE);
    cssOf(SCALED_LANDSCAPE);

    expect(cssOf(LANDSCAPE_IPHONE)).toEqual(before);
  });

  it('po změně lišty (390×844 s výřezem → 390×664) zůstane ✓ 16 px nad spodním okrajem volné plochy', () => {
    for (const window of [PORTRAIT_IPHONE, PORTRAIT_WITH_BAR]) {
      const settings = settingsFor(window);
      expectSpan(confirmBox(settings), null, [settings.height - 120, settings.height - 16]);
    }
  });

  it('po zmenšení na zmenšené zobrazení a zpět na iPad je nastavení jako dnes', () => {
    cssOf(PORTRAIT_IPHONE);

    expect(cssOf(SCALED_LANDSCAPE)).toEqual(todaySettingsCss(SCALED_LANDSCAPE));
    expect(cssOf(IPAD)).toEqual(todaySettingsCss(IPAD));
  });
});

describe('AC7: otočení s otevřeným nastavením nic neztratí', () => {
  function stateWithOpenSettings(): PlayState {
    const round = createAnswerRound(SAVED, seededRandom());
    const session = chooseOption(openSettings(CLOSED_SETTINGS, SAVED), {
      maxNumber: 20,
      answerInput: 'writing',
    });
    return {
      round,
      settings: SAVED,
      progress: { earned: 3 },
      counting: startDotCounting(round.problem),
      writing: null,
      settingsSession: session,
      guide: null,
    };
  }

  it('vybrané a ještě neuložené volby zůstanou vybrané, panel zůstane otevřený a nic se neuloží', () => {
    const state = stateWithOpenSettings();
    const before = structuredClone(state);

    const after = playStateAfterResize(state, { width: 300, height: 300 });

    expect(isSettingsOpen(after.settingsSession)).toBe(true);
    expect(selectedOptions(after.settingsSession)).toEqual({
      maxNumber: 20,
      operations: 'plus',
      answerInput: 'writing',
    });
    expect(after.settings).toEqual(before.settings);
  });

  it('zavření a znovuotevření nastavení 5× za sebou dá pokaždé stejné rozložení', () => {
    const first = cssOf(PORTRAIT_IPHONE);
    let session = CLOSED_SETTINGS;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      session = openSettings(session, SAVED);
      expect(isSettingsOpen(session)).toBe(true);
      expect(cssOf(PORTRAIT_IPHONE)).toEqual(first);
      session = confirmSettings(session, SAVED, { earned: 0 }).session;
      expect(isSettingsOpen(session)).toBe(false);
    }
  });
});
