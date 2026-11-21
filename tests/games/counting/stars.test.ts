import { describe, expect, it } from 'vitest';

import { ANSWER_CHOICES, tapAnswer } from '../../../src/games/counting/logic/answerRound';
import type { AnswerRound } from '../../../src/games/counting/logic/answerRound';
import { SOUNDS, soundLengthSeconds } from '../../../src/games/counting/logic/answerSounds';
import {
  HINT_DOT_SIZE,
  STAR_SIZE,
  layoutHint,
  layoutScreen,
} from '../../../src/games/counting/logic/screenLayout';
import { STARS_PER_SET, createStarProgress, starsAfterTap } from '../../../src/shared/logic/stars';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const LAYOUT = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, ANSWER_CHOICES.length, STARS_PER_SET);

/** Kolo s pevným příkladem 3 + 4, aby testy nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return {
    problem: { first: 3, second: 4, operation: 'plus', result: 7 },
    maxNumber: 10,
    wrongAnswers: 0,
    solved: false,
  };
}

/*
 * Hvězdičky bez hry (přibývání, chyby, oslava po desáté, nová řada) testuje
 * sdílená část v `tests/shared/stars.test.ts` (#177).
 */

describe('AC1: nahoře je řada 10 hvězdiček, která nic nepřekrývá', () => {
  it('v řadě je 10 hvězdiček', () => {
    expect(STARS_PER_SET).toBe(10);
    expect(LAYOUT.stars).toHaveLength(10);
  });

  it('hvězdičky jsou zleva doprava v jedné řadě a nepřekrývají se', () => {
    for (let index = 1; index < LAYOUT.stars.length; index += 1) {
      const previous = LAYOUT.stars[index - 1];
      const current = LAYOUT.stars[index];
      expect(current?.y).toBe(previous?.y);
      expect((current?.x ?? 0) - (previous?.x ?? 0)).toBeGreaterThan(STAR_SIZE);
    }
  });

  it('všechny hvězdičky jsou celé na obrazovce', () => {
    for (const star of LAYOUT.stars) {
      expect(star.x - STAR_SIZE / 2).toBeGreaterThanOrEqual(0);
      expect(star.x + STAR_SIZE / 2).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(star.y - STAR_SIZE / 2).toBeGreaterThanOrEqual(0);
    }
  });

  it('hvězdičky jsou nad příkladem s dostatečnou mezerou', () => {
    const lowestStarBottom = Math.max(...LAYOUT.stars.map((star) => star.y + STAR_SIZE / 2));
    const problemTop = LAYOUT.problem.y - LAYOUT.problemSize.height / 2;

    expect(problemTop - lowestStarBottom).toBeGreaterThanOrEqual(30);
  });

  // #52 AC5: hvězdičky jsou nově malé jako v mockupu A3 (dříve aspoň 60 px).
  it('hvězdičky jsou malé jako v mockupu, 30 px', () => {
    expect(STAR_SIZE).toBe(30);
  });

  it('příklad se stále nepřekrývá s nápovědou ani s číselníkem', () => {
    const problemBottom = LAYOUT.problem.y + LAYOUT.problemSize.height / 2;
    const highestButtonTop = Math.min(
      ...LAYOUT.answerButtons.map((button) => button.y - button.size / 2),
    );
    const tallestHint = layoutHint(LAYOUT, [10]);

    for (const dot of tallestHint) {
      expect(dot.y - HINT_DOT_SIZE / 2).toBeGreaterThan(problemBottom);
      expect(dot.y + HINT_DOT_SIZE / 2).toBeLessThan(highestButtonTop);
    }
  });
});

describe('AC2: po správné odpovědi se rozsvítí další hvězdička zleva', () => {
  it('správné ťuknutí ve hře opravdu přidá hvězdičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(starsAfterTap(createStarProgress(), tap.outcome).progress.earned).toBe(1);
  });
});

describe('AC3: hvězdička za každý vyřešený příklad, chyba ji nebere', () => {
  it('i po chybách a s nápovědou dostane hráč za vyřešení hvězdičku', () => {
    let round = roundThreePlusFour();
    let progress = createStarProgress();

    for (const tapped of [2, 9, 5, 7]) {
      const tap = tapAnswer(round, tapped);
      round = tap.round;
      progress = starsAfterTap(progress, tap.outcome).progress;
    }

    expect(progress.earned).toBe(1);
  });
});

describe('AC4: po desáté hvězdičce přijde oslava', () => {
  it('oslavná melodie trvá asi 2 sekundy a je delší než běžný zvuk', () => {
    const length = soundLengthSeconds(SOUNDS.celebration);

    expect(length).toBeGreaterThanOrEqual(1.5);
    expect(length).toBeLessThanOrEqual(2.5);
    expect(length).toBeGreaterThan(soundLengthSeconds(SOUNDS.correct));
  });

  it('během oslavy se ťuknutí ignorují, protože příklad je už vyřešený', () => {
    const solved = tapAnswer(roundThreePlusFour(), 7).round;

    for (const tapped of ANSWER_CHOICES) {
      expect(tapAnswer(solved, tapped).outcome).toBe('ignored');
    }
  });
});
