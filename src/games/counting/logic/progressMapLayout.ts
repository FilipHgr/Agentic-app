/**
 * Rozmístění zástupné mapy postupu (#87 AC7, #133 AC7) v herních
 * jednotkách: start, 2 zastávky a cíl na cestě, a kde stojí značka hráče.
 * Cesta vede rovnými úseky od místa k místu po řadě. Na šířku jde vlnovkou
 * zleva doprava, na výšku klikatě zdola nahoru, takže se nikde nekříží.
 * Každá mapa má vlnovku jinak natočenou (začíná dole, nebo nahoře).
 * Mapa leží pod rohem kolečka a domečku a mimo výřez a lištu. Za cílem
 * (na šířku vpravo, na výšku nad ním) stojí symbol tématu (#134 AC2).
 * Místa a značka se měří i s okrajem a poskočením po dojití, aby se ani
 * nakreslené nepřekrývaly a nevyčnívaly (kontrola #133).
 * Čistý TypeScript bez Phaseru; vzhled kreslí scéna a dá se vyměnit bez
 * změny tohoto rozložení i logiky mapy.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_GOAL_CELEBRATION_SCALE } from './mapAnimation';
import { MAP_STEPS, MAP_THEMES } from './progressMap';
import type { MapThemeId } from './progressMap';
import { PROGRESS_MAP_SHAPE } from './theme';

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

/** Čtverec se středem `x`, `y` a stranou `size`. */
export interface MapSquare extends MapPoint {
  readonly size: number;
}

export interface ProgressMapLayout {
  /** Střed místa podle kroku: 0 start, 1 a 2 zastávky, `MAP_STEPS` cíl. */
  readonly places: readonly MapPoint[];
  /** Průměr místa na mapě. */
  readonly placeSize: number;
  /** Průměr značky hráče. */
  readonly markerSize: number;
  /** Symbol tématu u cíle (#134 AC2) na světlém kruhovém podkladu, `size` je průměr podkladu. */
  readonly goalSymbol: MapSquare;
  /**
   * Kam se vejde celý slavící cíl (#135 AC3): podklad zvětšený 1,3× i se
   * zlatou září a prstencem, se středem ve středu symbolu cíle.
   */
  readonly goalCelebration: MapSquare;
}

/** Kolikrát se zastávka, cíl a značka po dojití značky krátce zvětší. */
export const MAP_ARRIVAL_PULSE_SCALE = 1.15;

/** Kolikrát je nakreslená značka větší než její průměr: bílý okraj a poskočení. */
export const DRAWN_MARKER_SCALE =
  (1 + PROGRESS_MAP_SHAPE.markerBorderShare) * MAP_ARRIVAL_PULSE_SCALE;

/** Pás nahoře pro kolečko a domeček v CSS px (roh 88 px, iPad 12 + 76 px a stavový řádek). */
const CORNER_BAND_CSS = 100;

/** Odstup mapy od okrajů viditelné plochy v CSS px. */
const EDGE_MARGIN_CSS = 16;

/** Na výšku leží místa střídavě v levém a pravém sloupci. */
const PORTRAIT_COLUMNS = 2;

/** Největší značka v CSS px, aby mapa se 4 místy nevypadala přerostle. */
const MAX_MARKER_CSS = 150;

/** Značka zabere nejvýš tento díl místa mezi zastávkami, aby nezakryla sousední. */
const MARKER_SHARE = 0.75;

/** Místo je menší než značka, aby značka stojící na něm byla dobře vidět. */
const PLACE_TO_MARKER = 0.7;

/** Plocha mapy v herních jednotkách: levý horní roh, šířka a výška. */
export interface ContentBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Plocha pro mapu: bez pásu kolečka a domečku, výřezu, lišty a s odstupem
 * od okraje. Drží se jí i pohyby prostředí (#136).
 */
export function mapContentBox(area: GameArea): ContentBox {
  const covered = area.coveredEdges ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = EDGE_MARGIN_CSS / area.scale;
  const left = covered.left + margin;
  const top = covered.top + CORNER_BAND_CSS / area.scale;
  const right = area.width - covered.right - margin;
  const bottom = area.height - covered.bottom - margin;
  return { left, top, width: right - left, height: bottom - top };
}

/** Začíná cesta této mapy vlnou dolů (na výšku vlevo)? Mapy se střídají. */
function startsLow(theme: MapThemeId): boolean {
  return MAP_THEMES.indexOf(theme) % 2 === 0;
}

/** Míst na cestě (start, zastávky, cíl) a za nimi jedno místo pro symbol cíle. */
const PLACE_COUNT = MAP_STEPS + 1;
const SLOT_COUNT = PLACE_COUNT + 1;

/**
 * Střed symbolu cíle měřený v rozestupech míst od začátku řady (na výšku
 * v řadách odspodu): stojí v posledním, pátém místě za cílem, tedy
 * o půl rozestupu dál než poslední hrana míst.
 */
const GOAL_SYMBOL_SLOT = PLACE_COUNT + 0.5;

/**
 * Na šířku: všechna místa v jedné řadě zleva doprava, střídavě výš a níž,
 * symbol cíle vpravo vedle cíle ve stejné výšce.
 */
function wavyRow(content: ContentBox, maxMarker: number, theme: MapThemeId): ProgressMapLayout {
  const spacing = rowSpacing(content, maxMarker);
  const markerSize = rowMarkerSize(content, maxMarker, spacing);
  const amplitude = Math.min(
    (content.height - markerSize * DRAWN_MARKER_SCALE) / 2,
    markerSize * 0.8,
  );
  const middle = content.top + content.height / 2;
  const firstLow = startsLow(theme);
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const low = index % 2 === 0 ? firstLow : !firstLow;
    return {
      x: content.left + spacing * (index + 0.5),
      y: middle + (low ? amplitude : -amplitude),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x + spacing, y: goal.y });
}

function rowMarkerSize(content: ContentBox, maxMarker: number, spacing: number): number {
  return Math.min(spacing * MARKER_SHARE, content.height / 2 / DRAWN_MARKER_SCALE, maxMarker);
}

/**
 * Rozestup míst v řadě. Symbol cíle stojí o rozestup za cílem; když by se
 * slavící cíl (#135) za ním nevešel, řada se zhustí, aby se symbol nemusel
 * posunout až k cíli.
 */
function rowSpacing(content: ContentBox, maxMarker: number): number {
  const even = content.width / SLOT_COUNT;
  const half = goalCelebrationSize(goalBadgeSize(rowMarkerSize(content, maxMarker, even))) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.width) {
    return even;
  }
  return (content.width - half) / GOAL_SYMBOL_SLOT;
}

/** Na výšku: místa zdola nahoru, střídavě vlevo a vpravo, symbol cíle nad cílem. */
function zigzagUp(content: ContentBox, maxMarker: number, theme: MapThemeId): ProgressMapLayout {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const cellHeight = columnCellHeight(content, maxMarker);
  const markerSize = columnMarkerSize(cellWidth, cellHeight, maxMarker);
  const firstColumn = startsLow(theme) ? 0 : 1;
  const places = Array.from({ length: PLACE_COUNT }, (_, index) => {
    const column = index % 2 === 0 ? firstColumn : 1 - firstColumn;
    return {
      x: content.left + cellWidth * (column + 0.5),
      // Řady se počítají odspodu: start dole, cíl nahoře.
      y: content.top + content.height - cellHeight * (index + 0.5),
    };
  });
  const goal = lastPlace(places);
  return withGoal(content, places, markerSize, { x: goal.x, y: goal.y - cellHeight });
}

/**
 * Rozložení se symbolem cíle na místě `wanted`. Symbol se posune dovnitř
 * tak, aby se slavící cíl i se září vešel celý do plochy mapy (#135 AC3).
 */
function withGoal(
  content: ContentBox,
  places: readonly MapPoint[],
  markerSize: number,
  wanted: MapPoint,
): ProgressMapLayout {
  const size = goalBadgeSize(markerSize);
  const celebrationSize = goalCelebrationSize(size);
  const half = celebrationSize / 2;
  const center = {
    x: clampInto(wanted.x, content.left + half, content.left + content.width - half),
    y: clampInto(wanted.y, content.top + half, content.top + content.height - half),
  };
  return {
    places,
    placeSize: markerSize * PLACE_TO_MARKER,
    markerSize,
    goalSymbol: { ...center, size },
    goalCelebration: { ...center, size: celebrationSize },
  };
}

function columnMarkerSize(cellWidth: number, cellHeight: number, maxMarker: number): number {
  return Math.min(cellWidth * MARKER_SHARE, cellHeight * MARKER_SHARE, maxMarker);
}

/**
 * Výška řady na výšku. Symbol cíle stojí o řadu nad cílem; když by se
 * slavící cíl (#135) nad ním nevešel, řady se zhustí.
 */
function columnCellHeight(content: ContentBox, maxMarker: number): number {
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const even = content.height / SLOT_COUNT;
  const marker = columnMarkerSize(cellWidth, even, maxMarker);
  const half = goalCelebrationSize(goalBadgeSize(marker)) / 2;
  if (GOAL_SYMBOL_SLOT * even + half <= content.height) {
    return even;
  }
  return (content.height - half) / GOAL_SYMBOL_SLOT;
}

/** Průměr slavícího cíle i se září. */
function goalCelebrationSize(badgeSize: number): number {
  return badgeSize * MAP_GOAL_CELEBRATION_SCALE * (1 + PROGRESS_MAP_SHAPE.goalGlowShare);
}

/** `value` posunutá do rozmezí `min` až `max`; když se rozmezí nevejde, jeho střed. */
function clampInto(value: number, min: number, max: number): number {
  if (min > max) {
    return (min + max) / 2;
  }
  return Math.min(Math.max(value, min), max);
}

/** Průměr světlého podkladu symbolu cíle i s okrajem; symbol leží uvnitř. */
function goalBadgeSize(markerSize: number): number {
  return markerSize * PROGRESS_MAP_SHAPE.goalBadgeToMarker;
}

function lastPlace(places: readonly MapPoint[]): MapPoint {
  return places[places.length - 1] ?? { x: 0, y: 0 };
}

/** Rozložení mapy `theme`; orientace cesty se řídí tvarem herní plochy. */
export function layoutProgressMap(area: GameArea, theme: MapThemeId): ProgressMapLayout {
  const content = mapContentBox(area);
  const maxMarker = MAX_MARKER_CSS / area.scale;
  return area.width > area.height
    ? wavyRow(content, maxMarker, theme)
    : zigzagUp(content, maxMarker, theme);
}

/** Kde stojí značka na kroku `step` (mimo mapu se bere nejbližší konec). */
export function markerAt(layout: ProgressMapLayout, step: number): MapPoint {
  const last = layout.places.length - 1;
  const index = Math.min(Math.max(Math.round(step), 0), last);
  return layout.places[index] ?? { x: 0, y: 0 };
}
