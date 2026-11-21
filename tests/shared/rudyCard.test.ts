import { describe, expect, it } from 'vitest';

import { RUDY_SHEET } from '../../src/shared/logic/rudy';
import {
  RUDY_CARD_STYLE,
  layoutRudyCard,
  rudyCardPageBackdrop,
} from '../../src/shared/logic/rudyCard';
import type { RudyCardLayout, RudyRect } from '../../src/shared/logic/rudyCard';
import { gameAreaFor } from '../../src/shared/logic/viewportLayout';
import type { GameArea, GameAreaFit, Viewport } from '../../src/shared/logic/viewportLayout';
import { HOME_SCREEN_WINDOWS } from './layoutRules';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  viewportOf,
} from './viewportFixtures';
import type { TestWindow } from './viewportFixtures';

/**
 * Testy k #169 AC2: okno s pandou má ztmavení 40 % a kartu s bílým
 * okrajem 6 px a stínem jako karta mapy (#145). Karta má 75 % menší strany
 * okna (±1 px); v malých oknech je větší, aby panda měla aspoň 200 px
 * výšky. Karta je vždy celá v bezpečné oblasti a na plátně hry, panda je
 * uprostřed karty a celá vidět.
 *
 * Pravidla v cyklu přes zkušební okna z testů rozložení, pro hru s dnešní
 * plochou (`fixed`, Počítání, menu) i s plochou přes celé okno
 * (`fullWindow`, Omalovánky). Jeden test na pravidlo, případ v popisu `expect`.
 */

const WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ...HOME_SCREEN_WINDOWS,
];

const FITS: readonly GameAreaFit[] = ['fixed', 'fullWindow'];

const MIN_PANDA_HEIGHT = 200;
const TOLERANCE = 0.01;

interface Case {
  readonly name: string;
  readonly viewport: Viewport;
  readonly area: GameArea;
  readonly layout: RudyCardLayout;
}

const CASES: readonly Case[] = WINDOWS.flatMap((window) =>
  FITS.map((fit) => {
    const viewport = viewportOf(window);
    const area = gameAreaFor(viewport, fit);
    return {
      name: `${window.name}, ${fit}`,
      viewport,
      area,
      layout: layoutRudyCard(viewport, area),
    };
  }),
);

function rightOf(rect: RudyRect): number {
  return rect.left + rect.width;
}

function bottomOf(rect: RudyRect): number {
  return rect.top + rect.height;
}

function isInside(inner: RudyRect, outer: RudyRect): boolean {
  return (
    inner.left >= outer.left - TOLERANCE &&
    inner.top >= outer.top - TOLERANCE &&
    rightOf(inner) <= rightOf(outer) + TOLERANCE &&
    bottomOf(inner) <= bottomOf(outer) + TOLERANCE
  );
}

function safeRect(viewport: Viewport): RudyRect {
  const { safeArea } = viewport;
  return {
    left: safeArea.left,
    top: safeArea.top,
    width: viewport.width - safeArea.left - safeArea.right,
    height: viewport.height - safeArea.top - safeArea.bottom,
  };
}

function canvasRect(area: GameArea): RudyRect {
  return {
    left: area.offsetX,
    top: area.offsetY,
    width: area.width * area.scale,
    height: area.height * area.scale,
  };
}

/** Karta bez bílého okraje: plocha, ve které je panda. */
function insideBorder(card: RudyRect): RudyRect {
  const border = RUDY_CARD_STYLE.borderCss;
  return {
    left: card.left + border,
    top: card.top + border,
    width: card.width - 2 * border,
    height: card.height - 2 * border,
  };
}

function describeRect(rect: RudyRect): string {
  return `${rect.left},${rect.top} ${rect.width}×${rect.height}`;
}

describe('#169 AC2: vzhled okna jako karta mapy (#145)', () => {
  it('ztmavení má 40 %, karta bílý okraj 6 px, zaoblené rohy a stín', () => {
    expect(RUDY_CARD_STYLE).toMatchObject({
      dimColor: '#000000',
      dimAlpha: 0.4,
      borderCss: 6,
      borderColor: '#FFFFFF',
      cornerRadiusCss: 24,
    });
    expect(RUDY_CARD_STYLE.shadowLayers * RUDY_CARD_STYLE.shadowLayerAlpha).toBeGreaterThan(0);
  });

  it('okraje stránky kolem plátna jsou ztmavené stejně jako hra pod kartou', () => {
    // #F5F5F7 ztmavené černou se 40 %: 245 × 0,6 = 147, 247 × 0,6 = 148.
    expect(rudyCardPageBackdrop()).toEqual({ color: '#939394' });
  });
});

describe('#169 AC2: rozložení karty s pandou v každém okně', () => {
  it('karta je celá v bezpečné oblasti okna', () => {
    for (const { name, viewport, layout } of CASES) {
      expect(
        isInside(layout.card, safeRect(viewport)),
        `${name}: ${describeRect(layout.card)}`,
      ).toBe(true);
    }
  });

  it('karta je celá na plátně hry, aby se dala nakreslit', () => {
    for (const { name, area, layout } of CASES) {
      expect(isInside(layout.card, canvasRect(area)), `${name}: ${describeRect(layout.card)}`).toBe(
        true,
      );
    }
  });

  it('karta má 75 % menší strany okna (±1 px), jen v malých oknech je větší kvůli pandě', () => {
    for (const { name, viewport, layout } of CASES) {
      const share = 0.75 * Math.min(viewport.width, viewport.height);
      const sides = `${name}: karta ${layout.card.width}×${layout.card.height}, 75 % = ${share}`;
      expect(layout.card.width, sides).toBe(layout.card.height);
      if (layout.card.width <= share + 1) {
        expect(layout.card.width, sides).toBeGreaterThanOrEqual(share - 1);
      }
    }
  });

  it('panda má aspoň 200 px výšky', () => {
    for (const { name, layout } of CASES) {
      expect(
        layout.panda.height,
        `${name}: panda ${layout.panda.height} px`,
      ).toBeGreaterThanOrEqual(MIN_PANDA_HEIGHT);
    }
  });

  it('panda je celá vidět uvnitř bílého okraje karty', () => {
    for (const { name, layout } of CASES) {
      expect(
        isInside(layout.panda, insideBorder(layout.card)),
        `${name}: panda ${describeRect(layout.panda)}, karta ${describeRect(layout.card)}`,
      ).toBe(true);
    }
  });

  it('panda je uprostřed karty a má poměr stran snímku', () => {
    for (const { name, layout } of CASES) {
      const { card, panda } = layout;
      const offset = {
        x: panda.left + panda.width / 2 - (card.left + card.width / 2),
        y: panda.top + panda.height / 2 - (card.top + card.height / 2),
      };
      expect(Math.abs(offset.x), `${name}: vodorovně o ${offset.x} px`).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.y), `${name}: svisle o ${offset.y} px`).toBeLessThanOrEqual(1);
      expect(panda.width / panda.height, name).toBeCloseTo(
        RUDY_SHEET.frameWidth / RUDY_SHEET.frameHeight,
        3,
      );
    }
  });

  it('v malém okně je karta jen tak velká, aby panda měla 200 px', () => {
    for (const { name, viewport, layout } of CASES) {
      const share = 0.75 * Math.min(viewport.width, viewport.height);
      if (layout.card.width > share + 1) {
        expect(layout.panda.height, `${name}: panda ${layout.panda.height} px`).toBeLessThan(
          MIN_PANDA_HEIGHT + 2,
        );
      }
    }
  });
});
