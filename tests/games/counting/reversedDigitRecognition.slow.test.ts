import { describe, expect, it } from 'vitest';

import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';

import { WRITING_AREA, uciTestSamples } from './penDigits';
import type { PenDigitSample } from './penDigits';
import { inForm } from './writtenForms';
import type { WrittenForm } from './writtenForms';

/**
 * Testy k #85: přesnost rozpoznání číslic napsaných odspodu (opačným
 * směrem) a zrcadlově na testovací části sady UCI (`pendigits.tes`), kterou
 * test sám obrátí nebo zrcadlí zleva doprava. Odmítnutí zápisu je chyba.
 *
 * Normální zápis dál hlídají dnešní testy beze změny prahů
 * (`digitRecognition.slow.test.ts`, `twoDigitRecognition.slow.test.ts`,
 * `phonePortraitRecognition.slow.test.ts`, `nineRecognition.test.ts`).
 * Tady se navíc porovnává se stavem před #85 (AC3).
 */

/** AC1: opačný směr aspoň 90 % celkem. */
const MIN_REVERSED_TOTAL = 0.9;

/** AC1: opačný směr každá číslice aspoň 80 %. */
const MIN_REVERSED_DIGIT = 0.8;

/** AC2: zrcadlení (i zrcadlení s opačným směrem) aspoň 85 % celkem. */
const MIN_MIRRORED_TOTAL = 0.85;

/** AC2: zrcadlení (i zrcadlení s opačným směrem) každá číslice aspoň 75 %. */
const MIN_MIRRORED_DIGIT = 0.75;

/** AC3: záměna číslice za jinou smí přibýt nejvýš o 2 procentní body. */
const MAX_CONFUSION_INCREASE = 0.02;

/** AC3: celková přesnost na neupravené sadě smí klesnout nejvýš o 1 procentní bod. */
const MAX_TOTAL_DECREASE = 0.01;

/**
 * Stav před #85 na neupravené sadě: kolikrát se napsaná číslice (klíč)
 * rozpoznala jako jiná číslice (vnitřní klíč). Změřeno 2026-11-07 na
 * `recognizeDigit` ze sprintu 3 před #85. Neuvedené dvojice byly 0,
 * odmítnutí (null) nebylo žádné.
 */
const CONFUSIONS_BEFORE: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  0: { 5: 8, 6: 2, 7: 6, 8: 1 },
  1: { 2: 49, 4: 1, 7: 2, 9: 1 },
  2: { 1: 14 },
  3: { 1: 2, 9: 2 },
  4: { 5: 7, 6: 2, 7: 1, 9: 4 },
  5: { 0: 1, 3: 7, 9: 4 },
  6: { 1: 1, 8: 1 },
  7: { 1: 27, 2: 2, 3: 1, 8: 2 },
  8: { 0: 3, 5: 2, 9: 1 },
  9: { 0: 1, 1: 7, 3: 7, 5: 5, 7: 1 },
};

/** Počet číslic v testovací části sady UCI. */
const SAMPLES_IN_SET = 3498;

/** Stav před #85: správně rozpoznáno 3 323 z 3 498 číslic (95,0 %). */
const CORRECT_BEFORE = 3323;

/** Rozpoznání celé sady ve čtyřech podobách trvá déle než běžný test. */
const SLOW_TEST_TIMEOUT_MS = 180_000;

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface Measurement {
  readonly total: number;
  readonly correct: number;
  readonly byDigit: ReadonlyMap<number, number>;
  /** Napsaná číslice → rozpoznaná jiná číslice → kolikrát. */
  readonly confusions: ReadonlyMap<number, ReadonlyMap<number, number>>;
  readonly countByDigit: ReadonlyMap<number, number>;
}

/** Vzorky sady v podobě `form` (obrácení a zrcadlení v ploše na psaní). */
function samplesInForm(form: WrittenForm): PenDigitSample[] {
  return uciTestSamples().map((sample) => ({
    digit: sample.digit,
    stroke: inForm([sample.stroke], form, WRITING_AREA)[0] ?? [],
  }));
}

function measure(samples: readonly PenDigitSample[]): Measurement {
  const correctByDigit = new Map<number, number>();
  const countByDigit = new Map<number, number>();
  const confusions = new Map<number, Map<number, number>>(
    DIGITS.map((digit) => [digit, new Map()]),
  );

  for (const sample of samples) {
    const recognized = recognizeDigit([sample.stroke], WRITING_AREA);
    countByDigit.set(sample.digit, (countByDigit.get(sample.digit) ?? 0) + 1);
    if (recognized === sample.digit) {
      correctByDigit.set(sample.digit, (correctByDigit.get(sample.digit) ?? 0) + 1);
    } else if (recognized !== null) {
      const row = confusions.get(sample.digit);
      row?.set(recognized, (row.get(recognized) ?? 0) + 1);
    }
  }

  const byDigit = new Map<number, number>();
  let correct = 0;
  for (const digit of DIGITS) {
    const digitCorrect = correctByDigit.get(digit) ?? 0;
    correct += digitCorrect;
    byDigit.set(digit, digitCorrect / (countByDigit.get(digit) ?? 1));
  }

  return { total: correct / samples.length, correct, byDigit, confusions, countByDigit };
}

/** Číslice pod hranicí i s podílem (pro čitelnou chybu testu). */
function digitsBelow(measurement: Measurement, minimum: number): Record<number, number> {
  const below: Record<number, number> = {};
  for (const [digit, share] of measurement.byDigit) {
    if (share < minimum) {
      below[digit] = Math.round(share * 1000) / 1000;
    }
  }
  return below;
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)} %`;
}

function confusionBefore(written: number, recognized: number): number {
  return CONFUSIONS_BEFORE[written]?.[recognized] ?? 0;
}

function confusionAfter(measurement: Measurement, written: number, recognized: number): number {
  return measurement.confusions.get(written)?.get(recognized) ?? 0;
}

/** Tabulka záměn před #85 a po něm, jen dvojice, které se aspoň jednou spletly. */
function confusionTable(measurement: Measurement): string {
  const lines = ['napsaná → rozpoznaná: před #85 → po #85'];
  for (const written of DIGITS) {
    const count = measurement.countByDigit.get(written) ?? 1;
    for (const recognized of DIGITS) {
      const before = confusionBefore(written, recognized);
      const after = confusionAfter(measurement, written, recognized);
      if (written !== recognized && (before > 0 || after > 0)) {
        lines.push(
          `${written} → ${recognized}: ${percent(before / count)} → ${percent(after / count)}`,
        );
      }
    }
  }
  return lines.join('\n');
}

describe('stav před #85 odpovídá testovací sadě', () => {
  it('tabulka záměn před #85 sedí na počty číslic v sadě a na 95,0 % správně', () => {
    const samples = uciTestSamples();
    expect(samples).toHaveLength(SAMPLES_IN_SET);
    let correct = 0;

    for (const digit of DIGITS) {
      const wrong = Object.values(CONFUSIONS_BEFORE[digit] ?? {}).reduce((a, b) => a + b, 0);
      const count = samples.filter((sample) => sample.digit === digit).length;
      expect(count - wrong, `číslice ${digit}: správně před #85`).toBeGreaterThan(0);
      correct += count - wrong;
    }

    expect(correct).toBe(CORRECT_BEFORE);
    expect(Math.round((CORRECT_BEFORE / SAMPLES_IN_SET) * 1000) / 1000).toBe(0.95);
  });
});

describe('AC1: číslice napsaná odspodu se pozná', () => {
  it(
    'z číslic sady napsaných opačným směrem pozná aspoň 90 % a každou číslici aspoň v 80 %',
    () => {
      const measurement = measure(samplesInForm('odspodu'));

      expect(measurement.total, `celkem ${percent(measurement.total)}`).toBeGreaterThanOrEqual(
        MIN_REVERSED_TOTAL,
      );
      expect(digitsBelow(measurement, MIN_REVERSED_DIGIT)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

describe('AC2: zrcadlově napsaná číslice se pozná', () => {
  it(
    'z číslic sady zrcadlených zleva doprava pozná aspoň 85 % a každou číslici aspoň v 75 %',
    () => {
      const measurement = measure(samplesInForm('zrcadlově'));

      expect(measurement.total, `celkem ${percent(measurement.total)}`).toBeGreaterThanOrEqual(
        MIN_MIRRORED_TOTAL,
      );
      expect(digitsBelow(measurement, MIN_MIRRORED_DIGIT)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'z číslic sady zrcadlených a zároveň napsaných odspodu pozná aspoň 85 % a každou aspoň v 75 %',
    () => {
      const measurement = measure(samplesInForm('zrcadlově a odspodu'));

      expect(measurement.total, `celkem ${percent(measurement.total)}`).toBeGreaterThanOrEqual(
        MIN_MIRRORED_TOTAL,
      );
      expect(digitsBelow(measurement, MIN_MIRRORED_DIGIT)).toEqual({});
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});

describe('AC3: normálně napsané číslice se nezhorší', () => {
  it(
    'normálně napsaná číslice se za žádnou jinou nesplete o víc než 2 procentní body častěji než před #85',
    () => {
      const measurement = measure(samplesInForm('normálně'));
      const table = confusionTable(measurement);
      console.log(`Záměny na neupravené sadě (#85, AC3)\n${table}`);

      for (const written of DIGITS) {
        const count = measurement.countByDigit.get(written) ?? 1;
        for (const recognized of DIGITS.filter((digit) => digit !== written)) {
          const before = confusionBefore(written, recognized) / count;
          const after = confusionAfter(measurement, written, recognized) / count;

          expect(
            after,
            `${written} rozpoznaná jako ${recognized}: před ${percent(before)}, po ${percent(after)}\n${table}`,
          ).toBeLessThanOrEqual(before + MAX_CONFUSION_INCREASE);
        }
      }
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it(
    'celkem pozná normálně napsaných číslic nejvýš o 1 procentní bod méně než před #85 (95,0 %)',
    () => {
      const measurement = measure(samplesInForm('normálně'));
      const before = CORRECT_BEFORE / SAMPLES_IN_SET;

      expect(
        measurement.total,
        `před ${percent(before)}, po ${percent(measurement.total)}`,
      ).toBeGreaterThanOrEqual(before - MAX_TOTAL_DECREASE);
    },
    SLOW_TEST_TIMEOUT_MS,
  );
});
