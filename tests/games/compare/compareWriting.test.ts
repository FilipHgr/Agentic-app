import { describe, expect, it } from 'vitest';

import { correctSign, otherSign } from '../../../src/games/compare/logic/compareProblems';
import type { CompareSign } from '../../../src/games/compare/logic/compareProblems';
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
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
  clearWritingBox,
  finishWritingStroke,
  isNewRejection,
  resizeWritingBox,
  startWritingStroke,
} from '../../../src/shared/logic/writingBox';
import { MemoryStorage, openCompare } from './compareFakes';
import type { TestCompare } from './compareFakes';
import { SIGN_AREA, straightMinus, straightVertical } from './signStrokes';

/**
 * Testy k #188 AC2 a AC3: znaménko psané prstem do okénka příkladu. Okénko
 * se chová jako v Počítání: 1 s po zvednutí prstu se zápis rozpozná,
 * rozpoznané znaménko dítě potvrdí ✓ nebo přepíše, smazání není chyba
 * a nerozpoznaný zápis vybledne a okénko vyzve psát znovu, nic netrestá.
 * Vyhodnocení po ✓ je stejné jako ťuknutí na tlačítko.
 */

/** Dítě napíše jeden tah: položí prst v `startMs`, zvedne ho o 300 ms později. */
function write(writing: SignWriting, stroke: Stroke, startMs: number): SignWriting {
  const down = startWritingStroke(writing, startMs);
  return finishWritingStroke(down, stroke, startMs + 300);
}

/** Dítě napíše tahy za sebou a počká, až se zápis rozpozná. */
function writeAndWait(strokes: readonly Stroke[], startMs = 0): SignWriting {
  let writing = createSignWriting(SIGN_AREA);
  let now = startMs;
  for (const stroke of strokes) {
    writing = write(writing, stroke, now);
    now += 400;
  }
  return updateSignWriting(writing, now + RECOGNITION_DELAY_MS);
}

/** Tahy, kterými dítě napíše znaménko `sign`. */
function strokesOf(sign: CompareSign): Stroke[] {
  return sign === '−' ? [straightMinus()] : [straightMinus(), straightVertical()];
}

/** Porovnávání s odpovědí psaním (rodič ji zvolil v nastavení). */
function openWritingCompare(): TestCompare {
  const storage = new MemoryStorage();
  storage.data.set(COMPARE_SETTINGS_KEY, '{"maxNumber":10,"answerInput":"writing"}');
  return openCompare(storage);
}

describe('#188 AC2: rozpoznané znaménko dítě před vyhodnocením potvrdí nebo přepíše', () => {
  it('napsané − se ukáže až 1 s po zvednutí prstu a pak jde potvrdit ✓', () => {
    const writing = write(createSignWriting(SIGN_AREA), straightMinus(), 0);
    const early = updateSignWriting(writing, 300 + RECOGNITION_DELAY_MS - 1);
    expect(writtenSign(early), 'před uplynutím 1 s').toBeNull();
    expect(canConfirmSign(early), '✓ ještě nejde').toBe(false);
    const recognized = updateSignWriting(writing, 300 + RECOGNITION_DELAY_MS);
    expect(writtenSign(recognized)).toBe('−');
    expect(canConfirmSign(recognized)).toBe(true);
  });

  it('dokud má dítě prst v okénku, nic se nerozpozná a ✓ nejde', () => {
    const down = startWritingStroke(createSignWriting(SIGN_AREA), 0);
    const later = updateSignWriting(down, 5000);
    expect(writtenSign(later)).toBeNull();
    expect(canConfirmSign(later)).toBe(false);
  });

  it('dítě rozpoznané − přepíše dopsáním svislé čáry na +', () => {
    const minus = writeAndWait([straightMinus()]);
    expect(writtenSign(minus)).toBe('−');
    const touched = startWritingStroke(minus, 5000);
    expect(writtenSign(touched), 'další dotyk znaménko schová').toBeNull();
    const plus = updateSignWriting(
      finishWritingStroke(touched, straightVertical(), 5300),
      5300 + RECOGNITION_DELAY_MS,
    );
    expect(writtenSign(plus)).toBe('+');
  });

  it('smazání vyprázdní okénko a nic se nepočítá jako chyba', () => {
    const test = openWritingCompare();
    const minus = writeAndWait([straightMinus()]);
    const cleared = clearWritingBox(minus);
    expect(writtenSign(cleared)).toBeNull();
    expect(cleared.strokes).toEqual([]);
    expect(test.sounds.played).toEqual([]);
    expect(test.session.starCount()).toBe(0);
  });

  it('po ✓ se správným napsaným znaménkem přibude hvězdička a znaménko zůstane v okénku', () => {
    const test = openWritingCompare();
    const sign = correctSign(test.session.problem());
    const result = confirmSign(writeAndWait(strokesOf(sign)), (written) =>
      test.session.tap(written),
    );
    expect(result.outcome).toBe('correct');
    expect(test.session.starCount()).toBe(1);
    expect(test.session.filledSign()).toBe(sign);
    expect(test.sounds.played).toContain('correct');
  });

  it('po ✓ se špatným znaménkem se nic nebere, okénko se vyprázdní a dítě píše znovu', () => {
    const test = openWritingCompare();
    const wrong = otherSign(correctSign(test.session.problem()));
    const result = confirmSign(writeAndWait(strokesOf(wrong)), (written) =>
      test.session.tap(written),
    );
    expect(result.outcome).toBe('wrong');
    expect(writtenSign(result.writing)).toBeNull();
    expect(result.writing.strokes).toEqual([]);
    expect(test.session.starCount()).toBe(0);
    const again = confirmSign(
      writeAndWait(strokesOf(correctSign(test.session.problem()))),
      (written) => test.session.tap(written),
    );
    expect(again.outcome, 'stejný příklad jde vyřešit dál').toBe('correct');
  });

  it('✓ bez rozpoznaného znaménka nic neudělá', () => {
    const test = openWritingCompare();
    const result = confirmSign(createSignWriting(SIGN_AREA), (written) =>
      test.session.tap(written),
    );
    expect(result.outcome).toBe('ignored');
    expect(test.sounds.played).toEqual([]);
  });

  it('po otočení zařízení zůstane v okénku napsaný zápis i rozpoznané znaménko', () => {
    const minus = writeAndWait([straightMinus()]);
    const bigger = resizeWritingBox(minus, { width: 300, height: 300 });
    expect(writtenSign(bigger)).toBe('−');
    const [stroke] = bigger.strokes;
    expect(stroke?.[0]?.x).toBeCloseTo((straightMinus()[0]?.x ?? 0) * 1.5, 6);
    expect(bigger.area).toEqual({ width: 300, height: 300 });
  });
});

describe('#188 AC3: nerozpoznaný zápis okénko vyzve psát znovu, nic netrestá', () => {
  it('svislá čára se nerozpozná, vybledne a okénko je zase prázdné', () => {
    const writing = writeAndWait([straightVertical()]);
    expect(writtenSign(writing)).toBeNull();
    expect(writing.strokes, 'okénko je prázdné').toEqual([]);
    expect(writing.fading.length, 'zápis bledne').toBe(1);
    const faded = updateSignWriting(writing, writing.fadingSinceMs + REJECTED_FADE_MS);
    expect(faded.fading).toEqual([]);
  });

  it('okénko po nerozpoznaném zápisu jemně cinkne a zhoupne se, hvězdičky ani chyby se nemění', () => {
    const test = openWritingCompare();
    expect(test.session.writingRejected()).toBe(true);
    expect(test.sounds.played).toEqual(['boxTap']);
    expect(test.changes.map((change) => change.kind)).toContain('writeAgain');
    expect(test.sounds.played).not.toContain('wrong');
    expect(test.session.starCount()).toBe(0);
    expect(test.session.tap(correctSign(test.session.problem()))).toBe('correct');
  });

  it('po otočení zařízení do 400 ms od nerozpoznaného zápisu okénko nevyzve psát znovu podruhé', () => {
    const rejected = writeAndWait([straightVertical()]);
    expect(isNewRejection([], rejected.fading), 'první vyzvání').toBe(true);
    // Otočení: okénko vznikne znovu se stejným (přepočteným) blednoucím zápisem.
    const rotated = resizeWritingBox(rejected, { width: 300, height: 300 });
    const afterRotation = updateSignWriting(rotated, rejected.fadingSinceMs + 100);
    expect(isNewRejection(rotated.fading, afterRotation.fading), 'po otočení').toBe(false);
    const faded = updateSignWriting(rotated, rejected.fadingSinceMs + REJECTED_FADE_MS);
    expect(isNewRejection(rotated.fading, faded.fading), 'po doblednutí').toBe(false);
  });

  it('nový nerozpoznaný zápis po otočení okénko zase vyzve psát znovu', () => {
    const rotated = resizeWritingBox(writeAndWait([straightVertical()]), {
      width: 300,
      height: 300,
    });
    const again = updateSignWriting(
      finishWritingStroke(startWritingStroke(rotated, 5000), straightVertical(), 5300),
      5300 + RECOGNITION_DELAY_MS,
    );
    expect(isNewRejection(rotated.fading, again.fading)).toBe(true);
  });

  it('ťuknutí na okénko příkladu při psaní jemně cinkne a nic se nepočítá', () => {
    const test = openWritingCompare();
    expect(test.session.tapBox()).toBe(true);
    expect(test.sounds.played).toEqual(['boxTap']);
    expect(test.session.starCount()).toBe(0);
  });

  it('při otevřeném nastavení nerozpoznaný zápis necinká', () => {
    const test = openWritingCompare();
    test.gear.hold();
    expect(test.session.writingRejected()).toBe(false);
    expect(test.sounds.played).toEqual([]);
  });
});
