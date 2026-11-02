import { describe, expect, it } from 'vitest';

import { ANSWER_CHOICES, tapAnswer } from '../src/logic/answerRound';
import type { AnswerRound } from '../src/logic/answerRound';
import { CHARACTER_MOODS } from '../src/logic/characters';
import { MASCOT_REACTIONS, mascotReactionToTap, moodForReaction } from '../src/logic/mascot';
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

/** Prostor, který postavička zabere i se skokem a tancem do stran. */
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

describe('AC1: postavička je vlevo vedle příkladu a nic nepřekrývá', () => {
  it('postavička má aspoň 140 px', () => {
    expect(MASCOT_SIZE).toBeGreaterThanOrEqual(140);
  });

  it('postavička je vlevo od příkladu ve stejné výšce', () => {
    expect(LAYOUT.mascot.x).toBeLessThan(LAYOUT.problem.x);
    expect(LAYOUT.mascot.y).toBe(LAYOUT.problem.y);
  });

  it('postavička je i při tanci a skoku celá na obrazovce', () => {
    expect(MASCOT_BOX.left).toBeGreaterThanOrEqual(0);
    expect(MASCOT_BOX.top).toBeGreaterThanOrEqual(0);
  });

  it('postavička nepřekrývá ani nejdelší příklad „10 + 0 = ?“', () => {
    const problemBox: Box = {
      left: LAYOUT.problem.x - PROBLEM_MAX_WIDTH / 2,
      right: LAYOUT.problem.x + PROBLEM_MAX_WIDTH / 2,
      top: LAYOUT.problem.y - PROBLEM_TEXT_HEIGHT / 2,
      bottom: LAYOUT.problem.y + PROBLEM_TEXT_HEIGHT / 2,
    };

    expect(overlaps(MASCOT_BOX, problemBox)).toBe(false);
    expect(problemBox.right).toBeLessThanOrEqual(SCREEN_WIDTH);
  });

  it('postavička nepřekrývá hvězdičky', () => {
    for (const star of LAYOUT.stars) {
      expect(overlaps(MASCOT_BOX, squareBox(star.x, star.y, STAR_SIZE))).toBe(false);
    }
  });

  it('postavička nepřekrývá číselník', () => {
    for (const button of LAYOUT.answerButtons) {
      expect(overlaps(MASCOT_BOX, squareBox(button.x, button.y, button.size))).toBe(false);
    }
  });

  it('postavička nepřekrývá nápovědu u žádného příkladu', () => {
    for (const groups of [[10], [5, 5], [9, 1], [1, 9], [4, 6]]) {
      for (const dot of layoutHintDots(groups, LAYOUT.hint)) {
        expect(overlaps(MASCOT_BOX, squareBox(dot.x, dot.y, HINT_DOT_SIZE))).toBe(false);
      }
    }
  });
});

describe('AC2: když hráč nic nedělá, postavička žije', () => {
  it('postavička umí klidovou reakci s klidným obrázkem', () => {
    expect(MASCOT_REACTIONS).toContain('idle');
    expect(moodForReaction('idle')).toBe('klid');
  });

  it('postavička má obrázek na mrknutí', () => {
    expect(CHARACTER_MOODS).toContain('mrknuti');
  });
});

describe('AC3: po správné odpovědi se postavička raduje', () => {
  it('správná odpověď rozveselí postavičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(mascotReactionToTap(tap.outcome, false)).toBe('joy');
  });

  it('při radosti má postavička veselý obrázek', () => {
    expect(moodForReaction('joy')).toBe('radost');
  });
});

describe('AC4: po špatné odpovědi postavička povzbudí, nikdy se nemračí', () => {
  it('špatná odpověď vyvolá povzbudivé kývnutí', () => {
    const tap = tapAnswer(roundThreePlusFour(), 2);

    expect(mascotReactionToTap(tap.outcome, false)).toBe('encourage');
  });

  it('ani mnoho chyb za sebou postavičku nerozesmutní', () => {
    let round = roundThreePlusFour();

    for (const tapped of [2, 9, 5, 1, 0, 3]) {
      const tap = tapAnswer(round, tapped);
      round = tap.round;
      expect(mascotReactionToTap(tap.outcome, false)).toBe('encourage');
    }
  });

  it('po chybě postavička ukazuje povzbudivý obrázek', () => {
    expect(moodForReaction('encourage')).toBe('povzbuzeni');
  });

  it('postavička nemá žádný smutný ani zamračený výraz', () => {
    expect(CHARACTER_MOODS).toEqual(['klid', 'mrknuti', 'radost', 'povzbuzeni', 'oslava']);
    for (const reaction of MASCOT_REACTIONS) {
      expect(CHARACTER_MOODS).toContain(moodForReaction(reaction));
    }
  });
});

describe('AC5: při oslavě postavička tančí', () => {
  it('správná odpověď, která zaplní řadu hvězdiček, roztančí postavičku', () => {
    const tap = tapAnswer(roundThreePlusFour(), 7);

    expect(mascotReactionToTap(tap.outcome, true)).toBe('dance');
  });

  it('při tanci má postavička veselý obrázek', () => {
    expect(moodForReaction('dance')).toBe('oslava');
  });
});

describe('AC6: ťuknutí na postavičku se nepočítá jako odpověď', () => {
  it('postavička leží mimo všechna tlačítka číselníku, takže ťuknutí na ni žádné číslo nezadá', () => {
    for (const button of LAYOUT.answerButtons) {
      expect(overlaps(MASCOT_BOX, squareBox(button.x, button.y, button.size))).toBe(false);
    }
  });

  it('ťuknutí, které nic nezadá, postavičku ani kolo nezmění', () => {
    const round = roundThreePlusFour();
    const tap = tapAnswer(round, Number.NaN);

    expect(tap.round).toEqual(round);
    expect(mascotReactionToTap(tap.outcome, false)).toBeNull();
  });
});
