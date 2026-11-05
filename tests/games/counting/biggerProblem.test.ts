import { describe, expect, it } from 'vitest';

import {
  hintDotGroups,
  isHintVisible,
  problemText,
  tapAnswer,
} from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { SOUNDS, soundForOutcome } from '../../../src/games/counting/logic/answerSounds';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import {
  layoutDeviceHint,
  layoutDeviceScreen,
  layoutDeviceWritingScreen,
} from '../../../src/games/counting/logic/deviceLayout';
import type {
  DeviceScreenLayout,
  DeviceWritingLayout,
} from '../../../src/games/counting/logic/deviceLayout';
import type { Problem } from '../../../src/games/counting/logic/problems';
import { START_PROGRESS } from '../../../src/games/counting/logic/progress';
import * as screenLayout from '../../../src/games/counting/logic/screenLayout';
import {
  STAR_SIZE,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
} from '../../../src/games/counting/logic/screenLayout';
import type {
  HintDot,
  ScreenLayout,
  WritingLayout,
} from '../../../src/games/counting/logic/screenLayout';
import {
  confirmSettings,
  openSettings,
  CLOSED_SETTINGS,
} from '../../../src/games/counting/logic/settingsSession';
import type { GameSettings, MaxNumber } from '../../../src/games/counting/logic/settings';
import {
  STARS_PER_SET,
  startNewStarSet,
  starsAfterTap,
} from '../../../src/games/counting/logic/stars';
import { CONFETTI_COLORS } from '../../../src/games/counting/logic/theme';
import {
  IPAD_WINDOWS,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  viewportOf,
} from '../../shared/viewportFixtures';
import type { TestWindow } from '../../shared/viewportFixtures';

/**
 * Testy k #63 (hra bez postav vedle příkladu: větší příklad uprostřed
 * a oslava jen s konfetami), AC1, AC2 a AC5 na herní ploše iPadu
 * 1024 × 768 (i ve zmenšeném zobrazení 820×1180). Telefon (AC3, AC4)
 * je v `phoneBiggerProblem.test.ts`, starý uložený postup (AC6)
 * v `progressPersistence.test.ts`.
 *
 * Box textu příkladu je vysoký 1,2 × písmo; nápověda je svisle uprostřed
 * mezi jeho spodkem a horní hranou ovládání. Hodnoty „jako dnes“ (hvězdičky
 * a ovládání) jsou tu natvrdo z rozložení před #63, protože snapshot
 * herní obrazovky se v #63 vědomě aktualizuje.
 *
 * Ručně (náhled na iPadu, iPhonu a Samsungu): v síti nejsou požadavky na
 * obrázky postav, let hvězdičky a zatřesení po chybě vypadají jako dřív,
 * oslava trvá 2,6 s a konfety nezakryjí příklad nadlouho.
 */

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const RANGES: MaxNumber[] = [5, 10, 20];

type Mode = 'číselník' | 'psaní';
const MODES: Mode[] = ['číselník', 'psaní'];

const ALL_VARIANTS: Array<[MaxNumber, Mode]> = RANGES.flatMap((maxNumber) =>
  MODES.map((mode): [MaxNumber, Mode] => [maxNumber, mode]),
);

/** Závazná písma příkladu z #63 (dřív 160 / 130 / 110). */
const PROBLEM_FONT_SIZE: Record<MaxNumber, number> = { 5: 184, 10: 150, 20: 116 };

/** Svislý střed příkladu jako dřív: 0,26 × 768 u rozsahu 5 a 10, 194 u rozsahu 20. */
const PROBLEM_Y: Record<MaxNumber, number> = { 5: 199.68, 10: 199.68, 20: 194 };

/** Box textu příkladu je vysoký 1,2 × písmo. */
const TEXT_BOX_RATIO = 1.2;

/** Spodek řady hvězdiček (střed 52 + polovina hvězdičky 15). */
const STARS_BOTTOM = 67;

const MIN_GAP_UNDER_STARS = 22;
const MIN_HINT_GAP = 14;
const MIN_SIDE_MARGIN = 24;

/** Tolerance pro „uprostřed“ a stejnou mezeru nad a pod nápovědou. */
const CENTER_TOLERANCE = 1;

/** Tolerance kontrolního výpočtu (zaokrouhlení výšky boxu na celé jednotky). */
const TABLE_TOLERANCE = 0.5;

/**
 * Názvy polí a konstant, které patřily postavě vedle příkladu (místo, velikost,
 * skok, tanec, jméno). Dřívější názvy začínaly „masc“ nebo „charact“.
 */
const FIGURE_NAME = /masc|charact/i;

/** iPad na výšku dostane dnešní zmenšené zobrazení 1024 × 768. */
const SCALED_WINDOW: TestWindow = {
  name: '820×1180 zmenšené zobrazení',
  width: 820,
  height: 1180,
  safeArea: NO_NOTCH,
};

/**
 * Kontrolní výpočet z #63 (AC2) pro nejvyšší nápovědu v rozsahu: spodek
 * boxu textu, výška nápovědy, horní hrana ovládání a mezera nad i pod.
 */
const CONTROL_TABLE: Array<{
  maxNumber: MaxNumber;
  mode: Mode;
  boxBottom: number;
  hintHeight: number;
  controlsTop: number;
  gap: number;
}> = [
  {
    maxNumber: 5,
    mode: 'číselník',
    boxBottom: 310.08,
    hintHeight: 60,
    controlsTop: 604,
    gap: 116.96,
  },
  { maxNumber: 5, mode: 'psaní', boxBottom: 310.08, hintHeight: 60, controlsTop: 424, gap: 26.96 },
  {
    maxNumber: 10,
    mode: 'číselník',
    boxBottom: 289.68,
    hintHeight: 114,
    controlsTop: 444,
    gap: 20.16,
  },
  {
    maxNumber: 10,
    mode: 'psaní',
    boxBottom: 289.68,
    hintHeight: 114,
    controlsTop: 464,
    gap: 30.16,
  },
  {
    maxNumber: 20,
    mode: 'číselník',
    boxBottom: 263.6,
    hintHeight: 76,
    controlsTop: 368,
    gap: 14.2,
  },
  { maxNumber: 20, mode: 'psaní', boxBottom: 263.6, hintHeight: 76, controlsTop: 464, gap: 62.2 },
];

/** Mezera mezi horní hranou boxu textu a spodkem hvězdiček (#63, AC2). */
const GAP_UNDER_STARS: Record<MaxNumber, number> = { 5: 22.28, 10: 42.68, 20: 57.4 };

// Hodnoty z rozložení před #63 (commit 4dc5115), v herních jednotkách.
// Tlačítko je [x, y, strana], okénko [x, y, šířka, výška].

const KEYPAD_BEFORE: Record<MaxNumber, Array<[number, number, number]>> = {
  5: [
    [102, 674, 140],
    [266, 674, 140],
    [430, 674, 140],
    [594, 674, 140],
    [758, 674, 140],
    [922, 674, 140],
  ],
  10: [
    [102, 514, 140],
    [266, 514, 140],
    [430, 514, 140],
    [594, 514, 140],
    [758, 514, 140],
    [922, 514, 140],
    [184, 674, 140],
    [348, 674, 140],
    [512, 674, 140],
    [676, 674, 140],
    [840, 674, 140],
  ],
  20: [426, 556, 686].flatMap((y) =>
    [104, 240, 376, 512, 648, 784, 920].map((x): [number, number, number] => [x, y, 116]),
  ),
};

interface WritingBefore {
  readonly areas: Array<[number, number, number, number]>;
  readonly clear: [number, number, number];
  readonly confirm: [number, number, number];
}

const TWO_BOXES_BEFORE: WritingBefore = {
  areas: [
    [356, 604, 280, 280],
    [668, 604, 280, 280],
  ],
  clear: [114, 604, 140],
  confirm: [910, 604, 140],
};

const WRITING_BEFORE: Record<MaxNumber, WritingBefore> = {
  5: { areas: [[512, 584, 320, 320]], clear: [234, 584, 140], confirm: [790, 584, 140] },
  10: TWO_BOXES_BEFORE,
  20: TWO_BOXES_BEFORE,
};

/** Plná řada deseti hvězdiček: středy po 44 kolem středu plochy, ve výšce 52. */
const STARS_BEFORE: Array<{ x: number; y: number }> = Array.from(
  { length: STARS_PER_SET },
  (_, index) => ({ x: 314 + index * 44, y: 52 }),
);

/** Tečky nápovědy jako dřív (#44): rozsah 5 větší, rozsah 20 po deseti v řadě. */
const HINT_STYLE_BEFORE = {
  5: { dotSize: 60, spacing: 76, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
  10: { dotSize: 50, spacing: 64, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
  20: { dotSize: 34, spacing: 42, dotsPerRow: 10, fiveGap: 10, groupGap: 40 },
} as const;

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

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Všechny příklady v rozsahu (sčítání i odčítání). */
function allProblems(maxNumber: number): Problem[] {
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; first + second <= maxNumber; second += 1) {
      problems.push(plus(first, second));
    }
    for (let second = 0; second <= first; second += 1) {
      problems.push(minus(first, second));
    }
  }
  return problems;
}

function problemsWithDots(maxNumber: number): Problem[] {
  return allProblems(maxNumber).filter((problem) => hintDotGroups(problem).length > 0);
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

type AnyLayout = ScreenLayout | WritingLayout;

interface Variant {
  readonly maxNumber: MaxNumber;
  readonly mode: Mode;
  readonly layout: AnyLayout;
  readonly controls: Box[];
  readonly controlsTop: number;
}

function variantFor(maxNumber: MaxNumber, mode: Mode, starCount = STARS_PER_SET): Variant {
  if (mode === 'číselník') {
    const layout = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, starCount);
    const controls = layout.answerButtons.map((b) => box(b.x, b.y, b.size, b.size));
    return {
      maxNumber,
      mode,
      layout,
      controls,
      controlsTop: Math.min(...controls.map((c) => c.top)),
    };
  }
  const layout = layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, starCount);
  const areas = layout.writingAreas.map((a) => box(a.x, a.y, a.width, a.height));
  const { clearButton, confirmButton } = layout;
  return {
    maxNumber,
    mode,
    layout,
    controls: [
      ...areas,
      box(clearButton.x, clearButton.y, clearButton.size, clearButton.size),
      box(confirmButton.x, confirmButton.y, confirmButton.size, confirmButton.size),
    ],
    controlsTop: Math.min(...areas.map((a) => a.top)),
  };
}

/** Box textu příkladu: místo pro nejdelší vyřešený příklad, vysoký 1,2 × písmo. */
function textBox(layout: AnyLayout): Box {
  const height = TEXT_BOX_RATIO * layout.problemFontSize;
  return box(layout.problem.x, layout.problem.y, layout.problemSize.width, height);
}

function hintBounds(dots: readonly HintDot[], layout: AnyLayout): Box {
  const half = layout.hintStyle.dotSize / 2;
  return {
    left: Math.min(...dots.map((dot) => dot.x - half)),
    right: Math.max(...dots.map((dot) => dot.x + half)),
    top: Math.min(...dots.map((dot) => dot.y - half)),
    bottom: Math.max(...dots.map((dot) => dot.y + half)),
  };
}

/** Kolo s pevným příkladem, aby testy nezávisely na náhodě. */
function roundFor(problem: Problem, maxNumber: MaxNumber): AnswerRound {
  return { problem, maxNumber, wrongAnswers: 0, solved: false };
}

/** Všechna rozložení, která hra může použít, i s nápovědou (telefon na šířku ji počítá). */
function everyDeviceLayout(): Array<[string, DeviceScreenLayout | DeviceWritingLayout]> {
  const windows = [
    ...IPAD_WINDOWS,
    SCALED_WINDOW,
    ...PHONE_WINDOWS,
    ...PHONE_PORTRAIT_WINDOWS,
    ...PHONE_PORTRAIT_EDGE_WINDOWS,
  ];
  const result: Array<[string, DeviceScreenLayout | DeviceWritingLayout]> = [];
  for (const window of windows) {
    const area = gameAreaFor(viewportOf(window));
    for (const maxNumber of RANGES) {
      for (const hint of [[], [maxNumber]]) {
        const where = `${window.name}, rozsah ${maxNumber}, nápověda [${hint.join(', ')}]`;
        result.push([
          `${where}, číselník`,
          layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET, hint),
        ]);
        result.push([
          `${where}, psaní`,
          layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET, hint),
        ]);
      }
    }
  }
  return result;
}

describe('#63 AC1: postava vedle příkladu zmizí, zpětná vazba zůstane', () => {
  it('v žádném rozložení (iPad, zmenšené, telefon na šířku i na výšku) není místo pro postavu ani její skok a tanec', () => {
    for (const [where, layout] of everyDeviceLayout()) {
      const keys = Object.keys(layout).filter((key) => FIGURE_NAME.test(key));
      expect(keys, where).toEqual([]);
    }
  });

  it('rozložení herní plochy nenabízí žádné rozměry postavy', () => {
    const names = Object.keys(screenLayout).filter((name) => FIGURE_NAME.test(name));

    expect(names).toEqual([]);
  });

  it('po správné odpovědi zazní zvuk správné odpovědi a v příkladu se ukáže výsledek', () => {
    const tap = tapAnswer(roundFor(plus(3, 4), 10), 7);

    expect(tap.outcome).toBe('correct');
    expect(soundForOutcome(tap.outcome)).toBe('correct');
    expect(SOUNDS.correct.length).toBeGreaterThan(0);
    expect(problemText(tap.round)).toEqual({
      equation: '3 + 4 =',
      answer: '7',
      answerRevealed: true,
    });
  });

  it('po špatné odpovědi zazní zvuk chyby a výsledek se neprozradí', () => {
    const tap = tapAnswer(roundFor(plus(3, 4), 10), 2);

    expect(tap.outcome).toBe('wrong');
    expect(soundForOutcome(tap.outcome)).toBe('wrong');
    expect(SOUNDS.wrong.length).toBeGreaterThan(0);
    expect(problemText(tap.round).answer).toBe('?');
  });

  it('po 2. chybě se ukáže nápověda, po 1. ještě ne', () => {
    let round = roundFor(plus(3, 4), 10);
    round = tapAnswer(round, 2).round;
    expect(isHintVisible(round)).toBe(false);

    round = tapAnswer(round, 9).round;
    expect(isHintVisible(round)).toBe(true);
    const dots = layoutHint(variantFor(10, 'číselník').layout, hintDotGroups(round.problem));
    expect(dots).toHaveLength(7);
  });

  it('chyba nic netrestá: hvězdičky zůstanou a po chybách jde příklad pořád vyřešit za hvězdičku', () => {
    let round = roundFor(plus(3, 4), 10);
    let progress = { earned: 4 };
    for (const tapped of [2, 9, 5, 0, 1]) {
      const tap = tapAnswer(round, tapped);
      round = tap.round;
      progress = starsAfterTap(progress, tap.outcome).progress;
      expect(progress.earned, `po ťuknutí na ${tapped}`).toBe(4);
    }

    const solved = tapAnswer(round, 7);
    expect(solved.outcome).toBe('correct');
    expect(starsAfterTap(progress, solved.outcome).progress.earned).toBe(5);
  });

  it('na iPadu i ve zmenšeném zobrazení dostane hra stejné rozložení bez postavy', () => {
    for (const window of [...IPAD_WINDOWS, SCALED_WINDOW]) {
      const area = gameAreaFor(viewportOf(window));
      for (const maxNumber of RANGES) {
        const layout = layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET);
        const expected = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber + 1, STARS_PER_SET);
        expect(layout.problem, window.name).toEqual(expected.problem);
        expect(layout.problemFontSize, window.name).toBe(PROBLEM_FONT_SIZE[maxNumber]);
      }
    }
  });
});

describe('#63 AC2: na iPadu je příklad větší a uprostřed', () => {
  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): písmo příkladu má závaznou velikost',
    (maxNumber, mode) => {
      expect(variantFor(maxNumber, mode).layout.problemFontSize).toBe(PROBLEM_FONT_SIZE[maxNumber]);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): střed příkladu je ve vodorovném středu herní plochy a svisle jako dřív',
    (maxNumber, mode) => {
      const { problem } = variantFor(maxNumber, mode).layout;

      expect(Math.abs(problem.x - SCREEN_WIDTH / 2)).toBeLessThanOrEqual(CENTER_TOLERANCE);
      expect(problem.y).toBeCloseTo(PROBLEM_Y[maxNumber], 6);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): box textu příkladu je vysoký 1,2 × písmo',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);

      expect(
        Math.abs(layout.problemSize.height - TEXT_BOX_RATIO * layout.problemFontSize),
      ).toBeLessThanOrEqual(TABLE_TOLERANCE);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): nápověda je u každého příkladu vodorovně uprostřed pod příkladem',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);

      for (const problem of problemsWithDots(maxNumber)) {
        const bounds = hintBounds(
          layoutHint(variant.layout, hintDotGroups(problem)),
          variant.layout,
        );
        const center = (bounds.left + bounds.right) / 2;
        expect(
          Math.abs(center - variant.layout.problem.x),
          problemName(problem),
        ).toBeLessThanOrEqual(CENTER_TOLERANCE);
        expect(Math.abs(center - SCREEN_WIDTH / 2), problemName(problem)).toBeLessThanOrEqual(
          CENTER_TOLERANCE,
        );
      }
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): nápověda je svisle uprostřed mezi spodkem boxu textu a ovládáním, nad i pod aspoň 14',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const bottom = textBox(variant.layout).bottom;

      for (const problem of problemsWithDots(maxNumber)) {
        const bounds = hintBounds(
          layoutHint(variant.layout, hintDotGroups(problem)),
          variant.layout,
        );
        const gapAbove = bounds.top - bottom;
        const gapBelow = variant.controlsTop - bounds.bottom;
        const where = `${problemName(problem)}: nad ${gapAbove}, pod ${gapBelow}`;

        expect(Math.abs(gapAbove - gapBelow), where).toBeLessThanOrEqual(CENTER_TOLERANCE);
        expect(gapAbove, where).toBeGreaterThanOrEqual(MIN_HINT_GAP);
        expect(gapBelow, where).toBeGreaterThanOrEqual(MIN_HINT_GAP);
      }
    },
  );

  it('rozsah 20 s číselníkem: široká nápověda už nemá výjimku a je taky uprostřed', () => {
    const variant = variantFor(20, 'číselník');
    const bottom = textBox(variant.layout).bottom;
    const twoRows = [plus(20, 0), plus(0, 20), minus(20, 20), plus(15, 5), plus(11, 9)];

    for (const problem of [plus(10, 10), ...twoRows]) {
      const bounds = hintBounds(layoutHint(variant.layout, hintDotGroups(problem)), variant.layout);
      const gapAbove = bounds.top - bottom;
      const gapBelow = variant.controlsTop - bounds.bottom;
      const where = `${problemName(problem)}: nad ${gapAbove}, pod ${gapBelow}`;

      expect(Math.abs(gapAbove - gapBelow), where).toBeLessThanOrEqual(CENTER_TOLERANCE);
      expect(gapAbove, where).toBeGreaterThanOrEqual(MIN_HINT_GAP);
    }
    for (const problem of twoRows) {
      const bounds = hintBounds(layoutHint(variant.layout, hintDotGroups(problem)), variant.layout);
      expect(bounds.bottom - bounds.top, problemName(problem)).toBeCloseTo(76, 6);
      expect(Math.abs(bounds.top - bottom - 14.2), problemName(problem)).toBeLessThanOrEqual(
        TABLE_TOLERANCE,
      );
    }
  });

  it.each(CONTROL_TABLE)(
    'rozsah $maxNumber ($mode): kontrolní výpočet sedí (spodek boxu $boxBottom, nápověda $hintHeight, ovládání $controlsTop, mezera $gap)',
    ({ maxNumber, mode, boxBottom, hintHeight, controlsTop, gap }) => {
      const variant = variantFor(maxNumber, mode);
      const tallest = problemsWithDots(maxNumber)
        .map((problem) =>
          hintBounds(layoutHint(variant.layout, hintDotGroups(problem)), variant.layout),
        )
        .reduce((a, b) => (b.bottom - b.top > a.bottom - a.top ? b : a));

      expect(Math.abs(textBox(variant.layout).bottom - boxBottom)).toBeLessThanOrEqual(
        TABLE_TOLERANCE,
      );
      expect(tallest.bottom - tallest.top).toBeCloseTo(hintHeight, 6);
      expect(variant.controlsTop).toBeCloseTo(controlsTop, 6);
      expect(Math.abs(tallest.top - boxBottom - gap)).toBeLessThanOrEqual(TABLE_TOLERANCE);
      expect(Math.abs(controlsTop - tallest.bottom - gap)).toBeLessThanOrEqual(TABLE_TOLERANCE);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): nápověda nepřekrývá box textu, ovládání ani hvězdičky',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const others = [
        textBox(variant.layout),
        ...variant.controls,
        ...variant.layout.stars.map((star) => box(star.x, star.y, STAR_SIZE, STAR_SIZE)),
      ];

      for (const problem of problemsWithDots(maxNumber)) {
        const size = variant.layout.hintStyle.dotSize;
        for (const dot of layoutHint(variant.layout, hintDotGroups(problem))) {
          for (const other of others) {
            expect(overlaps(box(dot.x, dot.y, size, size), other), problemName(problem)).toBe(
              false,
            );
          }
        }
      }
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): mezi hvězdičkami a boxem textu příkladu je aspoň 22',
    (maxNumber, mode) => {
      const top = textBox(variantFor(maxNumber, mode).layout).top;

      expect(top - STARS_BOTTOM).toBeGreaterThanOrEqual(MIN_GAP_UNDER_STARS - 1e-9);
      expect(Math.abs(top - STARS_BOTTOM - GAP_UNDER_STARS[maxNumber])).toBeLessThanOrEqual(
        TABLE_TOLERANCE,
      );
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): nejdelší vyřešený příklad i nejširší nápověda mají okraj aspoň 24 na každé straně',
    (maxNumber, mode) => {
      const variant = variantFor(maxNumber, mode);
      const text = textBox(variant.layout);

      expect(text.left).toBeGreaterThanOrEqual(MIN_SIDE_MARGIN);
      expect(text.right).toBeLessThanOrEqual(SCREEN_WIDTH - MIN_SIDE_MARGIN);
      for (const problem of problemsWithDots(maxNumber)) {
        const bounds = hintBounds(
          layoutHint(variant.layout, hintDotGroups(problem)),
          variant.layout,
        );
        expect(bounds.left, problemName(problem)).toBeGreaterThanOrEqual(MIN_SIDE_MARGIN);
        expect(bounds.right, problemName(problem)).toBeLessThanOrEqual(
          SCREEN_WIDTH - MIN_SIDE_MARGIN,
        );
      }
    },
  );

  it.each(MODES)('rozsah 20 (%s): nejširší nápověda „10 + 10“ je široká 892', (mode) => {
    const variant = variantFor(20, mode);
    const bounds = hintBounds(layoutHint(variant.layout, [10, 10]), variant.layout);

    expect(bounds.right - bounds.left).toBeCloseTo(892, 6);
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): místo pro příklad stačí i na nejdelší vyřešený příklad ve větším písmu',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);
      // Nejdelší vyřešený příklad má v rozsahu 5 tři číslice, v 10 pět a v 20 šest
      // (Arial: číslice 0,56, mezera 0,28 a znaménko 0,59 písma, 4 mezery, 2 znaménka).
      const digits: Record<MaxNumber, number> = { 5: 3, 10: 5, 20: 6 };
      const width = layout.problemFontSize * (digits[maxNumber] * 0.56 + 4 * 0.28 + 2 * 0.59);

      expect(layout.problemSize.width).toBeGreaterThanOrEqual(width);
    },
  );

  it.each(RANGES)('rozsah %i: číselník má stejnou polohu a velikost jako dřív', (maxNumber) => {
    const { answerButtons } = layoutScreen(
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      maxNumber + 1,
      STARS_PER_SET,
    );

    expect(answerButtons.map((b) => [b.x, b.y, b.size])).toEqual(KEYPAD_BEFORE[maxNumber]);
  });

  it.each(RANGES)(
    'rozsah %i: okénka na psaní, smazání a ✓ mají stejnou polohu a velikost jako dřív',
    (maxNumber) => {
      const layout = layoutWritingScreen(SCREEN_WIDTH, SCREEN_HEIGHT, maxNumber, STARS_PER_SET);
      const expected = WRITING_BEFORE[maxNumber];

      expect(layout.writingAreas.map((a) => [a.x, a.y, a.width, a.height])).toEqual(expected.areas);
      expect([layout.clearButton.x, layout.clearButton.y, layout.clearButton.size]).toEqual(
        expected.clear,
      );
      expect([layout.confirmButton.x, layout.confirmButton.y, layout.confirmButton.size]).toEqual(
        expected.confirm,
      );
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): hvězdičky i tečky nápovědy mají stejnou polohu a velikost jako dřív',
    (maxNumber, mode) => {
      const { layout } = variantFor(maxNumber, mode);

      expect(STAR_SIZE).toBe(30);
      expect(layout.stars.map((star) => ({ x: star.x, y: star.y }))).toEqual(STARS_BEFORE);
      expect(layout.hintStyle).toEqual(HINT_STYLE_BEFORE[maxNumber]);
    },
  );

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): stejné rozložení dostane i hra přes layoutDeviceHint (iPad bez výjimek)',
    (maxNumber, mode) => {
      const area = gameAreaFor(viewportOf(IPAD_WINDOWS[0] as TestWindow));
      const device =
        mode === 'číselník'
          ? layoutDeviceScreen(area, maxNumber + 1, STARS_PER_SET)
          : layoutDeviceWritingScreen(area, maxNumber, STARS_PER_SET);
      const groups = maxNumber === 5 ? [3, 2] : [7, 3];

      expect(layoutDeviceHint(device, groups)).toEqual(
        layoutHint(variantFor(maxNumber, mode).layout, groups),
      );
    },
  );
});

describe('#63 AC5: oslava po deseti hvězdičkách je jen s konfetami a melodií', () => {
  const SAVED: GameSettings = { maxNumber: 10, operations: 'plus', answerInput: 'keypad' };

  it('desátá správná odpověď spustí oslavu s melodií a konfetami', () => {
    const result = starsAfterTap({ earned: STARS_PER_SET - 1 }, 'correct');

    expect(result.setCompleted).toBe(true);
    expect(SOUNDS.celebration.length).toBeGreaterThan(0);
    expect(CONFETTI_COLORS.length).toBeGreaterThan(0);
  });

  it('po oslavě přijde prázdná řada hvězdiček a nic jiného se nevystřídá', () => {
    expect(startNewStarSet()).toEqual({ earned: 0 });
    expect(START_PROGRESS).toEqual({ earned: 0 });
  });

  it.each(ALL_VARIANTS)(
    'rozsah %i (%s): při oslavě (plná řada) se příklad, číselník ani okénka neposunou a nic nepřibude',
    (maxNumber, mode) => {
      const before = variantFor(maxNumber, mode, STARS_PER_SET - 1);
      const during = variantFor(maxNumber, mode, STARS_PER_SET);
      const { stars: starsBefore, ...restBefore } = before.layout;
      const { stars: starsDuring, ...restDuring } = during.layout;

      expect(restDuring).toEqual(restBefore);
      expect(during.controls).toEqual(before.controls);
      expect(starsDuring).toHaveLength(starsBefore.length + 1);
      expect(Object.keys(during.layout).sort()).toEqual(Object.keys(before.layout).sort());
    },
  );

  it('když oslavu přeruší nastavení, po ✓ přijde prázdná řada a nový příklad', () => {
    const open = openSettings(CLOSED_SETTINGS, SAVED);

    const result = confirmSettings(open, SAVED, { earned: STARS_PER_SET });

    expect(result.progress).toEqual({ earned: 0 });
    expect(result.startNewProblem).toBe(true);
  });
});
