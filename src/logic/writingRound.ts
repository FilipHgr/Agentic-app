/**
 * Kolo s odpovědí psanou prstem (#41): tahy, čekání na rozpoznání,
 * ukázaná číslice, potvrzení ✓ a odmítnutý zápis. Čas se předává jako
 * číslo v ms, takže logika nepotřebuje skutečné časovače. Čistý TypeScript.
 * Rozpoznávání se stahuje na pozadí (#58): dokud není, kolo má místo něj
 * `null`, zápis zůstane vidět a počká, ✓ nejde stisknout.
 */

import type { AnswerRound, TapOutcome } from './answerRound';
import type { Stroke, WritingAreaSize } from './digitRecognition';
import { isCorrectAnswer } from './problems';

/** Za jak dlouho po zvednutí prstu se ukáže rozpoznaná číslice. */
export const RECOGNITION_DELAY_MS = 1000;

/** Jak dlouho bledne odmítnutý zápis, než zmizí. */
export const REJECTED_FADE_MS = 400;

export type DigitRecognizer = (strokes: readonly Stroke[], area: WritingAreaSize) => number | null;

export interface WritingRound {
  readonly answer: AnswerRound;
  readonly area: WritingAreaSize;
  /** Stažené rozpoznávání; `null`, dokud se nestáhne (#58). */
  readonly recognize: DigitRecognizer | null;
  /** Dopsané tahy současného zápisu. */
  readonly strokes: readonly Stroke[];
  /** Dítě má prst na ploše. */
  readonly fingerDown: boolean;
  /** Kdy se naposledy zvedl prst a zápis čeká na rozpoznání; jinak `null`. */
  readonly waitingSinceMs: number | null;
  /** Rozpoznaná číslice, kterou jde potvrdit; jinak `null`. */
  readonly digit: number | null;
  /** Odmítnutý zápis, který právě bledne. */
  readonly fading: readonly Stroke[];
  /** Kdy začal blednout odmítnutý zápis. */
  readonly fadingSinceMs: number;
}

export interface ConfirmResult {
  readonly outcome: TapOutcome;
  readonly round: WritingRound;
}

/** Nové kolo s prázdnou plochou na psaní; `recognize` je `null`, dokud se nestáhne. */
export function createWritingRound(
  answer: AnswerRound,
  area: WritingAreaSize,
  recognize: DigitRecognizer | null,
): WritingRound {
  return {
    answer,
    area,
    recognize,
    strokes: [],
    fingerDown: false,
    waitingSinceMs: null,
    digit: null,
    fading: [],
    fadingSinceMs: 0,
  };
}

/** Rozpoznávání se stáhlo: čekající zápis se rozpozná při dalším posunu v čase. */
export function withRecognizer(round: WritingRound, recognize: DigitRecognizer): WritingRound {
  return { ...round, recognize };
}

/** Prst se dotkl plochy: dokud je dole, nic se nerozpoznává. */
export function startStroke(round: WritingRound, nowMs: number): WritingRound {
  return { ...dropFinishedFade(round, nowMs), fingerDown: true, digit: null };
}

/** Prst se zvedl: tah se přidá k zápisu a za 1 s se zápis rozpozná. */
export function finishStroke(round: WritingRound, stroke: Stroke, nowMs: number): WritingRound {
  return {
    ...round,
    strokes: [...round.strokes, stroke],
    fingerDown: false,
    waitingSinceMs: nowMs,
    digit: null,
  };
}

/**
 * Posune kolo v čase: rozpozná čekající zápis a nechá zmizet vybledlý.
 * Bez staženého rozpoznávání zápis čeká dál, bez časového limitu.
 */
export function updateWriting(round: WritingRound, nowMs: number): WritingRound {
  const current = dropFinishedFade(round, nowMs);
  if (current.recognize === null || !isRecognitionDue(current, nowMs)) {
    return current;
  }

  const digit = current.recognize(current.strokes, current.area);
  if (digit === null) {
    return {
      ...current,
      strokes: [],
      waitingSinceMs: null,
      fading: current.strokes,
      fadingSinceMs: nowMs,
    };
  }
  return { ...current, waitingSinceMs: null, digit };
}

function isRecognitionDue(round: WritingRound, nowMs: number): boolean {
  return (
    !round.fingerDown &&
    round.waitingSinceMs !== null &&
    nowMs - round.waitingSinceMs >= RECOGNITION_DELAY_MS
  );
}

function dropFinishedFade(round: WritingRound, nowMs: number): WritingRound {
  if (round.fading.length === 0 || nowMs - round.fadingSinceMs < REJECTED_FADE_MS) {
    return round;
  }
  return { ...round, fading: [] };
}

/** Smazání: zápis i číslice zmizí. Není to chyba. */
export function clearWriting(round: WritingRound): WritingRound {
  return { ...round, strokes: [], fingerDown: false, waitingSinceMs: null, digit: null };
}

/** Jde teď ťuknout na ✓? Jen s ukázanou číslicí a nevyřešeným příkladem. */
export function canConfirm(round: WritingRound): boolean {
  return round.digit !== null && !round.answer.solved;
}

/**
 * Potvrzení ✓ se vyhodnotí stejně jako ťuknutí na číselník. Po špatné
 * odpovědi se zápis smaže, aby dítě mohlo psát znovu.
 */
export function confirmWriting(round: WritingRound): ConfirmResult {
  if (round.digit === null || !canConfirm(round)) {
    return { outcome: 'ignored', round };
  }

  const answer = round.answer;
  if (isCorrectAnswer(answer.problem, round.digit)) {
    return { outcome: 'correct', round: { ...round, answer: { ...answer, solved: true } } };
  }

  return {
    outcome: 'wrong',
    round: clearWriting({ ...round, answer: { ...answer, wrongAnswers: answer.wrongAnswers + 1 } }),
  };
}

/** Rozpoznaná číslice, nebo `null`, když žádná není ukázaná. */
export function shownDigit(round: WritingRound): number | null {
  return round.digit;
}

/** Tahy současného zápisu. */
export function writtenStrokes(round: WritingRound): readonly Stroke[] {
  return round.strokes;
}

/** Odmítnutý zápis, který právě bledne. */
export function fadingStrokes(round: WritingRound): readonly Stroke[] {
  return round.fading;
}
