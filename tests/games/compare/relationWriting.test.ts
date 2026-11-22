import { describe, expect, it } from 'vitest';

import { correctSign, otherSign } from '../../../src/games/compare/logic/compareProblems';
import type {
  CompareProblem,
  CompareSign,
  RelationSign,
} from '../../../src/games/compare/logic/compareProblems';
import { DEFAULT_COMPARE_SETTINGS } from '../../../src/games/compare/logic/compareSettings';
import type { SignKind } from '../../../src/games/compare/logic/compareSettings';
import {
  canConfirmSign,
  confirmSign,
  createSignWriting,
  updateSignWriting,
  writtenSign,
} from '../../../src/games/compare/logic/signWriting';
import type { SignWriting } from '../../../src/games/compare/logic/signWriting';
import { COMPARE_SETTINGS_KEY } from '../../../src/games/compare/storage/settingsStorage';
import type { Stroke } from '../../../src/shared/logic/strokes';
import {
  INCOMPLETE_WAIT_MS,
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
  clearWritingBox,
  finishWritingStroke,
  isNewRejection,
  startWritingStroke,
} from '../../../src/shared/logic/writingBox';
import { MemoryStorage, openCompare, solveProblem } from './compareFakes';
import type { TestCompare } from './compareFakes';
import {
  SIGN_AREA,
  straightEquals,
  straightGreater,
  straightLess,
  straightMinus,
  straightVertical,
} from './signStrokes';

/**
 * Testy k #191 AC1 a AC2: při volbě psaní a znamének < = > (i při „vše“)
 * dítě u „a ☐ b“ píše znaménko do okénka stejně jako + a −: rozpoznané
 * znaménko čeká na ✓, smazání není chyba, nerozpoznaný zápis vybledne
 * a okénko vyzve psát znovu, nic netrestá. Rozpozná se jen znaménko,
 * které k druhu příkladu patří.
 */

/** Dítě napíše jeden tah: položí prst v `startMs`, zvedne ho o 300 ms později. */
function write(writing: SignWriting, stroke: Stroke, startMs: number): SignWriting {
  const down = startWritingStroke(writing, startMs);
  return finishWritingStroke(down, stroke, startMs + 300);
}

/** Dítě napíše tahy u příkladu `problem` za sebou a počká, až se zápis rozpozná. */
function writeAndWait(problem: CompareProblem, strokes: readonly Stroke[]): SignWriting {
  let writing = createSignWriting(SIGN_AREA);
  let now = 0;
  for (const stroke of strokes) {
    writing = write(writing, stroke, now);
    now += 400;
  }
  return updateSignWriting(writing, now + RECOGNITION_DELAY_MS, problem.kind);
}

/** Tahy, kterými dítě napíše znaménko `sign`. */
function strokesOf(sign: CompareSign): Stroke[] {
  switch (sign) {
    case '<':
      return [straightLess()];
    case '>':
      return [straightGreater()];
    case '=':
      return straightEquals();
    case '−':
      return [straightMinus()];
    case '+':
      return [straightMinus(), straightVertical()];
  }
}

/** Znaménka s odpovědí psaním a druhem znamének `signKind`. */
function openWriting(signKind: SignKind, seed?: number): TestCompare {
  const storage = new MemoryStorage();
  storage.data.set(
    COMPARE_SETTINGS_KEY,
    JSON.stringify({ ...DEFAULT_COMPARE_SETTINGS, answerInput: 'writing', signKind }),
  );
  return openCompare(storage, seed);
}

/** Dítě napíše znaménko `sign` k rozehranému příkladu a ťukne na ✓. */
function writeAndConfirm(test: TestCompare, sign: CompareSign) {
  const problem = test.session.problem();
  return confirmSign(writeAndWait(problem, strokesOf(sign)), (written) =>
    test.session.tap(written),
  );
}

describe('#191 AC1: u „a ☐ b“ se při psaní odpovídá psaním do okénka', () => {
  it('napsané < se ukáže až 1 s po zvednutí prstu a pak jde potvrdit ✓', () => {
    const writing = write(createSignWriting(SIGN_AREA), straightLess(), 0);
    const early = updateSignWriting(writing, 300 + RECOGNITION_DELAY_MS - 1, 'relation');
    expect(writtenSign(early), 'před uplynutím 1 s').toBeNull();
    expect(canConfirmSign(early), '✓ ještě nejde').toBe(false);
    const recognized = updateSignWriting(writing, 300 + RECOGNITION_DELAY_MS, 'relation');
    expect(writtenSign(recognized)).toBe('<');
    expect(canConfirmSign(recognized)).toBe(true);
  });

  it('po ✓ se správným napsaným <, = nebo > přibude hvězdička a znaménko zůstane v okénku', () => {
    const test = openWriting('comparison');
    const seen = new Set<CompareSign>();
    for (let solved = 0; solved < 40; solved += 1) {
      const problem = test.session.problem();
      expect(problem.kind).toBe('relation');
      const sign = correctSign(problem);
      const stars = test.session.starCount();
      const result = writeAndConfirm(test, sign);
      expect(result.outcome, `${problem.a} ${sign} ${problem.b}`).toBe('correct');
      expect(test.session.filledSign()).toBe(sign);
      expect(test.session.starCount()).toBe(stars + 1);
      seen.add(sign);
      test.timers.runAll();
    }
    expect([...seen].sort()).toEqual(['<', '=', '>']);
  });

  it('po ✓ se špatným znaménkem se nic nebere, okénko se vyprázdní a dítě píše znovu', () => {
    const test = openWriting('comparison');
    const wrong = otherSign(correctSign(test.session.problem()));
    const result = writeAndConfirm(test, wrong);
    expect(result.outcome).toBe('wrong');
    expect(writtenSign(result.writing)).toBeNull();
    expect(result.writing.strokes).toEqual([]);
    expect(test.session.starCount()).toBe(0);
    expect(test.sounds.played).toContain('wrong');
    const again = writeAndConfirm(test, correctSign(test.session.problem()));
    expect(again.outcome, 'stejný příklad jde vyřešit dál').toBe('correct');
  });

  it('smazání vyprázdní okénko a nic se nepočítá jako chyba', () => {
    const test = openWriting('comparison');
    const less = writeAndWait(test.session.problem(), [straightLess()]);
    const cleared = clearWritingBox(less);
    expect(writtenSign(cleared)).toBeNull();
    expect(cleared.strokes).toEqual([]);
    expect(test.sounds.played).toEqual([]);
    expect(test.session.starCount()).toBe(0);
  });

  it('nerozpoznaný zápis u „a ☐ b“ vybledne, okénko je zase prázdné a nic se nepočítá', () => {
    const test = openWriting('comparison');
    const writing = writeAndWait(test.session.problem(), [straightVertical()]);
    expect(writtenSign(writing)).toBeNull();
    expect(writing.strokes, 'okénko je prázdné').toEqual([]);
    expect(writing.fading.length, 'zápis bledne').toBe(1);
    const faded = updateSignWriting(writing, writing.fadingSinceMs + REJECTED_FADE_MS, 'relation');
    expect(faded.fading).toEqual([]);
    expect(test.session.writingRejected()).toBe(true);
    expect(test.sounds.played).toEqual(['boxTap']);
    expect(test.session.starCount()).toBe(0);
  });

  it('dítě rozpoznané < přepíše: smaže ho a napíše =', () => {
    const less = writeAndWait({ kind: 'relation', a: 1, b: 2 }, [straightLess()]);
    expect(writtenSign(less)).toBe('<');
    let writing = clearWritingBox(less);
    for (const [index, stroke] of straightEquals().entries()) {
      writing = write(writing, stroke, 5000 + index * 400);
    }
    expect(writtenSign(updateSignWriting(writing, 5700 + RECOGNITION_DELAY_MS, 'relation'))).toBe(
      '=',
    );
  });

  it('při „vše“ dítě píše + − u „a ☐ b = c“ i < = > u „a ☐ b“', () => {
    const test = openWriting('all', 7);
    const seen = new Set<CompareProblem['kind']>();
    for (let solved = 0; solved < 40; solved += 1) {
      const problem = test.session.problem();
      const result = writeAndConfirm(test, correctSign(problem));
      expect(result.outcome, problem.kind).toBe('correct');
      seen.add(problem.kind);
      test.timers.runAll();
    }
    expect([...seen].sort()).toEqual(['arithmetic', 'relation']);
  });
});

describe('#191: dítě smí psát = a < > dvěma tahy pomalu', () => {
  const relation: CompareProblem = { kind: 'relation', a: 3, b: 3 };

  /** Dítě napíše první tah a pak `pauseMs` přemýšlí (okénko se mezitím posouvá v čase). */
  function firstStrokeThenPause(stroke: Stroke, pauseMs: number): SignWriting {
    let writing = write(createSignWriting(SIGN_AREA), stroke, 0);
    for (let now = 300; now <= 300 + pauseMs; now += 100) {
      writing = updateSignWriting(writing, now, 'relation');
    }
    return writing;
  }

  it('dítě napíše první čáru =, přes 2 s přemýšlí, dopíše druhou a hra pozná =', () => {
    const [top, bottom] = straightEquals() as [Stroke, Stroke];
    const waiting = firstStrokeThenPause(top, 2500);
    expect(waiting.strokes, 'první čára zůstala v okénku').toEqual([top]);
    expect(waiting.fading, 'nic nebledne').toEqual([]);
    expect(writtenSign(waiting)).toBeNull();
    expect(canConfirmSign(waiting), '✓ ještě nejde').toBe(false);
    const both = write(waiting, bottom, 2900);
    expect(writtenSign(updateSignWriting(both, 3200 + RECOGNITION_DELAY_MS, 'relation'))).toBe('=');
  });

  it('dítě napíše jedno rameno <, přes 2 s přemýšlí, dopíše druhé a hra pozná <', () => {
    const [upper, lower] = [
      [
        { x: 140, y: 50 },
        { x: 60, y: 100 },
      ],
      [
        { x: 60, y: 100 },
        { x: 140, y: 150 },
      ],
    ];
    const waiting = firstStrokeThenPause(upper, 2500);
    expect(waiting.strokes).toEqual([upper]);
    expect(waiting.fading).toEqual([]);
    const both = write(waiting, lower, 2900);
    expect(writtenSign(updateSignWriting(both, 3200 + RECOGNITION_DELAY_MS, 'relation'))).toBe('<');
  });

  it('samotná vodorovná čára po 3 s od zvednutí prstu vybledne a okénko vyzve psát znovu', () => {
    const [top] = straightEquals() as [Stroke];
    const writing = write(createSignWriting(SIGN_AREA), top, 0);
    const stillWaiting = updateSignWriting(writing, 300 + INCOMPLETE_WAIT_MS - 1, 'relation');
    expect(stillWaiting.strokes, 'těsně před limitem čeká').toEqual([top]);
    const faded = updateSignWriting(stillWaiting, 300 + INCOMPLETE_WAIT_MS, 'relation');
    expect(faded.strokes).toEqual([]);
    expect(isNewRejection(stillWaiting.fading, faded.fading), 'okénko vyzve psát znovu').toBe(true);
    const test = openWriting('comparison');
    expect(test.session.writingRejected()).toBe(true);
    expect(test.sounds.played).toEqual(['boxTap']);
    expect(test.session.starCount()).toBe(0);
  });

  it('druhá čára dopsaná těsně před limitem dá =', () => {
    const [top, bottom] = straightEquals() as [Stroke, Stroke];
    const waiting = firstStrokeThenPause(top, INCOMPLETE_WAIT_MS - 100);
    expect(waiting.strokes).toEqual([top]);
    const both = write(waiting, bottom, 300 + INCOMPLETE_WAIT_MS - 100);
    const now = 300 + INCOMPLETE_WAIT_MS + 200 + RECOGNITION_DELAY_MS;
    expect(writtenSign(updateSignWriting(both, now, 'relation'))).toBe('=');
  });

  it('čekající první čáru = smaže dítě smazáním', () => {
    const [top] = straightEquals() as [Stroke];
    const cleared = clearWritingBox(firstStrokeThenPause(top, 2500));
    expect(cleared.strokes).toEqual([]);
    expect(cleared.fading).toEqual([]);
  });

  it('samotná svislá čára dál vybledne a okénko vyzve psát znovu', () => {
    const writing = firstStrokeThenPause(straightVertical(), 2500);
    expect(writing.strokes).toEqual([]);
    expect(writtenSign(writing)).toBeNull();
    const rejected = updateSignWriting(
      write(createSignWriting(SIGN_AREA), straightVertical(), 0),
      300 + RECOGNITION_DELAY_MS,
      relation.kind,
    );
    expect(rejected.fading.length, 'zápis bledne').toBe(1);
  });

  it('u „a ☐ b = c“ nic nečeká: samotná svislá čára vybledne jako v #188', () => {
    const writing = updateSignWriting(
      write(createSignWriting(SIGN_AREA), straightVertical(), 0),
      300 + RECOGNITION_DELAY_MS,
      'arithmetic',
    );
    expect(writing.strokes).toEqual([]);
    expect(writing.fading.length).toBe(1);
  });
});

describe('#191 AC2: rozpozná se jen znaménko, které k druhu příkladu patří', () => {
  it('u „a ☐ b“ se napsané + ani − nerozpozná a ✓ s ním nic neudělá', () => {
    const test = openWriting('comparison');
    const problem = test.session.problem();
    for (const sign of ['+', '−'] as const) {
      const writing = writeAndWait(problem, strokesOf(sign));
      expect(writtenSign(writing), sign).toBeNull();
      const result = confirmSign(writing, (written) => test.session.tap(written));
      expect(result.outcome, sign).toBe('ignored');
    }
    expect(test.session.starCount()).toBe(0);
  });

  it('u „a ☐ b“ napsané + vybledne a dítě píše znovu', () => {
    const writing = writeAndWait({ kind: 'relation', a: 1, b: 2 }, strokesOf('+'));
    expect(writing.strokes).toEqual([]);
    expect(writing.fading.length).toBe(2);
  });

  it('u „a ☐ b = c“ se napsané <, > ani = nerozpozná', () => {
    const test = openWriting('plusMinus');
    const problem = test.session.problem();
    expect(problem.kind).toBe('arithmetic');
    for (const sign of ['<', '>', '='] satisfies RelationSign[]) {
      expect(writtenSign(writeAndWait(problem, strokesOf(sign))), sign).toBeNull();
    }
  });

  it('+ a − u „a ☐ b = c“ se dál rozpoznají jako v #188', () => {
    const test = openWriting('plusMinus');
    solveProblem(test);
    const problem = test.session.problem();
    expect(writtenSign(writeAndWait(problem, strokesOf('−')))).toBe('−');
    expect(writtenSign(writeAndWait(problem, strokesOf('+')))).toBe('+');
  });
});
