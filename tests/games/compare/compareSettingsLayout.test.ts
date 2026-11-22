/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import {
  cardDots,
  cardNumeral,
  layoutCompareScreen,
} from '../../../src/games/compare/logic/compareLayout';
import type { Dot, Rect } from '../../../src/games/compare/logic/compareLayout';
import { MAX_NUMBER_OPTIONS, SHOW_OPTIONS } from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings } from '../../../src/games/compare/logic/compareSettings';
import {
  layoutCompareSettings,
  showOptionIcon,
} from '../../../src/games/compare/logic/compareSettingsLayout';
import type {
  CompareSettingsLayout,
  SettingsRowLabels,
} from '../../../src/games/compare/logic/compareSettingsLayout';
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
 * Testy k #179 AC4 a rozložení nastavení podle obrázků S (2026-11-04):
 * pravidla v cyklu přes zkušební okna iPadu, telefonu na šířku i na výšku,
 * vše měřené v CSS px okna. Panel: volby a ✓ aspoň 64 px s mezerou pro
 * prst, nic se nepřekrývá ani neleží pod domečkem a kolečkem, popisky se
 * vejdou v každém jazyce. Karty: při rozsahu 20 se vejde 20 teček ve dvou
 * skupinách po 10, i s číslem pod nimi, a číslo se vejde do karty.
 */

const MIN_TOUCH_CSS = 64;
const MIN_OPTION_GAP_CSS = 8;
/** Nejmenší tečka při rozsahu 20 (jen tečky, nebo tečky s číslem), CSS px. */
const MIN_DOT_20_CSS = 20;
/** V malém zmenšeném zobrazení 600 × 400, menším než jakékoli zařízení. */
const MIN_SCALED_DOT_20_CSS = 12;
/** Číslo pod tečkami a samotné číslo aspoň takhle vysoké (CSS px). */
const MIN_NUMERAL_BELOW_CSS = 28;
const MIN_NUMERAL_ALONE_CSS = 48;
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

function areaOf(window: TestWindow): GameArea {
  return gameAreaFor(viewportOf(window), 'fullWindow');
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

function dotRect(dot: Dot): Rect {
  return centeredRect(dot.x, dot.y, 2 * dot.radius, 2 * dot.radius);
}

/** Odhadnutý obdélník čísla („20“ je nejširší) se středem a velikostí písma. */
function numeralRect(numeral: { x: number; y: number; fontSize: number }, digits = 2): Rect {
  return centeredRect(
    numeral.x,
    numeral.y,
    digits * DIGIT_WIDTH_RATIO * numeral.fontSize,
    numeral.fontSize,
  );
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

function settingsOf(window: TestWindow, labels?: SettingsRowLabels): CompareSettingsLayout {
  return layoutCompareSettings(areaOf(window), labels);
}

/** Volby a ✓ v CSS px. */
function tapParts(window: TestWindow): Part[] {
  const area = areaOf(window);
  const layout = settingsOf(window);
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
function allParts(window: TestWindow): Part[] {
  const area = areaOf(window);
  const labels = settingsOf(window).rows.map((row) => ({
    name: `popisek ${row.kind}`,
    box: cssOf(centeredRect(row.label.x, row.label.y, row.label.width, row.label.height), area),
  }));
  return [...tapParts(window), ...labels];
}

describe('#179: nastavení má dvě řady „Do kolika“ a „Ukázat“ a ✓', () => {
  it('rodič vidí řadu rozsahů 5, 10, 20 a řadu tečky, čísla, tečky s číslem', () => {
    for (const window of ALL_WINDOWS) {
      const layout = settingsOf(window);
      expect(
        layout.rows.map((row) => row.kind),
        window.name,
      ).toEqual(['maxNumber', 'show']);
      expect(
        layout.rows[0].options.map((option) => option.value),
        window.name,
      ).toEqual([...MAX_NUMBER_OPTIONS]);
      expect(
        layout.rows[1].options.map((option) => option.value),
        window.name,
      ).toEqual([...SHOW_OPTIONS]);
    }
  });

  it('volby a ✓ mají aspoň 64 × 64 px a mezi volbami je aspoň 8 px pro prst', () => {
    for (const window of DEVICE_WINDOWS) {
      const parts = tapParts(window);
      for (const part of parts) {
        expect(width(part.box), `${window.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
        expect(height(part.box), `${window.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
      }
      for (const [index, part] of parts.entries()) {
        for (const other of parts.slice(index + 1)) {
          const gapX = Math.max(other.box.left - part.box.right, part.box.left - other.box.right);
          const gapY = Math.max(other.box.top - part.box.bottom, part.box.top - other.box.bottom);
          expect(
            Math.max(gapX, gapY),
            `${window.name}: ${part.name} × ${other.name}`,
          ).toBeGreaterThanOrEqual(MIN_OPTION_GAP_CSS - 0.01);
        }
      }
    }
  });

  it('celý panel je na obrazovce, nic se nepřekrývá a nic neleží pod domečkem ani kolečkem', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const whole = cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
      const parts = allParts(window);
      for (const [index, part] of parts.entries()) {
        expect(isInside(part.box, whole), `${window.name}: ${part.name}`).toBe(true);
        for (const corner of cornerButtons(window)) {
          expect(overlaps(part.box, corner), `${window.name}: ${part.name} v rohu`).toBe(false);
        }
        for (const other of parts.slice(index + 1)) {
          expect(
            overlaps(part.box, other.box),
            `${window.name}: ${part.name} × ${other.name}`,
          ).toBe(false);
        }
      }
    }
  });

  it('popisky řad se vejdou do svého místa v každém jazyce', () => {
    for (const [language, labels] of Object.entries(LABELS_BY_LANGUAGE)) {
      for (const window of ALL_WINDOWS) {
        for (const row of settingsOf(window, labels).rows) {
          const name = `${language}, ${window.name}: ${row.kind}`;
          expect(row.label.text, name).toBe(labels[row.kind]);
          expect(
            row.label.text.length * CHARACTER_WIDTH_RATIO * row.label.fontSize,
            name,
          ).toBeLessThanOrEqual(row.label.width);
          expect(row.label.fontSize, name).toBeLessThanOrEqual(row.label.height);
        }
      }
    }
  });

  it('na iPadu jsou popisky nad řadami a ✓ pod nimi, na telefonu na šířku popisky vlevo a ✓ vpravo, na výšku ✓ dole', () => {
    for (const window of ALL_WINDOWS) {
      const layout = settingsOf(window);
      const area = areaOf(window);
      const [first, second] = layout.rows;
      const lastRow = second.options.at(-1);
      const name = window.name;
      if (PHONE_WINDOWS.includes(window)) {
        for (const row of layout.rows) {
          const firstOption = row.options[0];
          expect(row.label.align, name).toBe('right');
          expect(row.label.x + row.label.width / 2, name).toBeLessThanOrEqual(
            (firstOption?.x ?? 0) - (firstOption?.width ?? 0) / 2,
          );
        }
        expect(layout.confirm.x - layout.confirm.size / 2, name).toBeGreaterThan(
          (lastRow?.x ?? 0) + (lastRow?.width ?? 0) / 2,
        );
      } else {
        for (const row of layout.rows) {
          expect(row.label.align, name).toBe('center');
          expect(row.label.y, name).toBeLessThan(row.y);
        }
        expect(layout.confirm.y - layout.confirm.size / 2, name).toBeGreaterThan(
          second.y + (lastRow?.height ?? 0) / 2,
        );
        expect(layout.confirm.x, name).toBeCloseTo(area.width / 2, 3);
      }
      if (PORTRAIT_WINDOWS.includes(window)) {
        // ✓ dole u palce: v dolní třetině plochy.
        expect(layout.confirm.y, name).toBeGreaterThan((area.height * 2) / 3);
      }
      expect(first.y, name).toBeLessThan(second.y);
    }
  });

  it('obrázek ve volbě „Ukázat“ (tečky, číslo, obojí) je celý uvnitř volby', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      for (const option of settingsOf(window).rows[1].options) {
        const optionBox = cssOf(
          centeredRect(option.x, option.y, option.width, option.height),
          area,
        );
        const icon = showOptionIcon(option, option.value as CompareSettings['show']);
        const name = `${window.name}: ${option.value}`;
        expect(icon.dots.length > 0, name).toBe(option.value !== 'numbers');
        expect(icon.numeral !== null, name).toBe(option.value !== 'dots');
        const pieces = [
          ...icon.dots.map(dotRect),
          ...(icon.numeral ? [numeralRect(icon.numeral, 1)] : []),
        ];
        for (const [index, piece] of pieces.entries()) {
          expect(isInside(cssOf(piece, area), optionBox), name).toBe(true);
          for (const other of pieces.slice(index + 1)) {
            expect(overlaps(cssOf(piece, area), cssOf(other, area)), name).toBe(false);
          }
        }
      }
    }
  });
});

function minDot20(window: TestWindow): number {
  return window === SCALED_WINDOW ? MIN_SCALED_DOT_20_CSS : MIN_DOT_20_CSS;
}

describe('#179 AC4: při rozsahu 20 se na kartu vejde 20 teček ve dvou skupinách po 10', () => {
  it('pro každý počet 1–20 je každá tečka celá v kartě, tečky se nepřekrývají a jsou dost velké', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      for (const show of ['dots', 'both'] as const) {
        const look: CompareSettings = { maxNumber: 20, show };
        for (const card of layout.cards) {
          const numeral = cardNumeral(card, look);
          for (let count = 1; count <= 20; count += 1) {
            const dots = cardDots(card, count, layout.dotGroups, look);
            const name = `${window.name}, ${show}: ${count} teček`;
            expect(dots, name).toHaveLength(count);
            for (const [index, dot] of dots.entries()) {
              const box = cssOf(dotRect(dot), area);
              expect(isInside(box, cssOf(card, area)), name).toBe(true);
              expect(2 * dot.radius * area.scale, name).toBeGreaterThanOrEqual(minDot20(window));
              if (numeral) {
                expect(overlaps(box, cssOf(numeralRect(numeral), area)), `${name}: číslo`).toBe(
                  false,
                );
              }
              for (const other of dots.slice(index + 1)) {
                expect(Math.hypot(dot.x - other.x, dot.y - other.y), name).toBeGreaterThan(
                  dot.radius + other.radius,
                );
              }
            }
          }
        }
      }
    }
  });

  it('dítě vidí dvě oddělené skupiny po 10: mezera mezi skupinami je větší než mezi tečkami', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      for (const show of ['dots', 'both'] as const) {
        const dots = cardDots(layout.cards[0], 20, layout.dotGroups, { maxNumber: 20, show });
        const bounds = (group: Dot[]): Box => ({
          left: Math.min(...group.map((dot) => dot.x - dot.radius)),
          right: Math.max(...group.map((dot) => dot.x + dot.radius)),
          top: Math.min(...group.map((dot) => dot.y - dot.radius)),
          bottom: Math.max(...group.map((dot) => dot.y + dot.radius)),
        });
        const first = bounds(dots.slice(0, 10));
        const second = bounds(dots.slice(10));
        const name = `${window.name}, ${show}`;
        expect(overlaps(first, second), name).toBe(false);
        const groupGap = Math.max(
          second.left - first.right,
          first.left - second.right,
          second.top - first.bottom,
          first.top - second.bottom,
        );
        const [dot, next] = dots;
        const dotGap =
          Math.hypot((next?.x ?? 0) - (dot?.x ?? 0), (next?.y ?? 0) - (dot?.y ?? 0)) -
          2 * (dot?.radius ?? 0);
        expect(groupGap, name).toBeGreaterThan(dotGap);
      }
    }
  });

  it('tečky jsou při stejném nastavení stejně velké pro každý počet a na obou kartách', () => {
    for (const window of ALL_WINDOWS) {
      const layout = layoutCompareScreen(areaOf(window));
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        for (const show of ['dots', 'both'] as const) {
          const look = { maxNumber, show };
          const radii = new Set<number>();
          for (const card of layout.cards) {
            for (let count = 1; count <= maxNumber; count += 1) {
              for (const dot of cardDots(card, count, layout.dotGroups, look)) {
                radii.add(Math.round(dot.radius * 1e6));
              }
            }
          }
          expect(radii.size, `${window.name}, do ${maxNumber}, ${show}`).toBe(1);
        }
      }
    }
  });

  it('do 5 a do 10 s tečkami vidí dítě stejné tečky jako dřív (do 10 po pěti)', () => {
    for (const window of ALL_WINDOWS) {
      const layout = layoutCompareScreen(areaOf(window));
      for (const maxNumber of [5, 10] as const) {
        for (let count = 1; count <= maxNumber; count += 1) {
          expect(
            cardDots(layout.cards[0], count, layout.dotGroups, { maxNumber, show: 'dots' }),
            `${window.name}: do ${maxNumber}, ${count}`,
          ).toEqual(cardDots(layout.cards[0], count, layout.dotGroups));
        }
      }
    }
  });
});

describe('#179 AC3: čísla na kartách', () => {
  it('s volbou „čísla“ vidí dítě jen velké číslo, které se celé vejde do karty', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const look: CompareSettings = { maxNumber, show: 'numbers' };
        for (const card of layout.cards) {
          const name = `${window.name}, do ${maxNumber}`;
          expect(cardDots(card, 7, layout.dotGroups, look), name).toEqual([]);
          const numeral = cardNumeral(card, look);
          expect(numeral, name).not.toBeNull();
          if (numeral) {
            expect(isInside(cssOf(numeralRect(numeral), area), cssOf(card, area)), name).toBe(true);
            expect(numeral.fontSize * area.scale, name).toBeGreaterThanOrEqual(
              MIN_NUMERAL_ALONE_CSS,
            );
          }
        }
      }
    }
  });

  it('s volbou „tečky s číslem“ je číslo pod tečkami a celé v kartě', () => {
    for (const window of ALL_WINDOWS) {
      const area = areaOf(window);
      const layout = layoutCompareScreen(area);
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const look: CompareSettings = { maxNumber, show: 'both' };
        for (const card of layout.cards) {
          const name = `${window.name}, do ${maxNumber}`;
          const numeral = cardNumeral(card, look);
          expect(numeral, name).not.toBeNull();
          if (!numeral) {
            continue;
          }
          expect(isInside(cssOf(numeralRect(numeral), area), cssOf(card, area)), name).toBe(true);
          expect(numeral.fontSize * area.scale, name).toBeGreaterThanOrEqual(MIN_NUMERAL_BELOW_CSS);
          const dots = cardDots(card, maxNumber, layout.dotGroups, look);
          const lowestDot = Math.max(...dots.map((dot) => dot.y + dot.radius));
          expect(numeral.y - numeral.fontSize / 2, name).toBeGreaterThanOrEqual(lowestDot);
        }
      }
    }
  });

  it('s volbou „tečky“ číslo na kartě není', () => {
    for (const window of ALL_WINDOWS) {
      const layout = layoutCompareScreen(areaOf(window));
      expect(cardNumeral(layout.cards[0], { maxNumber: 20, show: 'dots' }), window.name).toBeNull();
    }
  });
});
