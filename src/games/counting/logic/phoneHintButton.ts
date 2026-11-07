/**
 * Tlačítko nápovědy na telefonu (#84) v herních jednotkách. Tlačítko je
 * tam, kde se po ťuknutí ukážou tečky (otázka 2, varianta a): v rozložení
 * počítaném pro tytéž tečky dostane volné místo kolem nich a se středem co
 * nejblíž středu teček.
 *
 * - Na šířku (C, #68) je volné místo v pásu nahoře vpravo vedle příkladu,
 *   nebo pod ním, podle toho, kde jsou tečky; sahá až 8 px nad ovládání.
 * - Na výšku (P2, #56) je to vyhrazené místo pro nápovědu pod příkladem,
 *   které smí sahat až k příkladu a 8 px nad ovládání.
 * - Na šířku má místo pro tečky aspoň velikost tlačítka
 *   (`HINT_BUTTON_MIN_SIDE`, `phoneBandPlan.ts`).
 *
 * Čistý TypeScript.
 */

import type { PhoneScreenLayout, PhoneWritingLayout } from './deviceLayout';
import { problemRegion } from './phoneBandPlan';
import type { Region } from './phoneHint';
import { HINT_BUTTON_MIN_SIDE } from './phonePlan';
import { isPortraitLayout } from './phonePortraitLayout';
import { units } from './phoneScreenParts';
import type { ButtonSlot, HintDot } from './screenLayout';

/** Strana tlačítka, když je dost místa, v CSS px. */
const PREFERRED_SIZE = 72;

/** Mezera mezi tlačítkem a ovládáním v CSS px (AC7). */
const CONTROLS_GAP = 8;

/** Odstup tlačítka od příkladu, když jsou tečky pod ním, v CSS px (jako tečky, #68). */
const PROBLEM_BELOW_GAP = 6;

/** Odstup od horního okraje volné plochy v CSS px. */
const TOP_EDGE = 4;

type PhoneLayout = PhoneScreenLayout | PhoneWritingLayout;

function isWritingLayout(layout: PhoneLayout): layout is PhoneWritingLayout {
  return 'writingAreas' in layout;
}

/** Horní hrana ovládání: číselník, nebo okénka se smazáním a ✓. */
function controlsTop(layout: PhoneLayout): number {
  if (isWritingLayout(layout)) {
    const areaTops = layout.writingAreas.map((area) => area.y - area.height / 2);
    const buttonTops = [layout.clearButton, layout.confirmButton].map(
      (button) => button.y - button.size / 2,
    );
    return Math.min(...areaTops, ...buttonTops);
  }
  return Math.min(...layout.answerButtons.map((button) => button.y - button.size / 2));
}

/** Obdélník, který zabírají tečky i s plochami pro prst. */
function dotsBounds(dots: readonly HintDot[], cell: number): Region {
  const xs = dots.map((dot) => dot.x);
  const ys = dots.map((dot) => dot.y);
  return {
    left: Math.min(...xs) - cell / 2,
    right: Math.max(...xs) + cell / 2,
    top: Math.min(...ys) - cell / 2,
    bottom: Math.max(...ys) + cell / 2,
  };
}

/** Volné místo pro tlačítko na šířku: vpravo vedle příkladu, nebo pod ním (#68). */
function landscapeRegion(layout: PhoneLayout, dots: Region): Region {
  const band = problemRegion(layout.request.free);
  const problemRight = layout.problem.x + layout.problemSize.width / 2;
  const problemBottom = layout.problem.y + layout.problemSize.height / 2;
  const bottom = controlsTop(layout) - units(CONTROLS_GAP);
  if (dots.left >= problemRight) {
    // Místo vedle příkladu je široké jako tečky, nejméně jako tlačítko (`phoneBandPlan.ts`).
    return {
      left: dots.left,
      right: Math.max(dots.right, dots.left + units(HINT_BUTTON_MIN_SIDE)),
      top: units(TOP_EDGE),
      bottom,
    };
  }
  return {
    left: units(band.left),
    right: units(band.right),
    top: problemBottom + units(PROBLEM_BELOW_GAP),
    bottom,
  };
}

/**
 * Volné místo pro tlačítko na výšku: vyhrazené místo pro nápovědu, nahoře
 * až po příklad a dole až 8 px nad ovládání (do 5 s psaním je místo pro
 * jednu řadu teček nižší než tlačítko).
 */
function portraitRegion(layout: PhoneLayout, hintRegion: Region): Region {
  const problemBottom = layout.problem.y + layout.problemSize.height / 2;
  return {
    ...hintRegion,
    top: Math.min(hintRegion.top, problemBottom),
    bottom: controlsTop(layout) - units(CONTROLS_GAP),
  };
}

/** Číslo `value` posunuté do rozsahu `min` až `max`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Čtverec v místě `region` se středem co nejblíž `center`. */
function squareIn(region: Region, center: { x: number; y: number }): ButtonSlot {
  const size = Math.min(
    units(PREFERRED_SIZE),
    region.right - region.left,
    region.bottom - region.top,
  );
  const half = size / 2;
  return {
    x: clamp(center.x, region.left + half, region.right - half),
    y: clamp(center.y, region.top + half, region.bottom - half),
    size,
  };
}

/** Tlačítko nápovědy na telefonu pro tečky `dots` z téhož rozložení (aspoň jedna tečka). */
export function layoutPhoneHintButton(layout: PhoneLayout, dots: readonly HintDot[]): ButtonSlot {
  const bounds = dotsBounds(dots, layout.hintDotHitSize);
  const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  const region = isPortraitLayout(layout)
    ? portraitRegion(layout, layout.hintRegion)
    : landscapeRegion(layout, bounds);
  return squareIn(region, center);
}
