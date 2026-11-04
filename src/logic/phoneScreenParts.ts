/**
 * Převod rozložení telefonu (na šířku #54 i na výšku #56) z CSS px na
 * herní jednotky. Na telefonu jsou 2 herní jednotky na 1 CSS px, aby byla
 * hra ostrá i na Retina displeji. Čistý TypeScript.
 */

import type { DeviceSizes, GameSize } from './deviceLayout';
import { DOTS_PER_ROW } from './phoneHint';
import type { Region } from './phoneHint';
import type { PhonePlan, PhonePlanRequest } from './phonePlan';
import { MASCOT_DANCE_SWAY, MASCOT_JUMP_HEIGHT, MASCOT_SIZE } from './screenLayout';
import type {
  ButtonSlot,
  HintDot,
  HintStyle,
  Point,
  ScreenLayout,
  WritingAreaSlot,
} from './screenLayout';

/** Herní jednotky na 1 CSS px na telefonu. */
export const PHONE_UNITS_PER_CSS_PX = 2;

/** Číslo ve spočítané tečce jako část průměru tečky. */
const DOT_NUMBER_RATIO = 0.6;

export function units(cssPx: number): number {
  return cssPx * PHONE_UNITS_PER_CSS_PX;
}

export function cssSizeOf(area: GameSize): GameSize {
  return {
    width: area.width / PHONE_UNITS_PER_CSS_PX,
    height: area.height / PHONE_UNITS_PER_CSS_PX,
  };
}

function pointInUnits(point: Point): Point {
  return { x: units(point.x), y: units(point.y) };
}

export function dotInUnits(dot: HintDot): HintDot {
  return { ...pointInUnits(dot), group: dot.group };
}

export function slotInUnits(slot: ButtonSlot): ButtonSlot {
  return { x: units(slot.x), y: units(slot.y), size: units(slot.size) };
}

export function areaInUnits(area: WritingAreaSlot): WritingAreaSlot {
  return {
    x: units(area.x),
    y: units(area.y),
    width: units(area.width),
    height: units(area.height),
  };
}

export function regionInUnits(region: Region): Region {
  return {
    left: units(region.left),
    top: units(region.top),
    right: units(region.right),
    bottom: units(region.bottom),
  };
}

/** Vzhled teček pro scénu; na telefonu jsou vždy po pěti v řadě. */
function hintStyleOf(plan: PhonePlan): HintStyle {
  return {
    dotSize: units(plan.hintDotSize),
    spacing: units(plan.hintCell),
    dotsPerRow: DOTS_PER_ROW,
    fiveGap: 0,
    groupGap: 0,
  };
}

export interface PhoneParts extends DeviceSizes {
  readonly device: 'phone';
  /** Tečky nápovědy pro skupinky, se kterými se rozložení počítalo. */
  readonly hintDots: readonly HintDot[];
  /** Zadání rozložení v CSS px, aby šla nápověda spočítat i pro jiné skupinky. */
  readonly request: PhonePlanRequest;
}

/** Společné části rozložení telefonu v herních jednotkách. */
export function phoneParts(
  plan: PhonePlan,
  request: PhonePlanRequest,
): Omit<ScreenLayout, 'answerButtons'> & PhoneParts {
  return {
    device: 'phone',
    request,
    problem: pointInUnits(plan.problem),
    problemFontSize: units(plan.problemFontSize),
    problemSize: { width: units(plan.problemWidth), height: units(plan.problemHeight) },
    hintStyle: hintStyleOf(plan),
    stars: plan.stars.map(pointInUnits),
    mascot: pointInUnits(plan.mascot),
    starSize: units(plan.starSize),
    mascotSize: units(plan.mascotSize),
    mascotJumpHeight: (units(plan.mascotSize) * MASCOT_JUMP_HEIGHT) / MASCOT_SIZE,
    mascotDanceSway: (units(plan.mascotSize) * MASCOT_DANCE_SWAY) / MASCOT_SIZE,
    hintDotHitSize: units(plan.hintCell),
    hintDotsCountable: plan.hintDotsCountable,
    dotNumberFontSize: units(Math.round(plan.hintDotSize * DOT_NUMBER_RATIO)),
    detailScale: PHONE_UNITS_PER_CSS_PX,
    hintDots: plan.hintDots.map(dotInUnits),
  };
}
