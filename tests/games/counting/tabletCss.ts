/**
 * Velikosti a polohy všech prvků herní obrazovky iPadu v CSS px (#54, AC5).
 * Testy porovnávají dvě umístění téže plochy (nová volba rozložení
 * a dnešní zobrazení, ostré plátno a dnešní plátno). Pevné body iPadu jsou
 * v `tabletLayoutUnchanged.test.ts`.
 */

import { hintDotGroups } from '../../../src/games/counting/logic/answerRound';
import type { Problem } from '../../../src/games/counting/logic/problems';
import {
  STAR_SIZE,
  hintDotHitArea,
  layoutHint,
  layoutScreen,
  layoutWritingScreen,
} from '../../../src/games/counting/logic/screenLayout';
import type {
  Point,
  ScreenLayout,
  WritingLayout,
} from '../../../src/games/counting/logic/screenLayout';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { STARS_PER_SET } from '../../../src/games/counting/logic/stars';
import type { Placement } from '../../shared/viewportFixtures';

const RANGES: MaxNumber[] = [5, 10, 20];

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

/** Zaokrouhlení na tisíciny, aby porovnání nezáviselo na drobných chybách v plovoucí čárce. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cssPoint(point: Point, placement: Placement): { x: number; y: number } {
  return {
    x: round(placement.offsetX + point.x * placement.scale),
    y: round(placement.offsetY + point.y * placement.scale),
  };
}

function cssSize(size: number, placement: Placement): number {
  return round(size * placement.scale);
}

function cssTop(layout: ScreenLayout | WritingLayout, placement: Placement): object {
  const style = layout.hintStyle;
  return {
    problem: cssPoint(layout.problem, placement),
    problemFontSize: cssSize(layout.problemFontSize, placement),
    problemSize: {
      width: cssSize(layout.problemSize.width, placement),
      height: cssSize(layout.problemSize.height, placement),
    },
    hintStyle: {
      dotSize: cssSize(style.dotSize, placement),
      spacing: cssSize(style.spacing, placement),
      dotsPerRow: style.dotsPerRow,
      fiveGap: cssSize(style.fiveGap, placement),
      groupGap: cssSize(style.groupGap, placement),
    },
    stars: layout.stars.map((star) => ({
      ...cssPoint(star, placement),
      size: cssSize(STAR_SIZE, placement),
    })),
  };
}

function cssHints(
  layout: ScreenLayout | WritingLayout,
  maxNumber: MaxNumber,
  placement: Placement,
): Record<string, object[]> {
  const hints: Record<string, object[]> = {};
  for (const problem of sampleProblems(maxNumber)) {
    hints[problemName(problem)] = layoutHint(layout, hintDotGroups(problem)).map((dot) => ({
      ...cssPoint(dot, placement),
      group: dot.group,
      hitSize: cssSize(hintDotHitArea(dot).size, placement),
    }));
  }
  return hints;
}

function cssButton(
  slot: { x: number; y: number; size: number },
  placement: Placement,
): { x: number; y: number; size: number } {
  return { ...cssPoint(slot, placement), size: cssSize(slot.size, placement) };
}

/**
 * Všechny prvky obrazovky ve všech rozsazích, s číselníkem i s psaním,
 * při plné řadě hvězdiček (tak hra rozložení počítá), v CSS px okna.
 *
 * @param gameWidth Šířka herní plochy v herních jednotkách.
 * @param gameHeight Výška herní plochy v herních jednotkách.
 * @param placement Kde a jak velká je herní plocha v okně.
 */
export function tabletCssLayouts(
  gameWidth: number,
  gameHeight: number,
  placement: Placement,
): Record<string, object> {
  const result: Record<string, object> = {};
  for (const maxNumber of RANGES) {
    const keypad = layoutScreen(gameWidth, gameHeight, maxNumber + 1, STARS_PER_SET);
    result[`rozsah ${maxNumber}, číselník`] = {
      ...cssTop(keypad, placement),
      answerButtons: keypad.answerButtons.map((slot) => cssButton(slot, placement)),
      hints: cssHints(keypad, maxNumber, placement),
    };

    const writing = layoutWritingScreen(gameWidth, gameHeight, maxNumber, STARS_PER_SET);
    result[`rozsah ${maxNumber}, psaní`] = {
      ...cssTop(writing, placement),
      writingAreas: writing.writingAreas.map((area) => ({
        ...cssPoint(area, placement),
        width: cssSize(area.width, placement),
        height: cssSize(area.height, placement),
      })),
      clearButton: cssButton(writing.clearButton, placement),
      confirmButton: cssButton(writing.confirmButton, placement),
      hints: cssHints(writing, maxNumber, placement),
    };
  }
  return result;
}
