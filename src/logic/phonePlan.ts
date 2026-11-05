/**
 * Společné typy a rozměry rozložení telefonu na šířku (V2, #54), v CSS px
 * volné plochy (bez výřezu a lišty, levý horní roh je 0, 0). Čistý TypeScript.
 */

import type { ButtonSlot, HintDot, Point, WritingAreaSlot } from './screenLayout';
import type { MaxNumber } from './settings';
import { STARS_PER_SET } from './stars';

export interface FreeSize {
  readonly width: number;
  readonly height: number;
}

export interface PhonePlanRequest {
  readonly free: FreeSize;
  readonly maxNumber: MaxNumber;
  readonly answerInput: 'keypad' | 'writing';
  readonly starCount: number;
  /** Skupinky teček nápovědy; prázdné = nápověda není vidět. */
  readonly hintGroups: readonly number[];
}

export interface WritingControls {
  readonly areas: readonly WritingAreaSlot[];
  readonly clear: ButtonSlot;
  readonly confirm: ButtonSlot;
}

/** Hotové rozložení v CSS px. */
export interface PhonePlan {
  readonly stars: readonly Point[];
  readonly starSize: number;
  readonly mascot: Point;
  readonly mascotSize: number;
  readonly problem: Point;
  readonly problemFontSize: number;
  readonly problemWidth: number;
  readonly problemHeight: number;
  readonly answerButtons: readonly ButtonSlot[];
  readonly writing: WritingControls | null;
  readonly hintDots: readonly HintDot[];
  readonly hintCell: number;
  readonly hintDotSize: number;
  /** Jde na tečky ťukat a počítat je (#43)? */
  readonly hintDotsCountable: boolean;
}

/** Číselník nebo okénka na psaní umístěné na obrazovce. */
export interface ControlsPlacement {
  readonly answerButtons: readonly ButtonSlot[];
  readonly writing: WritingControls | null;
}

export const EDGE_MARGIN = 8;
/** Pravý horní roh pro kolečko nastavení a odstup od něj. */
export const GEAR_CORNER_SIZE = 88;
export const GEAR_CORNER_GAP = 4;

export const STAR_SIZE = 24;
export const STAR_SPACING = 28;
/** Hvězdičky jsou těsně u horního okraje, aby se pod ně na nízkém okně vešlo okénko 180 px. */
export const STAR_ROW_TOP = 2;
export const STAR_ROW_BOTTOM = STAR_ROW_TOP + STAR_SIZE;
export const STAR_ROW_WIDTH = (STARS_PER_SET - 1) * STAR_SPACING + STAR_SIZE;

/** Nejmenší svislé mezery: pod hvězdičkami, nad ovládáním a pod ním. */
export const MIN_GAP_BELOW_STARS = 4;
export const MIN_GAP_ABOVE_CONTROLS = 6;
export const MIN_GAP_BOTTOM = 4;

export const MASCOT_PROBLEM_GAP = 8;
export const MASCOT_ABOVE_PROBLEM_GAP = 4;
export const PROBLEM_HINT_GAP = 12;
/** Odstup teček od okolí, když mají vlastní volné místo. */
export const HINT_REGION_GAP = 4;

export const MIN_MASCOT_SIZE = 64;
export const MIN_MASCOT_SIZE_WITH_HINT = 48;

export const FONT_SIZES = [72, 64, 56, 48, 44, 40, 36, 32];
export const MIN_FONT_SIZE = 32;
