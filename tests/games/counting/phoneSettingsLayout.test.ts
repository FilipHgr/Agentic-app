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
import { cssBoxOf, cssSettings, panelCssPlacement, todaySettingsCss } from './parentPanelSnapshot';
import {
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
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
const MIN_TOUCH_GAP = 8;
const MIN_TOUCH_EDGE = 8;
/** Roh kolečka: x > W − 80 a y < 80 (AC2). */
const GEAR_CORNER = 80;
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

/** Ťukací plochy: volby všech řad a ✓. */
function tapBoxes(settings: PhoneSettings): Box[] {
  return [...[0, 1, 2].flatMap((index) => rowBoxes(settings, index)), confirmBox(settings)];
}

function labelBoxes(settings: PhoneSettings): Box[] {
  return [0, 1, 2].map((index) => labelBox(settings, index));
}

function expectNear(actual: number, expected: number, tolerance = EXACT_TOLERANCE): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectSpan(
  actual: Box,
  horizontal: [number, number] | null,
  vertical: [number, number] | null,
  tolerance = EXACT_TOLERANCE,
): void {
  if (horizontal) {
    expectNear(actual.left, horizontal[0], tolerance);
    expectNear(actual.right, horizontal[1], tolerance);
  }
  if (vertical) {
    expectNear(actual.top, vertical[0], tolerance);
    expectNear(actual.bottom, vertical[1], tolerance);
  }
}

function cssFontSize(size: number, settings: PhoneSettings): number {
  return size * settings.placement.scale;
}

// ---------------------------------------------------------------------------
// AC1: kdy se použije které rozložení
// ---------------------------------------------------------------------------

describe('AC1: nastavení dostane rozložení na šířku tam, kde se hra hraje na telefonu na šířku', () => {
  it.each(LANDSCAPE_WINDOWS)('$name: nastavení je na šířku, řady vlevo a ✓ vpravo', (window) => {
    const settings = settingsFor(window);

    expect(chooseLayoutMode(viewportOf(window))).toBe('phoneLandscape');
    expect(settings.mode).toBe('phoneLandscape');
    const rows = rowBounds([0, 1, 2].flatMap((index) => rowBoxes(settings, index)));
    expect(confirmBox(settings).left).toBeGreaterThan(rows.right);
  });
});

describe('AC1: nastavení dostane rozložení na výšku tam, kde se hra hraje na telefonu na výšku', () => {
  it.each(PORTRAIT_WINDOWS)(
    '$name: nastavení je na výšku, řady pod sebou a ✓ pod nimi',
    (window) => {
      const settings = settingsFor(window);

      expect(chooseLayoutMode(viewportOf(window))).toBe('phonePortrait');
      expect(settings.mode).toBe('phonePortrait');
      const rows = rowBounds([0, 1, 2].flatMap((index) => rowBoxes(settings, index)));
      expect(confirmBox(settings).top).toBeGreaterThan(rows.bottom);
    },
  );
});

describe('AC1: ostatní okna mají nastavení jako dnes', () => {
  it.each(UNCHANGED_WINDOWS)(
    '$name: popisky, volby i ✓ jsou na stejném místě a stejně velké jako dnes',
    (window) => {
      const area = gameAreaFor(viewportOf(window));
      const layout = layoutDeviceSettingsPanel(area);

      expect(cssSettings(layout, panelCssPlacement(area, layout.placement))).toEqual(
        todaySettingsCss(window),
      );
    },
  );

  it.each(UNCHANGED_WINDOWS)(
    '$name: volby mají písmo jako dnes a popisky řad jsou na středu nad řadou',
    (window) => {
      const layout = layoutDeviceSettingsPanel(gameAreaFor(viewportOf(window)));

      for (const row of layout.rows) {
        expect(row.label.align).toBe('center');
        for (const option of row.options) {
          expect(option.fontSize).toBe(TABLET_OPTION_FONT_SIZE);
        }
      }
    },
  );

  it('hranice na šířku: 932×499 má telefonní nastavení, 932×500 nastavení iPadu', () => {
    expect(settingsFor(BORDER_LANDSCAPE).mode).toBe('phoneLandscape');
    expect(settingsFor(UNCHANGED_WINDOWS[2] as TestWindow).mode).toBe('tablet');
  });

  it('hranice na výšku: 499×932 má telefonní nastavení, 500×932 zmenšené jako dnes', () => {
    expect(settingsFor(BORDER_PORTRAIT_WIDTH).mode).toBe('phonePortrait');
    expect(settingsFor(UNCHANGED_WINDOWS[4] as TestWindow).mode).toBe('scaled');
  });

  it('hranice na výšku: 360×620 má telefonní nastavení, 360×619 zmenšené jako dnes', () => {
    expect(settingsFor(BORDER_PORTRAIT_HEIGHT).mode).toBe('phonePortrait');
    expect(settingsFor(UNCHANGED_WINDOWS[5] as TestWindow).mode).toBe('scaled');
  });

  it.each([
    { name: 'okno 0 × 0', viewport: { width: 0, height: 0, safeArea: NO_NOTCH } },
    { name: 'záporná šířka', viewport: { width: -390, height: 844, safeArea: NO_NOTCH } },
    { name: 'chybějící údaj o okně', viewport: undefined },
  ])('$name: hra nespadne a nastavení je jako dnes', ({ viewport }) => {
    const area = gameAreaFor(viewport);

    expect(() => layoutDeviceSettingsPanel(area)).not.toThrow();
    const layout = layoutDeviceSettingsPanel(area);
    expect(layout.mode).toBe('scaled');
    expect(cssSettings(layout, panelCssPlacement(area, layout.placement))).toEqual(
      todaySettingsCss(undefined),
    );
  });
});

// ---------------------------------------------------------------------------
// AC2: společná pravidla pro všechna telefonní okna (bez pravidel průvodce)
// ---------------------------------------------------------------------------

describe('AC2: na telefonu se nastavení pohodlně ovládá prstem', () => {
  it.each(ALL_PHONE_WINDOWS)('$name: volby i ✓ mají aspoň 64 × 64 px', (window) => {
    for (const tap of tapBoxes(settingsFor(window))) {
      expect(widthOf(tap)).toBeGreaterThanOrEqual(MIN_TOUCH_SIDE);
      expect(heightOf(tap)).toBeGreaterThanOrEqual(MIN_TOUCH_SIDE);
    }
  });

  it.each(ALL_PHONE_WINDOWS)('$name: mezi sousedními volbami a ✓ je aspoň 8 px', (window) => {
    const taps = tapBoxes(settingsFor(window));
    taps.forEach((first, i) => {
      taps.slice(i + 1).forEach((second) => {
        expect(gapBetween(first, second)).toBeGreaterThanOrEqual(MIN_TOUCH_GAP);
      });
    });
  });

  it.each(ALL_PHONE_WINDOWS)(
    '$name: volby i ✓ jsou aspoň 8 px od okraje volné plochy',
    (window) => {
      const settings = settingsFor(window);
      const inner: Box = {
        left: MIN_TOUCH_EDGE,
        right: settings.width - MIN_TOUCH_EDGE,
        top: MIN_TOUCH_EDGE,
        bottom: settings.height - MIN_TOUCH_EDGE,
      };
      for (const tap of tapBoxes(settings)) {
        expect(isInside(tap, inner)).toBe(true);
      }
    },
  );
});

describe('AC2: na telefonu je nastavení čitelné', () => {
  it.each(ALL_PHONE_WINDOWS)('$name: popisky řad mají písmo 16 px', (window) => {
    const settings = settingsFor(window);
    for (const row of settings.layout.rows) {
      expectNear(cssFontSize(row.label.fontSize, settings), LABEL_FONT_SIZE, 0.01);
    }
  });

  it.each(LANDSCAPE_WINDOWS)('$name: volby mají na šířku písmo 28 px', (window) => {
    const settings = settingsFor(window);
    for (const option of settings.layout.rows.flatMap((row) => row.options)) {
      expectNear(cssFontSize(option.fontSize, settings), LANDSCAPE_OPTION_FONT_SIZE, 0.01);
    }
  });

  it.each(PORTRAIT_WINDOWS)('$name: volby mají na výšku písmo 32 px', (window) => {
    const settings = settingsFor(window);
    for (const option of settings.layout.rows.flatMap((row) => row.options)) {
      expectNear(cssFontSize(option.fontSize, settings), PORTRAIT_OPTION_FONT_SIZE, 0.01);
    }
  });

  it.each(ALL_PHONE_WINDOWS)(
    '$name: popisky řad (Do kolika, Příklady, Odpověď) se podle odhadu délky vejdou do svého pruhu',
    (window) => {
      const settings = settingsFor(window);
      settings.layout.rows.forEach((row, index) => {
        const estimate = row.label.text.length * CHARACTER_WIDTH_RATIO * LABEL_FONT_SIZE;
        expect(estimate).toBeLessThanOrEqual(widthOf(labelBox(settings, index)) + 0.01);
        expect(heightOf(labelBox(settings, index))).toBeGreaterThanOrEqual(LABEL_FONT_SIZE);
      });
    },
  );
});

describe('AC2: na telefonu nic nepřekáží', () => {
  it.each(ALL_PHONE_WINDOWS)(
    '$name: nic není pod výřezem ani lištou domů, všechno je ve volné ploše',
    (window) => {
      const settings = settingsFor(window);
      const free: Box = { left: 0, right: settings.width, top: 0, bottom: settings.height };
      for (const item of [...labelBoxes(settings), ...tapBoxes(settings)]) {
        expect(isInside(item, free)).toBe(true);
      }
    },
  );

  it.each(ALL_PHONE_WINDOWS)('$name: popisky, volby ani ✓ se nepřekrývají', (window) => {
    const settings = settingsFor(window);
    const items = [...labelBoxes(settings), ...tapBoxes(settings)];
    items.forEach((first, i) => {
      items.slice(i + 1).forEach((second) => {
        expect(overlaps(first, second)).toBe(false);
      });
    });
  });

  it.each(ALL_PHONE_WINDOWS)(
    '$name: do rohu kolečka (x > W − 80, y < 80) nezasahuje žádný popisek, volba ani ✓',
    (window) => {
      const settings = settingsFor(window);
      const corner: Box = {
        left: settings.width - GEAR_CORNER,
        right: settings.width,
        top: 0,
        bottom: GEAR_CORNER,
      };
      for (const item of [...labelBoxes(settings), ...tapBoxes(settings)]) {
        expect(overlaps(item, corner)).toBe(false);
      }
    },
  );

  it.each(ALL_PHONE_WINDOWS)(
    '$name: kolečko zůstává jako v #55, plocha 64 × 64 px 8 px od horního a pravého okraje volné plochy',
    (window) => {
      const gear = settingsGearFor(viewportOf(window));

      expect(gear.hitSize).toBe(MIN_TOUCH_SIDE);
      expect(gear.top).toBe(window.safeArea.top + 8);
      expect(gear.right).toBe(window.safeArea.right + 8);
    },
  );
});

// ---------------------------------------------------------------------------
// AC3: nastavení na šířku (S-sirka-nast)
// ---------------------------------------------------------------------------

/** Horní okraj první řady na šířku: T = (H − 248) / 2. */
function landscapeTop(height: number): number {
  return (height - 248) / 2;
}

describe('AC3: na telefonu na šířku jsou řady vlevo pod sebou a ✓ vpravo', () => {
  it.each(LANDSCAPE_WINDOWS)(
    '$name: řady Do kolika, Příklady a Odpověď jsou pod sebou v tomto pořadí',
    (window) => {
      const settings = settingsFor(window);

      expect(settings.layout.rows.map((row) => row.kind)).toEqual([
        'maxNumber',
        'operations',
        'answerInput',
      ]);
      expect(settings.layout.rows.map((row) => row.label.text)).toEqual([
        'Do kolika',
        'Příklady',
        'Odpověď',
      ]);
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: popisek je v pruhu x 12–100, zarovnaný vpravo a svisle na středu řady',
    (window) => {
      const settings = settingsFor(window);
      settings.layout.rows.forEach((row, index) => {
        const label = labelBox(settings, index);
        const options = rowBounds(rowBoxes(settings, index));

        expectSpan(label, [12, 100], null);
        expect(row.label.align).toBe('right');
        expectNear((label.top + label.bottom) / 2, (options.top + options.bottom) / 2);
      });
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: volby mají 104 × 72 px na x 112–216, 224–328 a 336–440, Odpověď zarovnaná vlevo',
    (window) => {
      const settings = settingsFor(window);
      const columns: [number, number][] = [
        [112, 216],
        [224, 328],
        [336, 440],
      ];
      for (const index of [0, 1, 2]) {
        const boxes = rowBoxes(settings, index);
        expect(boxes).toHaveLength(index === 2 ? 2 : 3);
        boxes.forEach((option, column) => {
          expectNear(widthOf(option), 104);
          expectNear(heightOf(option), 72);
          expectSpan(option, columns[column] ?? null, null);
        });
      }
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: řady jsou na y T až T + 72, T + 88 až T + 160 a T + 176 až T + 248, T = (H − 248) / 2',
    (window) => {
      const settings = settingsFor(window);
      const top = landscapeTop(settings.height);
      const rows: [number, number][] = [
        [top, top + 72],
        [top + 88, top + 160],
        [top + 176, top + 248],
      ];
      rows.forEach((expected, index) => {
        expectSpan(rowBounds(rowBoxes(settings, index)), null, expected, CENTER_TOLERANCE);
      });
    },
  );

  it.each(LANDSCAPE_WINDOWS)(
    '$name: ✓ má 96 × 96 px na x W − 120 až W − 24 a svisle na středu',
    (window) => {
      const settings = settingsFor(window);
      const confirm = confirmBox(settings);
      const top = (settings.height - 96) / 2;

      expectNear(widthOf(confirm), 96);
      expectNear(heightOf(confirm), 96);
      expectSpan(confirm, [settings.width - 120, settings.width - 24], null);
      expectSpan(confirm, null, [top, top + 96], CENTER_TOLERANCE);
    },
  );

  it.each(LANDSCAPE_WINDOWS)('$name: horní okraj ✓ je aspoň 100 px, mimo roh kolečka', (window) => {
    expect(confirmBox(settingsFor(window)).top).toBeGreaterThanOrEqual(100 - CENTER_TOLERANCE);
  });

  it('vypočtené hodnoty 744×296: T = 24, ✓ na y 100–196', () => {
    const settings = settingsFor(PHONE_WINDOWS[0] as TestWindow);

    expectSpan(rowBounds(rowBoxes(settings, 0)), null, [24, 96], CENTER_TOLERANCE);
    expectSpan(rowBounds(rowBoxes(settings, 2)), null, [200, 272], CENTER_TOLERANCE);
    expectSpan(confirmBox(settings), [624, 720], [100, 196], CENTER_TOLERANCE);
  });

  it('vypočtené hodnoty 844×340 s výřezem (volná plocha 750×319): T = 35,5, ✓ na y 111,5–207,5', () => {
    const window = PHONE_WINDOWS.find((w) => w.width === 844);
    if (!window) {
      throw new Error('Okno 844×340 chybí');
    }
    const settings = settingsFor(window);

    expectSpan(rowBounds(rowBoxes(settings, 0)), null, [35.5, 107.5], CENTER_TOLERANCE);
    expectSpan(confirmBox(settings), [630, 726], [111.5, 207.5], CENTER_TOLERANCE);
  });

  it('vypočtené hodnoty 932×499: T = 125,5', () => {
    const settings = settingsFor(BORDER_LANDSCAPE);

    expectSpan(rowBounds(rowBoxes(settings, 0)), null, [125.5, 197.5], CENTER_TOLERANCE);
    expectSpan(rowBounds(rowBoxes(settings, 2)), null, [301.5, 373.5], CENTER_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// AC5: nastavení na výšku (S-vyska-nast)
// ---------------------------------------------------------------------------

describe('AC5: na telefonu na výšku jsou řady pod sebou na středu a ✓ dole u palce', () => {
  it.each(PORTRAIT_WINDOWS)(
    '$name: volby mají 104 × 80 px s mezerou 8 px, řada tří voleb je široká 328 px a vodorovně na středu',
    (window) => {
      const settings = settingsFor(window);
      for (const index of [0, 1, 2]) {
        const boxes = rowBoxes(settings, index);
        expect(boxes).toHaveLength(index === 2 ? 2 : 3);
        for (const option of boxes) {
          expectNear(widthOf(option), 104);
          expectNear(heightOf(option), 80);
        }
        boxes.slice(1).forEach((option, i) => {
          const previous = boxes[i] as Box;
          expectNear(option.left - previous.right, 8);
        });
        const bounds = rowBounds(boxes);
        expectNear(widthOf(bounds), index === 2 ? 216 : 328);
        expectNear((bounds.left + bounds.right) / 2, settings.width / 2, CENTER_TOLERANCE);
      }
    },
  );

  it.each(PORTRAIT_WINDOWS)('$name: řady jsou na y 114–194, 244–324 a 374–454', (window) => {
    const settings = settingsFor(window);
    const rows: [number, number][] = [
      [114, 194],
      [244, 324],
      [374, 454],
    ];
    rows.forEach((expected, index) => {
      expectSpan(rowBounds(rowBoxes(settings, index)), null, expected);
    });
  });

  it.each(PORTRAIT_WINDOWS)(
    '$name: popisky jsou v pruhu 20 px na y 88–108, 218–238 a 348–368, na středu 6 px nad řadou',
    (window) => {
      const settings = settingsFor(window);
      const labels: [number, number][] = [
        [88, 108],
        [218, 238],
        [348, 368],
      ];
      settings.layout.rows.forEach((row, index) => {
        const label = labelBox(settings, index);
        const options = rowBounds(rowBoxes(settings, index));

        expectSpan(label, null, labels[index] ?? null);
        expectNear(options.top - label.bottom, 6);
        expectNear((label.left + label.right) / 2, settings.width / 2, CENTER_TOLERANCE);
        expect(row.label.align).toBe('center');
      });
    },
  );

  it.each(PORTRAIT_WINDOWS)(
    '$name: ✓ má 104 × 104 px, je vodorovně na středu a na y H − 120 až H − 16',
    (window) => {
      const settings = settingsFor(window);
      const confirm = confirmBox(settings);

      expectNear(widthOf(confirm), 104);
      expectNear(heightOf(confirm), 104);
      expectNear((confirm.left + confirm.right) / 2, settings.width / 2, CENTER_TOLERANCE);
      expectSpan(confirm, null, [settings.height - 120, settings.height - 16]);
    },
  );

  it('vypočtené hodnoty 360×620: řady na x 16–344, ✓ na y 500–604, mezera nad ✓ 46 px', () => {
    const settings = settingsFor(BORDER_PORTRAIT_HEIGHT);
    const confirm = confirmBox(settings);

    expectSpan(rowBounds(rowBoxes(settings, 0)), [16, 344], null, CENTER_TOLERANCE);
    expectSpan(confirm, [128, 232], [500, 604], CENTER_TOLERANCE);
    expectNear(confirm.top - rowBounds(rowBoxes(settings, 2)).bottom, 46);
  });

  it('vypočtené hodnoty 390×844 s výřezem (volná plocha 390×763): ✓ na y 643–747', () => {
    const window = PHONE_PORTRAIT_WINDOWS.find((w) => w.width === 390 && w.height === 844);
    if (!window) {
      throw new Error('Okno 390×844 chybí');
    }

    expectSpan(confirmBox(settingsFor(window)), null, [643, 747]);
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
