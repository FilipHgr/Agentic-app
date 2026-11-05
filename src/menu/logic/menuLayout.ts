/**
 * Rozložení menu podle obrázku B (#67 AC1) v CSS px okna, i s výřezem
 * a lištou domů. Nahoře lišta (místo pro profil vlevo, místo pro jazyk
 * a zástupná tlačítka „…“ vpravo), pod ní kategorie (sloupec vlevo, na
 * telefonu na výšku řada) a vedle nebo pod nimi mřížka dlaždic.
 * Čistý TypeScript bez Phaseru.
 *
 * Místa pro profil a jazyk jsou v rozložení už dnes, i když zůstanou
 * prázdná, aby se dlaždice po doplnění profilů (#71) a jazyka (#70)
 * neposunuly.
 */

import {
  chooseLayoutMode,
  isValidViewport,
  safeAreaOrNone,
} from '../../shared/logic/viewportLayout';
import type { LayoutMode, Viewport } from '../../shared/logic/viewportLayout';

/** Obdélník v CSS px okna. */
export interface MenuBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface MenuCategorySlot {
  /** Ťukací plocha, vysoká aspoň 64 px. */
  readonly hit: MenuBox;
  /** Nakreslená pilulka uvnitř ťukací plochy (48 px vysoká). */
  readonly pill: MenuBox;
}

export interface MenuLayout {
  readonly mode: LayoutMode;
  readonly profileSlot: MenuBox;
  readonly languageSlot: MenuBox;
  readonly placeholders: readonly MenuBox[];
  readonly placeholderFontSize: number;
  readonly categoryDirection: 'row' | 'column';
  readonly categories: readonly MenuCategorySlot[];
  readonly categoryFontSize: number;
  /** Odsazení názvu kategorie od levého okraje pilulky. */
  readonly categoryTextInset: number;
  readonly gridColumns: number;
  readonly tiles: readonly MenuBox[];
  readonly tileRadius: number;
  readonly tileSymbolFontSize: number;
  readonly tileTitleFontSize: number;
}

export interface MenuContent {
  /** Názvy viditelných kategorií v jazyce menu, v pořadí menu. */
  readonly categoryTitles: readonly string[];
  readonly tileCount: number;
}

/** Odhad šířky textu jako v #65: znaky × 0,6 × velikost písma. */
const CHARACTER_WIDTH_RATIO = 0.6;

const BUTTON_SIZE = 64;
const PILL_HEIGHT = 48;
const CATEGORY_GAP = 8;

/** Rozměry, které se liší podle zařízení. */
interface MenuMetrics {
  /** Okraj od volné plochy vlevo a vpravo. */
  readonly sideMargin: number;
  /** Horní okraj lišty od volné plochy. */
  readonly barTop: number;
  /** Mezera mezi tlačítky v liště. */
  readonly barGap: number;
  readonly profileWidth: number;
  readonly placeholderCount: number;
  /** Kde začínají kategorie (od horního okraje volné plochy). */
  readonly contentTop: number;
  readonly categoryWidth: number;
  readonly categoryFontSize: number;
  readonly categoryTextInset: number;
  /** Mezera mezi kategoriemi a mřížkou. */
  readonly columnGap: number;
  readonly tileGap: number;
  readonly tileRadius: number;
  readonly tileTitleFontSize: number;
}

/** iPad a zmenšené zobrazení (obrázek B na iPadu). */
const TABLET_METRICS: MenuMetrics = {
  sideMargin: 24,
  barTop: 12,
  barGap: 16,
  profileWidth: 240,
  placeholderCount: 2,
  contentTop: 104,
  categoryWidth: 220,
  categoryFontSize: 17,
  categoryTextInset: 20,
  columnGap: 20,
  tileGap: 20,
  tileRadius: 24,
  tileTitleFontSize: 17,
};

/** Telefon na šířku (obrázek z „Rozhodnutí po obrázku“ v #67). */
const PHONE_LANDSCAPE_METRICS: MenuMetrics = {
  sideMargin: 8,
  barTop: 8,
  barGap: 8,
  profileWidth: 220,
  placeholderCount: 1,
  contentTop: 80,
  categoryWidth: 208,
  categoryFontSize: 16,
  categoryTextInset: 18,
  columnGap: 16,
  tileGap: 12,
  tileRadius: 20,
  tileTitleFontSize: 15,
};

/** Telefon na výšku (obrázek B na telefonu): kategorie v řadě nahoře. */
const PHONE_PORTRAIT_METRICS: MenuMetrics = {
  sideMargin: 16,
  barTop: 12,
  barGap: 16,
  profileWidth: 76,
  placeholderCount: 1,
  contentTop: 88,
  categoryWidth: 0,
  categoryFontSize: 17,
  categoryTextInset: 20,
  columnGap: 12,
  tileGap: 20,
  tileRadius: 24,
  tileTitleFontSize: 17,
};

/** Nejmenší šířka dlaždice, podle které se volí počet sloupců. */
const TABLET_MIN_TILE_WIDTH = 240;
const PHONE_LANDSCAPE_MIN_TILE_WIDTH = 150;
const TABLET_TILE_HEIGHT = 200;
const PHONE_PORTRAIT_TILE_HEIGHT = 160;
const PHONE_PORTRAIT_COLUMNS = 2;
/** Na telefonu na šířku se dlaždice vejdou do výšky asi dvaapůlkrát (obrázek). */
const PHONE_LANDSCAPE_VISIBLE_ROWS = 2.5;
const PHONE_LANDSCAPE_MIN_TILE_HEIGHT = 80;
const PHONE_LANDSCAPE_MAX_TILE_HEIGHT = 160;

/** Volná plocha okna v CSS px (bez výřezu a lišty domů). */
function freeAreaOf(viewport: Viewport | undefined): MenuBox {
  if (!isValidViewport(viewport)) {
    return { left: 0, right: 1024, top: 0, bottom: 768 };
  }
  const safeArea = safeAreaOrNone(viewport.safeArea);
  return {
    left: safeArea.left,
    right: viewport.width - safeArea.right,
    top: safeArea.top,
    bottom: viewport.height - safeArea.bottom,
  };
}

function metricsFor(mode: LayoutMode): MenuMetrics {
  switch (mode) {
    case 'phoneLandscape':
      return PHONE_LANDSCAPE_METRICS;
    case 'phonePortrait':
      return PHONE_PORTRAIT_METRICS;
    case 'tablet':
    case 'scaled':
      return TABLET_METRICS;
  }
}

function boxAt(left: number, top: number, width: number, height: number): MenuBox {
  return { left, top, right: left + width, bottom: top + height };
}

function textWidth(text: string, fontSize: number): number {
  return [...text].length * CHARACTER_WIDTH_RATIO * fontSize;
}

/** Pilulka 48 px uprostřed ťukací plochy 64 px. */
function categorySlot(left: number, top: number, width: number): MenuCategorySlot {
  const pillTop = top + (BUTTON_SIZE - PILL_HEIGHT) / 2;
  return {
    hit: boxAt(left, top, width, BUTTON_SIZE),
    pill: boxAt(left, pillTop, width, PILL_HEIGHT),
  };
}

/** Kategorie ve sloupci pod sebou, všechny stejně široké. */
function categoryColumn(free: MenuBox, metrics: MenuMetrics, count: number): MenuCategorySlot[] {
  const left = free.left + metrics.sideMargin;
  return Array.from({ length: count }, (_, index) =>
    categorySlot(
      left,
      free.top + metrics.contentTop + index * (BUTTON_SIZE + CATEGORY_GAP),
      metrics.categoryWidth,
    ),
  );
}

/** Kategorie v řadě; každá je široká podle svého názvu. */
function categoryRow(
  free: MenuBox,
  metrics: MenuMetrics,
  titles: readonly string[],
): MenuCategorySlot[] {
  const slots: MenuCategorySlot[] = [];
  let left = free.left + metrics.sideMargin;
  for (const title of titles) {
    const width = Math.max(
      BUTTON_SIZE,
      Math.ceil(textWidth(title, metrics.categoryFontSize) + 2 * metrics.categoryTextInset),
    );
    slots.push(categorySlot(left, free.top + metrics.contentTop, width));
    left += width + CATEGORY_GAP;
  }
  return slots;
}

interface GridArea {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function columnsFor(mode: LayoutMode, width: number, gap: number): number {
  if (mode === 'phonePortrait') {
    return PHONE_PORTRAIT_COLUMNS;
  }
  const minTileWidth =
    mode === 'phoneLandscape' ? PHONE_LANDSCAPE_MIN_TILE_WIDTH : TABLET_MIN_TILE_WIDTH;
  const fitting = Math.floor((width + gap) / (minTileWidth + gap));
  const [fewest, most] = mode === 'phoneLandscape' ? [3, 4] : [2, 4];
  return Math.min(most, Math.max(fewest, fitting));
}

function tileHeightFor(mode: LayoutMode, grid: GridArea, gap: number): number {
  if (mode === 'phonePortrait') {
    return PHONE_PORTRAIT_TILE_HEIGHT;
  }
  if (mode === 'phoneLandscape') {
    const height = Math.floor((grid.bottom - grid.top - 2 * gap) / PHONE_LANDSCAPE_VISIBLE_ROWS);
    return Math.min(
      PHONE_LANDSCAPE_MAX_TILE_HEIGHT,
      Math.max(PHONE_LANDSCAPE_MIN_TILE_HEIGHT, height),
    );
  }
  return TABLET_TILE_HEIGHT;
}

/** Symbol na dlaždici: na nízkých dlaždicích telefonu menší. */
function tileSymbolFontSize(mode: LayoutMode, tileHeight: number): number {
  if (mode === 'phoneLandscape') {
    return tileHeight < 100 ? 30 : 36;
  }
  return 34;
}

export function menuLayoutFor(viewport: Viewport | undefined, content: MenuContent): MenuLayout {
  const mode = chooseLayoutMode(viewport);
  const metrics = metricsFor(mode);
  const free = freeAreaOf(viewport);

  // Horní lišta: profil vlevo, vpravo místo pro jazyk a zástupná tlačítka.
  const barTop = free.top + metrics.barTop;
  const profileSlot = boxAt(
    free.left + metrics.sideMargin,
    barTop,
    metrics.profileWidth,
    BUTTON_SIZE,
  );
  const placeholders: MenuBox[] = [];
  let right = free.right - metrics.sideMargin;
  for (let index = 0; index < metrics.placeholderCount; index += 1) {
    placeholders.unshift(boxAt(right - BUTTON_SIZE, barTop, BUTTON_SIZE, BUTTON_SIZE));
    right -= BUTTON_SIZE + metrics.barGap;
  }
  const languageSlot = boxAt(right - BUTTON_SIZE, barTop, BUTTON_SIZE, BUTTON_SIZE);

  const isRow = mode === 'phonePortrait';
  const categories = isRow
    ? categoryRow(free, metrics, content.categoryTitles)
    : categoryColumn(free, metrics, content.categoryTitles.length);

  const grid: GridArea = isRow
    ? {
        left: free.left + metrics.sideMargin,
        right: free.right - metrics.sideMargin,
        top: free.top + metrics.contentTop + BUTTON_SIZE + metrics.columnGap,
        bottom: free.bottom - metrics.sideMargin,
      }
    : {
        left: free.left + metrics.sideMargin + metrics.categoryWidth + metrics.columnGap,
        right: free.right - metrics.sideMargin,
        top: free.top + metrics.contentTop,
        bottom: free.bottom - metrics.sideMargin,
      };

  const gap = metrics.tileGap;
  const gridColumns = columnsFor(mode, grid.right - grid.left, gap);
  const tileWidth = (grid.right - grid.left - (gridColumns - 1) * gap) / gridColumns;
  const tileHeight = tileHeightFor(mode, grid, gap);
  const tiles = Array.from({ length: content.tileCount }, (_, index) => {
    const column = index % gridColumns;
    const row = Math.floor(index / gridColumns);
    return boxAt(
      grid.left + column * (tileWidth + gap),
      grid.top + row * (tileHeight + gap),
      tileWidth,
      tileHeight,
    );
  });

  return {
    mode,
    profileSlot,
    languageSlot,
    placeholders,
    placeholderFontSize: 22,
    categoryDirection: isRow ? 'row' : 'column',
    categories,
    categoryFontSize: metrics.categoryFontSize,
    categoryTextInset: metrics.categoryTextInset,
    gridColumns,
    tiles,
    tileRadius: metrics.tileRadius,
    tileSymbolFontSize: tileSymbolFontSize(mode, tileHeight),
    tileTitleFontSize: metrics.tileTitleFontSize,
  };
}
