/**
 * Jedno okénko na psaní prstem (#188) obecně pro jakoukoli rozpoznanou
 * hodnotu (znaménko, číslice). Chová se jako okénko v Počítání (#41):
 * dokud je prst dole, nic se nerozpoznává; 1 s po zvednutí prstu se zápis
 * rozpozná. Rozpoznaná hodnota čeká na potvrzení ✓ a další tah ji zruší
 * (dítě ji přepíše, tah se přidá k zápisu). Nerozpoznaný zápis vybledne
 * a zmizí, nic se nepočítá jako chyba. Čas se předává jako číslo v ms,
 * takže logika nepotřebuje skutečné časovače. Čistý TypeScript bez Phaseru.
 */

import { scaleStrokes } from './strokes';
import type { Stroke, WritingAreaSize } from './strokes';

/** Za jak dlouho po zvednutí prstu se zápis rozpozná (stejně jako v Počítání). */
export const RECOGNITION_DELAY_MS = 1000;

/** Jak dlouho bledne nerozpoznaný zápis, než zmizí. */
export const REJECTED_FADE_MS = 400;

/**
 * Rozpoznaná hodnota ukázaná v okénku (Porovnávání ukáže znaménko) zabere
 * tuto část výšky okénka.
 */
export const WRITTEN_LABEL_HEIGHT_SHARE = 0.7;

/** Zaoblení rohu okénka na psaní v CSS px (na iPadu v Počítání herní jednotky). */
export const WRITING_AREA_CORNER_RADIUS = 28;

/** Rozpoznání zápisu: hodnota, nebo `null`, když zápis nic nepřipomíná. */
export type StrokeRecognizer<T> = (strokes: readonly Stroke[], area: WritingAreaSize) => T | null;

export interface WritingBoxState<T> {
  readonly area: WritingAreaSize;
  /** Dopsané tahy současného zápisu. */
  readonly strokes: readonly Stroke[];
  /** Dítě má prst na ploše. */
  readonly fingerDown: boolean;
  /** Kdy se naposledy zvedl prst a zápis čeká na rozpoznání; jinak `null`. */
  readonly waitingSinceMs: number | null;
  /** Rozpoznaná hodnota, kterou jde potvrdit; jinak `null`. */
  readonly value: T | null;
  /** Nerozpoznaný zápis, který právě bledne. */
  readonly fading: readonly Stroke[];
  /** Kdy začal blednout nerozpoznaný zápis. */
  readonly fadingSinceMs: number;
}

/** Prázdné okénko velikosti `area`. */
export function createWritingBox<T>(area: WritingAreaSize): WritingBoxState<T> {
  return {
    area,
    strokes: [],
    fingerDown: false,
    waitingSinceMs: null,
    value: null,
    fading: [],
    fadingSinceMs: 0,
  };
}

/** Prst se dotkl okénka: ukázaná hodnota zmizí, dokud je prst dole, nic se nerozpozná. */
export function startWritingStroke<T>(box: WritingBoxState<T>, nowMs: number): WritingBoxState<T> {
  return { ...dropFinishedFade(box, nowMs), fingerDown: true, value: null };
}

/** Prst se zvedl: tah se přidá k zápisu a za 1 s se zápis rozpozná. */
export function finishWritingStroke<T>(
  box: WritingBoxState<T>,
  stroke: Stroke,
  nowMs: number,
): WritingBoxState<T> {
  return {
    ...box,
    strokes: [...box.strokes, stroke],
    fingerDown: false,
    waitingSinceMs: nowMs,
    value: null,
  };
}

/**
 * Posune okénko v čase: rozpozná čekající zápis a nechá zmizet vybledlý.
 * Nerozpoznaný zápis začne blednout a okénko je zase prázdné.
 */
export function updateWritingBox<T>(
  box: WritingBoxState<T>,
  nowMs: number,
  recognize: StrokeRecognizer<T>,
): WritingBoxState<T> {
  const current = dropFinishedFade(box, nowMs);
  if (!isRecognitionDue(current, nowMs)) {
    return current;
  }
  const value = recognize(current.strokes, current.area);
  if (value === null) {
    return {
      ...current,
      strokes: [],
      waitingSinceMs: null,
      fading: current.strokes,
      fadingSinceMs: nowMs,
    };
  }
  return { ...current, waitingSinceMs: null, value };
}

/** Smazání: zápis i hodnota zmizí. Není to chyba. */
export function clearWritingBox<T>(box: WritingBoxState<T>): WritingBoxState<T> {
  return { ...box, strokes: [], fingerDown: false, waitingSinceMs: null, value: null };
}

/** Jde ťuknout na ✓? Jen s rozpoznanou hodnotou, prst nahoře a nic nečeká. */
export function canConfirmWritingBox<T>(box: WritingBoxState<T>): boolean {
  return box.value !== null && !box.fingerDown && box.waitingSinceMs === null;
}

/**
 * Okénko po otočení zařízení má jinou velikost: zápis se přepočte, aby
 * zůstal na stejném místě okénka, rozpoznaná hodnota zůstane.
 */
export function resizeWritingBox<T>(
  box: WritingBoxState<T>,
  area: WritingAreaSize,
): WritingBoxState<T> {
  return {
    ...box,
    area,
    strokes: scaleStrokes(box.strokes, box.area, area),
    fading: scaleStrokes(box.fading, box.area, area),
  };
}

/**
 * Začal v okénku blednout nový nerozpoznaný zápis? Zápis, který bledl už
 * před otočením zařízení (okénko vzniklo znovu se stejným stavem), nový
 * není, takže okénko nevyzve psát znovu podruhé.
 */
export function isNewRejection(before: readonly Stroke[], after: readonly Stroke[]): boolean {
  return after.length > 0 && after !== before;
}

function isRecognitionDue<T>(box: WritingBoxState<T>, nowMs: number): boolean {
  return (
    !box.fingerDown &&
    box.waitingSinceMs !== null &&
    nowMs - box.waitingSinceMs >= RECOGNITION_DELAY_MS
  );
}

function dropFinishedFade<T>(box: WritingBoxState<T>, nowMs: number): WritingBoxState<T> {
  if (box.fading.length === 0 || nowMs - box.fadingSinceMs < REJECTED_FADE_MS) {
    return box;
  }
  return { ...box, fading: [] };
}
