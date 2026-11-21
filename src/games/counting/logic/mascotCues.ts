/**
 * Kdy panda v Počítání co dělá (#167). Čistý TypeScript bez Phaseru;
 * scéna jen předá, co se ve hře stalo, a pohyb pandě přehraje.
 *
 * - Správná odpověď: radost, desátá v řadě (plná řada) oslava místo radosti.
 * - Chybná odpověď: povzbuzení.
 * - Ťuknutí na tlačítko nápovědy: přemýšlí.
 * - Otevření hry: pozdrav, až je vidět herní obrazovka (po zavření
 *   průvodce nastavení). Když se do 2 s nestáhne, vynechá se.
 * - Po zavření karty s mapou je panda v klidu.
 *
 * Panda hru nikdy nezdržuje: nic tady na pandu nečeká, odpovídat jde hned.
 */

import { moveDurationMs } from '../../../shared/logic/mascot';
import type { MascotMove } from '../../../shared/logic/mascot';
import type { TapOutcome } from './answerRound';
import { STARS_PER_SET } from './stars';

/** Jak dlouho smí pozdrav čekat na stažení, než se vynechá (ms, AC5). */
export const GREETING_WAIT_MS = 2000;

/**
 * Pohyb po vyhodnocení odpovědi. `setCompleted` je `true`, když odpověď
 * zaplnila řadu hvězdiček (desátá správná, začíná oslava). Ignorovaná
 * odpověď (třeba během karty s mapou) pandou nepohne.
 */
export function moveForAnswer(outcome: TapOutcome, setCompleted: boolean): MascotMove | null {
  if (outcome === 'correct') {
    return setCompleted ? 'celebrate' : 'joy';
  }
  return outcome === 'wrong' ? 'encourage' : null;
}

/** Pohyb po ťuknutí na tlačítko nápovědy; `shown` je `false`, když se nápověda neukázala. */
export function moveForHintButton(shown: boolean): MascotMove | null {
  return shown ? 'think' : null;
}

/**
 * Pohyby, které mají být stažené dopředu, aby se přehrály hned (bez
 * trhnutí při prvním použití). Najednou jich smí být v paměti jen pár
 * (#166), proto jen ty, které můžou přijít: radost a povzbuzení vždy,
 * po pozdravu přemýšlení, nebo místo něj oslava, když další správná
 * odpověď zaplní řadu.
 */
export function movesToPrepare(starCount: number, greetingDone: boolean): MascotMove[] {
  const moves: MascotMove[] = ['joy', 'encourage'];
  if (greetingDone) {
    moves.push(starCount >= STARS_PER_SET - 1 ? 'celebrate' : 'think');
  }
  return moves;
}

/** Pozdrav: ještě nezačal, čeká na stažení, panda mává, nebo je hotový (i vynechaný). */
export type GreetingPhase = 'notYet' | 'waiting' | 'waving' | 'done';

export interface GreetingState {
  readonly phase: GreetingPhase;
  /** Od kdy fáze trvá (ms). */
  readonly since: number;
}

export const GREETING_NOT_YET: GreetingState = { phase: 'notYet', since: 0 };

/** Herní obrazovka je vidět: pozdrav začne čekat na stažení (jen poprvé). */
export function greetingRequested(state: GreetingState, now: number): GreetingState {
  return state.phase === 'notYet' ? { phase: 'waiting', since: now } : state;
}

/** Panda už reagovala na hru: pozdrav by ji přerušil, vynechá se. */
export function greetingInterrupted(state: GreetingState, now: number): GreetingState {
  return state.phase === 'done' ? state : { phase: 'done', since: now };
}

export interface GreetingStep {
  readonly state: GreetingState;
  /** Má se teď pozdrav přehrát? */
  readonly play: boolean;
}

/**
 * Posun času: stažený pozdrav se do 2 s od ukázání obrazovky přehraje,
 * pozdě stažený se vynechá. Po dohrání je pozdrav hotový.
 */
export function greetingStep(state: GreetingState, now: number, waveReady: boolean): GreetingStep {
  if (state.phase === 'waiting') {
    if (now - state.since > GREETING_WAIT_MS) {
      return { state: { phase: 'done', since: now }, play: false };
    }
    if (waveReady) {
      return { state: { phase: 'waving', since: now }, play: true };
    }
  }
  if (state.phase === 'waving' && now - state.since >= moveDurationMs()) {
    return { state: { phase: 'done', since: now }, play: false };
  }
  return { state, play: false };
}

/** Je pozdrav za námi (dohraný nebo vynechaný)? */
export function isGreetingDone(state: GreetingState): boolean {
  return state.phase === 'done';
}
