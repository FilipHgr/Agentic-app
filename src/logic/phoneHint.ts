/**
 * Rozmístění teček nápovědy na telefonu (#54). Na telefonu je pro
 * nápovědu jen obdélník vlevo od ovládání. Tečky jsou buď po pěti v řadě
 * jako v #30 (do 10), nebo se tvar každé skupinky (počet sloupců a řad)
 * volí zvlášť, aby se všechny skupinky vešly vedle sebe (do 5 a do 20).
 * Když to nejde, jsou skupinky pod sebou. Každá tečka má vlastní
 * čtvercovou buňku, takže se tečky ani jejich plochy pro prst nepřekrývají.
 * Čistý TypeScript bez Phaseru.
 */

import type { HintDot } from './screenLayout';

/** Obdélník v herních jednotkách. */
export interface Region {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Mřížka teček: strana buňky jedné tečky, mezera mezi skupinkami a nejvíc teček v řadě. */
export interface HintGrid {
  readonly cell: number;
  readonly groupGap: number;
  readonly maxColumns: number;
  /**
   * Každá řada skupinky má plných `maxColumns` teček a jen poslední smí
   * být kratší (po pěti jako v #30). Jinak se řady volí podle místa.
   */
  readonly fullRows: boolean;
}

interface GroupShape {
  readonly columns: number;
  readonly rows: number;
}

/** Skupinky vedle sebe (`stacked: false`), nebo pod sebou. */
interface Arrangement {
  readonly shapes: readonly GroupShape[];
  readonly stacked: boolean;
}

/** Tolerance na zaokrouhlení při porovnání s velikostí obdélníku. */
const FIT_TOLERANCE = 0.001;

function regionWidth(region: Region): number {
  return region.right - region.left;
}

function regionHeight(region: Region): number {
  return region.bottom - region.top;
}

/** Tvar skupinky, která se má vejít do `rows` řad (víc, když to sloupce nedovolí). */
function shapeForRows(count: number, rows: number, maxColumns: number): GroupShape {
  const columns = Math.max(1, Math.min(maxColumns, Math.ceil(count / rows)));
  return { columns, rows: Math.ceil(count / columns) };
}

/** Tvar skupinky s nejvýš `columns` tečkami v řadě. */
function shapeForColumns(count: number, columns: number): GroupShape {
  const used = Math.max(1, Math.min(count, columns));
  return { columns: used, rows: Math.ceil(count / used) };
}

function arrangementWidth(arrangement: Arrangement, grid: HintGrid): number {
  const widths = arrangement.shapes.map((shape) => shape.columns * grid.cell);
  if (arrangement.stacked) {
    return Math.max(...widths);
  }
  return sum(widths) + gapsBetween(widths.length, grid);
}

function arrangementHeight(arrangement: Arrangement, grid: HintGrid): number {
  const heights = arrangement.shapes.map((shape) => shape.rows * grid.cell);
  if (!arrangement.stacked) {
    return Math.max(...heights);
  }
  return sum(heights) + gapsBetween(heights.length, grid);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function gapsBetween(groupCount: number, grid: HintGrid): number {
  return (groupCount - 1) * grid.groupGap;
}

/** Po pěti v řadě: skupinky vedle sebe, a když se nevejdou, pod sebou. */
function fullRowOptions(groups: readonly number[], grid: HintGrid): Arrangement[] {
  const shapes = groups.map((count) => shapeForColumns(count, grid.maxColumns));
  return [
    { shapes, stacked: false },
    { shapes, stacked: true },
  ];
}

/**
 * Možnosti rozmístění od nejplošší: skupinky vedle sebe v 1, 2, 3… řadách,
 * nakonec skupinky pod sebou s tolika sloupci, kolik se vejde.
 */
function flexibleOptions(groups: readonly number[], region: Region, grid: HintGrid): Arrangement[] {
  const options: Arrangement[] = [];
  const mostRows = Math.max(...groups);
  for (let rows = 1; rows <= mostRows; rows += 1) {
    options.push({
      shapes: groups.map((count) => shapeForRows(count, rows, grid.maxColumns)),
      stacked: false,
    });
  }

  const columnsThatFit = Math.floor((regionWidth(region) + FIT_TOLERANCE) / grid.cell);
  const stackedColumns = Math.min(grid.maxColumns, columnsThatFit);
  options.push({
    shapes: groups.map((count) => shapeForColumns(count, stackedColumns)),
    stacked: true,
  });
  return options;
}

function fitsIn(arrangement: Arrangement, region: Region, grid: HintGrid): boolean {
  return (
    arrangementWidth(arrangement, grid) <= regionWidth(region) + FIT_TOLERANCE &&
    arrangementHeight(arrangement, grid) <= regionHeight(region) + FIT_TOLERANCE
  );
}

/** Tečky jedné skupinky po řadách zleva doprava od levého horního rohu `left`, `top`. */
function placeGroup(
  count: number,
  shape: GroupShape,
  group: number,
  corner: { left: number; top: number },
  cell: number,
): HintDot[] {
  return Array.from({ length: count }, (_, dot) => ({
    x: corner.left + (dot % shape.columns) * cell + cell / 2,
    y: corner.top + Math.floor(dot / shape.columns) * cell + cell / 2,
    group,
  }));
}

/** Tečky celého rozmístění, vycentrovaného v obdélníku. */
function placeArrangement(
  groups: readonly number[],
  arrangement: Arrangement,
  region: Region,
  grid: HintGrid,
): HintDot[] {
  const left = region.left + (regionWidth(region) - arrangementWidth(arrangement, grid)) / 2;
  const top = region.top + (regionHeight(region) - arrangementHeight(arrangement, grid)) / 2;
  const corner = { left, top };
  const dots: HintDot[] = [];

  groups.forEach((count, group) => {
    const shape = arrangement.shapes[group] ?? shapeForColumns(count, grid.maxColumns);
    dots.push(...placeGroup(count, shape, group, corner, grid.cell));
    if (arrangement.stacked) {
      corner.top += shape.rows * grid.cell + grid.groupGap;
    } else {
      corner.left += shape.columns * grid.cell + grid.groupGap;
    }
  });
  return dots;
}

/**
 * Tečky nápovědy pro skupinky `groups` (nulové skupinky se vynechají)
 * v obdélníku `region`. Vybere se nejplošší rozmístění, které se vejde;
 * kdyby se nevešlo žádné, použijí se skupinky pod sebou.
 */
export function arrangeHintDots(
  groups: readonly number[],
  region: Region,
  grid: HintGrid,
): HintDot[] {
  const visibleGroups = groups.filter((count) => count > 0);
  if (visibleGroups.length === 0) {
    return [];
  }
  const options = grid.fullRows
    ? fullRowOptions(visibleGroups, grid)
    : flexibleOptions(visibleGroups, region, grid);
  const chosen = options.find((option) => fitsIn(option, region, grid));
  const stackedFallback = options[options.length - 1];
  const arrangement = chosen ?? stackedFallback;
  if (!arrangement) {
    return [];
  }
  return placeArrangement(visibleGroups, arrangement, region, grid);
}
