/**
 * Rozložení obrazovky Porovnávání (#178 AC7) podle herní plochy: nahoře
 * řada hvězdiček mezi domečkem a kolečkem, pod ní dvě karty s tečkami
 * vedle sebe a „=“ mezi nimi. Na výšku jsou karty vysoké, „=“ pod nimi,
 * tečky po pěti ve sloupcích a hvězdičky ve 2 řadách po 5. Míry se počítají
 * z CSS px okna, aby karty i „=“ měly aspoň 64 px na každém zařízení.
 * Čistý TypeScript bez Phaseru.
 */

import { gearSizingFor } from '../../../shared/logic/settingsGear';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea, GameAreaFit } from '../../../shared/logic/viewportLayout';

/** Karty přes celou volnou plochu okna, i na iPadu. */
export const COMPARE_GAME_AREA_FIT: GameAreaFit = 'fullWindow';

/** Obdélník v herních jednotkách: levý horní roh a velikost. */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Tečka na kartě: střed a poloměr. */
export interface Dot extends Point {
  readonly radius: number;
}

/** Kde je „=“: mezi kartami (na šířku), nebo pod nimi (na výšku). */
export type EqualPlacement = 'between' | 'below';

/** Tečky po pěti v řadách (na šířku), nebo po pěti ve sloupcích (na výšku). */
export type DotGroups = 'rows' | 'columns';

export interface CompareLayout {
  readonly equalPlacement: EqualPlacement;
  readonly dotGroups: DotGroups;
  /** Levá a pravá karta, vždy vedle sebe. */
  readonly cards: readonly [Rect, Rect];
  readonly equalButton: Rect;
  /** Znak po správné odpovědi: střed v místě „=“ a velikost písma. */
  readonly sign: Point & { readonly size: number };
  readonly stars: {
    readonly stars: readonly Point[];
    readonly starSize: number;
    readonly detailScale: number;
  };
  readonly cardCornerRadius: number;
  /** Herní jednotky na 1 CSS px: tloušťka čar, konfety, zatřesení. */
  readonly unitsPerCssPx: number;
}

/** Mezera mezi rohovým tlačítkem a hrou v CSS px. */
const CORNER_GAP_CSS = 4;
const STARS_PER_ROW_LANDSCAPE = 10;
const STARS_PER_ROW_PORTRAIT = 5;
const STAR_SLOT_FILL = 0.8;
const MAX_STAR_CSS = 48;

/** Odstup od okrajů a mezi kartami v CSS px: telefon, nebo větší okno. */
const PHONE_SPACING = { margin: 8, gap: 16 };
const TABLET_SPACING = { margin: 24, gap: 32 };

/** „=“: díl kratší strany volné plochy, nejméně 64 px (dětský prst) a nejvýš 120 px. */
const EQUAL_SHARE = 0.22;
const MIN_TOUCH_CSS = 64;
const MAX_EQUAL_CSS = 120;
/** Karta je nejvýš takhle vysoká proti své šířce, aby tečky nebyly ztracené. */
const CARD_MAX_ASPECT = 0.85;

/** Teček v jedné řadě nebo sloupci a kolik řad nebo sloupců je nejvýš. */
const DOTS_PER_GROUP = 5;
const DOT_GROUPS = 2;
const CARD_PADDING_SHARE = 0.08;
/** Zaoblení rohů karty jako díl její kratší strany. */
const CARD_CORNER_RADIUS_SHARE = 0.08;
const DOT_RADIUS_SHARE = 0.4;
const SIGN_FONT_SHARE = 0.9;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Strana čtverce v horních rozích, kde je domeček a kolečko (i s mezerou), v CSS px. */
function cornerSizeCss(area: GameArea): number {
  // Mimo telefon se počítá s větším kolečkem iPadu, i když okno může mít menší.
  const { sizes, inset } = gearSizingFor(isPhoneMode(area.mode));
  return inset + sizes.hitSize + CORNER_GAP_CSS;
}

function starRow(area: GameArea, unit: number, corner: number, portrait: boolean) {
  const available = area.width - 2 * corner;
  const perRow = portrait ? STARS_PER_ROW_PORTRAIT : STARS_PER_ROW_LANDSCAPE;
  const rows = portrait ? 2 : 1;
  const slot = available / perRow;
  const rowHeight = corner / rows;
  const starSize = Math.min(slot * STAR_SLOT_FILL, rowHeight * STAR_SLOT_FILL, MAX_STAR_CSS * unit);
  const stars: Point[] = [];
  for (let index = 0; index < STARS_PER_ROW_LANDSCAPE; index += 1) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    stars.push({ x: corner + (column + 0.5) * slot, y: (row + 0.5) * rowHeight });
  }
  return { stars, starSize, detailScale: unit };
}

/**
 * Strana „=“ v herních jednotkách. Zaokrouhlí se nahoru na celé jednotky,
 * aby po přepočtu na CSS px nevyšlo kvůli zaokrouhlení méně než 64 px.
 */
function equalSize(shortSide: number, unit: number): number {
  return Math.ceil(clamp(shortSide * EQUAL_SHARE, MIN_TOUCH_CSS * unit, MAX_EQUAL_CSS * unit));
}

interface CardsPlacement {
  readonly first: Rect;
  readonly second: Rect;
  readonly equal: number;
  /** Střed „=“ (a znaku po správné odpovědi). */
  readonly center: Point;
  readonly equalPlacement: EqualPlacement;
}

/** Karty vedle sebe a „=“ mezi nimi. */
function equalBetween(play: Rect, equal: number, gap: number): CardsPlacement {
  const width = (play.width - equal - 2 * gap) / 2;
  const height = Math.min(play.height, width * CARD_MAX_ASPECT);
  const top = play.top + (play.height - height) / 2;
  return {
    first: { left: play.left, top, width, height },
    second: { left: play.left + play.width - width, top, width, height },
    equal,
    center: { x: play.left + play.width / 2, y: top + height / 2 },
    equalPlacement: 'between',
  };
}

/**
 * Na výšku: vysoké karty vedle sebe přes celou šířku i celou volnou výšku
 * až k „=“ uprostřed pod nimi; tečky v nich jsou po pěti ve sloupcích.
 */
function equalBelow(play: Rect, equal: number, gap: number): CardsPlacement {
  const width = (play.width - gap) / 2;
  const height = play.height - equal - gap;
  const top = play.top;
  return {
    first: { left: play.left, top, width, height },
    second: { left: play.left + play.width - width, top, width, height },
    equal,
    center: { x: play.left + play.width / 2, y: top + height + gap + equal / 2 },
    equalPlacement: 'below',
  };
}

/**
 * Karty jsou vždy vedle sebe (#178), aby znak mezi nimi šel číst zleva
 * doprava. Na šířku je „=“ mezi kartami, na výšku pod nimi.
 */
function placeCards(play: Rect, unit: number, gap: number, portrait: boolean): CardsPlacement {
  const equal = equalSize(Math.min(play.width, play.height), unit);
  return portrait ? equalBelow(play, equal, gap) : equalBetween(play, equal, gap);
}

export function layoutCompareScreen(area: GameArea): CompareLayout {
  const unit = 1 / area.scale;
  const portrait = area.height > area.width;
  const spacing = isPhoneMode(area.mode) ? PHONE_SPACING : TABLET_SPACING;
  const margin = spacing.margin * unit;
  const gap = spacing.gap * unit;
  const corner = cornerSizeCss(area) * unit;
  const play: Rect = {
    left: margin,
    top: corner + CORNER_GAP_CSS * unit,
    width: area.width - 2 * margin,
    height: area.height - corner - CORNER_GAP_CSS * unit - margin,
  };
  const cards = placeCards(play, unit, gap, portrait);
  const equalButton: Rect = {
    left: cards.center.x - cards.equal / 2,
    top: cards.center.y - cards.equal / 2,
    width: cards.equal,
    height: cards.equal,
  };
  return {
    equalPlacement: cards.equalPlacement,
    dotGroups: portrait ? 'columns' : 'rows',
    cards: [cards.first, cards.second],
    equalButton,
    sign: { ...cards.center, size: cards.equal * SIGN_FONT_SHARE },
    stars: starRow(area, unit, corner, portrait),
    cardCornerRadius: Math.min(cards.first.width, cards.first.height) * CARD_CORNER_RADIUS_SHARE,
    unitsPerCssPx: unit,
  };
}

/**
 * Tečky na kartě po pěti (#178 AC1): na šířku v řadách (mřížka 5 × 2,
 * druhá řada pokračuje zleva), na výšku ve sloupcích (mřížka 2 × 5, druhý
 * sloupec pokračuje shora). S nejvýš pěti tečkami je jediná řada nebo
 * jediný sloupec na středu karty. Velikost teček nezávisí na počtu, aby
 * šly počty porovnat, a je co největší, jaká se do karty vejde.
 */
export function cardDots(card: Rect, count: number, groups: DotGroups = 'rows'): Dot[] {
  const padding = Math.min(card.width, card.height) * CARD_PADDING_SHARE;
  const across = groups === 'rows' ? DOTS_PER_GROUP : DOT_GROUPS;
  const down = groups === 'rows' ? DOT_GROUPS : DOTS_PER_GROUP;
  const cell = Math.min((card.width - 2 * padding) / across, (card.height - 2 * padding) / down);
  const usedGroups = Math.ceil(count / DOTS_PER_GROUP);
  const columns = groups === 'rows' ? DOTS_PER_GROUP : usedGroups;
  const rows = groups === 'rows' ? usedGroups : DOTS_PER_GROUP;
  const gridLeft = card.left + (card.width - columns * cell) / 2;
  const gridTop = card.top + (card.height - rows * cell) / 2;
  const dots: Dot[] = [];
  for (let index = 0; index < count; index += 1) {
    const group = Math.floor(index / DOTS_PER_GROUP);
    const place = index % DOTS_PER_GROUP;
    const column = groups === 'rows' ? place : group;
    const row = groups === 'rows' ? group : place;
    dots.push({
      x: gridLeft + (column + 0.5) * cell,
      y: gridTop + (row + 0.5) * cell,
      radius: cell * DOT_RADIUS_SHARE,
    });
  }
  return dots;
}
