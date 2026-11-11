/**
 * Rozmístění zástupné mapy postupu (#87 AC7, #133 AC7) v herních
 * jednotkách: start, 2 zastávky a cíl na cestě, a kde stojí značka hráče.
 * Cesta vede rovnými úseky od místa k místu po řadě. Na šířku jde vlnovkou
 * zleva doprava, na výšku klikatě zdola nahoru, takže se nikde nekříží.
 * Každá mapa má vlnovku jinak natočenou (začíná dole, nebo nahoře).
 * Mapa leží pod rohem kolečka a domečku a mimo výřez a lištu.
 * Čistý TypeScript bez Phaseru; vzhled kreslí scéna a dá se vyměnit bez
 * změny tohoto rozložení i logiky mapy.
 */

import type { GameArea } from '../../../shared/logic/viewportLayout';
import { MAP_STEPS, MAP_THEMES } from './progressMap';
import type { MapThemeId } from './progressMap';

export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProgressMapLayout {
  /** Střed místa podle kroku: 0 start, 1 a 2 zastávky, `MAP_STEPS` cíl. */
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

/** Na výšku leží místa střídavě v levém a pravém sloupci. */
const PORTRAIT_COLUMNS = 2;

/** Největší značka v CSS px, aby mapa se 4 místy nevypadala přerostle. */
const MAX_MARKER_CSS = 150;

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

/** Začíná cesta této mapy vlnou dolů (na výšku vlevo)? Mapy se střídají. */
function startsLow(theme: MapThemeId): boolean {
  return MAP_THEMES.indexOf(theme) % 2 === 0;
}

/** Na šířku: všechna místa v jedné řadě zleva doprava, střídavě výš a níž. */
function wavyRow(content: ContentBox, maxMarker: number, theme: MapThemeId): ProgressMapLayout {
  const count = MAP_STEPS + 1;
  const spacing = content.width / count;
  const markerSize = Math.min(spacing * MARKER_SHARE, content.height / 2, maxMarker);
  const amplitude = Math.min((content.height - markerSize) / 2, markerSize * 0.8);
  const middle = content.top + content.height / 2;
  const firstLow = startsLow(theme);
  const places = Array.from({ length: count }, (_, index) => {
    const low = index % 2 === 0 ? firstLow : !firstLow;
    return {
      x: content.left + spacing * (index + 0.5),
      y: middle + (low ? amplitude : -amplitude),
    };
  });
  return { places, placeSize: markerSize * PLACE_TO_MARKER, markerSize };
}

/** Na výšku: místa zdola nahoru, střídavě vlevo a vpravo. */
function zigzagUp(content: ContentBox, maxMarker: number, theme: MapThemeId): ProgressMapLayout {
  const count = MAP_STEPS + 1;
  const cellWidth = content.width / PORTRAIT_COLUMNS;
  const cellHeight = content.height / count;
  const markerSize = Math.min(cellWidth * MARKER_SHARE, cellHeight * MARKER_SHARE, maxMarker);
  const firstColumn = startsLow(theme) ? 0 : 1;
  const places = Array.from({ length: count }, (_, index) => {
    const column = index % 2 === 0 ? firstColumn : 1 - firstColumn;
    return {
      x: content.left + cellWidth * (column + 0.5),
      // Řady se počítají odspodu: start dole, cíl nahoře.
      y: content.top + content.height - cellHeight * (index + 0.5),
    };
  });
  return { places, placeSize: markerSize * PLACE_TO_MARKER, markerSize };
}

/** Rozložení mapy `theme`; orientace cesty se řídí tvarem herní plochy. */
export function layoutProgressMap(area: GameArea, theme: MapThemeId): ProgressMapLayout {
  const content = contentBoxOf(area);
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
