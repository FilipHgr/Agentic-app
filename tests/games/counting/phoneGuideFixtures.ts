/**
 * Pomůcky pro testy průvodce nastavením na telefonu (#60, část b z #59).
 * Všechny polohy se přepočítají na CSS px a měří od levého horního rohu
 * volné plochy (okno bez výřezu a lišty domů), jak to říká zadání.
 *
 * Navržené rozhraní: `layoutDeviceGuideStep(area, step)` v `deviceLayout.ts`
 * (obdoba `layoutDeviceSettingsPanel`) vrátí pro herní plochu `area` celé
 * rozložení jednoho kroku průvodce: řady voleb, vzhled voleb, radu, Zpět,
 * ukazatel kroku, Další / Začít hrát, reproduktor, rámeček, druh
 * rozložení `mode` a `placement` (jednotky průvodce → jednotky plochy).
 */

import { expect } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { layoutDeviceGuideStep } from '../../../src/games/counting/logic/deviceLayout';
import type { DeviceGuideLayout } from '../../../src/games/counting/logic/deviceLayout';
import type { LayoutMode } from '../../../src/shared/logic/viewportLayout';
import type { GuideStep } from '../../../src/games/counting/logic/setupGuide';
import { cssBoxOf, panelCssPlacement } from './parentPanelCss';
import { boundsOf, freeAreaOf, heightOf, viewportOf, widthOf } from '../../shared/viewportFixtures';
import type { Box, Placement, TestWindow } from '../../shared/viewportFixtures';

export const STEPS: readonly GuideStep[] = [1, 2, 3, 4];

/** Tolerance u pevných čísel: herní plocha telefonu má celé jednotky (nejvýš ¼ px). */
export const EXACT_TOLERANCE = 0.5;
/** Tolerance ±1 px u středění a výpočtu T (AC4, AC5). */
export const CENTER_TOLERANCE = 1;

export interface PhoneGuide {
  readonly layout: DeviceGuideLayout;
  readonly mode: LayoutMode;
  readonly placement: Placement;
  /** Šířka a výška volné plochy v CSS px. */
  readonly width: number;
  readonly height: number;
  readonly free: Box;
}

export function guideFor(window: TestWindow, step: GuideStep): PhoneGuide {
  const area = gameAreaFor(viewportOf(window));
  const layout = layoutDeviceGuideStep(area, step);
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

interface CenteredSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Obdélník slotu v CSS px vůči levému hornímu rohu volné plochy. */
export function slotBox(slot: CenteredSlot, guide: PhoneGuide): Box {
  const b = cssBoxOf(slot, guide.placement);
  return {
    left: b.left - guide.free.left,
    right: b.right - guide.free.left,
    top: b.top - guide.free.top,
    bottom: b.bottom - guide.free.top,
  };
}

export function cssSize(size: number, guide: PhoneGuide): number {
  return size * guide.placement.scale;
}

export function optionBoxes(guide: PhoneGuide, rowIndex: number): Box[] {
  const row = guide.layout.rows[rowIndex];
  expect(row).toBeDefined();
  return (row?.options ?? []).map((option) => slotBox(option, guide));
}

export function rowBox(guide: PhoneGuide, rowIndex: number): Box {
  return boundsOf(optionBoxes(guide, rowIndex));
}

export function labelBox(guide: PhoneGuide, rowIndex: number): Box {
  const row = guide.layout.rows[rowIndex];
  if (row === undefined) {
    throw new Error(`Řada ${rowIndex} chybí`);
  }
  return slotBox(row.label, guide);
}

export function messageBox(guide: PhoneGuide): Box {
  return slotBox(guide.layout.message, guide);
}

export function indicatorBox(guide: PhoneGuide): Box {
  return slotBox(guide.layout.indicator, guide);
}

export function rightBox(guide: PhoneGuide): Box {
  return slotBox(guide.layout.right, guide);
}

export function speakerBox(guide: PhoneGuide): Box {
  return slotBox(guide.layout.speaker, guide);
}

export function backBox(guide: PhoneGuide): Box | null {
  return guide.layout.back ? slotBox(guide.layout.back, guide) : null;
}

export function frameBox(guide: PhoneGuide): Box | null {
  return guide.layout.frame ? slotBox(guide.layout.frame, guide) : null;
}

export function expectNear(
  actual: number,
  expected: number,
  tolerance = EXACT_TOLERANCE,
  where = '',
): void {
  expect(Math.abs(actual - expected), `${where}: ${actual} místo ${expected}`).toBeLessThanOrEqual(
    tolerance,
  );
}

export function expectSpan(
  actual: Box | null,
  horizontal: readonly [number, number] | null,
  vertical: readonly [number, number] | null,
  tolerance = EXACT_TOLERANCE,
  where = '',
): void {
  expect(actual, where).not.toBeNull();
  if (actual === null) {
    return;
  }
  if (horizontal) {
    expectNear(actual.left, horizontal[0], tolerance, `${where}, levý okraj`);
    expectNear(actual.right, horizontal[1], tolerance, `${where}, pravý okraj`);
  }
  if (vertical) {
    expectNear(actual.top, vertical[0], tolerance, `${where}, horní okraj`);
    expectNear(actual.bottom, vertical[1], tolerance, `${where}, spodní okraj`);
  }
}

// ---------------------------------------------------------------------------
// Hodnoty ze zadání: AC4 (na šířku) a průvodce z AC5 (na výšku)
// ---------------------------------------------------------------------------

/** Horní okraj první řady na šířku: T = (H − 236) / 2 (AC4). */
export function landscapeGuideTop(height: number): number {
  return (height - 236) / 2;
}

/** Svislé rozpětí řad na šířku: T až T + 68, T + 84 až T + 152, T + 168 až T + 236. */
export function landscapeRowSpans(height: number): [number, number][] {
  const top = landscapeGuideTop(height);
  return [
    [top, top + 68],
    [top + 84, top + 152],
    [top + 168, top + 236],
  ];
}

/** Na výšku: řady na y 114–186, 228–300 a 342–414 (AC5). */
export const PORTRAIT_ROW_SPANS: readonly [number, number][] = [
  [114, 186],
  [228, 300],
  [342, 414],
];

/** Na výšku: popisky v pruhu 20 px na y 88–108, 202–222 a 316–336 (AC5). */
export const PORTRAIT_LABEL_SPANS: readonly [number, number][] = [
  [88, 108],
  [202, 222],
  [316, 336],
];

/** Na výšku: rámeček na y 80–194, 194–308, nebo 308–422 (AC5). */
export const PORTRAIT_FRAME_SPANS: readonly [number, number][] = [
  [80, 194],
  [194, 308],
  [308, 422],
];

/** Řada tlačítek na výšku: Zpět 80, reproduktor 64, ukazatel 48, Další 128, mezery 8 (AC5). */
export function portraitButtonSpans(width: number): {
  back: [number, number];
  speaker: [number, number];
  indicator: [number, number];
  right: [number, number];
} {
  const left = (width - 344) / 2;
  return {
    back: [left, left + 80],
    speaker: [left + 88, left + 152],
    indicator: [left + 160, left + 208],
    right: [left + 216, left + 344],
  };
}

/**
 * Ověří všechny pevné polohy kroku průvodce na šířku podle AC4:
 * řady, popisky, rámeček, rada, ukazatel kroku a tlačítka.
 */
export function expectLandscapeGuideSpec(window: TestWindow, step: GuideStep): void {
  const guide = guideFor(window, step);
  const { width: w, height: h } = guide;
  const where = `${window.name}, krok ${step}`;
  const rows = landscapeRowSpans(h);
  const columns: [number, number][] = [
    [112, 208],
    [216, 312],
    [320, 416],
  ];

  expect(guide.mode, where).toBe('phoneLandscape');
  rows.forEach((span, index) => {
    optionBoxes(guide, index).forEach((option, column) => {
      expectSpan(
        option,
        columns[column] ?? null,
        span,
        CENTER_TOLERANCE,
        `${where}, řada ${index + 1}, volba ${column + 1}`,
      );
    });
    expectSpan(labelBox(guide, index), [12, 100], null, EXACT_TOLERANCE, `${where}, popisek`);
  });

  const focused = step === 4 ? null : rows[step - 1];
  if (focused) {
    expectSpan(
      frameBox(guide),
      [4, 424],
      [focused[0] - 8, focused[1] + 8],
      CENTER_TOLERANCE,
      `${where}, rámeček`,
    );
  } else {
    expect(frameBox(guide), where).toBeNull();
  }

  expectSpan(messageBox(guide), [w - 304, w - 16], [80, 168], EXACT_TOLERANCE, `${where}, rada`);
  expectSpan(indicatorBox(guide), null, [h - 108, h - 88], EXACT_TOLERANCE, `${where}, ukazatel`);
  const indicator = indicatorBox(guide);
  expectNear(
    (indicator.left + indicator.right) / 2,
    w - 160,
    CENTER_TOLERANCE,
    `${where}, ukazatel na středu`,
  );
  if (step === 1) {
    expect(backBox(guide), where).toBeNull();
  } else {
    expectSpan(
      backBox(guide),
      [w - 304, w - 224],
      [h - 80, h - 16],
      EXACT_TOLERANCE,
      `${where}, Zpět`,
    );
  }
  expectSpan(
    speakerBox(guide),
    [w - 216, w - 152],
    [h - 80, h - 16],
    EXACT_TOLERANCE,
    `${where}, reproduktor`,
  );
  expectSpan(
    rightBox(guide),
    [w - 144, w - 16],
    [h - 80, h - 16],
    EXACT_TOLERANCE,
    `${where}, Další`,
  );
}

/**
 * Ověří všechny pevné polohy kroku průvodce na výšku podle AC5:
 * řady, popisky, rámeček, rada a řada tlačítek.
 */
export function expectPortraitGuideSpec(window: TestWindow, step: GuideStep): void {
  const guide = guideFor(window, step);
  const { width: w, height: h } = guide;
  const where = `${window.name}, krok ${step}`;
  const centerX = w / 2;

  expect(guide.mode, where).toBe('phonePortrait');
  PORTRAIT_ROW_SPANS.forEach((span, index) => {
    const at = `${where}, řada ${index + 1}`;
    const row = rowBox(guide, index);
    expectSpan(row, null, span, EXACT_TOLERANCE, at);
    expectNear(widthOf(row), index === 2 ? 216 : 328, EXACT_TOLERANCE, at);
    expectNear((row.left + row.right) / 2, centerX, CENTER_TOLERANCE, at);
    const label = labelBox(guide, index);
    expectSpan(label, null, PORTRAIT_LABEL_SPANS[index] ?? null, EXACT_TOLERANCE, `${at}, popisek`);
    expectNear((label.left + label.right) / 2, centerX, CENTER_TOLERANCE, `${at}, popisek`);
  });

  const focusedIndex = step === 4 ? null : step - 1;
  if (focusedIndex === null) {
    expect(frameBox(guide), where).toBeNull();
  } else {
    const row = rowBox(guide, focusedIndex);
    expectSpan(
      frameBox(guide),
      [row.left - 8, row.right + 8],
      PORTRAIT_FRAME_SPANS[focusedIndex] ?? null,
      EXACT_TOLERANCE,
      `${where}, rámeček`,
    );
  }

  expectSpan(messageBox(guide), [16, w - 16], [h - 180, h - 92], EXACT_TOLERANCE, `${where}, rada`);
  const buttons = portraitButtonSpans(w);
  const buttonRow: [number, number] = [h - 80, h - 16];
  if (step === 1) {
    expect(backBox(guide), where).toBeNull();
  } else {
    expectSpan(backBox(guide), buttons.back, buttonRow, CENTER_TOLERANCE, `${where}, Zpět`);
  }
  expectSpan(
    speakerBox(guide),
    buttons.speaker,
    buttonRow,
    CENTER_TOLERANCE,
    `${where}, reproduktor`,
  );
  expectSpan(rightBox(guide), buttons.right, buttonRow, CENTER_TOLERANCE, `${where}, Další`);
  expectSpan(indicatorBox(guide), buttons.indicator, null, CENTER_TOLERANCE, `${where}, ukazatel`);
  const indicator = indicatorBox(guide);
  expect(indicator.top, `${where}, ukazatel v řadě tlačítek`).toBeGreaterThanOrEqual(
    buttonRow[0] - EXACT_TOLERANCE,
  );
  expect(indicator.bottom, `${where}, ukazatel v řadě tlačítek`).toBeLessThanOrEqual(
    buttonRow[1] + EXACT_TOLERANCE,
  );
}
