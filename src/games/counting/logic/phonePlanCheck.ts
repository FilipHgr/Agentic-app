/**
 * Kontrola hotového rozložení telefonu (V2, #54) v CSS px: nic se
 * nepřekrývá, nic nevyčnívá z volné plochy a roh s kolečkem zůstane volný.
 * Čistý TypeScript.
 */

import type { Region } from './phoneHint';
import { GEAR_CORNER_SIZE } from './phonePlan';
import type { ControlsPlacement, FreeSize, PhonePlan } from './phonePlan';
import type { Point } from './screenLayout';

const TOLERANCE = 0.01;

export function rectAround(center: Point, width: number, height: number): Region {
  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: center.y - height / 2,
    bottom: center.y + height / 2,
  };
}

/** Překrývají se (dotyk hranou se nepočítá)? */
export function overlaps(a: Region, b: Region): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function isInside(inner: Region, outer: Region): boolean {
  return (
    inner.left >= outer.left - TOLERANCE &&
    inner.right <= outer.right + TOLERANCE &&
    inner.top >= outer.top - TOLERANCE &&
    inner.bottom <= outer.bottom + TOLERANCE
  );
}

/** Obdélníky všech tlačítek a okének. */
function controlsRects(placement: ControlsPlacement): Region[] {
  const buttons = placement.writing
    ? [placement.writing.clear, placement.writing.confirm]
    : placement.answerButtons;
  const areas = placement.writing?.areas ?? [];
  return [
    ...buttons.map((slot) => rectAround(slot, slot.size, slot.size)),
    ...areas.map((area) => rectAround(area, area.width, area.height)),
  ];
}

/** Hvězdičky, příklad a ovládání. */
function fixedRects(plan: PhonePlan, controls: readonly Region[]): Region[] {
  return [
    ...plan.stars.map((star) => rectAround(star, plan.starSize, plan.starSize)),
    rectAround(plan.problem, plan.problemWidth, plan.problemHeight),
    ...controls,
  ];
}

function anyPairOverlaps(rects: readonly Region[]): boolean {
  return rects.some((first, i) => rects.slice(i + 1).some((second) => overlaps(first, second)));
}

function anyOverlapsBetween(first: readonly Region[], second: readonly Region[]): boolean {
  return first.some((a) => second.some((b) => overlaps(a, b)));
}

/** Nic se nepřekrývá, nic nevyčnívá z volné plochy a roh s kolečkem je volný. */
export function isValidPlan(plan: PhonePlan, free: FreeSize): boolean {
  const area: Region = { left: 0, top: 0, right: free.width, bottom: free.height };
  const corner: Region = {
    left: free.width - GEAR_CORNER_SIZE,
    right: free.width,
    top: 0,
    bottom: GEAR_CORNER_SIZE,
  };
  const controls = controlsRects(plan);
  const fixed = fixedRects(plan, controls);
  const dots = plan.hintDots.map((dot) => rectAround(dot, plan.hintDotSize, plan.hintDotSize));
  const hits = plan.hintDotsCountable
    ? plan.hintDots.map((dot) => rectAround(dot, plan.hintCell, plan.hintCell))
    : [];
  const all = [...fixed, ...dots, ...hits];

  return (
    all.every((rect) => isInside(rect, area) && !overlaps(rect, corner)) &&
    !anyPairOverlaps(fixed) &&
    !anyOverlapsBetween(dots, fixed) &&
    !anyOverlapsBetween(hits, controls)
  );
}
