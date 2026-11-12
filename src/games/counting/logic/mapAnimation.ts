/**
 * Časová osa ukázání mapy postupu (#135): kde je značka, která místa
 * svítí a jak slaví cíl v čase od ukázání mapy. Značka jde po cestě
 * z minulého místa na nové, nové místo se rozsvítí, až na něm zastaví,
 * a v cíli se symbol zvětší, zazáří a přijdou konfety.
 * Vše plyne jen z času a kroku, ne z rozložení, takže po otočení zařízení
 * značka pokračuje ze stejného dílu cesty a dojde ve stejném čase (AC4).
 * Po melodii cíle se u cíle objeví půlka klíče (#139 AC2), a když tím
 * vznikne celý klíč, přiletí k ní druhá půlka a spojí se.
 * Čistý TypeScript bez Phaseru; kreslí scéna, zvuky pouští sezení.
 */

import type { KeyReward } from '../../../shared/logic/keyRewards';
import { SOUNDS, soundLengthSeconds } from './answerSounds';
import type { MapMove } from './progressMap';
import type { MapPoint, ProgressMapLayout } from './progressMapLayout';

/** Krátké zdržení, aby dítě vidělo značku na minulém místě, než vyrazí. */
export const MARKER_START_DELAY_MS = 300;

/** Jak dlouho značka jde z minulého místa na nové. */
export const MARKER_WALK_MS = 900;

/** Kdy značka stojí na novém místě, ms od ukázání mapy (AC1: nejpozději 1,5 s). */
export const MARKER_ARRIVAL_MS = MARKER_START_DELAY_MS + MARKER_WALK_MS;

/** Kolikrát se symbol cíle po dojití zvětší (upřesnění vzhledu z 2026-11-12). */
export const MAP_GOAL_CELEBRATION_SCALE = 1.3;

/** Jak dlouho se symbol cíle po dojití zvětšuje. */
export const GOAL_GROW_MS = 450;

/** Za jak dlouho po dojití do cíle přijdou konfety (symbol je skoro celý zvětšený). */
export const GOAL_CONFETTI_DELAY_MS = 300;

/** Jak cíl v jednom okamžiku slaví. */
export interface GoalCelebrationMoment {
  /** Zvětšení symbolu cíle (1 v klidu, nejvýš `MAP_GOAL_CELEBRATION_SCALE`). */
  readonly scale: number;
  /** Symbol cíle září. */
  readonly glowing: boolean;
  /** Konfety v cíli už letí. */
  readonly confetti: boolean;
}

const RESTING_GOAL: GoalCelebrationMoment = { scale: 1, glowing: false, confetti: false };

/** Plynulý rozjezd i zastavení: 0 → 0, 1 → 1, mezi tím neklesá. */
function easeInOut(progress: number): number {
  return (1 - Math.cos(Math.PI * progress)) / 2;
}

/** Plynulé zpomalení ke konci: 0 → 0, 1 → 1, mezi tím neklesá. */
function easeOut(progress: number): number {
  return Math.sin((Math.PI / 2) * progress);
}

function clampShare(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Jaký díl cesty z minulého na nové místo má značka za sebou v čase
 * `elapsedMs` od ukázání mapy: 0 na začátku, 1 od dojití, mezi tím neklesá.
 */
export function markerShareAt(elapsedMs: number): number {
  if (elapsedMs <= MARKER_START_DELAY_MS) {
    return 0;
  }
  if (elapsedMs >= MARKER_ARRIVAL_MS) {
    return 1;
  }
  return easeInOut(clampShare((elapsedMs - MARKER_START_DELAY_MS) / MARKER_WALK_MS));
}

/** Kde značka v čase `elapsedMs` stojí: na úseku cesty mezi minulým a novým místem. */
export function markerPointAt(
  layout: ProgressMapLayout,
  move: MapMove,
  elapsedMs: number,
): MapPoint {
  const from = layout.places[move.from] ?? { x: 0, y: 0 };
  const to = layout.places[move.to] ?? from;
  const share = markerShareAt(elapsedMs);
  if (share >= 1) {
    return to;
  }
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/**
 * Svítí místo `step`? Prošlá místa svítí celou dobu, nové místo až od
 * chvíle, kdy na něm značka zastaví, místa za ním nesvítí.
 */
export function isPlaceLitAt(move: MapMove, step: number, elapsedMs: number): boolean {
  if (step <= move.from) {
    return true;
  }
  if (step === move.to) {
    return markerShareAt(elapsedMs) >= 1;
  }
  return false;
}

/**
 * Jak cíl slaví v čase `elapsedMs`: až po dojití značky do cíle se symbol
 * plynule zvětší na 1,3× a zazáří, chvilku potom přijdou konfety. Na
 * zastávce a před dojitím cíl jen stojí.
 */
export function goalCelebrationAt(move: MapMove, elapsedMs: number): GoalCelebrationMoment {
  if (!move.reachedGoal || markerShareAt(elapsedMs) < 1) {
    return RESTING_GOAL;
  }
  const sinceArrival = elapsedMs - MARKER_ARRIVAL_MS;
  const grown = easeOut(clampShare(sinceArrival / GOAL_GROW_MS));
  return {
    scale: 1 + (MAP_GOAL_CELEBRATION_SCALE - 1) * grown,
    glowing: true,
    confetti: sinceArrival >= GOAL_CONFETTI_DELAY_MS,
  };
}

/**
 * Kdy se u cíle objeví půlka klíče a zazní její tón, ms od ukázání mapy
 * (#139 AC2): až dohraje melodie cíle, která začne, když značka dojde.
 */
export const KEY_REWARD_APPEAR_MS =
  MARKER_ARRIVAL_MS + Math.ceil(soundLengthSeconds(SOUNDS.mapGoal) * 1000);

/** Jak dlouho půlka klíče naskakuje (zvětšuje se z nuly). */
export const KEY_REWARD_POP_MS = 350;

/** Jak dlouho po objevení stojí půlky celého klíče od sebe, než se k sobě rozletí. */
export const KEY_JOIN_DELAY_MS = 450;

/** Jak dlouho se půlky celého klíče k sobě přibližují. */
export const KEY_JOIN_MS = 600;

/** Kdy jsou půlky celého klíče spojené, ms od ukázání mapy (dlouho před koncem 5 s cíle). */
export const KEY_JOINED_MS = KEY_REWARD_APPEAR_MS + KEY_JOIN_DELAY_MS + KEY_JOIN_MS;

/** Jak vypadá půlka klíče u cíle v jednom okamžiku. */
export interface KeyRewardMoment {
  /** Půlka klíče je u cíle vidět. */
  readonly visible: boolean;
  /** Obě půlky jsou spojené v celý klíč (jen když cíl klíč dokončil). */
  readonly joined: boolean;
  /** Jak velká už je naskakující půlka: 0 před objevením, 1 celá. */
  readonly popShare: number;
  /** Jak daleko od sebe jsou půlky: 1 od sebe, 0 spojené; u půlky bez druhé 0. */
  readonly separation: number;
}

/**
 * Půlka klíče u cíle v čase `elapsedMs` od ukázání mapy: objeví se po
 * melodii cíle a naskočí. U `'wholeKey'` se objeví obě půlky kousek od
 * sebe a pak se k sobě přiblíží a spojí. Všechno doběhne do konce 5 s cíle
 * a pak se nemění.
 */
export function keyRewardMomentAt(reward: KeyReward, elapsedMs: number): KeyRewardMoment {
  const sinceAppear = elapsedMs - KEY_REWARD_APPEAR_MS;
  if (sinceAppear < 0) {
    return {
      visible: false,
      joined: false,
      popShare: 0,
      separation: reward === 'wholeKey' ? 1 : 0,
    };
  }
  const popShare = easeOut(clampShare(sinceAppear / KEY_REWARD_POP_MS));
  if (reward === 'half') {
    return { visible: true, joined: false, popShare, separation: 0 };
  }
  const joinShare = clampShare((sinceAppear - KEY_JOIN_DELAY_MS) / KEY_JOIN_MS);
  return { visible: true, joined: joinShare >= 1, popShare, separation: 1 - easeInOut(joinShare) };
}
