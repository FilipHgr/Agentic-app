import { describe, expect, it } from 'vitest';

import { recognizeSign } from '../../../src/games/compare/logic/signRecognition';
import {
  LARGE_SIGN_AREA,
  SIGN_AREA,
  handNegativeSamples,
  minusSamples,
  plusSamples,
  straightMinus,
  straightVertical,
  uciNegativeSamples,
} from './signStrokes';
import type { StrokeSample } from './signStrokes';

/**
 * Testy k #188 AC3: rozpoznání + a − napsaného prstem jen v zařízení na
 * vlastní sadě tahů (`signStrokes.ts`): nakloněné, nerovné, krátké
 * i dlouhé čáry, plus v obou pořadích tahů, a záporné vzorky (svislá
 * čára, kruh, čmáranice, číslice, ×, =, T, L a číslice ze sady UCI).
 * Aspoň 95 % kladných vzorků se rozpozná správně a aspoň 95 % záporných
 * se nerozpozná vůbec.
 */

const MIN_SHARE = 0.95;

/** Část vzorků, u kterých rozpoznání vrátí `expected`, a jména těch ostatních. */
function score(samples: readonly StrokeSample[], expected: ReturnType<typeof recognizeSign>) {
  const missed = samples.filter(
    (sample) => recognizeSign(sample.strokes, sample.area) !== expected,
  );
  return { share: 1 - missed.length / samples.length, missed: missed.map((sample) => sample.name) };
}

describe('#188 AC3: jeden vodorovný tah je −', () => {
  it('rovná vodorovná čára přes okénko je −', () => {
    expect(recognizeSign([straightMinus()], SIGN_AREA)).toBe('−');
  });

  it('dítě napíše − nakloněně, nerovně, krátce i dlouze a hra ho pozná aspoň v 95 % případů', () => {
    for (const area of [SIGN_AREA, LARGE_SIGN_AREA]) {
      const result = score(minusSamples(300, area), '−');
      expect(
        result.share,
        `okénko ${area.width} px, nepoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('− se pozná, i když dítě omylem ťukne ještě tečku vedle', () => {
    const dot = [
      { x: 20, y: 20 },
      { x: 22, y: 21 },
    ];
    expect(recognizeSign([straightMinus(), dot], SIGN_AREA)).toBe('−');
  });
});

describe('#188 AC3: dva křížící se tahy, vodorovný a svislý, jsou +', () => {
  it('rovný kříž je + v obou pořadích tahů', () => {
    expect(recognizeSign([straightMinus(), straightVertical()], SIGN_AREA)).toBe('+');
    expect(recognizeSign([straightVertical(), straightMinus()], SIGN_AREA)).toBe('+');
  });

  it('dítě napíše + nakloněně, nerovně, mimo střed a v obou pořadích a hra ho pozná aspoň v 95 % případů', () => {
    for (const area of [SIGN_AREA, LARGE_SIGN_AREA]) {
      const samples = plusSamples(300, area);
      const verticalFirst = samples.filter((sample) => sample.name.includes('nejdřív svislá'));
      expect(verticalFirst.length, 'polovina plusů začíná svislou čárou').toBe(150);
      const result = score(samples, '+');
      expect(
        result.share,
        `okénko ${area.width} px, nepoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('napsané − se doplněním svislé čáry změní na +', () => {
    expect(recognizeSign([straightMinus()], SIGN_AREA)).toBe('−');
    expect(recognizeSign([straightMinus(), straightVertical()], SIGN_AREA)).toBe('+');
  });
});

describe('#188 AC3: ostatní zápisy se nerozpoznají a okénko vyzve psát znovu', () => {
  it('prázdný zápis ani samotné ťuknutí nejsou znaménko', () => {
    expect(recognizeSign([], SIGN_AREA)).toBeNull();
    expect(recognizeSign([[{ x: 100, y: 100 }]], SIGN_AREA)).toBeNull();
  });

  it('svislá čára samotná není −', () => {
    expect(recognizeSign([straightVertical()], SIGN_AREA)).toBeNull();
  });

  it('svislé čáry, kruhy, čmáranice, číslice, ×, =, T a L hra aspoň v 95 % případů nerozpozná', () => {
    for (const area of [SIGN_AREA, LARGE_SIGN_AREA]) {
      const result = score(handNegativeSamples(area), null);
      expect(
        result.share,
        `okénko ${area.width} px, rozpoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('číslice napsané lidmi (sada UCI) hra aspoň v 95 % případů jako znaménko nerozpozná', () => {
    const samples = uciNegativeSamples(SIGN_AREA);
    expect(samples.length).toBeGreaterThan(3000);
    const result = score(samples, null);
    expect(
      result.share,
      `rozpoznané: ${result.missed.slice(0, 20).join(', ')}`,
    ).toBeGreaterThanOrEqual(MIN_SHARE);
  });
});
