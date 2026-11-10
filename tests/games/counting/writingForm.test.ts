import { describe, expect, it } from 'vitest';

import {
  recognizeDigit,
  recognizeDigitWithForm,
} from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingForm } from '../../../src/games/counting/logic/digitRecognition';

import { NOT_DIGITS } from './notDigitStrokes';
import {
  ASYMMETRIC_DIGITS,
  FORM_AREA,
  LOOP_DIRECTIONS,
  ONE,
  WRITTEN_FORMS,
  inForm,
  nineLoop,
  zeroLoop,
} from './writtenForms';
import type { WrittenForm } from './writtenForms';

/**
 * Testy k #85: číslice napsaná odspodu (opačným směrem) nebo zrcadlově
 * se pozná jako ta, kterou dítě myslelo. Rychlé testy na pevných tvarech
 * z `writtenForms.ts`. Přesnost na celé sadě UCI měří
 * `reversedDigitRecognition.slow.test.ts`.
 *
 * Výsledek rozpoznání vedle číslice vrací i podobu, která vyhrála
 * (komentář vlastníka k #85, kvůli navazujícímu ukázání správného tvaru).
 * Zrcadlový a zároveň obrácený zápis je zrcadlový.
 */

/** Podoba, kterou má rozpoznání nahlásit pro zápis napsaný v podobě z testu. */
const EXPECTED_FORM: Record<WrittenForm, WritingForm> = {
  normálně: 'normal',
  odspodu: 'reversed',
  zrcadlově: 'mirrored',
  'zrcadlově a odspodu': 'mirrored',
};

/** AC4: aspoň 90 % zápisů, které nejsou číslice, se odmítne (jako v #41). */
const MIN_REJECTED_SHARE = 0.9;

interface FormCase {
  readonly label: string;
  readonly digit: number;
  readonly form: WrittenForm;
  readonly strokes: Stroke[];
}

/** Každá pevná číslice v každé ze čtyř podob. */
function formCases(): FormCase[] {
  return ASYMMETRIC_DIGITS.flatMap(({ digit, strokes }) =>
    WRITTEN_FORMS.map((form) => ({
      label: `${digit} napsaná ${form}`,
      digit,
      form,
      strokes: inForm(strokes, form),
    })),
  );
}

/** Nula a devítka se smyčkou po směru i proti směru, napsané normálně i odspodu. */
function loopCases(): FormCase[] {
  const loops = [
    { digit: 0, write: zeroLoop },
    { digit: 9, write: nineLoop },
  ];
  const forms: WrittenForm[] = ['normálně', 'odspodu'];
  return loops.flatMap(({ digit, write }) =>
    LOOP_DIRECTIONS.flatMap((direction) =>
      forms.map((form) => ({
        label: `${digit} se smyčkou ${direction}, napsaná ${form}`,
        digit,
        form,
        strokes: inForm(write(direction), form),
      })),
    ),
  );
}

function rejectedShare(attempts: readonly Stroke[][]): number {
  const rejected = attempts.filter(
    (strokes) => recognizeDigitWithForm(strokes, FORM_AREA) === null,
  );
  return rejected.length / attempts.length;
}

describe('AC1: číslice napsaná odspodu se pozná', () => {
  it('číslici napsanou opačným směrem hra pozná jako tu, kterou dítě myslelo', () => {
    for (const writing of formCases().filter((item) => item.form === 'odspodu')) {
      expect(recognizeDigit(writing.strokes, FORM_AREA), writing.label).toBe(writing.digit);
    }
  });
});

describe('AC2: zrcadlově napsaná číslice se pozná', () => {
  it('zrcadlovou číslici, i napsanou odspodu, hra pozná jako tu, kterou dítě myslelo', () => {
    const mirrored = formCases().filter(
      (item) => item.form === 'zrcadlově' || item.form === 'zrcadlově a odspodu',
    );
    for (const writing of mirrored) {
      expect(recognizeDigit(writing.strokes, FORM_AREA), writing.label).toBe(writing.digit);
    }
  });
});

describe('AC3: normálně napsané číslice se nezhorší', () => {
  it('normálně napsanou číslici, jedničku, nulu i devítku hra pozná dál', () => {
    const normal = [
      ...formCases().filter((item) => item.form === 'normálně'),
      ...loopCases().filter((item) => item.form === 'normálně'),
      { label: 'svislá jednička', digit: 1, form: 'normálně' as const, strokes: ONE },
    ];
    for (const writing of normal) {
      expect(recognizeDigit(writing.strokes, FORM_AREA), writing.label).toBe(writing.digit);
    }
  });
});

describe('výsledek rozpoznání řekne, v jaké podobě dítě číslici napsalo', () => {
  it('vedle číslice vrátí podobu normální, obrácenou nebo zrcadlovou', () => {
    for (const writing of formCases()) {
      expect(recognizeDigitWithForm(writing.strokes, FORM_AREA), writing.label).toEqual({
        digit: writing.digit,
        form: EXPECTED_FORM[writing.form],
      });
    }
  });

  it('smyčka nuly nebo devítky psaná na druhou stranu se nehlásí jako zrcadlení', () => {
    for (const writing of loopCases()) {
      const recognized = recognizeDigitWithForm(writing.strokes, FORM_AREA);

      expect(recognized?.digit, writing.label).toBe(writing.digit);
      expect(recognized?.form, writing.label).not.toBe('mirrored');
    }
  });

  it('podoba nemění číslo, které se ukáže, ani odmítnutí', () => {
    const attempts = [
      ...formCases(),
      ...loopCases(),
      ...NOT_DIGITS.map((strokes, index) => ({ label: `nečíslice ${index}`, strokes })),
    ];
    for (const writing of attempts) {
      const withForm = recognizeDigitWithForm(writing.strokes, FORM_AREA);

      expect(withForm?.digit ?? null, writing.label).toBe(
        recognizeDigit(writing.strokes, FORM_AREA),
      );
    }
  });

  it('rozpoznání v jakékoli podobě nezmění zápis, který dítě napsalo', () => {
    for (const writing of formCases()) {
      const before = JSON.stringify(writing.strokes);

      recognizeDigit(writing.strokes, FORM_AREA);
      recognizeDigitWithForm(writing.strokes, FORM_AREA);

      expect(JSON.stringify(writing.strokes), writing.label).toBe(before);
    }
  });
});

describe('AC4: zápis, který není číslice, se dál odmítne', () => {
  it('prázdný zápis se odmítne bez číslice i bez podoby', () => {
    const empty: Stroke[][] = [[], [[]], [[], []]];
    for (const strokes of empty) {
      expect(recognizeDigitWithForm(strokes, FORM_AREA), JSON.stringify(strokes)).toBeNull();
    }
  });

  it('tečky, krátké čárky a čmáranice se odmítnou, i když jsou napsané odspodu nebo zrcadlově', () => {
    for (const form of WRITTEN_FORMS) {
      const attempts = NOT_DIGITS.map((strokes) => inForm(strokes, form));

      expect(rejectedShare(attempts), `nečíslice napsané ${form}`).toBeGreaterThanOrEqual(
        MIN_REJECTED_SHARE,
      );
    }
  });
});
