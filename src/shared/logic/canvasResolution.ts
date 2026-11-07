/**
 * Rozlišení plátna hry (#77), společné pro všechny hry. Čistý TypeScript
 * bez Phaseru.
 *
 * Herní plocha (`gameAreaFor`) se nemění. S plochou `fixed` má iPad
 * a zmenšené zobrazení dál 1024 × 768 herních jednotek na stejném místě
 * okna; plátno ale dostane pevně 2 obrazové body na každý zobrazený CSS px,
 * stejně jako telefon a menu, a kamera hry herní jednotky zvětší (`zoom`)
 * na obrazové body. Telefon zůstává přesně jako dřív: jednotka je obrazový
 * bod plátna. S plochou `fullWindow` (#96) má iPad jednotky jako telefon
 * (2 na CSS px), plátno má tedy velikost plochy a `zoom` vyjde 1.
 *
 * Hustota displeje (`devicePixelRatio`) se záměrně nepoužívá, hra se kreslí
 * všude stejně (mimo rozsah #77 je kreslení podle skutečné hustoty).
 */

import { isPhoneMode, PHONE_UNITS_PER_CSS_PX } from './viewportLayout';
import type { GameArea } from './viewportLayout';

/** Obrazové body plátna na 1 zobrazený CSS px, stejně jako na telefonu. */
export const CANVAS_PIXELS_PER_CSS_PX = PHONE_UNITS_PER_CSS_PX;

/** Nejmenší plátno: prohlížeč může na chvíli poslat nesmyslné okno. */
const MIN_CANVAS_PIXELS = 1;

/**
 * Plátno hry: velikost v obrazových bodech, zobrazená velikost a levý
 * horní roh v okně v CSS px a kolik obrazových bodů má jedna herní jednotka.
 */
export interface CanvasResolution {
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly zoom: number;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

/** CSS px na herní jednotku; nesmyslná hodnota se bere jako 0 (prázdné okno). */
function usableScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 0;
}

/** Nezáporné konečné číslo, jinak 0. */
function usableOffset(offset: number): number {
  return Number.isFinite(offset) && offset > 0 ? offset : 0;
}

/** Telefon jako dřív: plátno má velikost herní plochy, jednotka je obrazový bod. */
function phoneResolution(area: GameArea): CanvasResolution {
  return {
    pixelWidth: area.width,
    pixelHeight: area.height,
    cssWidth: area.width * area.scale,
    cssHeight: area.height * area.scale,
    offsetX: area.offsetX,
    offsetY: area.offsetY,
    zoom: 1,
  };
}

/** Celé obrazové body plátna pro délku v CSS px, zaokrouhleno dolů. */
function pixelsFor(cssLength: number): number {
  return Math.max(MIN_CANVAS_PIXELS, Math.floor(cssLength * CANVAS_PIXELS_PER_CSS_PX));
}

/**
 * iPad a zmenšené zobrazení: plátno má 2 obrazové body na CSS px. Velikost
 * se zaokrouhlí dolů na celé obrazové body (nejvýš o půl CSS px), aby hra
 * z okna nevyčnívala, a plátno zůstane na středu jako dřív.
 */
function sharpResolution(area: GameArea): CanvasResolution {
  const scale = usableScale(area.scale);
  const shownWidth = area.width * scale;
  const shownHeight = area.height * scale;
  const pixelWidth = pixelsFor(shownWidth);
  const pixelHeight = pixelsFor(shownHeight);
  const cssWidth = pixelWidth / CANVAS_PIXELS_PER_CSS_PX;
  const cssHeight = pixelHeight / CANVAS_PIXELS_PER_CSS_PX;
  // Celá herní plocha se vejde na plátno i po zaokrouhlení.
  const zoom = Math.min(pixelWidth / area.width, pixelHeight / area.height);
  // Ubraná část (nejvýš půl CSS px) se rozdělí na obě strany, plátno zůstane na středu.
  const offsetX = usableOffset(area.offsetX) + (shownWidth - cssWidth) / 2;
  const offsetY = usableOffset(area.offsetY) + (shownHeight - cssHeight) / 2;
  return {
    pixelWidth,
    pixelHeight,
    cssWidth,
    cssHeight,
    offsetX: Math.max(0, offsetX),
    offsetY: Math.max(0, offsetY),
    zoom,
  };
}

/** Jak velké plátno hra dostane a kam a jak velké se v okně zobrazí. */
export function canvasResolutionFor(area: GameArea): CanvasResolution {
  return isPhoneMode(area.mode) ? phoneResolution(area) : sharpResolution(area);
}

/** Bod na plátně (v obrazových bodech) v herních jednotkách. */
export function canvasToGamePoint(resolution: CanvasResolution, point: CanvasPoint): CanvasPoint {
  return { x: point.x / resolution.zoom, y: point.y / resolution.zoom };
}

/** Dotyk v okně (v CSS px) v herních jednotkách. */
export function windowToGamePoint(resolution: CanvasResolution, point: CanvasPoint): CanvasPoint {
  return canvasToGamePoint(resolution, {
    x: (point.x - resolution.offsetX) * (resolution.pixelWidth / resolution.cssWidth),
    y: (point.y - resolution.offsetY) * (resolution.pixelHeight / resolution.cssHeight),
  });
}
