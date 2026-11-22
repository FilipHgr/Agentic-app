/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  ANSWER_INPUT_OPTIONS,
  MAX_NUMBER_OPTIONS,
} from '../../../src/games/compare/logic/compareSettings';
import { layoutCompareSettings } from '../../../src/games/compare/logic/compareSettingsLayout';
import type {
  CompareSettingsLayout,
  SettingsRowLabels,
} from '../../../src/games/compare/logic/compareSettingsLayout';
import type { Rect } from '../../../src/games/compare/logic/compareLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { dictionariesByLanguage } from '../../shared/textChecks';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  isInside,
  overlaps,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #179 AC4 a #187 AC3, AC6: rozložení nastavení podle obrázků
 * S (2026-11-04) jako pravidla v cyklu přes zkušební okna iPadu, telefonu
 * na šířku i na výšku a přes všechny jazyky se souborem textů, vše
 * měřené v CSS px okna. Od #187 má panel jen řadu „Do kolika“ (10, 20)
 * a ✓: volby a ✓ aspoň 64 px s mezerou pro prst, nic se nepřekrývá ani
 * neleží pod domečkem a kolečkem, popisky se vejdou v každém jazyce.
 */

const MIN_TOUCH_CSS = 64;
const MIN_OPTION_GAP_CSS = 8;
/** Odhad šířky znaku jako díl velikosti písma (bez měření v prohlížeči). */
const CHARACTER_WIDTH_RATIO = 0.6;
const DIGIT_WIDTH_RATIO = 0.62;

const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};

const DEVICE_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_WINDOWS = [...DEVICE_WINDOWS, SCALED_WINDOW];
const PORTRAIT_WINDOWS = [...PHONE_PORTRAIT_WINDOWS, ...PHONE_PORTRAIT_EDGE_WINDOWS];

/** Popisky řad ze souborů textů každého jazyka. */
const LABELS_BY_LANGUAGE: Record<string, SettingsRowLabels> = Object.fromEntries(
  Object.entries(
    dictionariesByLanguage(
      import.meta.glob('../../../src/games/compare/texts/*.ts', { eager: true }),
    ),
  ).map(([language, texts]) => [language, texts['rowLabels'] as SettingsRowLabels]),
);

interface Panel {
  readonly name: string;
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly labels: SettingsRowLabels;
  readonly layout: CompareSettingsLayout;
}

/** Panel nastavení ve všech oknech `windows` a všech jazycích. */
function panels(windows: readonly TestWindow[] = ALL_WINDOWS): Panel[] {
  return windows.flatMap((window) =>
    Object.entries(LABELS_BY_LANGUAGE).map(([language, labels]) => {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      return {
        name: `${language}, ${window.name}`,
        window,
        area,
        labels,
        layout: layoutCompareSettings(area, labels),
      };
    }),
  );
}

function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function centeredRect(x: number, y: number, width: number, height: number): Rect {
  return { left: x - width / 2, top: y - height / 2, width, height };
}

function width(box: Box): number {
  return box.right - box.left;
}

function height(box: Box): number {
  return box.bottom - box.top;
}

/** Plocha pro prst u domečku a u kolečka v CSS px okna. */
function cornerButtons(window: TestWindow): Box[] {
  const home = homeButtonFor(viewportOf(window));
  const gear = settingsGearFor(viewportOf(window));
  return [
    {
      left: home.left,
      right: home.left + home.hitSize,
      top: home.top,
      bottom: home.top + home.hitSize,
    },
    {
      left: window.width - gear.right - gear.hitSize,
      right: window.width - gear.right,
      top: gear.top,
      bottom: gear.top + gear.hitSize,
    },
  ];
}

interface Part {
  readonly name: string;
  readonly box: Box;
}

/** Volby a ✓ v CSS px. */
function tapParts({ layout, area }: Panel): Part[] {
  const options = layout.rows.flatMap((row) =>
    row.options.map((option) => ({
      name: `${row.kind} ${option.value}`,
      box: cssOf(centeredRect(option.x, option.y, option.width, option.height), area),
    })),
  );
  const { confirm } = layout;
  return [
    ...options,
    { name: '✓', box: cssOf(centeredRect(confirm.x, confirm.y, confirm.size, confirm.size), area) },
  ];
}

/** Volby, ✓ i popisky v CSS px. */
function allParts(panel: Panel): Part[] {
  const labels = panel.layout.rows.map((row) => ({
    name: `popisek ${row.kind}`,
    box: cssOf(
      centeredRect(row.label.x, row.label.y, row.label.width, row.label.height),
      panel.area,
    ),
  }));
  return [...tapParts(panel), ...labels];
}

describe('#187 AC3, #188 AC1: nastavení má řady „Do kolika“ (10, 20) a „Odpověď“ a ✓', () => {
  it('rodič vidí řadu rozsahů 10 a 20 a pod ní řadu „Odpověď“ (karty s tečkami a otázka jsou pryč)', () => {
    for (const panel of panels()) {
      expect(
        panel.layout.rows.map((row) => row.kind),
        panel.name,
      ).toEqual(['maxNumber', 'answerInput']);
      expect(
        panel.layout.rows[0]?.options.map((option) => option.value),
        panel.name,
      ).toEqual([...MAX_NUMBER_OPTIONS]);
      expect(
        panel.layout.rows[1]?.options.map((option) => option.value),
        panel.name,
      ).toEqual([...ANSWER_INPUT_OPTIONS]);
    }
  });

  it('tužka psaní se celá vejde do své volby a je dost velká, aby ji rodič poznal', () => {
    for (const panel of panels()) {
      const answerRow = panel.layout.rows.find((row) => row.kind === 'answerInput');
      expect(answerRow, panel.name).toBeDefined();
      for (const option of answerRow?.options ?? []) {
        expect(option.pencilSize, panel.name).toBeLessThanOrEqual(
          Math.min(option.width, option.height),
        );
        expect(option.pencilSize * panel.area.scale, panel.name).toBeGreaterThanOrEqual(36);
      }
    }
  });

  it('číslo rozsahu i „123“ se celé vejdou do volby', () => {
    for (const panel of panels()) {
      for (const option of panel.layout.rows.flatMap((row) => row.options)) {
        if (option.value === 'writing') {
          continue;
        }
        const digits = option.value === 'tap' ? '123'.length : String(option.value).length;
        expect(digits * DIGIT_WIDTH_RATIO * option.fontSize, panel.name).toBeLessThanOrEqual(
          option.width,
        );
        expect(option.fontSize, panel.name).toBeLessThanOrEqual(option.height);
      }
    }
  });
});

describe('#187 AC6: panel nastavení na iPadu i telefonu', () => {
  it('volby a ✓ mají aspoň 64 × 64 px a mezi nimi je aspoň 8 px pro prst', () => {
    for (const panel of panels(DEVICE_WINDOWS)) {
      const parts = tapParts(panel);
      for (const part of parts) {
        expect(width(part.box), `${panel.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
        expect(height(part.box), `${panel.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
      }
      for (const [index, part] of parts.entries()) {
        for (const other of parts.slice(index + 1)) {
          const gapX = Math.max(other.box.left - part.box.right, part.box.left - other.box.right);
          const gapY = Math.max(other.box.top - part.box.bottom, part.box.top - other.box.bottom);
          expect(
            Math.max(gapX, gapY),
            `${panel.name}: ${part.name} × ${other.name}`,
          ).toBeGreaterThanOrEqual(MIN_OPTION_GAP_CSS - 0.01);
        }
      }
    }
  });

  it('celý panel je na obrazovce, nic se nepřekrývá a nic neleží pod domečkem ani kolečkem', () => {
    for (const panel of panels()) {
      const { area } = panel;
      const whole = cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
      const parts = allParts(panel);
      for (const [index, part] of parts.entries()) {
        expect(isInside(part.box, whole), `${panel.name}: ${part.name}`).toBe(true);
        for (const corner of cornerButtons(panel.window)) {
          expect(overlaps(part.box, corner), `${panel.name}: ${part.name} v rohu`).toBe(false);
        }
        for (const other of parts.slice(index + 1)) {
          expect(overlaps(part.box, other.box), `${panel.name}: ${part.name} × ${other.name}`).toBe(
            false,
          );
        }
      }
    }
  });

  it('popisky řad se vejdou do svého místa v každém jazyce', () => {
    for (const panel of panels()) {
      for (const row of panel.layout.rows) {
        const name = `${panel.name}: ${row.kind}`;
        expect(row.label.text, name).toBe(panel.labels[row.kind]);
        expect(
          row.label.text.length * CHARACTER_WIDTH_RATIO * row.label.fontSize,
          name,
        ).toBeLessThanOrEqual(row.label.width);
        expect(row.label.fontSize, name).toBeLessThanOrEqual(row.label.height);
      }
    }
  });

  it('na iPadu je popisek nad řadou a ✓ pod ní, na telefonu na šířku popisek vlevo a ✓ vpravo, na výšku ✓ dole', () => {
    for (const panel of panels()) {
      const { layout, area, name } = panel;
      const last = layout.rows[layout.rows.length - 1];
      const lastOption = last?.options.at(-1);
      if (PHONE_WINDOWS.includes(panel.window)) {
        for (const row of layout.rows) {
          const firstOption = row.options[0];
          expect(row.label.align, name).toBe('right');
          expect(row.label.x + row.label.width / 2, name).toBeLessThanOrEqual(
            (firstOption?.x ?? 0) - (firstOption?.width ?? 0) / 2,
          );
        }
        expect(layout.confirm.x - layout.confirm.size / 2, name).toBeGreaterThan(
          (lastOption?.x ?? 0) + (lastOption?.width ?? 0) / 2,
        );
      } else {
        for (const row of layout.rows) {
          expect(row.label.align, name).toBe('center');
          expect(row.label.y, name).toBeLessThan(row.y);
        }
        expect(layout.confirm.y - layout.confirm.size / 2, name).toBeGreaterThan(
          (last?.y ?? 0) + (lastOption?.height ?? 0) / 2,
        );
        expect(layout.confirm.x, name).toBeCloseTo(area.width / 2, 3);
      }
      if (PORTRAIT_WINDOWS.includes(panel.window)) {
        // ✓ dole u palce: v dolní třetině plochy.
        expect(layout.confirm.y, name).toBeGreaterThan((area.height * 2) / 3);
      }
    }
  });
});
