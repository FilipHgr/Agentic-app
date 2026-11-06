import { describe, expect, it } from 'vitest';

import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { layoutPhonePortraitWritingScreen } from '../../../src/games/counting/logic/deviceLayout';
import type { PhonePortraitWritingLayout } from '../../../src/games/counting/logic/deviceLayout';
import { recognizeDigit } from '../../../src/games/counting/logic/digitRecognition';
import type { Stroke, WritingAreaSize } from '../../../src/games/counting/logic/digitRecognition';
import type { MaxNumber } from '../../../src/games/counting/logic/settings';
import { NOT_DIGITS } from './notDigitStrokes';
import { WRITING_AREA, placeStroke, uciTestSamples } from './penDigits';
import type { PenDigitSample } from './penDigits';
import {
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  viewportOf,
} from '../../shared/viewportFixtures';

/**
 * Testy k #56, AC6: rozpoznávání ve vysokém okénku na telefonu na výšku.
 *
 * „Dnes“ je čtvercové okénko stejně široké jako vysoké okénko. Zkušební
 * sada tahů (UCI, `penDigits.ts`) i pevná sada teček, čárek a čmáranic
 * (`notDigitStrokes.ts`) se zvětší stejným poměrem v obou osách, aby
 * zabraly stejnou část šířky okénka jako dnes, a ve vysokém okénku se
 * umístí svisle doprostřed. Každý zápis se musí rozpoznat jako stejná
 * číslice jako dnes, nebo stejně odmítnout.
 *
 * Celá sada se ověří na nejvyšším povoleném okénku (1,6× vyšší než široké),
 * na skutečných okénkách z rozložení na výšku jen každý 20. vzorek, aby
 * testy běžely rychle. Rozpoznávání závisí na okénku jen přes jeho
 * rozměry, ne přes polohu.
 */

/** Rozpoznání celé sady trvá déle než běžný test. */
const SLOW_TEST_TIMEOUT_MS = 60_000;

/** Nejvýš 1,6× vyšší než široké (AC6). */
const MAX_BOX_HEIGHT_RATIO = 1.6;

/** Nejmenší šířka okénka do 10 a do 20 (AC6). */
const NARROWEST_BOX = 160;

/** Na skutečných okénkách z rozložení stačí každý 20. vzorek sady. */
const SAMPLE_STEP = 20;

const RANGES: MaxNumber[] = [5, 10, 20];

/** Okénko dnes: čtverec stejně široký jako vysoké okénko. */
function todayBoxOf(box: WritingAreaSize): WritingAreaSize {
  return { width: box.width, height: box.width };
}

/** Zápis ze čtverce o šířce okénka posunutý svisle doprostřed vysokého okénka. */
function inTallBox(strokes: readonly Stroke[], box: WritingAreaSize): Stroke[] {
  const dy = (box.height - box.width) / 2;
  return strokes.map((stroke) => placeStroke(stroke, 1, 0, dy));
}

/** Zápis nakreslený v ploše 320 × 320 zvětšený na čtverec o šířce okénka. */
function scaledToWidth(strokes: readonly Stroke[], width: number): Stroke[] {
  const scale = width / WRITING_AREA.width;
  return strokes.map((stroke) => placeStroke(stroke, scale, 0, 0));
}

interface Difference {
  readonly index: number;
  readonly today: number | null;
  readonly tall: number | null;
}

/** Zápisy (nakreslené ve čtverci o šířce okénka), které se ve vysokém okénku rozpoznají jinak. */
function differences(
  attempts: ReadonlyArray<readonly Stroke[]>,
  box: WritingAreaSize,
): Difference[] {
  const found: Difference[] = [];
  attempts.forEach((strokes, index) => {
    const today = recognizeDigit(strokes, todayBoxOf(box));
    const tall = recognizeDigit(inTallBox(strokes, box), box);
    if (today !== tall) {
      found.push({ index, today, tall });
    }
  });
  return found;
}

/** Vzorky sady zvětšené do čtverce o šířce `width` (stejná část šířky jako dnes). */
function samplesForWidth(width: number, step = 1): Stroke[][] {
  return uciTestSamples({ width, height: width })
    .filter((_, index) => index % step === 0)
    .map((sample: PenDigitSample) => [sample.stroke]);
}

/** Vysoké okénko dané šířky s poměrem `ratio`. */
function tallBox(width: number, ratio: number): WritingAreaSize {
  return { width, height: width * ratio };
}

/** Okénka z rozložení na výšku (v herních jednotkách, jak je dostane rozpoznávání). */
function portraitBoxes(): WritingAreaSize[] {
  const unique = new Map<string, WritingAreaSize>();
  for (const window of [...PHONE_PORTRAIT_WINDOWS, ...PHONE_PORTRAIT_EDGE_WINDOWS]) {
    const area = gameAreaFor(viewportOf(window));
    for (const maxNumber of RANGES) {
      const layout: PhonePortraitWritingLayout = layoutPhonePortraitWritingScreen(area, {
        maxNumber,
        operations: 'mixed',
      });
      for (const box of layout.writingAreas) {
        unique.set(`${box.width}×${box.height}`, { width: box.width, height: box.height });
      }
    }
  }
  return [...unique.values()];
}

describe('AC6: ve vysokém okénku se zápis rozpozná stejně jako dnes', () => {
  it(
    'každý vzorek zkušební sady se v okénku 1,6× vyšším než širokém rozpozná stejně jako dnes',
    () => {
      const box = tallBox(NARROWEST_BOX, MAX_BOX_HEIGHT_RATIO);

      expect(differences(samplesForWidth(box.width), box).slice(0, 10)).toEqual([]);
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it.each([
    [NARROWEST_BOX, MAX_BOX_HEIGHT_RATIO],
    [200, MAX_BOX_HEIGHT_RATIO],
    [200, 1.25],
  ])(
    'tečky, krátké čárky a čmáranice se v okénku %i px s poměrem %f odmítnou nebo rozpoznají stejně jako dnes',
    (width, ratio) => {
      const box = tallBox(width, ratio);
      const attempts = NOT_DIGITS.map((strokes) => scaledToWidth(strokes, box.width));

      expect(differences(attempts, box)).toEqual([]);
    },
  );

  it(
    'na skutečných okénkách z rozložení na výšku se vzorky sady, tečky, čárky i čmáranice rozpoznají stejně jako dnes',
    () => {
      const boxes = portraitBoxes();
      expect(boxes.length).toBeGreaterThan(0);

      for (const box of boxes) {
        const where = `okénko ${box.width} × ${box.height}`;
        const samples = samplesForWidth(box.width, SAMPLE_STEP);
        const notDigits = NOT_DIGITS.map((strokes) => scaledToWidth(strokes, box.width));

        expect(differences(samples, box).slice(0, 10), where).toEqual([]);
        expect(differences(notDigits, box), where).toEqual([]);
      }
    },
    SLOW_TEST_TIMEOUT_MS,
  );

  it.each([0.15, 0.3, 0.6])(
    'číslice napsaná menší (%f šířky okénka) se ve vysokém okénku rozpozná stejně jako dnes',
    (share) => {
      const box = tallBox(NARROWEST_BOX, MAX_BOX_HEIGHT_RATIO);
      const size = box.width * share;
      const offset = (box.width - size) / 2;
      const small = uciTestSamples({ width: size, height: size })
        .filter((_, index) => index % SAMPLE_STEP === 0)
        .map((sample) => [placeStroke(sample.stroke, 1, offset, offset)]);

      expect(differences(small, box).slice(0, 10)).toEqual([]);
    },
  );
});
