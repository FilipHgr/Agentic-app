/**
 * Rozložení okna s pandou Rudym (#169 AC2) bez Phaseru: kam a jak velkou
 * kartu v okně dát a kde v ní stojí panda. Kreslí `src/shared/ui/rudyWindow.ts`.
 *
 * Okno vypadá jako karta mapy postupu v Počítání (#145): ztmavení 40 %,
 * karta se zaoblenými rohy, bílým okrajem 6 px a stínem. Styl je tady
 * zvlášť ve sdílené části, hra ho nesdílí (sdílená část nic z her nebere).
 *
 * Karta je čtverec se stranou 75 % menší strany okna. V malých oknech je
 * větší, aby panda měla aspoň 200 px výšky. Karta leží vždy celá
 * v bezpečné oblasti (mimo výřez, stavový řádek a lištu domů) a na plátně
 * hry, na středu té plochy. Panda je uprostřed karty, celá uvnitř okraje.
 * Míry jsou v CSS px okna.
 */

import type { PageBackdrop } from './gameHost';
import { RUDY_SHEET } from './rudy';
import { PAGE_BACKGROUND, WHITE } from './theme';
import { safeAreaOrNone } from './viewportLayout';
import type { GameArea, Viewport } from './viewportLayout';

/** Vzhled karty a ztmavení (jako karta mapy z #145). Míry v CSS px. */
export const RUDY_CARD_STYLE = {
  dimColor: '#000000',
  dimAlpha: 0.4,
  borderCss: 6,
  borderColor: WHITE,
  /** Plocha karty za pandou: světle modrá jako tlačítka s čísly, panda na ní vynikne. */
  fillColor: '#E5F0FF',
  cornerRadiusCss: 24,
  shadowColor: '#000000',
  /** Stín z několika vrstev: každá o `shadowSpreadCss` širší, s krytím `shadowLayerAlpha`. */
  shadowLayers: 6,
  shadowSpreadCss: 3,
  shadowLayerAlpha: 0.06,
  /** O kolik je stín posunutý dolů. */
  shadowOffsetCss: 8,
  /** Odstup pandy od bílého okraje karty. */
  paddingCss: 12,
} as const;

/** Jaký díl menší strany okna karta zabere. */
const CARD_SHARE = 0.75;

/** Nejmenší výška pandy (snímku) v CSS px. */
export const RUDY_MIN_HEIGHT_CSS = 200;

/** Obdélník v CSS px okna. */
export interface RudyRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Karta i s bílým okrajem a snímek pandy v ní. */
export interface RudyCardLayout {
  readonly card: RudyRect;
  readonly panda: RudyRect;
}

/** Kde jde kartu nakreslit: bezpečná oblast okna a zároveň plátno hry. */
function drawableRect(viewport: Viewport, area: GameArea): RudyRect {
  const safe = safeAreaOrNone(viewport.safeArea);
  const left = Math.max(safe.left, area.offsetX);
  const top = Math.max(safe.top, area.offsetY);
  const right = Math.min(viewport.width - safe.right, area.offsetX + area.width * area.scale);
  const bottom = Math.min(viewport.height - safe.bottom, area.offsetY + area.height * area.scale);
  // Celé CSS px dovnitř, aby karta po zaokrouhlení nepřečnívala.
  const whole = { left: Math.ceil(left), top: Math.ceil(top) };
  return {
    ...whole,
    width: Math.max(0, Math.floor(right) - whole.left),
    height: Math.max(0, Math.floor(bottom) - whole.top),
  };
}

/** Okraj a odstup karty kolem pandy na jedné straně. */
function cardFrameCss(): number {
  return RUDY_CARD_STYLE.borderCss + RUDY_CARD_STYLE.paddingCss;
}

/** Nejmenší strana karty, ve které má panda 200 px výšky. */
function smallestCardForPanda(): number {
  const scale = RUDY_MIN_HEIGHT_CSS / RUDY_SHEET.frameHeight;
  const longerSide = Math.max(RUDY_SHEET.frameWidth, RUDY_SHEET.frameHeight) * scale;
  return Math.ceil(longerSide) + 2 * cardFrameCss();
}

/** Snímek pandy co největší a na středu karty. */
function pandaIn(card: RudyRect): RudyRect {
  const inner = Math.max(0, card.width - 2 * cardFrameCss());
  const scale = Math.min(inner / RUDY_SHEET.frameWidth, inner / RUDY_SHEET.frameHeight);
  const width = RUDY_SHEET.frameWidth * scale;
  const height = RUDY_SHEET.frameHeight * scale;
  return {
    left: card.left + (card.width - width) / 2,
    top: card.top + (card.height - height) / 2,
    width,
    height,
  };
}

/**
 * Karta s pandou v okně `viewport` nad herní plochou `area` (AC2): strana
 * 75 % menší strany okna, v malých oknech větší kvůli 200 px pandy,
 * nejvýš tak velká, aby se celá vešla do bezpečné oblasti a na plátno.
 */
export function layoutRudyCard(viewport: Viewport, area: GameArea): RudyCardLayout {
  const drawable = drawableRect(viewport, area);
  const wanted = Math.max(
    Math.round(CARD_SHARE * Math.min(viewport.width, viewport.height)),
    smallestCardForPanda(),
  );
  const side = Math.max(0, Math.min(wanted, drawable.width, drawable.height));
  const card: RudyRect = {
    left: drawable.left + Math.floor((drawable.width - side) / 2),
    top: drawable.top + Math.floor((drawable.height - side) / 2),
    width: side,
    height: side,
  };
  return { card, panda: pandaIn(card) };
}

/** Barva `#RRGGBB` ztmavená černou s průhledností `alpha`. */
function dimmedColor(color: string, alpha: number): string {
  const channels = [1, 3, 5].map((start) =>
    Math.round(Number.parseInt(color.slice(start, start + 2), 16) * (1 - alpha)),
  );
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Okraje stránky kolem plátna během okna: ztmavené stejně jako hra pod kartou. */
export function rudyCardPageBackdrop(): PageBackdrop {
  return { color: dimmedColor(PAGE_BACKGROUND, RUDY_CARD_STYLE.dimAlpha) };
}
