import { afterEach, describe, expect, it } from 'vitest';

import {
  layoutCompareScreen,
  layoutProblemScreen,
  layoutRelationScreen,
} from '../../../src/games/compare/logic/compareLayout';
import type { Rect } from '../../../src/games/compare/logic/compareLayout';
import { allProblems, allRelationProblems } from '../../../src/games/compare/logic/compareProblems';
import type { CompareProblem } from '../../../src/games/compare/logic/compareProblems';
import {
  ANSWER_INPUT_OPTIONS,
  MAX_NUMBER_OPTIONS,
} from '../../../src/games/compare/logic/compareSettings';
import type { MaxNumber } from '../../../src/games/compare/logic/compareSettings';
import { homeButtonFor } from '../../../src/shared/logic/homeButton';
import { settingsGearFor } from '../../../src/shared/logic/settingsGear';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import { LANGUAGES, selectLanguage } from '../../../src/shared/texts/languages';
import type { Language } from '../../../src/shared/texts/languages';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  gapBetween,
  isInside,
  overlaps,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #190 AC4 a AC6: rozložení obou druhů příkladů („a ☐ b = c“
 * s tlačítky + −, „a ☐ b“ s tlačítky < = >) jako pravidla v cyklu přes
 * všechna zkušební okna (iPad, telefon na šířku i na výšku), oba jazyky,
 * oba rozsahy a oba druhy. Vše v CSS px okna: tlačítka aspoň 64 px
 * a 8 px od sebe, nic se nepřekrývá ani neleží pod domečkem a kolečkem,
 * všechno se vejde a čísla „a ☐ b“ jsou aspoň tak velká jako u + −.
 */

const MIN_TOUCH_CSS = 64;
const MIN_GAP_CSS = 8;
const MIN_NUMBER_FONT_CSS = 48;
/** Odhad šířky číslice a znaménka jako díl velikosti písma (bez měření v prohlížeči). */
const DIGIT_WIDTH_RATIO = 0.62;

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
  SCALED_WINDOW,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];
const DEVICE_WINDOWS = ALL_WINDOWS.filter((window) => window !== SCALED_WINDOW);

type Kind = CompareProblem['kind'];
const KINDS: readonly Kind[] = ['arithmetic', 'relation'];

interface Part {
  readonly name: string;
  readonly box: Box;
}

/** Jedna obrazovka hry: okno, jazyk, rozsah, druh a jeden příklad. */
interface Screen {
  readonly name: string;
  readonly window: TestWindow;
  readonly area: GameArea;
  readonly maxNumber: MaxNumber;
  readonly kind: Kind;
  readonly problem: CompareProblem;
  /** Části příkladu zleva doprava. */
  readonly equation: readonly Part[];
  /** Čísla příkladu s jejich místem. */
  readonly numbers: ReadonlyArray<{ readonly slot: Rect; readonly value: number }>;
  readonly box: Rect;
  readonly boxHit: Rect;
  readonly fontSize: number;
  readonly signSize: number;
  /** Tlačítka zleva doprava se svým znaménkem. */
  readonly buttons: ReadonlyArray<Part & { readonly sign: string }>;
  readonly symbolSize: number;
  readonly stars: readonly Part[];
}

afterEach(() => {
  selectLanguage('cs');
});

function cssOf(rect: Rect, area: GameArea): Box {
  return {
    left: area.offsetX + rect.left * area.scale,
    right: area.offsetX + (rect.left + rect.width) * area.scale,
    top: area.offsetY + rect.top * area.scale,
    bottom: area.offsetY + (rect.top + rect.height) * area.scale,
  };
}

function width(box: Box): number {
  return box.right - box.left;
}

function height(box: Box): number {
  return box.bottom - box.top;
}

function boundsOf(parts: readonly Part[]): Box {
  const boxes = parts.map((part) => part.box);
  return {
    left: Math.min(...boxes.map((box) => box.left)),
    right: Math.max(...boxes.map((box) => box.right)),
    top: Math.min(...boxes.map((box) => box.top)),
    bottom: Math.max(...boxes.map((box) => box.bottom)),
  };
}

/** Příklady, přes které pravidla jdou: jeden za každý tvar (počet číslic, druh). */
function problemShapes(maxNumber: MaxNumber, kind: Kind): CompareProblem[] {
  const problems: readonly CompareProblem[] =
    kind === 'relation' ? allRelationProblems(maxNumber) : allProblems(maxNumber);
  const byShape = new Map<string, CompareProblem>();
  for (const problem of problems) {
    const numbers =
      problem.kind === 'relation' ? [problem.a, problem.b] : [problem.a, problem.b, problem.result];
    const shape = numbers.map((value) => String(value).length).join(':');
    if (!byShape.has(shape)) {
      byShape.set(shape, problem);
    }
  }
  return [...byShape.values()];
}

function starParts(
  stars: { readonly stars: ReadonlyArray<{ x: number; y: number }>; readonly starSize: number },
  area: GameArea,
): Part[] {
  const size = stars.starSize;
  return stars.stars.map((star, index) => ({
    name: `hvězdička ${index + 1}`,
    box: cssOf(
      { left: star.x - size / 2, top: star.y - size / 2, width: size, height: size },
      area,
    ),
  }));
}

/** Obrazovka „a ☐ b = c“ s + − nebo „a ☐ b“ s < = > pro jeden příklad. */
function screenOf(
  window: TestWindow,
  language: Language,
  maxNumber: MaxNumber,
  problem: CompareProblem,
): Screen {
  const area = gameAreaFor(viewportOf(window), 'fullWindow');
  const base = { window, area, maxNumber, kind: problem.kind, problem };
  if (problem.kind === 'relation') {
    const layout = layoutRelationScreen(area, maxNumber);
    const equation = layout.equationFor(problem);
    const buttons = layout.relationButtons;
    return {
      ...base,
      name: `${language}, ${window.name}, do ${maxNumber}: ${problem.a} ☐ ${problem.b}`,
      equation: [
        { name: 'první číslo', box: cssOf(equation.first, area) },
        { name: 'okénko', box: cssOf(equation.box, area) },
        { name: 'druhé číslo', box: cssOf(equation.second, area) },
      ],
      numbers: [
        { slot: equation.first, value: problem.a },
        { slot: equation.second, value: problem.b },
      ],
      box: equation.box,
      boxHit: equation.boxHit,
      fontSize: equation.fontSize,
      signSize: equation.signSize,
      buttons: [
        { name: 'tlačítko <', sign: '<', box: cssOf(buttons.less, area) },
        { name: 'tlačítko =', sign: '=', box: cssOf(buttons.equal, area) },
        { name: 'tlačítko >', sign: '>', box: cssOf(buttons.greater, area) },
      ],
      symbolSize: buttons.symbolSize,
      stars: starParts(layout.stars, area),
    };
  }
  const layout = layoutCompareScreen(area, maxNumber);
  const equation = layout.equationFor(problem);
  const buttons = layout.signButtons;
  return {
    ...base,
    name: `${language}, ${window.name}, do ${maxNumber}: ${problem.a} ☐ ${problem.b} = ${problem.result}`,
    equation: [
      { name: 'první číslo', box: cssOf(equation.first, area) },
      { name: 'okénko', box: cssOf(equation.box, area) },
      { name: 'druhé číslo', box: cssOf(equation.second, area) },
      { name: '„=“', box: cssOf(equation.equals, area) },
      { name: 'výsledek', box: cssOf(equation.result, area) },
    ],
    numbers: [
      { slot: equation.first, value: problem.a },
      { slot: equation.second, value: problem.b },
      { slot: equation.result, value: problem.result },
    ],
    box: equation.box,
    boxHit: equation.boxHit,
    fontSize: equation.fontSize,
    signSize: equation.signSize,
    buttons: [
      { name: 'tlačítko +', sign: '+', box: cssOf(buttons.plus, area) },
      { name: 'tlačítko −', sign: '−', box: cssOf(buttons.minus, area) },
    ],
    symbolSize: buttons.symbolSize,
    stars: starParts(layout.stars, area),
  };
}

/** Všechny kombinace okno × jazyk × rozsah × druh × tvar příkladu. */
function screens(windows: readonly TestWindow[] = ALL_WINDOWS): Screen[] {
  return windows.flatMap((window) =>
    LANGUAGES.flatMap((language) => {
      selectLanguage(language);
      return MAX_NUMBER_OPTIONS.flatMap((maxNumber) =>
        KINDS.flatMap((kind) =>
          problemShapes(maxNumber, kind).map((problem) =>
            screenOf(window, language, maxNumber, problem),
          ),
        ),
      );
    }),
  );
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

function allParts(screen: Screen): Part[] {
  return [...screen.equation, ...screen.buttons, ...screen.stars];
}

describe('#190 AC4: tlačítka podle druhu příkladu', () => {
  it('u „a ☐ b = c“ jsou pod příkladem 2 tlačítka + −, u „a ☐ b“ 3 tlačítka < = >', () => {
    for (const screen of screens()) {
      expect(
        screen.buttons.map((button) => button.sign),
        screen.name,
      ).toEqual(screen.kind === 'relation' ? ['<', '=', '>'] : ['+', '−']);
    }
  });

  it('dítě trefí každé tlačítko prstem: aspoň 64 × 64 px v každém okně, jazyce, rozsahu i druhu', () => {
    for (const screen of screens()) {
      for (const button of screen.buttons) {
        const name = `${screen.name}: ${button.name}`;
        expect(width(button.box), name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
        expect(height(button.box), name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS);
      }
    }
  });

  it('mezi tlačítky je aspoň 8 px a mezi tlačítky a příkladem i hvězdičkami taky', () => {
    for (const screen of screens()) {
      const equation = boundsOf(screen.equation);
      for (const [index, button] of screen.buttons.entries()) {
        for (const other of screen.buttons.slice(index + 1)) {
          expect(
            gapBetween(button.box, other.box),
            `${screen.name}: ${button.name} × ${other.name}`,
          ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        }
        expect(
          gapBetween(button.box, equation),
          `${screen.name}: ${button.name} × příklad`,
        ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        for (const star of screen.stars) {
          expect(
            gapBetween(button.box, star.box),
            `${screen.name}: ${button.name} × ${star.name}`,
          ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
        }
      }
    }
  });

  it('tlačítka jsou pod příkladem v jedné řadě zleva doprava a stejně velká', () => {
    for (const screen of screens()) {
      const equation = boundsOf(screen.equation);
      const [first] = screen.buttons;
      for (const [index, button] of screen.buttons.entries()) {
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeGreaterThanOrEqual(
          equation.bottom,
        );
        expect(button.box.top, `${screen.name}: ${button.name}`).toBeCloseTo(first!.box.top, 3);
        expect(width(button.box), `${screen.name}: ${button.name}`).toBeCloseTo(
          width(first!.box),
          3,
        );
        expect(height(button.box), `${screen.name}: ${button.name}`).toBeCloseTo(
          height(first!.box),
          3,
        );
        const previous = screen.buttons[index - 1];
        if (previous !== undefined) {
          expect(previous.box.right, `${screen.name}: ${button.name}`).toBeLessThanOrEqual(
            button.box.left,
          );
        }
      }
    }
  });

  it('znaménko v tlačítku je velké a celé uvnitř tlačítka', () => {
    for (const screen of screens()) {
      for (const button of screen.buttons) {
        const name = `${screen.name}: ${button.name}`;
        const symbolCss = screen.symbolSize * screen.area.scale;
        expect(symbolCss, name).toBeGreaterThan(0);
        expect(symbolCss, name).toBeLessThanOrEqual(height(button.box));
        expect(symbolCss * DIGIT_WIDTH_RATIO, name).toBeLessThanOrEqual(width(button.box));
      }
    }
  });

  it('při ťukání dostane „a ☐ b“ tlačítka < = >, při psaní oba druhy plochu na psaní (#191)', () => {
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        for (const answerInput of ANSWER_INPUT_OPTIONS) {
          const name = `${window.name}, do ${maxNumber}, ${answerInput}`;
          const relation = layoutProblemScreen(area, { maxNumber, answerInput }, 'relation');
          expect(relation.problemKind, name).toBe('relation');
          expect(relation.writing === null, name).toBe(answerInput === 'tap');
          const tapped = layoutRelationScreen(area, maxNumber);
          expect(relation.relationButtons, name).toEqual(
            answerInput === 'tap' ? tapped.relationButtons : null,
          );
          const arithmetic = layoutProblemScreen(area, { maxNumber, answerInput }, 'arithmetic');
          expect(arithmetic.problemKind, name).toBe('arithmetic');
          expect(arithmetic.writing === null, name).toBe(answerInput === 'tap');
          if (answerInput === 'tap') {
            expect(relation.equationFontSize, name).toBe(tapped.equationFontSize);
          } else {
            // Při psaní má „a ☐ b“ stejné písmo jako „a ☐ b = c“, aby se při „vše“ nic neměnilo.
            expect(relation.equationFontSize, name).toBe(arithmetic.equationFontSize);
          }
        }
      }
    }
  });
});

describe('#190 AC6: všechno je na obrazovce a nic se nepřekrývá', () => {
  it('dítě vidí celý příklad, tlačítka i hvězdičky, nic nepřečnívá z herní plochy', () => {
    for (const screen of screens()) {
      const whole = cssOf(
        { left: 0, top: 0, width: screen.area.width, height: screen.area.height },
        screen.area,
      );
      for (const part of allParts(screen)) {
        expect(isInside(part.box, whole), `${screen.name}: ${part.name}`).toBe(true);
      }
    }
  });

  it('části příkladu, tlačítka a hvězdičky se navzájem nepřekrývají', () => {
    for (const screen of screens()) {
      const parts = allParts(screen);
      for (const [index, part] of parts.entries()) {
        for (const other of parts.slice(index + 1)) {
          expect(
            overlaps(part.box, other.box),
            `${screen.name}: ${part.name} × ${other.name}`,
          ).toBe(false);
        }
      }
    }
  });

  it('nic ze hry neleží pod domečkem ani pod kolečkem v horních rozích', () => {
    for (const screen of screens()) {
      for (const part of [
        ...allParts(screen),
        { name: 'okénko na ťuknutí', box: cssOf(screen.boxHit, screen.area) },
      ]) {
        for (const corner of cornerButtons(screen.window)) {
          expect(overlaps(part.box, corner), `${screen.name}: ${part.name}`).toBe(false);
        }
      }
    }
  });

  it('okénko jde trefit prstem (aspoň 64 × 64 px) a je od tlačítek aspoň 8 px', () => {
    for (const screen of screens()) {
      const hit = cssOf(screen.boxHit, screen.area);
      expect(width(hit), screen.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(height(hit), screen.name).toBeGreaterThanOrEqual(MIN_TOUCH_CSS - 0.01);
      expect(isInside(cssOf(screen.box, screen.area), hit), screen.name).toBe(true);
      for (const button of screen.buttons) {
        expect(
          gapBetween(hit, button.box),
          `${screen.name}: ${button.name}`,
        ).toBeGreaterThanOrEqual(MIN_GAP_CSS - 0.01);
      }
    }
  });
});

describe('#190 AC6: čísla jsou velká a čitelná', () => {
  it('části příkladu jsou v jedné řadě zleva doprava', () => {
    for (const screen of screens()) {
      for (let index = 1; index < screen.equation.length; index += 1) {
        const previous = screen.equation[index - 1]!.box;
        const current = screen.equation[index]!.box;
        expect(previous.right, screen.name).toBeLessThanOrEqual(current.left);
        expect((current.top + current.bottom) / 2, screen.name).toBeCloseTo(
          (previous.top + previous.bottom) / 2,
          3,
        );
      }
    }
  });

  it('každé číslo (i dvoumístné) se celé vejde do svého místa a znaménko do okénka', () => {
    for (const screen of screens()) {
      for (const { slot, value } of screen.numbers) {
        const digits = String(value).length;
        expect(digits * DIGIT_WIDTH_RATIO * screen.fontSize, screen.name).toBeLessThanOrEqual(
          slot.width,
        );
        expect(screen.fontSize, screen.name).toBeLessThanOrEqual(slot.height);
      }
      expect(screen.signSize * DIGIT_WIDTH_RATIO, screen.name).toBeLessThanOrEqual(
        screen.box.width,
      );
      expect(screen.signSize, screen.name).toBeLessThanOrEqual(screen.box.height);
    }
  });

  it('čísla jsou na každém zařízení aspoň 48 px a okénko je čtverec', () => {
    for (const screen of screens(DEVICE_WINDOWS)) {
      expect(screen.fontSize * screen.area.scale, screen.name).toBeGreaterThanOrEqual(
        MIN_NUMBER_FONT_CSS,
      );
      expect(screen.box.width, screen.name).toBeCloseTo(screen.box.height, 3);
    }
  });

  it('čísla „a ☐ b“ jsou v každém okně a rozsahu aspoň tak velká jako u „a ☐ b = c“', () => {
    for (const window of ALL_WINDOWS) {
      const area = gameAreaFor(viewportOf(window), 'fullWindow');
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        expect(
          layoutRelationScreen(area, maxNumber).equationFontSize,
          `${window.name}, do ${maxNumber}`,
        ).toBeGreaterThanOrEqual(layoutCompareScreen(area, maxNumber).equationFontSize - 1e-9);
      }
    }
  });

  it('v jednom rozsahu mají všechny příklady „a ☐ b“ stejně velká čísla', () => {
    for (const window of ALL_WINDOWS) {
      const layout = (maxNumber: MaxNumber) =>
        layoutRelationScreen(gameAreaFor(viewportOf(window), 'fullWindow'), maxNumber);
      for (const maxNumber of MAX_NUMBER_OPTIONS) {
        const sizes = new Set(
          allRelationProblems(maxNumber).map(
            (problem) => layout(maxNumber).equationFor(problem).fontSize,
          ),
        );
        expect(sizes.size, `${window.name}, do ${maxNumber}`).toBe(1);
      }
    }
  });
});
