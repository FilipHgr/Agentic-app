import { describe, expect, it } from 'vitest';

import type { ProblemKind } from '../../../src/games/compare/logic/compareProblems';
import { recognizeSign } from '../../../src/games/compare/logic/signRecognition';
import {
  LARGE_SIGN_AREA,
  SIGN_AREA,
  beakSamples,
  equalsSamples,
  minusSamples,
  plusSamples,
  relationNegativeSamples,
  straightEquals,
  straightGreater,
  straightLess,
  straightMinus,
  straightVertical,
  uciNegativeSamples,
} from './signStrokes';
import type { StrokeSample } from './signStrokes';

/**
 * Testy k #191 AC2 a AC3: rozpoznání <, > a = napsaných prstem jen
 * v zařízení na vlastní sadě tahů (`signStrokes.ts`): nakloněné, nerovné
 * a různě velké zobáčky jedním tahem shora i zdola i dvěma tahy, = dvěma
 * tahy v obou pořadích a směrech. Záporné vzorky jsou číslice, kruhy,
 * čmáranice, ×, svislá čára, L, V, T a + a −, které do „a ☐ b“ nepatří,
 * a navíc číslice ze sady UCI. Aspoň 95 % každého znaménka se rozpozná
 * správně a aspoň 95 % záporných vzorků se nerozpozná vůbec. Rozpozná se
 * jen znaménko, které k druhu příkladu patří: u „a ☐ b = c“ ani jedno
 * z < = >, u „a ☐ b“ ani + a − (výsledky + a − z #188 hlídá dál
 * `signRecognition.test.ts`).
 */

const MIN_SHARE = 0.95;
const SAMPLE_COUNT = 300;
const AREAS = [SIGN_AREA, LARGE_SIGN_AREA];

/** Část vzorků, u kterých rozpoznání v druhu `kind` vrátí `expected`, a jména těch ostatních. */
function score(
  samples: readonly StrokeSample[],
  expected: ReturnType<typeof recognizeSign>,
  kind: ProblemKind,
) {
  const missed = samples.filter(
    (sample) => recognizeSign(sample.strokes, sample.area, kind) !== expected,
  );
  return { share: 1 - missed.length / samples.length, missed: missed.map((sample) => sample.name) };
}

describe('#191 AC2: < a > jsou zobáček, = dvě vodorovné čáry nad sebou', () => {
  it('rovné < se špičkou vlevo, > se špičkou vpravo a = z dvou čar se rozpoznají', () => {
    expect(recognizeSign([straightLess()], SIGN_AREA, 'relation')).toBe('<');
    expect(recognizeSign([straightGreater()], SIGN_AREA, 'relation')).toBe('>');
    expect(recognizeSign(straightEquals(), SIGN_AREA, 'relation')).toBe('=');
  });

  it('< a > jdou napsat jedním tahem shora i zdola', () => {
    const reversed = (stroke: ReturnType<typeof straightLess>) => [...stroke].reverse();
    expect(recognizeSign([reversed(straightLess())], SIGN_AREA, 'relation')).toBe('<');
    expect(recognizeSign([reversed(straightGreater())], SIGN_AREA, 'relation')).toBe('>');
  });

  it('= jde napsat nejdřív horní i nejdřív dolní čarou, zleva i zprava', () => {
    const [top, bottom] = straightEquals() as [
      ReturnType<typeof straightMinus>,
      ReturnType<typeof straightMinus>,
    ];
    expect(recognizeSign([bottom, top], SIGN_AREA, 'relation')).toBe('=');
    expect(recognizeSign([[...top].reverse(), bottom], SIGN_AREA, 'relation')).toBe('=');
  });

  it('dvě čáry přes sebe (×) ani dvě čáry vedle sebe nejsou =', () => {
    const { width, height } = SIGN_AREA;
    const cross = [
      [
        { x: width * 0.25, y: height * 0.25 },
        { x: width * 0.75, y: height * 0.75 },
      ],
      [
        { x: width * 0.75, y: height * 0.25 },
        { x: width * 0.25, y: height * 0.75 },
      ],
    ];
    expect(recognizeSign(cross, SIGN_AREA, 'relation')).toBeNull();
    const left = [
      { x: width * 0.05, y: height * 0.5 },
      { x: width * 0.4, y: height * 0.5 },
    ];
    const right = left.map((point) => ({ x: point.x + width * 0.55, y: point.y }));
    expect(recognizeSign([left, right], SIGN_AREA, 'relation')).toBeNull();
  });
});

describe('#191 AC3: dítě napíše < > = různě a hra je pozná aspoň v 95 % případů', () => {
  for (const sign of ['<', '>'] as const) {
    it(`dítě napíše ${sign} nakloněně, nerovně, různě velké, jedním tahem v obou směrech i dvěma tahy a hra ho pozná`, () => {
      for (const area of AREAS) {
        const samples = beakSamples(sign, SAMPLE_COUNT, area);
        expect(
          samples.filter((sample) => sample.strokes.length === 2).length,
          'čtvrtina dvěma tahy',
        ).toBe(SAMPLE_COUNT / 4);
        expect(
          samples.filter((sample) => sample.name.includes('zdola')).length,
          'aspoň čtvrtina jedním tahem zdola',
        ).toBeGreaterThanOrEqual(SAMPLE_COUNT / 4);
        const result = score(samples, sign, 'relation');
        expect(
          result.share,
          `okénko ${area.width} px, nepoznané: ${result.missed.join(', ')}`,
        ).toBeGreaterThanOrEqual(MIN_SHARE);
      }
    });
  }

  it('dítě napíše = dvěma nerovnými, nakloněnými čarami v obou pořadích a hra ho pozná', () => {
    for (const area of AREAS) {
      const samples = equalsSamples(SAMPLE_COUNT, area);
      expect(
        samples.filter((sample) => sample.name.includes('nejdřív dolní')).length,
        'polovina začíná dolní čarou',
      ).toBe(SAMPLE_COUNT / 2);
      const result = score(samples, '=', 'relation');
      expect(
        result.share,
        `okénko ${area.width} px, nepoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('dvě čáry < v obou pořadích dají stejné znaménko', () => {
    for (const sample of beakSamples('<', 40).filter((item) => item.strokes.length === 2)) {
      const swapped = [...sample.strokes].reverse();
      expect(recognizeSign(swapped, sample.area, 'relation'), sample.name).toBe(
        recognizeSign(sample.strokes, sample.area, 'relation'),
      );
    }
  });
});

describe('#191 AC3: ostatní zápisy se u „a ☐ b“ nerozpoznají a okénko vyzve psát znovu', () => {
  it('prázdný zápis, ťuknutí, samotná vodorovná ani svislá čára nejsou < = >', () => {
    expect(recognizeSign([], SIGN_AREA, 'relation')).toBeNull();
    expect(recognizeSign([[{ x: 100, y: 100 }]], SIGN_AREA, 'relation')).toBeNull();
    expect(recognizeSign([straightMinus()], SIGN_AREA, 'relation')).toBeNull();
    expect(recognizeSign([straightVertical()], SIGN_AREA, 'relation')).toBeNull();
  });

  it('číslice, kruhy, čmáranice, ×, svislé čáry, L, V, T, + a − hra u „a ☐ b“ aspoň v 95 % případů nerozpozná', () => {
    for (const area of AREAS) {
      const samples = relationNegativeSamples(area);
      for (const shape of ['×', 'L', 'V', 'kruh', 'čmáranice', 'svislá čára', '7', '+', '−']) {
        expect(
          samples.some((sample) => sample.name.startsWith(shape)),
          `v sadě je ${shape}`,
        ).toBe(true);
      }
      const result = score(samples, null, 'relation');
      expect(
        result.share,
        `okénko ${area.width} px, rozpoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('číslice napsané lidmi (sada UCI) hra u „a ☐ b“ aspoň v 95 % případů jako znaménko nerozpozná', () => {
    const samples = uciNegativeSamples(SIGN_AREA);
    expect(samples.length).toBeGreaterThan(3000);
    const result = score(samples, null, 'relation');
    expect(
      result.share,
      `rozpoznané: ${result.missed.slice(0, 20).join(', ')}`,
    ).toBeGreaterThanOrEqual(MIN_SHARE);
  });
});

describe('#191 AC2: rozpozná se jen znaménko, které k příkladu patří', () => {
  it('u „a ☐ b“ se napsané + ani − nerozpozná', () => {
    for (const area of AREAS) {
      const samples = [...plusSamples(100, area), ...minusSamples(100, area)];
      const result = score(samples, null, 'relation');
      expect(
        result.share,
        `okénko ${area.width} px, rozpoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('u „a ☐ b = c“ se napsané <, > ani = nerozpozná', () => {
    for (const area of AREAS) {
      const samples = [
        ...beakSamples('<', 100, area),
        ...beakSamples('>', 100, area),
        ...equalsSamples(100, area),
      ];
      const result = score(samples, null, 'arithmetic');
      expect(
        result.share,
        `okénko ${area.width} px, rozpoznané: ${result.missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(MIN_SHARE);
    }
  });

  it('rovné <, > a = u „a ☐ b = c“ nejsou + ani −, rovné + a − u „a ☐ b“ nejsou < = >', () => {
    expect(recognizeSign([straightLess()], SIGN_AREA)).toBeNull();
    expect(recognizeSign([straightGreater()], SIGN_AREA)).toBeNull();
    expect(recognizeSign(straightEquals(), SIGN_AREA)).toBeNull();
    expect(recognizeSign([straightMinus(), straightVertical()], SIGN_AREA, 'relation')).toBeNull();
    expect(recognizeSign([straightMinus()], SIGN_AREA, 'relation')).toBeNull();
  });

  it('bez druhu příkladu se rozpoznává jako u „a ☐ b = c“ (+ a −)', () => {
    expect(recognizeSign([straightMinus()], SIGN_AREA)).toBe('−');
    expect(recognizeSign([straightMinus()], SIGN_AREA, 'arithmetic')).toBe('−');
  });
});
