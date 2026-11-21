import { describe, expect, it } from 'vitest';

import {
  STARS_PER_SET,
  STAR_STYLE,
  createStarProgress,
  starLooks,
  startNewStarSet,
  starsAfterTap,
} from '../../src/shared/logic/stars';
import type { AnswerOutcome, StarProgress } from '../../src/shared/logic/stars';
import { PAGE_BACKGROUND, contrastRatio } from '../../src/shared/logic/theme';

/**
 * Řada hvězdiček společná pro hry (#177, přesunuto z testů Počítání #31
 * a #52 AC5): přibývání hvězdiček, oslava po desáté, nová řada a vzhled.
 * Rozložení řady a hvězdičky v Počítání testuje Počítání.
 */

/** WCAG: grafické prvky 3 : 1. */
const GRAPHIC_CONTRAST = 3;

/** Barvy porovnáváme bez ohledu na velikost písmen (#f5f5f7 = #F5F5F7). */
function expectColor(actual: string, expected: string): void {
  expect(actual.toLowerCase()).toBe(expected.toLowerCase());
}

/** Hvězdičky po řadě výsledků ťuknutí. */
function starsAfter(
  outcomes: readonly AnswerOutcome[],
  start = createStarProgress(),
): StarProgress {
  return outcomes.reduce((progress, outcome) => starsAfterTap(progress, outcome).progress, start);
}

/** Výsledky deseti správně vyřešených příkladů za sebou. */
const TEN_CORRECT: AnswerOutcome[] = Array.from({ length: STARS_PER_SET }, () => 'correct');

describe('AC2: po správné odpovědi se rozsvítí další hvězdička zleva', () => {
  it('správná odpověď přidá hvězdičku', () => {
    const result = starsAfterTap(createStarProgress(), 'correct');

    expect(result.starEarned).toBe(true);
    expect(result.progress.earned).toBe(1);
  });

  it('hvězdičky přibývají postupně po jedné', () => {
    expect(starsAfter(['correct', 'correct', 'correct']).earned).toBe(3);
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

  it('mnoho chyb za sebou hvězdičky nevynuluje', () => {
    const wrongs: AnswerOutcome[] = Array.from({ length: 50 }, () => 'wrong');

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

describe('#52 AC5: malé plné hvězdičky nahoře', () => {
  it('získaná hvězdička je zlatá #FFCC00 s obrysem #A67C00 tlustým 1,5 px', () => {
    expectColor(STAR_STYLE.earnedColor, '#FFCC00');
    expectColor(STAR_STYLE.earnedOutlineColor, '#A67C00');
    expect(STAR_STYLE.earnedOutlineWidth).toBe(1.5);
  });

  it('obrys získané hvězdičky má proti pozadí kontrast aspoň 3 : 1 (asi 3,5 : 1)', () => {
    const ratio = contrastRatio(STAR_STYLE.earnedOutlineColor, PAGE_BACKGROUND);
    expect(ratio).toBeGreaterThanOrEqual(GRAPHIC_CONTRAST);
    expect(ratio).toBeCloseTo(3.5, 1);
  });

  it('nezískaná hvězdička je plná šedá #D2D2D7 bez obrysu', () => {
    expectColor(STAR_STYLE.emptyColor, '#D2D2D7');
    const [empty] = starLooks({ earned: 0 });
    expectColor(empty?.fill ?? '', '#D2D2D7');
    expect(empty?.outlineWidth).toBe(0);
  });

  it('po třech správných odpovědích jsou tři hvězdičky zleva zlaté s obrysem, zbytek šedý', () => {
    const looks = starLooks({ earned: 3 });
    expect(looks).toHaveLength(STARS_PER_SET);
    looks.forEach((look, index) => {
      if (index < 3) {
        expectColor(look.fill, '#FFCC00');
        expectColor(look.outlineColor ?? '', '#A67C00');
        expect(look.outlineWidth).toBe(1.5);
      } else {
        expectColor(look.fill, '#D2D2D7');
        expect(look.outlineWidth).toBe(0);
      }
    });
  });

  it('získaná a nezískaná hvězdička jdou rozlišit i bez barev, podle obrysu', () => {
    const [earned, empty] = starLooks({ earned: 1 });
    expect(earned?.outlineWidth).toBeGreaterThan(0);
    expect(empty?.outlineWidth).toBe(0);
  });
});
