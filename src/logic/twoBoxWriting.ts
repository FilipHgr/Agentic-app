/**
 * Odpověď psaná prstem do dvou okének (#42): vlevo desítky, vpravo jednotky.
 * Každé okénko je samostatné kolo psaní z `writingRound.ts` (rozpoznání po
 * 1 s, odmítnutí, blednutí); tady se jen skládá číslo a vyhodnocuje odpověď.
 * Při rozsahu 5 se píše jen do okénka jednotek. Čistý TypeScript bez Phaseru.
 */

import type { AnswerRound, TapOutcome } from './answerRound';
import type { Stroke, WritingAreaSize } from './digitRecognition';
import { isCorrectAnswer } from './problems';
import {
  RECOGNITION_DELAY_MS,
  clearWriting,
  createWritingRound,
  fadingStrokes,
  finishStroke,
  shownDigit,
  startStroke,
  updateWriting,
  writtenStrokes,
} from './writingRound';
import type { DigitRecognizer, WritingRound } from './writingRound';

/** Okénko desítek (vlevo) nebo jednotek (vpravo). */
export type WritingBox = 'tens' | 'ones';

export interface TwoBoxRound {
  readonly answer: AnswerRound;
  readonly tens: WritingRound;
  readonly ones: WritingRound;
  /** Okénko, ve kterém má dítě právě prst; `null`, když prst nikde není. */
  readonly activeBox: WritingBox | null;
}

export interface TwoBoxConfirmResult {
  readonly outcome: TapOutcome;
  readonly round: TwoBoxRound;
}

/** Nové kolo s oběma okénky prázdnými. `area` je velikost jednoho okénka. */
export function createTwoBoxRound(
  answer: AnswerRound,
  area: WritingAreaSize,
  recognize?: DigitRecognizer,
): TwoBoxRound {
  return {
    answer,
    tens: createWritingRound(answer, area, recognize),
    ones: createWritingRound(answer, area, recognize),
    activeBox: null,
  };
}

/** Prst se dotkl okénka `box`: jeho číslice zmizí, druhé okénko zůstane. */
export function startBoxStroke(round: TwoBoxRound, box: WritingBox, nowMs: number): TwoBoxRound {
  return { ...withBox(round, box, startStroke(round[box], nowMs)), activeBox: box };
}

/**
 * Prst se zvedl: tah patří okénku, ve kterém začal. Když druhé okénko mělo
 * být rozpoznané už během tahu (prst na ploše ho zdržel), počká 1 s od teď.
 */
export function finishBoxStroke(round: TwoBoxRound, stroke: Stroke, nowMs: number): TwoBoxRound {
  const box = round.activeBox;
  if (box === null) {
    return round;
  }
  const other = otherBox(box);
  const finished = withBox(round, box, finishStroke(round[box], stroke, nowMs));
  return { ...withBox(finished, other, postponeWaiting(round[other], nowMs)), activeBox: null };
}

/** Posune obě okénka v čase. Dokud je prst na kterémkoli okénku, nic se nerozpozná. */
export function updateBoxes(round: TwoBoxRound, nowMs: number): TwoBoxRound {
  return {
    ...round,
    tens: updateBox(round.tens, round.activeBox !== null, nowMs),
    ones: updateBox(round.ones, round.activeBox !== null, nowMs),
  };
}

/** Smazání vyprázdní obě okénka a zruší čekání. Není to chyba. */
export function clearBoxes(round: TwoBoxRound): TwoBoxRound {
  return {
    ...round,
    tens: clearWriting(round.tens),
    ones: clearWriting(round.ones),
    activeBox: null,
  };
}

/** Jde ťuknout na ✓? Aspoň jedna číslice, nic nečeká, prst nikde a příklad nevyřešený. */
export function canConfirmBoxes(round: TwoBoxRound): boolean {
  return (
    !round.answer.solved &&
    round.activeBox === null &&
    !isWaiting(round.tens) &&
    !isWaiting(round.ones) &&
    shownNumber(round) !== null
  );
}

/** Potvrzení ✓ se vyhodnotí jako na číselníku. Po chybě se obě okénka vyprázdní. */
export function confirmBoxes(round: TwoBoxRound): TwoBoxConfirmResult {
  const number = shownNumber(round);
  if (number === null || !canConfirmBoxes(round)) {
    return { outcome: 'ignored', round };
  }

  const answer = round.answer;
  if (isCorrectAnswer(answer.problem, number)) {
    return { outcome: 'correct', round: { ...round, answer: { ...answer, solved: true } } };
  }
  const counted = { ...round, answer: { ...answer, wrongAnswers: answer.wrongAnswers + 1 } };
  return { outcome: 'wrong', round: clearBoxes(counted) };
}

/**
 * Číslo složené z okének: „1“ a „5“ je 15, „0“ a „7“ je 7. Jediná
 * číslice v kterémkoli okénku je jednociferné číslo. Bez číslic `null`.
 */
export function shownNumber(round: TwoBoxRound): number | null {
  const tens = shownDigit(round.tens);
  const ones = shownDigit(round.ones);
  if (tens !== null && ones !== null) {
    return tens * 10 + ones;
  }
  return tens ?? ones;
}

/** Rozpoznaná číslice v okénku, nebo `null`. */
export function boxDigit(round: TwoBoxRound, box: WritingBox): number | null {
  return shownDigit(round[box]);
}

/** Tahy zápisu v okénku. */
export function boxStrokes(round: TwoBoxRound, box: WritingBox): readonly Stroke[] {
  return writtenStrokes(round[box]);
}

/** Odmítnutý zápis, který v okénku právě bledne. */
export function boxFadingStrokes(round: TwoBoxRound, box: WritingBox): readonly Stroke[] {
  return fadingStrokes(round[box]);
}

function otherBox(box: WritingBox): WritingBox {
  return box === 'tens' ? 'ones' : 'tens';
}

function withBox(round: TwoBoxRound, box: WritingBox, writing: WritingRound): TwoBoxRound {
  return box === 'tens' ? { ...round, tens: writing } : { ...round, ones: writing };
}

function isWaiting(writing: WritingRound): boolean {
  return writing.fingerDown || writing.waitingSinceMs !== null;
}

/** Okénko, které už mělo být rozpoznané, začne odpočítávat 1 s znovu od `nowMs`. */
function postponeWaiting(writing: WritingRound, nowMs: number): WritingRound {
  const waitingSince = writing.waitingSinceMs;
  if (waitingSince === null || waitingSince + RECOGNITION_DELAY_MS > nowMs) {
    return writing;
  }
  return { ...writing, waitingSinceMs: nowMs };
}

/**
 * Posune jedno okénko v čase. Když má dítě prst na kterémkoli okénku,
 * okénko se tváří, jako by mělo prst samo: nerozpozná se, ale odmítnutý
 * zápis v něm dál bledne.
 */
function updateBox(writing: WritingRound, fingerSomewhere: boolean, nowMs: number): WritingRound {
  if (!fingerSomewhere || writing.fingerDown) {
    return updateWriting(writing, nowMs);
  }
  return { ...updateWriting({ ...writing, fingerDown: true }, nowMs), fingerDown: false };
}
