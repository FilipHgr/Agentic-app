import { describe, expect, it } from 'vitest';

import { clipSegment, hintPicture } from '../../../src/games/compare/logic/compareHint';
import type { CompareHintPicture, HintDot } from '../../../src/games/compare/logic/compareHint';
import { cardDots, layoutCompareScreen } from '../../../src/games/compare/logic/compareLayout';
import type { CompareLayout, Rect } from '../../../src/games/compare/logic/compareLayout';
import { MAX_NUMBER_OPTIONS, SHOW_OPTIONS } from '../../../src/games/compare/logic/compareSettings';
import type { CompareSettings } from '../../../src/games/compare/logic/compareSettings';
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
 * Testy k #180 AC1–AC3: obrázek nápovědy jako pravidla v cyklu přes
 * zkušební okna (iPad, telefon na šířku i na výšku), rozsahy 5, 10 a 20,
 * všechny způsoby ukázání a každý počet teček na obou kartách. Vše v CSS px okna.
 * Na výšku jsou tečky po pěti ve sloupcích, při rozsahu 20 ve dvou
 * skupinách po 10 (rozložení teček z #178 a #179 AC4).
 */

const SCALED_WINDOW: TestWindow = {
  name: '600×400 zmenšené zobrazení',
  width: 600,
  height: 400,
  safeArea: NO_NOTCH,
};

const ALL_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
  SCALED_WINDOW,
];

/** Nejmenší tečka nápovědy (i při rozsahu 20 s číslem pod tečkami), CSS px. */
const MIN_HINT_DOT_CSS = 20;
const MIN_SCALED_HINT_DOT_CSS = 12;
/** Číslo pod tečkami aspoň takhle vysoké (CSS px), jako v #179. */
const MIN_NUMERAL_BELOW_CSS = 28;

interface Screen {
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly layout: CompareLayout;
}

const SCREENS: readonly Screen[] = ALL_WINDOWS.map((window) => {
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  return { window, area, layout: layoutCompareScreen(area) };
});

function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function circleRect(x: number, y: number, radius: number): Rect {
  return { left: x - radius, top: y - radius, width: 2 * radius, height: 2 * radius };
}

interface HintCase {
  readonly screen: Screen;
  readonly look: CompareSettings;
  readonly left: number;
  readonly right: number;
  readonly picture: CompareHintPicture;
  readonly name: string;
}

/**
 * Dvojice počtů v rozsahu: každý počet na levé kartě proti nejmenšímu,
 * stejnému a největšímu počtu vpravo a naopak. Tečky karty závisí jen na
 * jejím počtu a dvojice jen na menším z obou, takže se tím pokryje každý
 * počet na obou stranách i každý počet dvojic.
 */
function countPairs(maxNumber: number): Array<readonly [number, number]> {
  const pairs = new Map<string, readonly [number, number]>();
  for (let count = 1; count <= maxNumber; count += 1) {
    for (const other of [1, count, maxNumber]) {
      pairs.set(`${count}:${other}`, [count, other]);
      pairs.set(`${other}:${count}`, [other, count]);
    }
  }
  return [...pairs.values()];
}

/** Každé okno, každý rozsah a způsob ukázání a dvojice počtů z `countPairs`. */
function* hintCases(): Generator<HintCase> {
  for (const screen of SCREENS) {
    for (const maxNumber of MAX_NUMBER_OPTIONS) {
      for (const show of SHOW_OPTIONS) {
        const look: CompareSettings = { maxNumber, show };
        for (const [left, right] of countPairs(maxNumber)) {
          yield {
            screen,
            look,
            left,
            right,
            picture: hintPicture(screen.layout, { left, right }, look),
            name: `${screen.window.name}, do ${maxNumber}, ${show}: ${left} : ${right}`,
          };
        }
      }
    }
  }
}

const CASES: readonly HintCase[] = [...hintCases()];

function paired(dots: readonly HintDot[]): HintDot[] {
  return dots.filter((dot) => dot.role === 'paired');
}

function extra(dots: readonly HintDot[]): HintDot[] {
  return dots.filter((dot) => dot.role === 'extra');
}

describe('#180 AC1 a AC2: tečky obou karet se spojí do dvojic, tečky bez dvojice se rozsvítí', () => {
  it('na každé kartě je tolik teček, kolik ukazuje příklad, i se samotnými čísly', () => {
    for (const { picture, left, right, name } of CASES) {
      expect(picture.cards[0], name).toHaveLength(left);
      expect(picture.cards[1], name).toHaveLength(right);
    }
  });

  it('dvojic je tolik, kolik je teček na menší kartě, a každá dvojice má jednu tečku vlevo a jednu vpravo', () => {
    for (const { picture, left, right, name } of CASES) {
      const pairs = Math.min(left, right);
      for (const dots of picture.cards) {
        const indexes = paired(dots).map((dot) => dot.pair);
        expect(indexes, name).toEqual(Array.from({ length: pairs }, (_, index) => index));
      }
      expect(picture.links, name).toHaveLength(pairs);
    }
  });

  it('rozsvítí se jen tečky bez dvojice, a to na kartě s víc tečkami', () => {
    for (const { picture, left, right, name } of CASES) {
      const [leftDots, rightDots] = picture.cards;
      expect(extra(leftDots), name).toHaveLength(Math.max(0, left - right));
      expect(extra(rightDots), name).toHaveLength(Math.max(0, right - left));
      for (const dot of [...extra(leftDots), ...extra(rightDots)]) {
        expect(dot.pair, name).toBeNull();
      }
    }
  });

  it('při stejném počtu má dvojici každá tečka a nic se nerozsvítí', () => {
    for (const { picture, left, right, name } of CASES) {
      if (left !== right) {
        continue;
      }
      for (const dots of picture.cards) {
        expect(extra(dots), name).toEqual([]);
        expect(paired(dots), name).toHaveLength(left);
      }
    }
  });

  it('tečky bez dvojice jsou na konci karty: dvojice se berou od první tečky po pěti', () => {
    for (const { picture, left, right, name } of CASES) {
      const pairs = Math.min(left, right);
      for (const dots of picture.cards) {
        for (const [index, dot] of dots.entries()) {
          expect(dot.role, `${name}, tečka ${index + 1}`).toBe(index < pairs ? 'paired' : 'extra');
        }
      }
    }
  });

  it('spojení každé dvojice vede od její tečky na levé kartě k její tečce na pravé', () => {
    for (const { picture, name } of CASES) {
      for (const link of picture.links) {
        const from = picture.cards[0].find((dot) => dot.pair === link.pair);
        const to = picture.cards[1].find((dot) => dot.pair === link.pair);
        expect(from, name).toBeDefined();
        expect(to, name).toBeDefined();
        expect(link.from, name).toEqual({ x: from?.x, y: from?.y });
        expect(link.to, name).toEqual({ x: to?.x, y: to?.y });
      }
    }
  });
});

describe('#180: tečky nápovědy jsou celé v kartě a dobře vidět', () => {
  it('každá tečka i se září je celá ve své kartě a tečky se nepřekrývají', () => {
    for (const { picture, screen, name } of CASES) {
      const { layout, area } = screen;
      for (const [side, dots] of picture.cards.entries()) {
        const card = cssOf(layout.cards[side as 0 | 1], area);
        for (const [index, dot] of dots.entries()) {
          const glow = cssOf(circleRect(dot.x, dot.y, dot.glowRadius), area);
          expect(isInside(glow, card), `${name}, tečka ${index + 1}`).toBe(true);
          expect(dot.glowRadius, name).toBeGreaterThan(dot.radius);
          for (const other of dots.slice(index + 1)) {
            expect(Math.hypot(dot.x - other.x, dot.y - other.y), name).toBeGreaterThan(
              dot.radius + other.radius,
            );
          }
        }
      }
    }
  });

  it('tečky nápovědy jsou dost velké (aspoň 20 px, v malém zmenšeném zobrazení 12 px)', () => {
    for (const { picture, screen, name } of CASES) {
      const min = screen.window === SCALED_WINDOW ? MIN_SCALED_HINT_DOT_CSS : MIN_HINT_DOT_CSS;
      for (const dot of [...picture.cards[0], ...picture.cards[1]]) {
        expect(2 * dot.radius * screen.area.scale, name).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it('s tečkami se při nápovědě nic neposune: tečky zůstanou přesně na svém místě', () => {
    for (const { picture, screen, look, left, right, name } of CASES) {
      if (look.show === 'numbers') {
        continue;
      }
      const { layout } = screen;
      const counts = [left, right] as const;
      for (const side of [0, 1] as const) {
        const before = cardDots(layout.cards[side], counts[side], layout.dotGroups, look);
        const after = picture.cards[side].map(({ x, y, radius }) => ({ x, y, radius }));
        expect(after, name).toEqual(before);
      }
    }
  });

  it('na šířku jdou tečky nápovědy po pěti v řadách, na výšku po pěti ve sloupcích', () => {
    for (const { picture, screen, left, name } of CASES) {
      if (left !== 5) {
        continue;
      }
      const dots = picture.cards[0];
      const portrait = screen.layout.dotGroups === 'columns';
      const across = new Set(dots.map((dot) => Math.round((portrait ? dot.x : dot.y) * 1000)));
      expect(across.size, name).toBe(1);
    }
  });

  it('při rozsahu 20 jsou tečky nápovědy ve dvou skupinách po 10 s mezerou mezi nimi', () => {
    for (const { picture, look, left, name } of CASES) {
      if (look.maxNumber !== 20 || left !== 20) {
        continue;
      }
      const dots = picture.cards[0];
      const step = (from: HintDot | undefined, to: HintDot | undefined): number =>
        Math.hypot((to?.x ?? 0) - (from?.x ?? 0), (to?.y ?? 0) - (from?.y ?? 0));
      const insideGroup = step(dots[0], dots[1]);
      // Od 10. tečky k 11. je mezera mezi skupinami, větší než mezi sousedy v řadě.
      const groupStart = Math.min(...dots.slice(10).map((dot) => step(dots[9], dot)));
      expect(groupStart, name).toBeGreaterThan(insideGroup);
    }
  });
});

describe('#180 AC3: v režimu „čísla“ se pod čísly objeví tečky', () => {
  it('s nápovědou zůstane číslo na kartě a tečky jsou nad ním, nic se nepřekrývá', () => {
    for (const { picture, screen, look, name } of CASES) {
      if (look.show === 'dots') {
        expect(picture.numerals, name).toEqual([null, null]);
        continue;
      }
      const { layout, area } = screen;
      for (const side of [0, 1] as const) {
        const numeral = picture.numerals[side];
        expect(numeral, name).not.toBeNull();
        if (!numeral) {
          continue;
        }
        expect(numeral.fontSize * area.scale, name).toBeGreaterThanOrEqual(MIN_NUMERAL_BELOW_CSS);
        expect(
          isInside(
            cssOf(circleRect(numeral.x, numeral.y, numeral.fontSize / 2), area),
            cssOf(layout.cards[side], area),
          ),
          name,
        ).toBe(true);
        for (const dot of picture.cards[side]) {
          expect(dot.y + dot.glowRadius, name).toBeLessThanOrEqual(
            numeral.y - numeral.fontSize / 2,
          );
        }
      }
    }
  });

  it('obrázek nápovědy nesahá na „=“: tečky i září jsou jen v kartách', () => {
    for (const { picture, screen, name } of CASES) {
      const { layout, area } = screen;
      const equal = cssOf(layout.equalButton, area);
      for (const dot of [...picture.cards[0], ...picture.cards[1]]) {
        expect(overlaps(cssOf(circleRect(dot.x, dot.y, dot.glowRadius), area), equal), name).toBe(
          false,
        );
      }
    }
  });
});

describe('#180: záře a spojení dvojic jsou čitelné', () => {
  it('záře sousedních teček se nedotýkají, ani na telefonu na výšku', () => {
    for (const { picture, name } of CASES) {
      for (const dots of picture.cards) {
        for (const [index, dot] of dots.entries()) {
          for (const other of dots.slice(index + 1)) {
            expect(
              Math.hypot(dot.x - other.x, dot.y - other.y),
              `${name}, tečka ${index + 1}`,
            ).toBeGreaterThan(dot.glowRadius + other.glowRadius);
          }
        }
      }
    }
  });

  it('kus spojení dvojice na kartě je celý v kartě a vede z tečky dvojice', () => {
    for (const { picture, screen, name } of CASES) {
      const { layout } = screen;
      for (const link of picture.links) {
        for (const side of [0, 1] as const) {
          const card = layout.cards[side];
          const part = clipSegment(link.from, link.to, card);
          expect(part, name).not.toBeNull();
          if (!part) {
            continue;
          }
          for (const point of [part.from, part.to]) {
            expect(point.x, name).toBeGreaterThanOrEqual(card.left - 1e-6);
            expect(point.x, name).toBeLessThanOrEqual(card.left + card.width + 1e-6);
            expect(point.y, name).toBeGreaterThanOrEqual(card.top - 1e-6);
            expect(point.y, name).toBeLessThanOrEqual(card.top + card.height + 1e-6);
          }
          const ownEnd = side === 0 ? link.from : link.to;
          const touchesDot = [part.from, part.to].some(
            (point) => Math.hypot(point.x - ownEnd.x, point.y - ownEnd.y) < 1e-6,
          );
          expect(touchesDot, name).toBe(true);
        }
      }
    }
  });
});
