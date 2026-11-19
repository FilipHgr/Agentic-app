/**
 * Mapa postupu v okně (#145, varianta V2): po oslavě se mapa ukáže jako
 * karta se zaoblenými rohy a bílým okrajem nad ztmavenou hrou. Tady je,
 * kam a jak velkou kartu v okně dát, plocha mapy v ní, obrázek prostředí
 * přes kartu a barva okrajů stránky kolem hry. Kreslí scéna.
 *
 * Karta zabere asi 75 % viditelné plochy hry (na šířku i na výšku), leží
 * mimo roh kolečka a domečku, výřez a lištu a je aspoň 8 px od okraje.
 * Když by v ní značka neměla 64 px (malé telefony), karta se zvětší, až
 * po celou volnou plochu pod rohy, nebo mezi nimi.
 * Čistý TypeScript bez Phaseru.
 */

import { homeButtonFor } from '../../../shared/logic/homeButton';
import type { PageBackdrop } from '../../../shared/logic/gameHost';
import { settingsGearFor } from '../../../shared/logic/settingsGear';
import { PAGE_BACKGROUND } from '../../../shared/logic/theme';
import { gameAreaFor, safeAreaOrNone } from '../../../shared/logic/viewportLayout';
import type { GameArea, Viewport } from '../../../shared/logic/viewportLayout';
import { MAP_PICTURE_SIZE, mapOrientationOf, mapPictureCover } from './mapPictures';
import type { MapOrientation, PictureRect } from './mapPictures';
import { progressMapMarkerSize } from './progressMapLayout';
import type { MapArea } from './progressMapLayout';
import { PROGRESS_MAP_CARD_STYLE } from './theme';

/** Karta s mapou: kde leží obrázek mapy a v jaké ploše se mapa rozloží. */
export interface ProgressMapCard {
  /** Plocha obrázku mapy v kartě (bez bílého okraje) v CSS px okna. */
  readonly rect: PictureRect;
  /**
   * Plocha mapy v kartě v herních jednotkách: stejná míra jako hra, levý
   * horní roh karty v CSS px okna, bez pásu kolečka (`insideCard`).
   */
  readonly area: MapArea;
}

/** Jaký díl viditelné plochy hry karta zabere na šířku i na výšku (varianta V2). */
const CARD_SHARE = 0.75;

/** Na kolik stejných kroků se dělí zvětšování karty od 75 % po celou volnou plochu. */
const CARD_GROWTH_STEPS = 25;

/** Nejmenší odstup karty i s okrajem od okraje viditelné plochy v CSS px (AC1). */
const CARD_EDGE_CSS = 8;

/** Odstup karty od plochy kolečka a domečku v CSS px (na telefonu na šířku roh 88 px). */
const CORNER_CLEARANCE_CSS = 16;

/** Nejmenší značka v kartě v CSS px (ťukací plocha z CLAUDE.md, AC2). */
const MIN_MARKER_CSS = 64;

/** Obdélník v CSS px okna podle hran. */
interface Edges {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Kde je vidět hra: volná plocha okna a zároveň herní plocha (plátno). */
function visibleEdges(viewport: Viewport, area: GameArea): Edges {
  const safe = safeAreaOrNone(viewport.safeArea);
  return {
    left: Math.max(safe.left, area.offsetX),
    right: Math.min(viewport.width - safe.right, area.offsetX + area.width * area.scale),
    top: Math.max(safe.top, area.offsetY),
    bottom: Math.min(viewport.height - safe.bottom, area.offsetY + area.height * area.scale),
  };
}

/** Rohy kolečka a domečku i s odstupem: kde končí domeček, kde začíná kolečko a jak jsou vysoko. */
function cornerEdges(viewport: Viewport): { homeRight: number; gearLeft: number; bottom: number } {
  const gear = settingsGearFor(viewport);
  const home = homeButtonFor(viewport);
  return {
    homeRight: home.left + home.hitSize + CORNER_CLEARANCE_CSS,
    gearLeft: viewport.width - gear.right - gear.hitSize - CORNER_CLEARANCE_CSS,
    bottom: Math.max(gear.top + gear.hitSize, home.top + home.hitSize) + CORNER_CLEARANCE_CSS,
  };
}

/**
 * Kam se karta i s okrajem smí dát: celá šířka pod rohy kolečka
 * a domečku, nebo celá výška mezi nimi. Vždy aspoň 8 px od okraje.
 */
function cardRegions(viewport: Viewport, visible: Edges): Edges[] {
  const corners = cornerEdges(viewport);
  const inner: Edges = {
    left: visible.left + CARD_EDGE_CSS,
    right: visible.right - CARD_EDGE_CSS,
    top: visible.top + CARD_EDGE_CSS,
    bottom: visible.bottom - CARD_EDGE_CSS,
  };
  const below: Edges = { ...inner, top: Math.max(inner.top, corners.bottom) };
  const between: Edges = {
    ...inner,
    left: Math.max(inner.left, corners.homeRight),
    right: Math.min(inner.right, corners.gearLeft),
  };
  return [below, between].filter((edges) => edges.right > edges.left && edges.bottom > edges.top);
}

/** Začátek úseku délky `length` se středem co nejblíž `center`, celý mezi `min` a `max`. */
function startNear(center: number, length: number, min: number, max: number): number {
  return Math.min(Math.max(center - length / 2, min), max - length);
}

/**
 * Karta i s okrajem velká `share` viditelné plochy, co nejblíž středu
 * viditelné plochy a celá v `region`, v celých CSS px (zaokrouhleno dovnitř).
 */
function drawnCardIn(region: Edges, visible: Edges, share: number): Edges {
  const width = Math.min((visible.right - visible.left) * share, region.right - region.left);
  const height = Math.min((visible.bottom - visible.top) * share, region.bottom - region.top);
  const left = startNear((visible.left + visible.right) / 2, width, region.left, region.right);
  const top = startNear((visible.top + visible.bottom) / 2, height, region.top, region.bottom);
  return {
    left: Math.ceil(left),
    right: Math.floor(left + width),
    top: Math.ceil(top),
    bottom: Math.floor(top + height),
  };
}

/** Karta z nakresleného obdélníku i s okrajem: obrázek mapy uvnitř a plocha mapy. */
function cardFromDrawn(drawn: Edges, gameArea: GameArea): ProgressMapCard {
  const border = PROGRESS_MAP_CARD_STYLE.borderCss;
  const rect: PictureRect = {
    left: drawn.left + border,
    top: drawn.top + border,
    width: Math.max(0, drawn.right - drawn.left - 2 * border),
    height: Math.max(0, drawn.bottom - drawn.top - 2 * border),
  };
  const area: MapArea = {
    mode: gameArea.mode,
    width: rect.width / gameArea.scale,
    height: rect.height / gameArea.scale,
    scale: gameArea.scale,
    offsetX: rect.left,
    offsetY: rect.top,
    insideCard: true,
  };
  return { rect, area };
}

function markerCss(card: ProgressMapCard): number {
  return progressMapMarkerSize(card.area) * card.area.scale;
}

/** Ze dvou karet ta s větší značkou (při shodě první). */
function largerMarker(first: ProgressMapCard, second: ProgressMapCard): ProgressMapCard {
  return markerCss(second) > markerCss(first) ? second : first;
}

/**
 * Kam dát kartu s mapou v okně `viewport` (AC1, AC2): asi 75 % viditelné
 * plochy pod rohem kolečka a domečku, nebo mezi nimi, podle toho, kde má
 * značka víc místa. Když by značka měla méně než 64 px, karta se zvětšuje,
 * dokud se značka nevejde, nejvýš po 8 px od okraje.
 */
export function layoutProgressMapCard(viewport: Viewport): ProgressMapCard {
  const gameArea = gameAreaFor(viewport);
  const visible = visibleEdges(viewport, gameArea);
  const regions = cardRegions(viewport, visible);
  if (regions.length === 0) {
    return cardFromDrawn(visible, gameArea);
  }
  let best: ProgressMapCard | null = null;
  for (let step = 0; step <= CARD_GROWTH_STEPS; step += 1) {
    const share = CARD_SHARE + ((1 - CARD_SHARE) * step) / CARD_GROWTH_STEPS;
    const cards = regions.map((region) =>
      cardFromDrawn(drawnCardIn(region, visible, share), gameArea),
    );
    best = cards.reduce(largerMarker);
    if (markerCss(best) >= MIN_MARKER_CSS) {
      return best;
    }
  }
  return best ?? cardFromDrawn(visible, gameArea);
}

/**
 * Obrázek prostředí přes celou kartu (AC2): orientace podle tvaru karty,
 * zachovaný poměr stran, na střed; co přečnívá, se ořízne. `rect` je
 * v CSS px od levého horního rohu karty.
 */
export function mapCardPictureCover(card: ProgressMapCard): {
  orientation: MapOrientation;
  rect: PictureRect;
} {
  const size = { width: card.rect.width, height: card.rect.height };
  const orientation = mapOrientationOf(size);
  return { orientation, rect: mapPictureCover(size, MAP_PICTURE_SIZE[orientation]) };
}

/** Barva `#RRGGBB` ztmavená černou s průhledností `alpha`. */
function dimmedColor(color: string, alpha: number): string {
  const channels = [1, 3, 5].map((start) =>
    Math.round(Number.parseInt(color.slice(start, start + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/**
 * Okraje stránky kolem plátna během karty (AC2): ztmavené pozadí hry
 * stejně jako hra pod kartou, žádný obrázek ani barva mapy.
 */
export function mapCardPageBackdrop(): PageBackdrop {
  return { color: dimmedColor(PAGE_BACKGROUND, PROGRESS_MAP_CARD_STYLE.dimAlpha) };
}
