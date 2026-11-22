import { describe, expect, it } from 'vitest';

import { cardDots, layoutCompareScreen } from '../../../src/games/compare/logic/compareLayout';
import type { CompareLayout, Rect } from '../../../src/games/compare/logic/compareLayout';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
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
 * Testy k #178 AC7: rozložení pro iPad na šířku, telefon na šířku i na
 * výšku jako pravidla v cyklu přes zkušební okna. Všechno se měří v CSS px
 * okna: karty i „=“ aspoň 64 px, 10 teček se vejde do karty po pěti
 * v řadě, nic se nepřekrývá (ani s domečkem a kolečkem v rozích). Karty
 * jsou vždy vedle sebe, aby znak mezi nimi šel číst zleva doprava; „=“ je
 * mezi nimi, na výšku uprostřed pod vysokými kartami s tečkami po pěti
 * ve sloupcích.
 */

const MIN_TOUCH_CSS = 64;
/** Mezera mezi kartami, když je „=“ pod nimi, nejvýš (CSS px). */
const MAX_CARD_GAP_CSS = 16;
/** Okraj hry od kraje volné plochy na telefonu (CSS px). */
const PHONE_MARGIN_CSS = 8;

/** Nejmenší tečka na iPadu a telefonech (CSS px). */
const MIN_DOT_DIAMETER_CSS = 40;
/** Nejmenší tečka v malém zmenšeném zobrazení 600 × 400, menším než jakékoli zařízení. */
const MIN_SCALED_DOT_DIAMETER_CSS = 20;
const DOTS_PER_GROUP = 5;

/** Okno mimo telefon i iPad: dnešní zmenšené zobrazení. */
const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};

const LANDSCAPE_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  SCALED_WINDOW,
];
const PORTRAIT_WINDOWS: readonly TestWindow[] = [
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const ALL_WINDOWS = [...LANDSCAPE_WINDOWS, ...PORTRAIT_WINDOWS];

interface Screen {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly layout: CompareLayout;
}

function screenOf(window: TestWindow): Screen {
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  return { window, area, layout: layoutCompareScreen(area) };
}

/** Obdélník herní plochy v CSS px okna. */
function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function areaBox(area: GameArea): Box {
  return cssOf({ left: 0, top: 0, width: area.width, height: area.height }, area);
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

/** Hvězdičky jako čtverce o straně průměru, v CSS px. */
function starBoxes({ layout, area }: Screen): Box[] {
  const size = layout.stars.starSize;
  return layout.stars.stars.map((star) =>
    cssOf({ left: star.x - size / 2, top: star.y - size / 2, width: size, height: size }, area),
  );
}

/** Pojmenované prvky obrazovky v CSS px. */
function namedParts(screen: Screen): Array<{ name: string; box: Box }> {
  const { layout, area } = screen;
  return [
    { name: 'levá karta', box: cssOf(layout.cards[0], area) },
    { name: 'pravá karta', box: cssOf(layout.cards[1], area) },
    { name: '„=“', box: cssOf(layout.equalButton, area) },
    ...starBoxes(screen).map((box, index) => ({ name: `hvězdička ${index + 1}`, box })),
  ];
}

function width(box: Box): number {
  return box.right - box.left;
}

function height(box: Box): number {
  return box.bottom - box.top;
}

describe('#178 AC7: karty i „=“ jsou dost velké na dětský prst', () => {
  it('dítě trefí prstem obě karty i „=“: v každém okně mají aspoň 64 × 64 px', () => {
    for (const window of ALL_WINDOWS) {
      const screen = screenOf(window);
      for (const part of namedParts(screen).slice(0, 3)) {
        expect(width(part.box), `${window.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
        expect(height(part.box), `${window.name}: ${part.name}`).toBeGreaterThanOrEqual(
          MIN_TOUCH_CSS,
        );
      }
    }
  });
});

describe('#178 AC7: všechno je na obrazovce a nic se nepřekrývá', () => {
  it('dítě vidí celé karty, „=“ i hvězdičky, nic nepřečnívá z herní plochy', () => {
    for (const window of ALL_WINDOWS) {
      const screen = screenOf(window);
      for (const part of namedParts(screen)) {
        expect(isInside(part.box, areaBox(screen.area)), `${window.name}: ${part.name}`).toBe(true);
      }
    }
  });

  it('karty, „=“ a hvězdičky se dítěti navzájem nepřekrývají', () => {
    for (const window of ALL_WINDOWS) {
      const parts = namedParts(screenOf(window));
      for (const [index, part] of parts.entries()) {
        for (const other of parts.slice(index + 1)) {
          expect(
            overlaps(part.box, other.box),
            `${window.name}: ${part.name} × ${other.name}`,
          ).toBe(false);
        }
      }
    }
  });

  it('nic ze hry neleží pod domečkem ani pod kolečkem v horních rozích', () => {
    for (const window of ALL_WINDOWS) {
      const corners = cornerButtons(window);
      for (const part of namedParts(screenOf(window))) {
        for (const corner of corners) {
          expect(overlaps(part.box, corner), `${window.name}: ${part.name}`).toBe(false);
        }
      }
    }
  });

  it('po správné odpovědi vidí dítě znak přesně na místě „=“', () => {
    for (const window of ALL_WINDOWS) {
      const { layout } = screenOf(window);
      const button = layout.equalButton;
      expect(layout.sign.x, window.name).toBeCloseTo(button.left + button.width / 2, 3);
      expect(layout.sign.y, window.name).toBeCloseTo(button.top + button.height / 2, 3);
      expect(layout.sign.size, window.name).toBeGreaterThan(0);
    }
  });
});

/** Nejmenší povolená tečka v okně (CSS px). */
function minDotOf(window: TestWindow): number {
  return window === SCALED_WINDOW ? MIN_SCALED_DOT_DIAMETER_CSS : MIN_DOT_DIAMETER_CSS;
}

describe('#178 AC1 a AC7: dítě vidí až 10 teček po pěti, na šířku v řadách a na výšku ve sloupcích', () => {
  it('pro každý počet 1–10 je každá tečka celá v kartě, tečky se nepřekrývají a jsou velké (aspoň 40 px, v malém zmenšeném zobrazení 20 px)', () => {
    for (const window of ALL_WINDOWS) {
      const { layout, area } = screenOf(window);
      for (const card of layout.cards) {
        for (let count = 1; count <= 10; count += 1) {
          const dots = cardDots(card, count, layout.dotGroups);
          const name = `${window.name}: ${count} teček`;
          expect(dots, name).toHaveLength(count);
          for (const [index, dot] of dots.entries()) {
            const dotBox = cssOf(
              {
                left: dot.x - dot.radius,
                top: dot.y - dot.radius,
                width: 2 * dot.radius,
                height: 2 * dot.radius,
              },
              area,
            );
            expect(isInside(dotBox, cssOf(card, area)), name).toBe(true);
            expect(2 * dot.radius * area.scale, name).toBeGreaterThanOrEqual(minDotOf(window));
            for (const other of dots.slice(index + 1)) {
              const distance = Math.hypot(dot.x - other.x, dot.y - other.y);
              expect(distance, name).toBeGreaterThan(dot.radius + other.radius);
            }
          }
        }
      }
    }
  });

  it('na šířku vidí dítě tečky po pěti v řadě, na výšku po pěti ve sloupci (řad nebo sloupců jen tolik, kolik je potřeba)', () => {
    for (const window of ALL_WINDOWS) {
      const { layout } = screenOf(window);
      const portrait = PORTRAIT_WINDOWS.includes(window);
      expect(layout.dotGroups, window.name).toBe(portrait ? 'columns' : 'rows');
      for (let count = 1; count <= 10; count += 1) {
        const dots = cardDots(layout.cards[0], count, layout.dotGroups);
        const groups = new Map<number, number>();
        for (const dot of dots) {
          const key = Math.round((portrait ? dot.x : dot.y) * 1000) / 1000;
          groups.set(key, (groups.get(key) ?? 0) + 1);
        }
        const name = `${window.name}: ${count} teček`;
        expect(groups.size, name).toBe(Math.ceil(count / DOTS_PER_GROUP));
        const [first] = [...groups.entries()].sort((a, b) => a[0] - b[0]);
        expect(first?.[1], name).toBe(Math.min(count, DOTS_PER_GROUP));
      }
    }
  });

  it('stejný počet teček vypadá dítěti na obou kartách stejně (stejně velké tečky)', () => {
    for (const window of ALL_WINDOWS) {
      const { layout } = screenOf(window);
      const [first] = cardDots(layout.cards[0], 10, layout.dotGroups);
      const [second] = cardDots(layout.cards[1], 10, layout.dotGroups);
      expect(first?.radius, window.name).toBeCloseTo(second?.radius ?? 0, 6);
    }
  });
});

describe('#178 AC7: na šířku karty vedle sebe s „=“ mezi nimi, na výšku vysoké karty vedle sebe s „=“ pod nimi', () => {
  it('dítě vidí obě karty vedle sebe ve stejné výšce, na šířku i na výšku', () => {
    for (const window of ALL_WINDOWS) {
      const { layout, area } = screenOf(window);
      const [left, right] = layout.cards.map((card) => cssOf(card, area)) as [Box, Box];
      expect(left.right, window.name).toBeLessThanOrEqual(right.left);
      expect(left.top, window.name).toBeCloseTo(right.top, 6);
      expect(left.bottom, window.name).toBeCloseTo(right.bottom, 6);
    }
  });

  it('dítě najde „=“ vždy mezi kartami, nebo uprostřed pod nimi', () => {
    for (const window of ALL_WINDOWS) {
      const { layout, area } = screenOf(window);
      const [left, right] = layout.cards.map((card) => cssOf(card, area)) as [Box, Box];
      const equal = cssOf(layout.equalButton, area);
      const between =
        left.right <= equal.left &&
        equal.right <= right.left &&
        equal.top >= left.top &&
        equal.bottom <= left.bottom;
      const below =
        equal.top >= left.bottom &&
        Math.abs((equal.left + equal.right) / 2 - (left.right + right.left) / 2) < 0.5;
      expect(between || below, window.name).toBe(true);
      expect(layout.equalPlacement, window.name).toBe(between ? 'between' : 'below');
    }
  });

  it('na iPadu a na telefonu na šířku je „=“ mezi kartami', () => {
    for (const window of [...IPAD_WINDOWS, JUST_ABOVE_LIMIT, ...PHONE_WINDOWS]) {
      expect(screenOf(window).layout.equalPlacement, window.name).toBe('between');
    }
  });

  it('na telefonu na výšku jsou karty vysoké přes celou šířku i volnou výšku a „=“ je pod nimi (tečky co největší)', () => {
    for (const window of PORTRAIT_WINDOWS) {
      const { layout, area } = screenOf(window);
      const [left, right] = layout.cards.map((card) => cssOf(card, area)) as [Box, Box];
      const playWidth = area.width * area.scale - 2 * PHONE_MARGIN_CSS;
      const equal = cssOf(layout.equalButton, area);
      const corners = cornerButtons(window);
      const belowCorners = Math.max(...corners.map((corner) => corner.bottom));
      expect(layout.equalPlacement, window.name).toBe('below');
      expect(right.right - left.left, window.name).toBeCloseTo(playWidth, 3);
      expect(right.left - left.right, window.name).toBeLessThanOrEqual(MAX_CARD_GAP_CSS);
      // Vysoké karty: od rohů s domečkem a kolečkem až k „=“ pod nimi.
      expect(left.top - belowCorners, window.name).toBeLessThanOrEqual(MAX_CARD_GAP_CSS);
      expect(equal.top - left.bottom, window.name).toBeLessThanOrEqual(MAX_CARD_GAP_CSS);
    }
  });

  it('obě karty jsou pro dítě stejně velké', () => {
    for (const window of ALL_WINDOWS) {
      const [first, second] = screenOf(window).layout.cards;
      expect(first.width, window.name).toBeCloseTo(second.width, 6);
      expect(first.height, window.name).toBeCloseTo(second.height, 6);
    }
  });

  it('dítě sbírá 10 hvězdiček: na šířku v jedné řadě, na telefonu na výšku ve 2 řadách po 5', () => {
    for (const window of LANDSCAPE_WINDOWS) {
      const stars = screenOf(window).layout.stars.stars;
      expect(stars, window.name).toHaveLength(10);
      expect(new Set(stars.map((star) => star.y)).size, window.name).toBe(1);
    }
    for (const window of PORTRAIT_WINDOWS) {
      const stars = screenOf(window).layout.stars.stars;
      expect(stars, window.name).toHaveLength(10);
      const rows = new Set(stars.map((star) => star.y));
      expect(rows.size, window.name).toBe(2);
    }
  });
});
