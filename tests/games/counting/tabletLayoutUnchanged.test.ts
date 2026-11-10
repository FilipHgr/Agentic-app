import { describe, expect, it } from 'vitest';

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  STAR_SIZE,
  hintDotHitArea,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
} from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import {
  IPAD_WINDOWS,
  TODAY_GAME_HEIGHT,
  TODAY_GAME_WIDTH,
  todayFitPlacement,
} from '../../shared/viewportFixtures';

/**
 * Testy k #54, AC5 (iPad se nemění), od #81 s pevnými body místo snapshotu.
 *
 * Na iPadu na šířku (okna 1180×820 a 1180×760) je herní plocha 1024 × 768
 * zmenšená na střed okna (Phaser Scale.FIT). Poloha prvku v okně v CSS px
 * je posun plochy + herní jednotky × měřítko. Pevné jsou obě části: místo
 * a měřítko plochy v každém okně a polohy všech prvků v herních jednotkách
 * (hvězdičky, příklad, nápověda, každé tlačítko číselníku, okénka, smazání
 * a ✓) ve všech rozsazích, s číselníkem i s psaním, při plné řadě
 * hvězdiček. Porovnává se přesně, bez tolerance. Hodnoty jsou z dřívějšího
 * snapshotu (ověřeno jednorázovým skriptem při #81).
 *
 * #63: herní obrazovka se vědomě změnila (větší příklad uprostřed, nápověda
 * od spodku boxu textu). Že se hvězdičky a ovládání nepohnuly, hlídá
 * natvrdo `biggerProblem.test.ts`. Že nová volba rozložení dá iPadu právě
 * tohle, ověřuje `deviceLayout.test.ts`.
 *
 * Při vědomé změně rozložení iPadu se hodnoty tady přepíšou a změna je
 * vidět v diffu.
 */

/** Místo a velikost herní plochy v okně v CSS px. */
const PLACEMENTS: Readonly<Record<string, object>> = {
  'iPad 1180×820': {
    width: 1093.3333333333333,
    height: 820,
    scale: 1.0677083333333333,
    offsetX: 43.33333333333337,
    offsetY: 0,
  },
  'iPad 1180×760': {
    width: 1013.3333333333334,
    height: 760,
    scale: 0.9895833333333334,
    offsetX: 83.33333333333331,
    offsetY: 0,
  },
};

/** Strana hvězdičky a plochy pro ťuknutí na tečku nápovědy v herních jednotkách. */
const STAR_SIDE = 30;
const DOT_HIT_SIDE = 64;

type Point = [x: number, y: number];
type Slot = [x: number, y: number, size: number];
type Area = [x: number, y: number, width: number, height: number];
type Dot = [x: number, y: number, group: number];

interface ScreenPoints {
  readonly problem: Point;
  readonly problemFontSize: number;
  readonly problemSize: [width: number, height: number];
  readonly hintStyle: object;
  readonly stars: Point[];
  /** Číselník: tlačítka 0 až rozsah. Psaní: smazání a ✓. */
  readonly buttons: Slot[];
  readonly writingAreas?: Area[];
  /** Tečky nápovědy pro nerovné skupinky a nejvíc teček v rozsahu. */
  readonly hints: Record<string, Dot[]>;
}

/** Polohy prvků herní plochy v herních jednotkách (střed prvku). */
const SCREENS: Readonly<Record<string, ScreenPoints>> = {
  'rozsah 5, číselník': {
    problem: [512, 199.68],
    problemFontSize: 184,
    problemSize: [754, 221],
    hintStyle: { dotSize: 60, spacing: 76, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    buttons: [
      [102, 674, 140],
      [266, 674, 140],
      [430, 674, 140],
      [594, 674, 140],
      [758, 674, 140],
      [922, 674, 140],
    ],
    hints: {
      '2 + 3': [
        [330, 457.03999999999996, 0],
        [406, 457.03999999999996, 0],
        [542, 457.03999999999996, 1],
        [618, 457.03999999999996, 1],
        [694, 457.03999999999996, 1],
      ],
      '4 + 1': [
        [330, 457.03999999999996, 0],
        [406, 457.03999999999996, 0],
        [482, 457.03999999999996, 0],
        [558, 457.03999999999996, 0],
        [694, 457.03999999999996, 1],
      ],
      '1 + 0': [[512, 457.03999999999996, 0]],
      '5 − 5': [
        [360, 457.03999999999996, 0],
        [436, 457.03999999999996, 0],
        [512, 457.03999999999996, 0],
        [588, 457.03999999999996, 0],
        [664, 457.03999999999996, 0],
      ],
      '5 − 1': [
        [360, 457.03999999999996, 0],
        [436, 457.03999999999996, 0],
        [512, 457.03999999999996, 0],
        [588, 457.03999999999996, 0],
        [664, 457.03999999999996, 0],
      ],
    },
  },
  'rozsah 5, psaní': {
    problem: [512, 199.68],
    problemFontSize: 184,
    problemSize: [754, 221],
    hintStyle: { dotSize: 60, spacing: 76, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    writingAreas: [[512, 584, 320, 320]],
    buttons: [
      [234, 584, 140],
      [790, 584, 140],
    ],
    hints: {
      '2 + 3': [
        [330, 367.03999999999996, 0],
        [406, 367.03999999999996, 0],
        [542, 367.03999999999996, 1],
        [618, 367.03999999999996, 1],
        [694, 367.03999999999996, 1],
      ],
      '4 + 1': [
        [330, 367.03999999999996, 0],
        [406, 367.03999999999996, 0],
        [482, 367.03999999999996, 0],
        [558, 367.03999999999996, 0],
        [694, 367.03999999999996, 1],
      ],
      '1 + 0': [[512, 367.03999999999996, 0]],
      '5 − 5': [
        [360, 367.03999999999996, 0],
        [436, 367.03999999999996, 0],
        [512, 367.03999999999996, 0],
        [588, 367.03999999999996, 0],
        [664, 367.03999999999996, 0],
      ],
      '5 − 1': [
        [360, 367.03999999999996, 0],
        [436, 367.03999999999996, 0],
        [512, 367.03999999999996, 0],
        [588, 367.03999999999996, 0],
        [664, 367.03999999999996, 0],
      ],
    },
  },
  'rozsah 10, číselník': {
    problem: [512, 199.68],
    problemFontSize: 150,
    problemSize: [788, 180],
    hintStyle: { dotSize: 50, spacing: 64, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    buttons: [
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
    hints: {
      '5 + 5': [
        [194, 366.84000000000003, 0],
        [258, 366.84000000000003, 0],
        [322, 366.84000000000003, 0],
        [386, 366.84000000000003, 0],
        [450, 366.84000000000003, 0],
        [574, 366.84000000000003, 1],
        [638, 366.84000000000003, 1],
        [702, 366.84000000000003, 1],
        [766, 366.84000000000003, 1],
        [830, 366.84000000000003, 1],
      ],
      '9 + 1': [
        [322, 334.84000000000003, 0],
        [386, 334.84000000000003, 0],
        [450, 334.84000000000003, 0],
        [514, 334.84000000000003, 0],
        [578, 334.84000000000003, 0],
        [322, 398.84000000000003, 0],
        [386, 398.84000000000003, 0],
        [450, 398.84000000000003, 0],
        [514, 398.84000000000003, 0],
        [702, 334.84000000000003, 1],
      ],
      '1 + 0': [[512, 366.84000000000003, 0]],
      '10 − 10': [
        [384, 334.84000000000003, 0],
        [448, 334.84000000000003, 0],
        [512, 334.84000000000003, 0],
        [576, 334.84000000000003, 0],
        [640, 334.84000000000003, 0],
        [384, 398.84000000000003, 0],
        [448, 398.84000000000003, 0],
        [512, 398.84000000000003, 0],
        [576, 398.84000000000003, 0],
        [640, 398.84000000000003, 0],
      ],
      '10 − 1': [
        [384, 334.84000000000003, 0],
        [448, 334.84000000000003, 0],
        [512, 334.84000000000003, 0],
        [576, 334.84000000000003, 0],
        [640, 334.84000000000003, 0],
        [384, 398.84000000000003, 0],
        [448, 398.84000000000003, 0],
        [512, 398.84000000000003, 0],
        [576, 398.84000000000003, 0],
        [640, 398.84000000000003, 0],
      ],
    },
  },
  'rozsah 10, psaní': {
    problem: [512, 199.68],
    problemFontSize: 150,
    problemSize: [788, 180],
    hintStyle: { dotSize: 50, spacing: 64, dotsPerRow: 5, fiveGap: 0, groupGap: 60 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    writingAreas: [
      [356, 604, 280, 280],
      [668, 604, 280, 280],
    ],
    buttons: [
      [114, 604, 140],
      [910, 604, 140],
    ],
    hints: {
      '5 + 5': [
        [194, 376.84000000000003, 0],
        [258, 376.84000000000003, 0],
        [322, 376.84000000000003, 0],
        [386, 376.84000000000003, 0],
        [450, 376.84000000000003, 0],
        [574, 376.84000000000003, 1],
        [638, 376.84000000000003, 1],
        [702, 376.84000000000003, 1],
        [766, 376.84000000000003, 1],
        [830, 376.84000000000003, 1],
      ],
      '9 + 1': [
        [322, 344.84000000000003, 0],
        [386, 344.84000000000003, 0],
        [450, 344.84000000000003, 0],
        [514, 344.84000000000003, 0],
        [578, 344.84000000000003, 0],
        [322, 408.84000000000003, 0],
        [386, 408.84000000000003, 0],
        [450, 408.84000000000003, 0],
        [514, 408.84000000000003, 0],
        [702, 344.84000000000003, 1],
      ],
      '1 + 0': [[512, 376.84000000000003, 0]],
      '10 − 10': [
        [384, 344.84000000000003, 0],
        [448, 344.84000000000003, 0],
        [512, 344.84000000000003, 0],
        [576, 344.84000000000003, 0],
        [640, 344.84000000000003, 0],
        [384, 408.84000000000003, 0],
        [448, 408.84000000000003, 0],
        [512, 408.84000000000003, 0],
        [576, 408.84000000000003, 0],
        [640, 408.84000000000003, 0],
      ],
      '10 − 1': [
        [384, 344.84000000000003, 0],
        [448, 344.84000000000003, 0],
        [512, 344.84000000000003, 0],
        [576, 344.84000000000003, 0],
        [640, 344.84000000000003, 0],
        [384, 408.84000000000003, 0],
        [448, 408.84000000000003, 0],
        [512, 408.84000000000003, 0],
        [576, 408.84000000000003, 0],
        [640, 408.84000000000003, 0],
      ],
    },
  },
  'rozsah 20, číselník': {
    problem: [512, 194],
    problemFontSize: 116,
    problemSize: [676, 139],
    hintStyle: { dotSize: 34, spacing: 42, dotsPerRow: 10, fiveGap: 10, groupGap: 40 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    buttons: [
      [104, 426, 116],
      [240, 426, 116],
      [376, 426, 116],
      [512, 426, 116],
      [648, 426, 116],
      [784, 426, 116],
      [920, 426, 116],
      [104, 556, 116],
      [240, 556, 116],
      [376, 556, 116],
      [512, 556, 116],
      [648, 556, 116],
      [784, 556, 116],
      [920, 556, 116],
      [104, 686, 116],
      [240, 686, 116],
      [376, 686, 116],
      [512, 686, 116],
      [648, 686, 116],
      [784, 686, 116],
      [920, 686, 116],
    ],
    hints: {
      '10 + 10': [
        [83, 315.8, 0],
        [125, 315.8, 0],
        [167, 315.8, 0],
        [209, 315.8, 0],
        [251, 315.8, 0],
        [303, 315.8, 0],
        [345, 315.8, 0],
        [387, 315.8, 0],
        [429, 315.8, 0],
        [471, 315.8, 0],
        [553, 315.8, 1],
        [595, 315.8, 1],
        [637, 315.8, 1],
        [679, 315.8, 1],
        [721, 315.8, 1],
        [773, 315.8, 1],
        [815, 315.8, 1],
        [857, 315.8, 1],
        [899, 315.8, 1],
        [941, 315.8, 1],
      ],
      '19 + 1': [
        [277, 294.8, 0],
        [319, 294.8, 0],
        [361, 294.8, 0],
        [403, 294.8, 0],
        [445, 294.8, 0],
        [497, 294.8, 0],
        [539, 294.8, 0],
        [581, 294.8, 0],
        [623, 294.8, 0],
        [665, 294.8, 0],
        [277, 336.8, 0],
        [319, 336.8, 0],
        [361, 336.8, 0],
        [403, 336.8, 0],
        [445, 336.8, 0],
        [497, 336.8, 0],
        [539, 336.8, 0],
        [581, 336.8, 0],
        [623, 336.8, 0],
        [747, 294.8, 1],
      ],
      '1 + 0': [[512, 315.8, 0]],
      '20 − 20': [
        [318, 294.8, 0],
        [360, 294.8, 0],
        [402, 294.8, 0],
        [444, 294.8, 0],
        [486, 294.8, 0],
        [538, 294.8, 0],
        [580, 294.8, 0],
        [622, 294.8, 0],
        [664, 294.8, 0],
        [706, 294.8, 0],
        [318, 336.8, 0],
        [360, 336.8, 0],
        [402, 336.8, 0],
        [444, 336.8, 0],
        [486, 336.8, 0],
        [538, 336.8, 0],
        [580, 336.8, 0],
        [622, 336.8, 0],
        [664, 336.8, 0],
        [706, 336.8, 0],
      ],
      '20 − 1': [
        [318, 294.8, 0],
        [360, 294.8, 0],
        [402, 294.8, 0],
        [444, 294.8, 0],
        [486, 294.8, 0],
        [538, 294.8, 0],
        [580, 294.8, 0],
        [622, 294.8, 0],
        [664, 294.8, 0],
        [706, 294.8, 0],
        [318, 336.8, 0],
        [360, 336.8, 0],
        [402, 336.8, 0],
        [444, 336.8, 0],
        [486, 336.8, 0],
        [538, 336.8, 0],
        [580, 336.8, 0],
        [622, 336.8, 0],
        [664, 336.8, 0],
        [706, 336.8, 0],
      ],
    },
  },
  'rozsah 20, psaní': {
    problem: [512, 194],
    problemFontSize: 116,
    problemSize: [676, 139],
    hintStyle: { dotSize: 34, spacing: 42, dotsPerRow: 10, fiveGap: 10, groupGap: 40 },
    stars: [
      [314, 52],
      [358, 52],
      [402, 52],
      [446, 52],
      [490, 52],
      [534, 52],
      [578, 52],
      [622, 52],
      [666, 52],
      [710, 52],
    ],
    writingAreas: [
      [356, 604, 280, 280],
      [668, 604, 280, 280],
    ],
    buttons: [
      [114, 604, 140],
      [910, 604, 140],
    ],
    hints: {
      '10 + 10': [
        [83, 363.8, 0],
        [125, 363.8, 0],
        [167, 363.8, 0],
        [209, 363.8, 0],
        [251, 363.8, 0],
        [303, 363.8, 0],
        [345, 363.8, 0],
        [387, 363.8, 0],
        [429, 363.8, 0],
        [471, 363.8, 0],
        [553, 363.8, 1],
        [595, 363.8, 1],
        [637, 363.8, 1],
        [679, 363.8, 1],
        [721, 363.8, 1],
        [773, 363.8, 1],
        [815, 363.8, 1],
        [857, 363.8, 1],
        [899, 363.8, 1],
        [941, 363.8, 1],
      ],
      '19 + 1': [
        [277, 342.8, 0],
        [319, 342.8, 0],
        [361, 342.8, 0],
        [403, 342.8, 0],
        [445, 342.8, 0],
        [497, 342.8, 0],
        [539, 342.8, 0],
        [581, 342.8, 0],
        [623, 342.8, 0],
        [665, 342.8, 0],
        [277, 384.8, 0],
        [319, 384.8, 0],
        [361, 384.8, 0],
        [403, 384.8, 0],
        [445, 384.8, 0],
        [497, 384.8, 0],
        [539, 384.8, 0],
        [581, 384.8, 0],
        [623, 384.8, 0],
        [747, 342.8, 1],
      ],
      '1 + 0': [[512, 363.8, 0]],
      '20 − 20': [
        [318, 342.8, 0],
        [360, 342.8, 0],
        [402, 342.8, 0],
        [444, 342.8, 0],
        [486, 342.8, 0],
        [538, 342.8, 0],
        [580, 342.8, 0],
        [622, 342.8, 0],
        [664, 342.8, 0],
        [706, 342.8, 0],
        [318, 384.8, 0],
        [360, 384.8, 0],
        [402, 384.8, 0],
        [444, 384.8, 0],
        [486, 384.8, 0],
        [538, 384.8, 0],
        [580, 384.8, 0],
        [622, 384.8, 0],
        [664, 384.8, 0],
        [706, 384.8, 0],
      ],
      '20 − 1': [
        [318, 342.8, 0],
        [360, 342.8, 0],
        [402, 342.8, 0],
        [444, 342.8, 0],
        [486, 342.8, 0],
        [538, 342.8, 0],
        [580, 342.8, 0],
        [622, 342.8, 0],
        [664, 342.8, 0],
        [706, 342.8, 0],
        [318, 384.8, 0],
        [360, 384.8, 0],
        [402, 384.8, 0],
        [444, 384.8, 0],
        [486, 384.8, 0],
        [538, 384.8, 0],
        [580, 384.8, 0],
        [622, 384.8, 0],
        [664, 384.8, 0],
        [706, 384.8, 0],
      ],
    },
  },
};

const RANGES: readonly MaxNumber[] = [5, 10, 20];

function plus(first: number, second: number): Problem {
  return { first, second, operation: 'plus', result: first + second };
}

function minus(first: number, second: number): Problem {
  return { first, second, operation: 'minus', result: first - second };
}

/** Nápovědy s nejvíc tečkami a s nerovnými skupinkami v každém rozsahu. */
function sampleProblems(maxNumber: MaxNumber): Problem[] {
  const half = maxNumber / 2;
  return [
    plus(Math.floor(half), Math.ceil(half)),
    plus(maxNumber - 1, 1),
    plus(1, 0),
    minus(maxNumber, maxNumber),
    minus(maxNumber, 1),
  ];
}

function problemName(problem: Problem): string {
  const sign = problem.operation === 'plus' ? '+' : '−';
  return `${problem.first} ${sign} ${problem.second}`;
}

/** Dnešní rozložení herní plochy 1024 × 768 ve stejném tvaru jako `SCREENS`. */
function todayScreens(): Record<string, ScreenPoints> {
  const screens: Record<string, ScreenPoints> = {};
  for (const maxNumber of RANGES) {
    const keypad = layoutScreen(TODAY_GAME_WIDTH, TODAY_GAME_HEIGHT, maxNumber + 1, STARS_PER_SET);
    const writing = layoutWritingScreen(
      TODAY_GAME_WIDTH,
      TODAY_GAME_HEIGHT,
      maxNumber,
      STARS_PER_SET,
    );
    for (const [mode, layout] of [
      ['číselník', keypad],
      ['psaní', writing],
    ] as const) {
      const hints: Record<string, Dot[]> = {};
      for (const problem of sampleProblems(maxNumber)) {
        hints[problemName(problem)] = layoutHint(layout, hintDotGroups(problem)).map((dot): Dot => [
          dot.x,
          dot.y,
          dot.group,
        ]);
      }
      const common = {
        problem: [layout.problem.x, layout.problem.y] as Point,
        problemFontSize: layout.problemFontSize,
        problemSize: [layout.problemSize.width, layout.problemSize.height] as [number, number],
        hintStyle: { ...layout.hintStyle },
        stars: layout.stars.map((star): Point => [star.x, star.y]),
      };
      screens[`rozsah ${maxNumber}, ${mode}`] =
        'answerButtons' in layout
          ? {
              ...common,
              buttons: layout.answerButtons.map((slot): Slot => [slot.x, slot.y, slot.size]),
              hints,
            }
          : {
              ...common,
              writingAreas: layout.writingAreas.map((area): Area => [
                area.x,
                area.y,
                area.width,
                area.height,
              ]),
              buttons: [layout.clearButton, layout.confirmButton].map((slot): Slot => [
                slot.x,
                slot.y,
                slot.size,
              ]),
              hints,
            };
    }
  }
  return screens;
}

describe('AC5: na iPadu na šířku se nic nemění', () => {
  it('v oknech 1180×820 a 1180×760 je herní plocha na pevném místě a pevně velká', () => {
    for (const window of IPAD_WINDOWS) {
      const placement = todayFitPlacement(window.width, window.height);

      expect(
        {
          width: TODAY_GAME_WIDTH * placement.scale,
          height: TODAY_GAME_HEIGHT * placement.scale,
          ...placement,
        },
        window.name,
      ).toEqual(PLACEMENTS[window.name]);
    }
  });

  it('hvězdičky, příklad, nápověda, každé tlačítko číselníku, okénka, smazání a ✓ mají pevné polohy a velikosti', () => {
    const today = todayScreens();

    expect(Object.keys(today)).toEqual(Object.keys(SCREENS));
    for (const [name, expected] of Object.entries(SCREENS)) {
      expect(today[name], name).toEqual(expected);
    }
    expect(STAR_SIZE, 'hvězdička').toBe(STAR_SIDE);
    for (const maxNumber of RANGES) {
      const layout = layoutScreen(
        TODAY_GAME_WIDTH,
        TODAY_GAME_HEIGHT,
        maxNumber + 1,
        STARS_PER_SET,
      );
      for (const problem of sampleProblems(maxNumber)) {
        for (const dot of layoutHint(layout, hintDotGroups(problem))) {
          expect(hintDotHitArea(dot).size, `rozsah ${maxNumber}, ${problemName(problem)}`).toBe(
            DOT_HIT_SIDE,
          );
        }
      }
    }
  });
});
