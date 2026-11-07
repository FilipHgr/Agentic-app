/**
 * Rozložení obrazovky Omalovánek (#88 AC1, AC4, AC6) v herních jednotkách:
 * plocha omalovánky v poměru obrázku 4 : 3 a vedle ní paleta 8 barev.
 * Na šířku je paleta vpravo ve dvou sloupcích po čtyřech, na výšku dole
 * ve dvou řadách po čtyřech (u palce). Nic neleží v rohu domečku vlevo
 * nahoře ani pod výřezem a lištou domů. Kolečko nastavení v Omalovánkách
 * není, jeho roh se nevyhrazuje. Zástupné rozložení, doladí se se vzhledem.
 * Čistý TypeScript bez Phaseru.
 */

import type { GameArea, SafeArea } from '../../../shared/logic/viewportLayout';
import { PALETTE } from './palette';

/** Obdélník v herních jednotkách. */
export interface LayoutRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface ColoringLayout {
  /** Plocha omalovánky. */
  readonly picture: LayoutRect;
  /** Ťukací plochy barev v pořadí palety. */
  readonly paletteColors: readonly LayoutRect[];
}

/** Poměr stran obrázku a vrstvy barev (1024 × 768). */
export const PICTURE_ASPECT = 4 / 3;

/** Roh domečku vlevo nahoře v CSS px: domeček 12 + 76 px, mezera 8 px a rezerva. */
const HOME_CORNER_CSS = 100;

/** Odstup od okrajů viditelné plochy v CSS px. */
const EDGE_MARGIN_CSS = 8;

/** Mezera mezi barvami a mezi paletou a omalovánkou v CSS px. */
const GAP_CSS = 12;

/** Menší mezera na nejnižších telefonech, aby barvy měly aspoň 64 px (pravidlo 8 px). */
const TIGHT_GAP_CSS = 8;

/** Ťukací plocha pro dětský prst v CSS px (CLAUDE.md). */
const MIN_COLOR_SIDE_CSS = 64;

/** Barva je nejvýš takhle velká, aby zbylo místo omalovánce. */
const MAX_COLOR_SIDE_CSS = 88;

/** Paleta má 2 × 4 barvy: na šířku 2 sloupce a 4 řady, na výšku obráceně. */
const PALETTE_LINES = 2;
const COLORS_PER_LINE = Math.ceil(PALETTE.length / PALETTE_LINES);

const NOTHING_COVERED: SafeArea = { top: 0, right: 0, bottom: 0, left: 0 };

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Herní jednotky na CSS px v této ploše. */
function unitsPerCss(area: GameArea): number {
  return 1 / area.scale;
}

/** Viditelná část herní plochy bez výřezu a lišty a s odstupem od okraje. */
function contentBoxOf(area: GameArea): Box {
  const covered = area.coveredEdges ?? NOTHING_COVERED;
  const margin = EDGE_MARGIN_CSS * unitsPerCss(area);
  return {
    left: covered.left + margin,
    top: covered.top + margin,
    right: area.width - covered.right - margin,
    bottom: area.height - covered.bottom - margin,
  };
}

/** Největší obdélník 4 : 3 na středu `box`; prázdný box dá prázdnou plochu. */
function fitPicture(box: Box): LayoutRect {
  const freeWidth = Math.max(0, box.right - box.left);
  const freeHeight = Math.max(0, box.bottom - box.top);
  const width = Math.min(freeWidth, freeHeight * PICTURE_ASPECT);
  const height = width / PICTURE_ASPECT;
  return {
    left: box.left + (freeWidth - width) / 2,
    top: box.top + (freeHeight - height) / 2,
    width,
    height,
  };
}

/**
 * Omalovánka v `box` mimo roh domečku `corner` (vlevo nahoře): buď vpravo
 * od rohu přes celou výšku, nebo pod rohem přes celou šířku, co je větší.
 */
function pictureBesideHome(box: Box, corner: Box): LayoutRect {
  const rightOfHome = fitPicture({ ...box, left: Math.max(box.left, corner.right) });
  const belowHome = fitPicture({ ...box, top: Math.max(box.top, corner.bottom) });
  return rightOfHome.width >= belowHome.width ? rightOfHome : belowHome;
}

interface ColorSizing {
  readonly side: number;
  readonly gap: number;
}

/** Strana barvy, když se jich do `space` vejde `count` za sebou s mezerou `gap`. */
function sideWithGap(space: number, count: number, gap: number): number {
  return (space - gap * (count - 1)) / count;
}

/**
 * Velikost barev v řadě délky `space`: běžná mezera, a když by barvy byly
 * menší než prst, menší mezera. Nikdy větší než maximum.
 */
function colorSizingFor(space: number, area: GameArea): ColorSizing {
  const units = unitsPerCss(area);
  const usualGap = GAP_CSS * units;
  const fitsWithUsualGap =
    sideWithGap(space, COLORS_PER_LINE, usualGap) >= MIN_COLOR_SIDE_CSS * units;
  const gap = fitsWithUsualGap ? usualGap : TIGHT_GAP_CSS * units;
  const side = Math.min(MAX_COLOR_SIDE_CSS * units, sideWithGap(space, COLORS_PER_LINE, gap));
  return { side, gap };
}

/** Barvy po řádcích mřížky `columns` × `rows` od levého horního rohu `left`, `top`. */
function colorGrid(
  left: number,
  top: number,
  side: number,
  gap: number,
  columns: number,
): LayoutRect[] {
  return PALETTE.map((_, index) => ({
    left: left + (index % columns) * (side + gap),
    top: top + Math.floor(index / columns) * (side + gap),
    width: side,
    height: side,
  }));
}

/** Na šířku: paleta vpravo, dva sloupce po čtyřech barvách, na středu výšky. */
function landscapeLayout(content: Box, corner: Box, area: GameArea): ColoringLayout {
  const { side, gap } = colorSizingFor(content.bottom - content.top, area);
  const paletteWidth = PALETTE_LINES * side + (PALETTE_LINES - 1) * gap;
  const paletteHeight = COLORS_PER_LINE * side + (COLORS_PER_LINE - 1) * gap;
  const paletteLeft = content.right - paletteWidth;
  const paletteTop = content.top + (content.bottom - content.top - paletteHeight) / 2;
  const picture = pictureBesideHome({ ...content, right: paletteLeft - gap }, corner);
  return {
    picture,
    paletteColors: colorGrid(paletteLeft, paletteTop, side, gap, PALETTE_LINES),
  };
}

/** Na výšku: paleta dole u palce, dvě řady po čtyřech barvách, na středu šířky. */
function portraitLayout(content: Box, corner: Box, area: GameArea): ColoringLayout {
  const { side, gap } = colorSizingFor(content.right - content.left, area);
  const paletteWidth = COLORS_PER_LINE * side + (COLORS_PER_LINE - 1) * gap;
  const paletteHeight = PALETTE_LINES * side + (PALETTE_LINES - 1) * gap;
  const paletteLeft = content.left + (content.right - content.left - paletteWidth) / 2;
  const paletteTop = content.bottom - paletteHeight;
  const picture = pictureBesideHome({ ...content, bottom: paletteTop - gap }, corner);
  return {
    picture,
    paletteColors: colorGrid(paletteLeft, paletteTop, side, gap, COLORS_PER_LINE),
  };
}

export function layoutColoring(area: GameArea): ColoringLayout {
  const content = contentBoxOf(area);
  const covered = area.coveredEdges ?? NOTHING_COVERED;
  const cornerSide = HOME_CORNER_CSS * unitsPerCss(area);
  const corner: Box = {
    left: covered.left,
    top: covered.top,
    right: covered.left + cornerSide,
    bottom: covered.top + cornerSide,
  };
  return area.width >= area.height
    ? landscapeLayout(content, corner, area)
    : portraitLayout(content, corner, area);
}
