import { describe, expect, it } from 'vitest';

import { MAX_SUM } from '../src/logic/addition';
import { ANSWER_CHOICES, hintDotGroups } from '../src/logic/answerRound';
import {
  HINT_DOT_SIZE,
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  MIN_LANDSCAPE_SIZE,
  MIN_PORTRAIT_SIZE,
  PROBLEM_MAX_WIDTH,
  PROBLEM_TEXT_HEIGHT,
  STAR_SIZE,
  gameSizeFor,
  layoutHintDots,
  layoutScreen,
} from '../src/logic/screenLayout';
import type { GameSize, ScreenLayout } from '../src/logic/screenLayout';
import { STARS_PER_SET } from '../src/logic/stars';

/** Obrazovky v CSS pixelech, na kterých se hra hraje (šířka × výška). */
const SCREENS = {
  'iPad Air na šířku v Safari': [1180, 740],
  'iPad Air na šířku celá obrazovka': [1180, 820],
  'starší iPad 4 : 3 na šířku': [1024, 768],
  'telefon na šířku': [844, 390],
  'široký monitor 2 : 1': [1600, 800],
  'čtvercové okno': [800, 800],
  'iPad Air na výšku': [820, 1110],
  'telefon na výšku v Safari': [414, 700],
  'vysoký telefon na výšku': [390, 844],
  'iPad 3 : 4 na výšku': [768, 1024],
} as const satisfies Record<string, readonly [number, number]>;

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function box(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideScreen(b: Box, size: GameSize): boolean {
  return b.left >= 0 && b.top >= 0 && b.right <= size.width && b.bottom <= size.height;
}

interface ScreenCase {
  readonly name: string;
  readonly size: GameSize;
  readonly layout: ScreenLayout;
  readonly landscape: boolean;
}

const CASES: ScreenCase[] = Object.entries(SCREENS).map(([name, [width, height]]) => {
  const size = gameSizeFor(width, height);
  return {
    name,
    size,
    layout: layoutScreen(size.width, size.height, ANSWER_CHOICES.length, STARS_PER_SET),
    landscape: width >= height,
  };
});

/** Všechny skupinky teček nápovědy, které mohou ve hře nastat. */
const ALL_HINTS: number[][] = [];
for (let first = 0; first <= MAX_SUM; first += 1) {
  for (let second = 0; first + second <= MAX_SUM; second += 1) {
    ALL_HINTS.push(hintDotGroups({ first, second, result: first + second }));
  }
}

function mascotBox(layout: ScreenLayout): Box {
  const { x, y } = layout.mascot;
  return {
    left: x - MASCOT_SIZE / 2 - MASCOT_DANCE_SWAY,
    right: x + MASCOT_SIZE / 2 + MASCOT_DANCE_SWAY,
    top: y - MASCOT_SIZE / 2 - MASCOT_JUMP_HEIGHT,
    bottom: y + MASCOT_SIZE / 2,
  };
}

function problemBox(layout: ScreenLayout): Box {
  return box(layout.problem.x, layout.problem.y, PROBLEM_MAX_WIDTH, PROBLEM_TEXT_HEIGHT);
}

function buttonBoxes(layout: ScreenLayout): Box[] {
  return layout.answerButtons.map((button) => box(button.x, button.y, button.size, button.size));
}

function starBoxes(layout: ScreenLayout): Box[] {
  return layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE));
}

/** Řady číselníku shora dolů, v každé počet tlačítek. */
function keypadRows(layout: ScreenLayout): number[] {
  const rows = new Map<number, number>();
  for (const button of layout.answerButtons) {
    rows.set(button.y, (rows.get(button.y) ?? 0) + 1);
  }
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, count]) => count);
}

describe('AC1: hra vyplní celou obrazovku bez prázdných pruhů', () => {
  it.each(CASES)('$name: herní plocha má stejný poměr stran jako obrazovka', ({ name, size }) => {
    const [width, height] = SCREENS[name as keyof typeof SCREENS];

    expect(size.width / size.height).toBeCloseTo(width / height, 2);
  });

  it.each(CASES)('$name: herní plocha není menší, než se vejde', ({ size, landscape }) => {
    const min = landscape ? MIN_LANDSCAPE_SIZE : MIN_PORTRAIT_SIZE;

    expect(size.width).toBeGreaterThanOrEqual(min.width);
    expect(size.height).toBeGreaterThanOrEqual(min.height);
  });

  it('nesmyslná velikost okna nerozbije hru, použije se výchozí plocha', () => {
    for (const [width, height] of [
      [0, 0],
      [-100, 500],
      [Number.NaN, 700],
      [800, Number.POSITIVE_INFINITY],
    ]) {
      expect(gameSizeFor(width ?? 0, height ?? 0)).toEqual(MIN_LANDSCAPE_SIZE);
    }
  });
});

describe('AC2: na šířku je číselník dole ve dvou řadách a postavička vlevo', () => {
  const landscapeCases = CASES.filter(({ landscape }) => landscape);

  it.each(landscapeCases)('$name: hvězdičky nahoře, číselník u spodního okraje', (c) => {
    const lowestButtonBottom = Math.max(...buttonBoxes(c.layout).map((b) => b.bottom));

    expect(Math.max(...starBoxes(c.layout).map((b) => b.bottom))).toBeLessThan(100);
    expect(c.size.height - lowestButtonBottom).toBeLessThanOrEqual(60);
  });

  it.each(landscapeCases)('$name: číselník má řady 0–5 a 6–10', ({ layout }) => {
    expect(keypadRows(layout)).toEqual([6, 5]);
  });

  it.each(landscapeCases)('$name: postavička je vlevo vedle příkladu', ({ layout }) => {
    expect(mascotBox(layout).right).toBeLessThanOrEqual(problemBox(layout).left);
  });
});

describe('AC3: na výšku je vše pod sebou a číselník ve třech řadách', () => {
  const portraitCases = CASES.filter(({ landscape }) => !landscape);

  it.each(portraitCases)('$name: číselník má řady 0–3, 4–7 a 8–10', ({ layout }) => {
    expect(keypadRows(layout)).toEqual([4, 4, 3]);
  });

  it.each(portraitCases)(
    '$name: hvězdičky, postavička, příklad a nápověda jdou shora dolů',
    (c) => {
      const { layout } = c;

      expect(Math.max(...starBoxes(layout).map((b) => b.bottom))).toBeLessThanOrEqual(
        mascotBox(layout).top,
      );
      expect(mascotBox(layout).bottom).toBeLessThanOrEqual(problemBox(layout).top);
      expect(problemBox(layout).bottom).toBeLessThan(layout.hint.y);
    },
  );

  it.each(portraitCases)('$name: číselník je u spodního okraje a přes skoro celou šířku', (c) => {
    const buttons = buttonBoxes(c.layout);
    const keypadWidth =
      Math.max(...buttons.map((b) => b.right)) - Math.min(...buttons.map((b) => b.left));

    expect(c.size.height - Math.max(...buttons.map((b) => b.bottom))).toBeLessThanOrEqual(60);
    expect(keypadWidth).toBeGreaterThanOrEqual(c.size.width * 0.75);
  });
});

describe('AC4: na žádné obrazovce se nic nepřekrývá ani nevyčnívá', () => {
  it.each(CASES)('$name: vše je celé na obrazovce', ({ size, layout }) => {
    const all = [
      mascotBox(layout),
      problemBox(layout),
      ...starBoxes(layout),
      ...buttonBoxes(layout),
    ];

    for (const b of all) {
      expect(insideScreen(b, size)).toBe(true);
    }
  });

  it.each(CASES)(
    '$name: tlačítka, hvězdičky, postavička a příklad se nepřekrývají',
    ({ layout }) => {
      const all = [
        mascotBox(layout),
        problemBox(layout),
        ...starBoxes(layout),
        ...buttonBoxes(layout),
      ];

      for (const [index, a] of all.entries()) {
        for (const b of all.slice(index + 1)) {
          expect(overlaps(a, b)).toBe(false);
        }
      }
    },
  );

  it.each(CASES)('$name: nápověda u žádného příkladu nic nepřekrývá', ({ size, layout }) => {
    const others = [
      mascotBox(layout),
      problemBox(layout),
      ...starBoxes(layout),
      ...buttonBoxes(layout),
    ];

    for (const groups of ALL_HINTS) {
      for (const dot of layoutHintDots(groups, layout.hint)) {
        const dotBox = box(dot.x, dot.y, HINT_DOT_SIZE, HINT_DOT_SIZE);
        expect(insideScreen(dotBox, size)).toBe(true);
        for (const other of others) {
          expect(overlaps(dotBox, other)).toBe(false);
        }
      }
    }
  });
});

describe('AC5: tlačítka jsou dost velká a čísla jdou popořadě', () => {
  it.each(CASES)('$name: každé tlačítko má aspoň 140 × 140 px', ({ layout }) => {
    for (const button of layout.answerButtons) {
      expect(button.size).toBeGreaterThanOrEqual(140);
    }
  });

  it.each(CASES)('$name: čísla jdou zleva doprava a shora dolů od 0 do 10', ({ layout }) => {
    const readingOrder = layout.answerButtons
      .map((button, index) => ({ button, number: ANSWER_CHOICES[index] }))
      .sort((a, b) => a.button.y - b.button.y || a.button.x - b.button.x)
      .map(({ number }) => number);

    expect(readingOrder).toEqual([...ANSWER_CHOICES]);
  });
});

describe('AC6: po otočení zařízení zůstane hra hratelná', () => {
  it('otočení iPadu z šířky na výšku a zpět dá vždy platné rozložení', () => {
    for (const [width, height] of [
      [1180, 740],
      [820, 1110],
      [1180, 740],
    ] as const) {
      const size = gameSizeFor(width, height);
      const layout = layoutScreen(size.width, size.height, ANSWER_CHOICES.length, STARS_PER_SET);

      expect(layout.answerButtons).toHaveLength(ANSWER_CHOICES.length);
      expect(layout.stars).toHaveLength(STARS_PER_SET);
    }
  });
});
