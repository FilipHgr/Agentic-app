/**
 * Tečky nápovědy na telefonu (#54, rozložení V2). Tečky jsou po pěti
 * v řadě jako v #30, poslední řada skupinky smí být kratší. Skupinky jsou
 * vedle sebe, nebo pod sebou; když se nevejdou do jednoho místa, dostane
 * každá skupinka své místo. Každá tečka má čtvercovou buňku, takže se
 * tečky ani jejich plochy pro prst nepřekrývají. Čistý TypeScript.
 */

import type { HintDot } from './screenLayout';

/** Obdélník (v CSS px nebo v herních jednotkách, podle volajícího). */
export interface Region {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Strana buňky jedné tečky a mezera mezi skupinkami. */
export interface HintGrid {
  readonly cell: number;
  readonly groupGap: number;
}

export type GroupArrangement = 'sideBySide' | 'stacked';

export interface BlockSize {
  readonly width: number;
  readonly height: number;
}

/** Tečky po pěti v řadě (#30). */
export const DOTS_PER_ROW = 5;

/** Tolerance na zaokrouhlení při porovnání s velikostí místa. */
const FIT_TOLERANCE = 0.001;

/** Skupinky bez nul; nulová skupinka žádné tečky nemá. */
export function visibleGroups(groups: readonly number[]): number[] {
  return groups.filter((count) => count > 0);
}

function groupSize(count: number, grid: HintGrid): BlockSize {
  return {
    width: Math.min(count, DOTS_PER_ROW) * grid.cell,
    height: Math.ceil(count / DOTS_PER_ROW) * grid.cell,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Velikost všech skupinek vedle sebe, nebo pod sebou. */
export function hintBlockSize(
  groups: readonly number[],
  grid: HintGrid,
  arrangement: GroupArrangement,
): BlockSize {
  const sizes = groups.map((count) => groupSize(count, grid));
  const gaps = Math.max(0, sizes.length - 1) * grid.groupGap;
  if (arrangement === 'sideBySide') {
    return {
      width: sum(sizes.map((size) => size.width)) + gaps,
      height: Math.max(0, ...sizes.map((size) => size.height)),
    };
  }
  return {
    width: Math.max(0, ...sizes.map((size) => size.width)),
    height: sum(sizes.map((size) => size.height)) + gaps,
  };
}

/** Tečky jedné skupinky po řadách od levého horního rohu `left`, `top`. */
function placeGroup(
  count: number,
  group: number,
  left: number,
  top: number,
  grid: HintGrid,
): HintDot[] {
  // Celé px: sousední buňky se pak potkají přesně a nepřekryjí se ani o zaokrouhlení.
  const originX = Math.ceil(left);
  const originY = Math.ceil(top);
  return Array.from({ length: count }, (_, dot) => ({
    x: originX + (dot % DOTS_PER_ROW) * grid.cell + grid.cell / 2,
    y: originY + Math.floor(dot / DOTS_PER_ROW) * grid.cell + grid.cell / 2,
    group,
  }));
}

/** Tečky všech skupinek vedle sebe, nebo pod sebou, od levého horního rohu. */
export function placeHintBlock(
  groups: readonly number[],
  grid: HintGrid,
  arrangement: GroupArrangement,
  left: number,
  top: number,
): HintDot[] {
  const dots: HintDot[] = [];
  let cursorX = left;
  let cursorY = top;
  groups.forEach((count, group) => {
    dots.push(...placeGroup(count, group, cursorX, cursorY, grid));
    const size = groupSize(count, grid);
    if (arrangement === 'sideBySide') {
      cursorX += size.width + grid.groupGap;
    } else {
      cursorY += size.height + grid.groupGap;
    }
  });
  return dots;
}

function fitsIn(size: BlockSize, region: Region): boolean {
  return (
    size.width <= region.right - region.left + FIT_TOLERANCE &&
    size.height <= region.bottom - region.top + FIT_TOLERANCE
  );
}

/** Celý blok do prvního místa, kam se vejde; svisle uprostřed místa. */
function placeWholeBlock(
  groups: readonly number[],
  grid: HintGrid,
  regions: readonly Region[],
): HintDot[] | null {
  for (const region of regions) {
    for (const arrangement of ['sideBySide', 'stacked'] as const) {
      const size = hintBlockSize(groups, grid, arrangement);
      if (fitsIn(size, region)) {
        const top = region.top + (region.bottom - region.top - size.height) / 2;
        return placeHintBlock(groups, grid, arrangement, region.left, top);
      }
    }
  }
  return null;
}

/** Každá skupinka zvlášť do prvního místa, kde je pro ni ještě vedle předchozích místo. */
function placeGroupByGroup(
  groups: readonly number[],
  grid: HintGrid,
  regions: readonly Region[],
): HintDot[] | null {
  const cursors = regions.map((region) => region.left);
  const dots: HintDot[] = [];
  for (const [group, count] of groups.entries()) {
    const size = groupSize(count, grid);
    const index = regions.findIndex((region, i) =>
      fitsIn(size, { ...region, left: cursors[i] ?? region.left }),
    );
    const region = regions[index];
    const left = cursors[index];
    if (!region || left === undefined) {
      return null;
    }
    dots.push(...placeGroup(count, group, left, region.top, grid));
    cursors[index] = left + size.width + grid.groupGap;
  }
  return dots;
}

/**
 * Tečky do volných míst `regions` (v pořadí, jak jsou nejvhodnější).
 * Nejdřív všechny skupinky pohromadě, jinak každá zvlášť. `null`, když se
 * nevejdou.
 */
export function placeHintInRegions(
  groups: readonly number[],
  grid: HintGrid,
  regions: readonly Region[],
): HintDot[] | null {
  return placeWholeBlock(groups, grid, regions) ?? placeGroupByGroup(groups, grid, regions);
}
