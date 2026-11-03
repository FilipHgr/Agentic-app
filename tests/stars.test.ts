import { describe, expect, it } from 'vitest';

import { ANSWER_CHOICES, tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound, TapOutcome } from '../src/logic/answerRound';
import { SOUNDS, soundLengthSeconds } from '../src/logic/answerSounds';
import {
  HINT_DOT_SIZE,
  PROBLEM_TEXT_HEIGHT,
  STAR_SIZE,
  layoutHintDots,
  layoutScreen,
} from '../src/logic/screenLayout';
import {
  STARS_PER_SET,
  createStarProgress,
  startNewStarSet,
  starsAfterTap,
} from '../src/logic/stars';
import type { StarProgress } from '../src/logic/stars';

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

/** Hvězdičky po řadě výsledků ťuknutí. */
function starsAfter(outcomes: readonly TapOutcome[], start = createStarProgress()): StarProgress {
  return outcomes.reduce((progress, outcome) => starsAfterTap(progress, outcome).progress, start);
}

/** Výsledky deseti správně vyřešených příkladů za sebou. */
const TEN_CORRECT: TapOutcome[] = Array.from({ length: STARS_PER_SET }, () => 'correct');

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
    const problemTop = LAYOUT.problem.y - PROBLEM_TEXT_HEIGHT / 2;

    expect(problemTop - lowestStarBottom).toBeGreaterThanOrEqual(30);
  });

  it('hvězdičky jsou dost velké, aby byly dobře vidět', () => {
    expect(STAR_SIZE).toBeGreaterThanOrEqual(60);
  });

  it('příklad se stále nepřekrývá s nápovědou ani s číselníkem', () => {
    const problemBottom = LAYOUT.problem.y + PROBLEM_TEXT_HEIGHT / 2;
    const highestButtonTop = Math.min(
      ...LAYOUT.answerButtons.map((button) => button.y - button.size / 2),
    );
    const tallestHint = layoutHintDots([10], LAYOUT.hint);

    for (const dot of tallestHint) {
      expect(dot.y - HINT_DOT_SIZE / 2).toBeGreaterThan(problemBottom);
      expect(dot.y + HINT_DOT_SIZE / 2).toBeLessThan(highestButtonTop);
    }
  });
});

describe('AC2: po správné odpovědi se rozsvítí další hvězdička zleva', () => {
  it('správná odpověď přidá hvězdičku', () => {
    const result = starsAfterTap(createStarProgress(), 'correct');

    expect(result.starEarned).toBe(true);
    expect(result.progress.earned).toBe(1);
  });

  it('hvězdičky přibývají postupně po jedné', () => {
    expect(starsAfter(['correct', 'correct', 'correct']).earned).toBe(3);
  });

  it('správné ťuknutí ve hře opravdu přidá hvězdičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(starsAfterTap(createStarProgress(), tap.outcome).progress.earned).toBe(1);
  });
});

describe('AC3: hvězdička za každý vyřešený příklad, chyba ji nebere', () => {
  it('špatná odpověď hvězdičku nepřidá ani nevezme', () => {
    const progress = starsAfter(['correct', 'correct']);
    const result = starsAfterTap(progress, 'wrong');

    expect(result.starEarned).toBe(false);
    expect(result.progress.earned).toBe(2);
  });

  it('ignorované ťuknutí hvězdičku nepřidá', () => {
    expect(starsAfterTap(createStarProgress(), 'ignored').progress.earned).toBe(0);
  });

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

  it('mnoho chyb za sebou hvězdičky nevynuluje', () => {
    const wrongs: TapOutcome[] = Array.from({ length: 50 }, () => 'wrong');

    expect(starsAfter(wrongs, starsAfter(['correct', 'correct', 'correct'])).earned).toBe(3);
  });
});

describe('AC4: po desáté hvězdičce přijde oslava', () => {
  it('desátá hvězdička spustí oslavu', () => {
    const nine = starsAfter(TEN_CORRECT.slice(1));
    const result = starsAfterTap(nine, 'correct');

    expect(result.progress.earned).toBe(10);
    expect(result.setCompleted).toBe(true);
  });

  it('dřív než po desáté hvězdičce oslava nepřijde', () => {
    let progress = createStarProgress();

    for (let star = 1; star < STARS_PER_SET; star += 1) {
      const result = starsAfterTap(progress, 'correct');
      expect(result.setCompleted).toBe(false);
      progress = result.progress;
    }
  });

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

describe('AC5: po oslavě začíná nová prázdná řada', () => {
  it('nová řada nemá žádnou rozsvícenou hvězdičku', () => {
    expect(startNewStarSet().earned).toBe(0);
  });

  it('po nové řadě se hvězdičky sbírají znovu od první', () => {
    const afterCelebration = startNewStarSet();
    const result = starsAfterTap(afterCelebration, 'correct');

    expect(result.progress.earned).toBe(1);
    expect(result.setCompleted).toBe(false);
  });

  it('i kdyby se plná řada nevyprázdnila, další hvězdička začne novou řadu', () => {
    const full = starsAfter(TEN_CORRECT);
    const result = starsAfterTap(full, 'correct');

    expect(result.progress.earned).toBe(1);
  });
});

describe('AC6: hra začíná bez hvězdiček', () => {
  it('po načtení nesvítí žádná hvězdička', () => {
    expect(createStarProgress().earned).toBe(0);
  });
});
