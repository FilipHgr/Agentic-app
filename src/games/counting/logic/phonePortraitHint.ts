/**
 * Nápověda na telefonu na výšku (#56, rozložení P2). Místo pro tečky je pod
 * příkladem vyhrazené vždy, i bez nápovědy, a stačí na nejvyšší nápovědu,
 * která v rozsahu a s druhem příkladů z nastavení může přijít (AC5). Po
 * ukázání nápovědy se tak nic neposune. Tečky jsou po pěti v řadě (#30),
 * skupinky vedle sebe, nebo pod sebou, když se vedle sebe nevejdou.
 * Čistý TypeScript.
 */

import { hintDotGroups } from './answerRound';
import { hintBlockSize, placeHintBlock, visibleGroups } from './phoneHint';
import type { GroupArrangement, HintGrid, Region } from './phoneHint';
import type { Problem } from './problems';
import type { HintDot } from './screenLayout';
import type { MaxNumber, OperationMode } from './settings';

/** Mezera mezi skupinkami teček v CSS px. */
export const HINT_GROUP_GAP = 8;

/** Rozsah a druh příkladů: podle nich se vyhradí místo pro nápovědu. */
export interface PortraitLayoutSettings {
  readonly maxNumber: MaxNumber;
  readonly operations: OperationMode;
}

/** Všechny příklady, které s nastavením mohou přijít. */
function possibleProblems(settings: PortraitLayoutSettings): Problem[] {
  const { maxNumber, operations } = settings;
  const problems: Problem[] = [];
  for (let first = 0; first <= maxNumber; first += 1) {
    for (let second = 0; second <= maxNumber; second += 1) {
      if (operations !== 'minus' && first + second <= maxNumber) {
        problems.push({ first, second, operation: 'plus', result: first + second });
      }
      if (operations !== 'plus' && second <= first) {
        problems.push({ first, second, operation: 'minus', result: first - second });
      }
    }
  }
  return problems;
}

/** Různé nápovědy (skupinky teček), které se s nastavením mohou ukázat. */
export function possibleHintGroups(settings: PortraitLayoutSettings): number[][] {
  const unique = new Map<string, number[]>();
  for (const problem of possibleProblems(settings)) {
    const groups = hintDotGroups(problem);
    if (groups.length > 0) {
      unique.set(groups.join('+'), groups);
    }
  }
  return [...unique.values()];
}

/** Skupinky vedle sebe, když se vejdou do šířky `width`, jinak pod sebou. */
function arrangementFor(
  groups: readonly number[],
  grid: HintGrid,
  width: number,
): GroupArrangement {
  return hintBlockSize(groups, grid, 'sideBySide').width <= width ? 'sideBySide' : 'stacked';
}

/** Kolik místa zabere nejvyšší a nejširší nápověda z `allGroups`. */
export interface ReservedHintSize {
  readonly height: number;
  readonly width: number;
}

/**
 * Místo pro nejvyšší nápovědu z `allGroups`, když je místo široké `width`.
 * Šířka je šířka nejširší nápovědy; větší než `width`, když se nevejde.
 */
export function reservedHintSize(
  allGroups: readonly (readonly number[])[],
  grid: HintGrid,
  width: number,
): ReservedHintSize {
  let height = 0;
  let widest = 0;
  for (const groups of allGroups) {
    const size = hintBlockSize(groups, grid, arrangementFor(groups, grid, width));
    height = Math.max(height, size.height);
    widest = Math.max(widest, size.width);
  }
  return { height, width: widest };
}

/**
 * Tečky nápovědy ve vyhrazeném místě `region`: nahoře a vodorovně uprostřed.
 * Funguje v CSS px i v herních jednotkách, podle `grid` a `region`.
 */
export function placePortraitHint(
  groups: readonly number[],
  grid: HintGrid,
  region: Region,
): HintDot[] {
  const visible = visibleGroups(groups);
  const regionWidth = region.right - region.left;
  const arrangement = arrangementFor(visible, grid, regionWidth);
  const size = hintBlockSize(visible, grid, arrangement);
  // Celé jednotky, aby blok po zaokrouhlení teček nahoru z místa nevyčníval.
  const left = region.left + Math.max(0, Math.floor((regionWidth - size.width) / 2));
  return placeHintBlock(visible, grid, arrangement, left, region.top);
}
