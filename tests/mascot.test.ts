import { describe, expect, it } from 'vitest';

import { ANSWER_CHOICES, tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import { MASCOT_REACTIONS, mascotExpression, mascotReactionToTap } from '../src/logic/mascot';
import {
  HINT_DOT_SIZE,
  MASCOT_DANCE_SWAY,
  MASCOT_JUMP_HEIGHT,
  MASCOT_SIZE,
  PROBLEM_MAX_WIDTH,
  PROBLEM_TEXT_HEIGHT,
  STAR_SIZE,
  layoutHintDots,
  layoutScreen,
} from '../src/logic/screenLayout';
import { STARS_PER_SET } from '../src/logic/stars';

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 768;

const LAYOUT = layoutScreen(SCREEN_WIDTH, SCREEN_HEIGHT, ANSWER_CHOICES.length, STARS_PER_SET);

interface Box {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Prostor, který sovička zabere i se skokem a tancem do stran. */
const MASCOT_BOX: Box = {
  left: LAYOUT.mascot.x - MASCOT_SIZE / 2 - MASCOT_DANCE_SWAY,
  right: LAYOUT.mascot.x + MASCOT_SIZE / 2 + MASCOT_DANCE_SWAY,
  top: LAYOUT.mascot.y - MASCOT_SIZE / 2 - MASCOT_JUMP_HEIGHT,
  bottom: LAYOUT.mascot.y + MASCOT_SIZE / 2,
};

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function squareBox(x: number, y: number, size: number): Box {
  return { left: x - size / 2, right: x + size / 2, top: y - size / 2, bottom: y + size / 2 };
}

/** Kolo s pevným příkladem 3 + 4, aby testy nezávisely na náhodě. */
function roundThreePlusFour(): AnswerRound {
  return { problem: { first: 3, second: 4, result: 7 }, wrongAnswers: 0, solved: false };
}

describe('AC1: sovička je vlevo vedle příkladu a nic nepřekrývá', () => {
  it('sovička má aspoň 140 px', () => {
    expect(MASCOT_SIZE).toBeGreaterThanOrEqual(140);
  });

  it('sovička je vlevo od příkladu ve stejné výšce', () => {
    expect(LAYOUT.mascot.x).toBeLessThan(LAYOUT.problem.x);
    expect(LAYOUT.mascot.y).toBe(LAYOUT.problem.y);
  });

  it('sovička je i při tanci a skoku celá na obrazovce', () => {
    expect(MASCOT_BOX.left).toBeGreaterThanOrEqual(0);
    expect(MASCOT_BOX.top).toBeGreaterThanOrEqual(0);
  });

  it('sovička nepřekrývá ani nejdelší příklad „10 + 0 = ?“', () => {
    const problemBox: Box = {
      left: LAYOUT.problem.x - PROBLEM_MAX_WIDTH / 2,
      right: LAYOUT.problem.x + PROBLEM_MAX_WIDTH / 2,
      top: LAYOUT.problem.y - PROBLEM_TEXT_HEIGHT / 2,
      bottom: LAYOUT.problem.y + PROBLEM_TEXT_HEIGHT / 2,
    };

    expect(overlaps(MASCOT_BOX, problemBox)).toBe(false);
    expect(problemBox.right).toBeLessThanOrEqual(SCREEN_WIDTH);
  });

  it('sovička nepřekrývá hvězdičky', () => {
    for (const star of LAYOUT.stars) {
      expect(overlaps(MASCOT_BOX, squareBox(star.x, star.y, STAR_SIZE))).toBe(false);
    }
  });

  it('sovička nepřekrývá číselník', () => {
    for (const button of LAYOUT.answerButtons) {
      expect(overlaps(MASCOT_BOX, squareBox(button.x, button.y, button.size))).toBe(false);
    }
  });

  it('sovička nepřekrývá nápovědu u žádného příkladu', () => {
    for (const groups of [[10], [5, 5], [9, 1], [1, 9], [4, 6]]) {
      for (const dot of layoutHintDots(groups, LAYOUT.hint)) {
        expect(overlaps(MASCOT_BOX, squareBox(dot.x, dot.y, HINT_DOT_SIZE))).toBe(false);
      }
    }
  });
});

describe('AC2: když hráč nic nedělá, sovička žije', () => {
  it('sovička umí klidovou reakci s otevřenýma očima', () => {
    expect(MASCOT_REACTIONS).toContain('idle');
    expect(mascotExpression('idle')).toBe('open');
  });
});

describe('AC3: po správné odpovědi se sovička raduje', () => {
  it('správná odpověď rozveselí sovičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(mascotReactionToTap(tap.outcome, false)).toBe('joy');
  });

  it('při radosti má sovička veselé oči', () => {
    expect(mascotExpression('joy')).toBe('happy');
  });
});

describe('AC4: po špatné odpovědi sovička povzbudí, nikdy se nemračí', () => {
  it('špatná odpověď vyvolá povzbudivé kývnutí', () => {
    const tap = tapAnswer(roundThreePlusFour(), 2);

    expect(mascotReactionToTap(tap.outcome, false)).toBe('encourage');
  });

  it('ani mnoho chyb za sebou sovičku nerozesmutní', () => {
    let round = roundThreePlusFour();

    for (const tapped of [2, 9, 5, 1, 0, 3]) {
      const tap = tapAnswer(round, tapped);
      round = tap.round;
      expect(mascotReactionToTap(tap.outcome, false)).toBe('encourage');
    }
  });

  it('sovička nemá žádný smutný ani zamračený výraz', () => {
    for (const reaction of MASCOT_REACTIONS) {
      expect(['open', 'happy']).toContain(mascotExpression(reaction));
    }
  });
});

describe('AC5: při oslavě sovička tančí', () => {
  it('správná odpověď, která zaplní řadu hvězdiček, roztančí sovičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(mascotReactionToTap(tap.outcome, true)).toBe('dance');
  });

  it('při tanci má sovička veselé oči', () => {
    expect(mascotExpression('dance')).toBe('happy');
  });
});

describe('AC6: ťuknutí na sovičku se nepočítá jako odpověď', () => {
  it('sovička leží mimo všechna tlačítka číselníku, takže ťuknutí na ni žádné číslo nezadá', () => {
    for (const button of LAYOUT.answerButtons) {
      expect(overlaps(MASCOT_BOX, squareBox(button.x, button.y, button.size))).toBe(false);
    }
  });

  it('ťuknutí, které nic nezadá, sovičku ani kolo nezmění', () => {
    const round = roundThreePlusFour();
    const tap = tapAnswer(round, Number.NaN);

    expect(tap.round).toEqual(round);
    expect(mascotReactionToTap(tap.outcome, false)).toBeNull();
  });
});
