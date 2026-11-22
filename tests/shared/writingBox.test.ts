import { describe, expect, it } from 'vitest';

import { scaleStrokes } from '../../src/shared/logic/strokes';
import type { Stroke } from '../../src/shared/logic/strokes';
import {
  RECOGNITION_DELAY_MS,
  REJECTED_FADE_MS,
  canConfirmWritingBox,
  clearWritingBox,
  createWritingBox,
  INCOMPLETE_WAIT_MS,
  finishWritingStroke,
  isNewRejection,
  resizeWritingBox,
  startWritingStroke,
  updateWritingBox,
} from '../../src/shared/logic/writingBox';
import type { StrokeRecognizer } from '../../src/shared/logic/writingBox';

/**
 * Testy k #188 AC4: sdílené okénko na psaní, které používá každá hra
 * s odpovědí psanou prstem. Chová se jako okénko v Počítání: rozpoznání
 * 1 s po zvednutí prstu, nic během tahu, nerozpoznaný zápis bledne
 * 400 ms, smazání vše vyprázdní a po otočení zápis zůstane na místě.
 */

const AREA = { width: 200, height: 200 };
const LINE: Stroke = [
  { x: 50, y: 100 },
  { x: 150, y: 100 },
];

/** Rozpoznávání do testu: zápis s jedním tahem je „A“, jinak nic. */
const recognizeOneStroke: StrokeRecognizer<string> = (strokes) =>
  strokes.length === 1 ? 'A' : null;

function writtenLine() {
  const down = startWritingStroke(createWritingBox<string>(AREA), 0);
  return finishWritingStroke(down, LINE, 200);
}

describe('#188 AC4: okénko na psaní je pro všechny hry stejné jako v Počítání', () => {
  it('rozpoznání i blednutí trvají stejně jako v Počítání (1 s a 400 ms)', () => {
    expect(RECOGNITION_DELAY_MS).toBe(1000);
    expect(REJECTED_FADE_MS).toBe(400);
  });

  it('zápis se rozpozná až 1 s po zvednutí prstu a pak jde potvrdit', () => {
    const written = writtenLine();
    const early = updateWritingBox(written, 200 + RECOGNITION_DELAY_MS - 1, recognizeOneStroke);
    expect(early.value).toBeNull();
    expect(canConfirmWritingBox(early)).toBe(false);
    const due = updateWritingBox(written, 200 + RECOGNITION_DELAY_MS, recognizeOneStroke);
    expect(due.value).toBe('A');
    expect(canConfirmWritingBox(due)).toBe(true);
  });

  it('dokud je prst dole, nic se nerozpozná, a další dotyk rozpoznanou hodnotu schová', () => {
    const recognized = updateWritingBox(writtenLine(), 5000, recognizeOneStroke);
    const touched = startWritingStroke(recognized, 6000);
    expect(touched.value).toBeNull();
    expect(touched.strokes, 'zápis zůstane, dítě ho dopisuje').toHaveLength(1);
    expect(updateWritingBox(touched, 60000, recognizeOneStroke).value).toBeNull();
  });

  it('nerozpoznaný zápis začne blednout, okénko je prázdné a po 400 ms zmizí úplně', () => {
    const twoStrokes = finishWritingStroke(startWritingStroke(writtenLine(), 300), LINE, 400);
    const rejected = updateWritingBox(twoStrokes, 400 + RECOGNITION_DELAY_MS, recognizeOneStroke);
    expect(rejected.value).toBeNull();
    expect(rejected.strokes).toEqual([]);
    expect(rejected.fading).toHaveLength(2);
    const faded = updateWritingBox(
      rejected,
      rejected.fadingSinceMs + REJECTED_FADE_MS,
      recognizeOneStroke,
    );
    expect(faded.fading).toEqual([]);
  });

  it('smazání vyprázdní zápis i hodnotu a nic nečeká', () => {
    const cleared = clearWritingBox(updateWritingBox(writtenLine(), 5000, recognizeOneStroke));
    expect(cleared.strokes).toEqual([]);
    expect(cleared.value).toBeNull();
    expect(cleared.waitingSinceMs).toBeNull();
    expect(canConfirmWritingBox(cleared)).toBe(false);
  });

  it('po otočení zařízení zůstane zápis na stejném místě většího okénka', () => {
    const recognized = updateWritingBox(writtenLine(), 5000, recognizeOneStroke);
    const resized = resizeWritingBox(recognized, { width: 400, height: 300 });
    expect(resized.value).toBe('A');
    expect(resized.strokes).toEqual([
      [
        { x: 100, y: 150 },
        { x: 300, y: 150 },
      ],
    ]);
    expect(scaleStrokes([LINE], { width: 0, height: 0 }, AREA)).toEqual([LINE]);
  });
});

describe('#191: hra může nechat nedopsaný zápis čekat na další tah', () => {
  /** Rozpoznávání do testu: jen dva tahy jsou „=“. */
  const recognizeTwoStrokes: StrokeRecognizer<string> = (strokes) =>
    strokes.length === 2 ? '=' : null;
  const oneStrokeIsIncomplete = (strokes: readonly Stroke[]) => strokes.length === 1;

  it('nedopsaný zápis do 3 s od zvednutí prstu nevybledne a s dalším tahem se rozpozná', () => {
    const waiting = updateWritingBox(
      writtenLine(),
      200 + INCOMPLETE_WAIT_MS - 1,
      recognizeTwoStrokes,
      oneStrokeIsIncomplete,
    );
    expect(waiting.strokes).toEqual([LINE]);
    expect(waiting.fading).toEqual([]);
    expect(canConfirmWritingBox(waiting)).toBe(false);
    const second = finishWritingStroke(startWritingStroke(waiting, 4000), LINE, 4200);
    const recognized = updateWritingBox(
      second,
      4200 + RECOGNITION_DELAY_MS,
      recognizeTwoStrokes,
      oneStrokeIsIncomplete,
    );
    expect(recognized.value).toBe('=');
  });

  it('nedopsaný zápis po 3 s od zvednutí prstu vybledne jako každý nerozpoznaný', () => {
    const faded = updateWritingBox(
      writtenLine(),
      200 + INCOMPLETE_WAIT_MS,
      recognizeTwoStrokes,
      oneStrokeIsIncomplete,
    );
    expect(faded.strokes).toEqual([]);
    expect(faded.fading).toEqual([LINE]);
    expect(isNewRejection([], faded.fading), 'okénko vyzve psát znovu').toBe(true);
  });

  it('další tah před uplynutím 3 s čekání znovu odpočítá od nového zvednutí prstu', () => {
    const waiting = updateWritingBox(
      writtenLine(),
      2500,
      recognizeTwoStrokes,
      oneStrokeIsIncomplete,
    );
    const second = finishWritingStroke(startWritingStroke(waiting, 2800), LINE, 3000);
    const threeStrokesIncomplete = () => true;
    const later = updateWritingBox(
      second,
      3000 + INCOMPLETE_WAIT_MS - 1,
      () => null,
      threeStrokesIncomplete,
    );
    expect(later.strokes.length, 'zápis pořád čeká').toBe(2);
    expect(later.fading).toEqual([]);
  });

  it('bez předaného pravidla (jako v Počítání) nerozpoznaný zápis vybledne jako dřív', () => {
    const rejected = updateWritingBox(
      writtenLine(),
      200 + RECOGNITION_DELAY_MS,
      recognizeTwoStrokes,
    );
    expect(rejected.strokes).toEqual([]);
    expect(rejected.fading).toEqual([LINE]);
  });
});
