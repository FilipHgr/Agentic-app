/**
 * Rozmístění zástupné mapy postupu (#87 AC7) v herních jednotkách: start,
 * 7 zastávek a cíl jako 8. zastávka na cestě, a kde stojí značka hráče.
 * Na šířku jde cesta vlnovkou zleva doprava, na výšku hadem ve třech řadách
 * po třech. Mapa leží pod rohem kolečka a domečku a mimo výřez a lištu.
 * Čistý TypeScript bez Phaseru; vzhled kreslí scéna a dá se vyměnit bez
 * změny tohoto rozložení i logiky mapy.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_STEPS } from './progressMap';

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProgressMapLayout {
  /** Střed místa podle kroku: 0 start, 1 až 7 zastávky, `MAP_STEPS` cíl. */
  readonly places: readonly MapPoint[];
  /** Průměr místa na mapě. */
  readonly placeSize: number;
  /** Průměr značky hráče. */
  readonly markerSize: number;
}

/** Pás nahoře pro kolečko a domeček v CSS px (roh 88 px, iPad 12 + 76 px a stavový řádek). */
const CORNER_BAND_CSS = 100;

/** Odstup mapy od okrajů viditelné plochy v CSS px. */
const EDGE_MARGIN_CSS = 16;

/** Na výšku: had ve třech řadách po třech místech. */
const PORTRAIT_COLUMNS = 3;

/** Značka zabere nejvýš tento díl místa mezi zastávkami, aby nezakryla sousední. */
const MARKER_SHARE = 0.75;

/** Místo je menší než značka, aby značka stojící na něm byla dobře vidět. */
const PLACE_TO_MARKER = 0.7;

interface ContentBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Plocha pro mapu: bez pásu kolečka a domečku, výřezu, lišty a s odstupem od okraje. */
function contentBoxOf(area: GameArea): ContentBox {
  const covered = area.coveredEdges ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const margin = EDGE_MARGIN_CSS / area.scale;
  const left = covered.left + margin;
  const top = covered.top + CORNER_BAND_CSS / area.scale;
  const right = area.width - covered.right - margin;
  const bottom = area.height - covered.bottom - margin;
  return { left, top, width: right - left, height: bottom - top };
}

/** Na šířku: všechna místa v jedné řadě, střídavě výš a níž jako vlnitá cesta. */
function wavyRow(content: ContentBox): ProgressMapLayout {
  const count = MAP_STEPS + 1;
  const spacing = content.width / count;
  const markerSize = Math.min(spacing * MARKER_SHARE, content.height / 2);
  const amplitude = Math.min((content.height - markerSize) / 2, markerSize * 0.6);
  const middle = content.top + content.height / 2;
  const places = Array.from({ length: count }, (_, index) => ({
    x: content.left + spacing * (index + 0.5),
    y: middle + (index % 2 === 0 ? amplitude : -amplitude),
  }));
  return { places, placeSize: markerSize * PLACE_TO_MARKER, markerSize };
}

/** Na výšku: had shora dolů, liché řady zprava doleva. */
function snake(content: ContentBox): ProgressMapLayout {
  const count = MAP_STEPS + 1;
  const rows = Math.ceil(count / PORTRAIT_COLUMNS);
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const cellHeight = content.height / rows;
  const markerSize = Math.min(cellWidth, cellHeight) * MARKER_SHARE;
  const places = Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / PORTRAIT_COLUMNS);
    const inRow = index % PORTRAIT_COLUMNS;
    const column = row % 2 === 0 ? inRow : PORTRAIT_COLUMNS - 1 - inRow;
    return {
      x: content.left + cellWidth * (column + 0.5),
      y: content.top + cellHeight * (row + 0.5),
    };
  });
  return { places, placeSize: markerSize * PLACE_TO_MARKER, markerSize };
}

export function layoutProgressMap(area: GameArea): ProgressMapLayout {
  const content = contentBoxOf(area);
  return content.width >= content.height ? wavyRow(content) : snake(content);
}

/** Kde stojí značka na kroku `step` (mimo mapu se bere nejbližší konec). */
export function markerAt(layout: ProgressMapLayout, step: number): MapPoint {
  const last = layout.places.length - 1;
  const index = Math.min(Math.max(Math.round(step), 0), last);
  return layout.places[index] ?? { x: 0, y: 0 };
}
