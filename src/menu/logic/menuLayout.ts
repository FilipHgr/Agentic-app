/**
 * Rozložení menu podle obrázku B (#67 AC1) v CSS px okna, i s výřezem
 * a lištou domů. Nahoře lišta (místo pro profil vlevo, místo pro jazyk
 * úplně vpravo, mezi nimi místo vyhrazené pro budoucí volby, #157), pod ní kategorie (sloupec vlevo, na
 * telefonu na výšku výběr kategorie, #95) a vedle nebo pod nimi mřížka
 * dlaždic.
 * Čistý TypeScript bez Phaseru.
 *
 * Místa pro profil a jazyk mají pevnou velikost, aby se dlaždice podle
 * profilu (#71) a jazyka (#70) neposouvaly.
 *
 * Profil (#71): kolečko 64 px v levém horním rohu místa pro profil, vedle
 * něj přezdívka. Na telefonu na výšku a bez přezdívky je jen kolečko.
 *
 * Posouvání (#69): mřížka a kategorie mají každá svou viditelnou plochu,
 * mimo kterou se obsah ořízne, a největší posun. Polohy dlaždic
 * a kategorií jsou bez posunu. Když se dlaždice nevejdou, mají takovou
 * výšku, aby z první skryté řady bylo vidět 20–60 %. Když se nevejdou
 * kategorie, mají mezi sebou takovou mezeru, aby z další skryté kategorie
 * bylo vidět aspoň 24 px. Když se všechno vejde (dnes), je rozložení stejné
 * jako bez posouvání.
 *
 * Jazyk (#70): kulaté tlačítko se zkratkou jazyka je v místě pro jazyk.
 * Panel nabídky jazyků je pod ním, zarovnaný k jeho pravému okraji,
 * a vejde se do volné plochy. Když se seznam jazyků nevejde, posouvá se
 * jako mřížka a z prvního skrytého jazyka je vidět 55 % řádku. Panel
 * leží nad mřížkou a kategoriemi, jejich polohy se kvůli němu nemění.
 *
 * Výběr kategorie (#95, obrázky D1–D3): na telefonu na výšku je místo řady
 * kategorií jedno tlačítko přes celou šířku na jejím místě (ťukací plocha
 * 64 px, nakreslené 56 px). Seznam kategorií je pod ním karta jako nabídka
 * jazyků přes mřížku, řádky 64 px s mezerou 8 px; když se nevejdou,
 * posouvají se a z první skryté řádky je vidět 55 %. Lišta ani dlaždice se
 * kvůli výběru nepohnou.
 *
 * Pár her (#156): když se dlaždice všech her („Vše“) vejdou bez posouvání,
 * jsou co největší (obrázek nejvýš 256 px) a blok dlaždic stojí uprostřed
 * volné plochy vedle kategorií nebo pod výběrem kategorie. Velikost
 * a počet sloupců se řídí počtem her ve „Vše“, po přepnutí kategorie se
 * blok jen znovu vystředí. Když se nevejdou, platí posouvání z #69.
 *
 * Panda (#168): ve volné části posouvané plochy her vedle dlaždic nebo
 * pod nimi, jen když se mřížka neposouvá (`mascotPlace.ts`). Nic jiného
 * se kvůli ní neposune.
 */

import {
  chooseLayoutMode,
  isValidViewport,
  safeAreaOrNone,
} from '../../shared/logic/viewportLayout';
import type { LayoutMode, Viewport } from '../../shared/logic/viewportLayout';
import { menuMascotBox } from './mascotPlace';

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

/** Plocha, ve které se obsah posouvá. */
export interface MenuScrollArea {
  /** Viditelná plocha: v ní se ťuká, podle ní se posouvá. */
  readonly viewport: MenuBox;
  /**
   * Kde se obsah při kreslení ořízne: viditelná plocha s rezervou, aby se
   * okraje pulzující, zatřesené nebo zmáčknuté dlaždice a stín neořízly.
   * Nezasahuje do lišty ani do kategorií.
   */
  readonly clip: MenuBox;
  /** Největší posun v px; 0 = obsah se vejde a neposouvá se. */
  readonly maxOffset: number;
}

/** Panel nabídky jazyků (#70). */
export interface MenuLanguagePanel {
  /** Bílá karta panelu. */
  readonly panel: MenuBox;
  /** Ťukací plochy jazyků (64 px vysoké) bez posunu, v pořadí nabídky. */
  readonly rows: readonly MenuBox[];
  /** Seznam jazyků se posouvá svisle. */
  readonly list: MenuScrollArea;
  readonly fontSize: number;
  /** Odsazení názvu od levého okraje řádku a ✓ od pravého. */
  readonly textInset: number;
  /** Místo pro ✓ u pravého okraje řádku. */
  readonly checkWidth: number;
}

/** Části tlačítka jazyka (#138): zkratka jazyka a pod ní vlajka. */
export interface MenuLanguageButtonParts {
  /** Plocha zkratky jazyka („CS“), vysoká jako písmo. */
  readonly code: MenuBox;
  /** Rámeček vlajky (24 × 16 px) pod zkratkou. */
  readonly flag: MenuBox;
}

/** Části jednoho řádku nabídky jazyků (#138): vlajka, vlastní název jazyka a ✓. */
export interface MenuLanguageRowParts {
  /** Rámeček vlajky (30 × 20 px) vlevo, svisle uprostřed řádku. */
  readonly flag: MenuBox;
  /** Plocha vlastního názvu jazyka mezi vlajkou a místem pro ✓. */
  readonly name: MenuBox;
  /** Místo pro ✓ u pravého okraje řádku. */
  readonly check: MenuBox;
}

/** Kolečko profilu a přezdívka vedle něj (#71). */
export interface MenuProfileBadgeLayout {
  /** Ťukací plocha kolečka (64 × 64 px), kolečko se kreslí uprostřed. */
  readonly circle: MenuBox;
  /** Plocha přezdívky vpravo od kolečka; `null` bez přezdívky a na telefonu na výšku. */
  readonly label: MenuBox | null;
  readonly symbolFontSize: number;
  readonly labelFontSize: number;
  /** Odsazení přezdívky od levého okraje její plochy. */
  readonly labelInset: number;
}

/** Výběr kategorie na telefonu na výšku (#95). */
export interface MenuCategoryPicker {
  /** Ťukací plocha tlačítka (64 px vysoká, přes celou šířku menu). */
  readonly button: MenuBox;
  /** Nakreslené tlačítko (56 px vysoké) uprostřed ťukací plochy. */
  readonly buttonDrawn: MenuBox;
  /** Písmo názvu kategorie na tlačítku i v řádcích. */
  readonly fontSize: number;
  /** Odsazení obsahu od levého i pravého okraje tlačítka a řádku. */
  readonly textInset: number;
  /** Místo pro symbol v rámečku i s mezerou k názvu. */
  readonly symbolWidth: number;
  readonly symbolFontSize: number;
  /** Světle modrý rámeček symbolu. */
  readonly symbolBoxWidth: number;
  readonly symbolBoxHeight: number;
  /** Mezera mezi rámečkem symbolu, názvem a šipkou nebo ✓. */
  readonly contentGap: number;
  /** Šířka šipky a ✓. */
  readonly markWidth: number;
  /** Místo pro šipku ▾ / ▴ vpravo na tlačítku i s mezerou k názvu. */
  readonly arrowWidth: number;
  readonly arrowFontSize: number;
  /** Místo pro ✓ vpravo v řádku i s mezerou k názvu. */
  readonly checkWidth: number;
  /** Bílá karta seznamu pod tlačítkem. */
  readonly panel: MenuBox;
  /** Ťukací plochy kategorií (64 px vysoké) bez posunu, v pořadí menu. */
  readonly rows: readonly MenuBox[];
  /** Seznam kategorií se posouvá svisle. */
  readonly list: MenuScrollArea;
}

/** Obrázek hry a název pod ním na jedné dlaždici (#122). */
export interface MenuTileImage {
  /** Čtverec obrázku vodorovně uprostřed dlaždice. */
  readonly image: MenuBox;
  /** Řádek názvu 2 px pod obrázkem, vysoký `TILE_TITLE_LINE` × písmo názvu. */
  readonly title: MenuBox;
}

export interface MenuLayout {
  readonly mode: LayoutMode;
  readonly profileSlot: MenuBox;
  readonly profileBadge: MenuProfileBadgeLayout;
  readonly languageSlot: MenuBox;
  /** Písmo zkratky jazyka na tlačítku (#70). */
  readonly languageButtonFontSize: number;
  readonly languagePanel: MenuLanguagePanel;
  /**
   * Místa v liště vyhrazená pro budoucí volby (#157, dřív zástupná kolečka
   * „…“), mezi profilem a jazykem. Nic se tam nekreslí a ťuknutí na ně nic nedělá, ale jiné části
   * menu do nich nesmí.
   */
  readonly reservedSlots: readonly MenuBox[];
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
  /**
   * Obrázek a název každé dlaždice z `tiles` ve stejném pořadí (#122),
   * v CSS px okna bez posunu mřížky jako `tiles`.
   */
  readonly tileImages: readonly MenuTileImage[];
  /** Mřížka se posouvá svisle. */
  readonly gridScroll: MenuScrollArea;
  /** Kategorie v řadě se posouvají vodorovně, ve sloupci svisle. */
  readonly categoryScroll: MenuScrollArea;
  /**
   * Výběr kategorie (#95), jen na telefonu na výšku; jinde `null`
   * a kategorie jsou ve sloupci. S výběrem je `categories` prázdné.
   */
  readonly categoryPicker: MenuCategoryPicker | null;
  /**
   * Panda (#168): snímek i ťukací plocha v CSS px okna ve volné části
   * posouvané plochy her (`mascotPlace.ts`), nebo `null`, když se nevejde.
   */
  readonly mascot: MenuBox | null;
}

export interface MenuContent {
  /** Názvy viditelných kategorií v jazyce menu, v pořadí menu. */
  readonly categoryTitles: readonly string[];
  /** Počet dlaždic vybrané kategorie. */
  readonly tileCount: number;
  /**
   * Počet dlaždic ve „Vše“ (všechny hry). Podle něj se volí výška dlaždic,
   * aby se po výběru jiné kategorie neměnila. Bez něj platí `tileCount`.
   */
  readonly allTileCount?: number;
  /** Vlastní názvy jazyků v pořadí nabídky (#70); bez nich je panel prázdný. */
  readonly languageNames?: readonly string[];
  /** Přezdívka aktivního profilu (#71); `null` nebo bez zadání = bez přezdívky. */
  readonly profileNickname?: string | null;
}

/** Odhad šířky textu jako v #65: znaky × 0,6 × velikost písma. */
const CHARACTER_WIDTH_RATIO = 0.6;

const BUTTON_SIZE = 64;
const PILL_HEIGHT = 48;
const CATEGORY_GAP = 8;
/**
 * Mezera mezi kategoriemi, když se posouvají: nejvýš 24 px (rozestup 88 px
 * jako na schváleném obrázku), jen když se s ní další kategorie neodkryje
 * aspoň o 24 px, smí být větší (nejvýš 48 px).
 */
const APPROVED_MAX_CATEGORY_GAP = 24;
const MAX_CATEGORY_GAP = 48;

/** Viditelná plocha posouvání je aspoň 4 px od okraje volné plochy a od lišty. */
const VIEWPORT_EDGE = 4;

/** Rezerva kamery mřížky nad viditelnou plochou (pulzování a stín první řady). */
const GRID_CLIP_TOP_RESERVE = 8;

/** Z další skryté kategorie je vidět 24 až 36 px pilulky (#69 AC4). */
const CATEGORY_PEEK_MIN = 24;
const CATEGORY_PEEK_MAX = 36;

/** Z první skryté řady dlaždic je vidět 20–60 % výšky, nejraději 40 % (#69 AC1). */
const ROW_PEEK_MIN = 0.2;
const ROW_PEEK_MAX = 0.6;
const ROW_PEEK_TARGET = 0.4;
/** Nejnižší dlaždice při posouvání (symbol a název se vejdou). */
const TABLET_MIN_SCROLL_TILE_HEIGHT = 120;
/** Nejvyšší počet celých řad, ze kterých se volí výška dlaždic. */
const MAX_FULL_ROWS = 12;

/** Rozměry, které se liší podle zařízení. */
interface MenuMetrics {
  /** Okraj od volné plochy vlevo a vpravo. */
  readonly sideMargin: number;
  /** Horní okraj lišty od volné plochy. */
  readonly barTop: number;
  /** Mezera mezi tlačítky v liště. */
  readonly barGap: number;
  readonly profileWidth: number;
  /** Počet míst v liště vyhrazených pro budoucí volby (#157). */
  readonly reservedSlotCount: number;
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
  reservedSlotCount: 2,
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
  reservedSlotCount: 1,
  contentTop: 80,
  categoryWidth: 208,
  categoryFontSize: 16,
  categoryTextInset: 18,
  columnGap: 16,
  tileGap: 12,
  tileRadius: 20,
  tileTitleFontSize: 15,
};

/** Telefon na výšku (obrázek B na telefonu): výběr kategorie nahoře na místě řady (#95). */
const PHONE_PORTRAIT_METRICS: MenuMetrics = {
  sideMargin: 16,
  barTop: 12,
  barGap: 16,
  profileWidth: 76,
  reservedSlotCount: 1,
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

/** Nabídka jazyků (#70): řádky po 64 px s mezerou 8 px, okraj panelu 8 px. */
const LANGUAGE_BUTTON_FONT_SIZE = 20;
const LANGUAGE_FONT_SIZE = 17;
const LANGUAGE_TEXT_INSET = 20;
const LANGUAGE_CHECK_WIDTH = 24;
/**
 * Rámeček vlajky vlevo od názvu jazyka (#138, schválený obrázek): 30 × 20 px,
 * stejný pro všechny jazyky, aby názvy začínaly pod sebou. Scéna do něj
 * vlajku vepíše se zachovaným poměrem stran.
 */
const LANGUAGE_FLAG_WIDTH = 30;
const LANGUAGE_FLAG_HEIGHT = 20;
/** Mezera mezi vlajkou a názvem jazyka. */
const LANGUAGE_FLAG_GAP = 12;
/** Na tlačítku jazyka je pod zkratkou menší vlajka 24 × 16 px s mezerou 3 px (#138). */
const BUTTON_FLAG_WIDTH = 24;
const BUTTON_FLAG_HEIGHT = 16;
const BUTTON_CODE_FLAG_GAP = 3;
/** Plocha zkratky jazyka je široká dvě výšky písma (dvě velká písmena). */
const BUTTON_CODE_WIDTH_PER_FONT = 2;
const LANGUAGE_ROW_GAP = 8;
const LANGUAGE_PANEL_PADDING = 8;
/** Panel je od tlačítka jazyka 8 px. */
const LANGUAGE_PANEL_GAP = 8;
const LANGUAGE_PANEL_MIN_WIDTH = 240;
/** Panel je od okraje volné plochy aspoň 8 px (pravidlo říká 4 px). */
const LANGUAGE_PANEL_EDGE = 8;
/**
 * Z prvního skrytého jazyka je vidět 55 % řádku, aby byla vidět i část
 * jeho názvu a bylo poznat, že seznam pokračuje (pravidlo z #69: 20–60 %).
 */
const LANGUAGE_ROW_PEEK = 0.55;

/**
 * Výběr kategorie (#95) podle obrázků D1–D3: nakreslené tlačítko 56 px,
 * vlevo symbol v rámečku 52 × 40 px, mezera 12 px, název, mezera 12 px
 * a šipka 24 px. Vpravo u šipky je 16 px, u ✓ v řádku 20 px. Panel je
 * od tlačítka 8 px, má okraj 8 px a od spodku volné plochy je aspoň 8 px.
 */
const PICKER_DRAWN_HEIGHT = 56;
const PICKER_FONT_SIZE = 17;
const PICKER_TEXT_INSET = 8;
const PICKER_SYMBOL_BOX_WIDTH = 52;
const PICKER_SYMBOL_BOX_HEIGHT = 40;
const PICKER_SYMBOL_FONT_SIZE = 20;
const PICKER_CONTENT_GAP = 12;
const PICKER_MARK_WIDTH = 24;
const PICKER_ARROW_FONT_SIZE = 16;
/** Šipka je od pravého okraje 16 px (odsazení 8 px a 8 px navíc). */
const PICKER_ARROW_RIGHT_EXTRA = 8;
/** ✓ je od pravého okraje řádku 20 px (odsazení 8 px a 12 px navíc). */
const PICKER_CHECK_RIGHT_EXTRA = 12;
const PICKER_PANEL_GAP = 8;
const PICKER_PANEL_PADDING = 8;
const PICKER_PANEL_EDGE = 8;
const PICKER_ROW_GAP = 8;
/** Z první skryté řádky je vidět 55 % (obrázek D3, pravidlo 20–60 %). */
const PICKER_ROW_PEEK = 0.55;

/** Kolečko profilu (#71): písmeno jako na obrázku palety, přezdívka jako kategorie. */
const PROFILE_SYMBOL_FONT_SIZE = 22;
const PROFILE_LABEL_FONT_SIZE = 17;
const PROFILE_LABEL_INSET = 8;

/** Volná plocha okna v CSS px (bez výřezu a lišty domů). */
export function freeAreaOf(viewport: Viewport | undefined): MenuBox {
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

export function boxAt(left: number, top: number, width: number, height: number): MenuBox {
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
function categoryColumn(
  free: MenuBox,
  metrics: MenuMetrics,
  count: number,
  gap: number,
): MenuCategorySlot[] {
  const left = free.left + metrics.sideMargin;
  return Array.from({ length: count }, (_, index) =>
    categorySlot(
      left,
      free.top + metrics.contentTop + index * (BUTTON_SIZE + gap),
      metrics.categoryWidth,
    ),
  );
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

/** Konec obsahu ve směru posouvání. */
function endOf(box: MenuBox, direction: 'row' | 'column'): number {
  return direction === 'row' ? box.right : box.bottom;
}

function startOf(box: MenuBox, direction: 'row' | 'column'): number {
  return direction === 'row' ? box.left : box.top;
}

/** Kolik px z první pilulky, která není celá vidět, je vidět; `Infinity`, když se všechny vejdou. */
function categoryPeek(
  slots: readonly MenuCategorySlot[],
  viewport: MenuBox,
  direction: 'row' | 'column',
): number {
  const viewportEnd = endOf(viewport, direction);
  const cut = slots.find((slot) => endOf(slot.pill, direction) > viewportEnd);
  return cut === undefined ? Infinity : viewportEnd - startOf(cut.pill, direction);
}

/** Mezera z `gaps`, která je nejblíž schválené (24 px) a splní `isGood`. */
function closestToApprovedGap(
  gaps: readonly number[],
  isGood: (gap: number) => boolean,
): number | undefined {
  const good = gaps.filter(isGood);
  return good.sort(
    (a, b) =>
      Math.abs(a - APPROVED_MAX_CATEGORY_GAP) - Math.abs(b - APPROVED_MAX_CATEGORY_GAP) || a - b,
  )[0];
}

/**
 * Kategorie s mezerou, při které je z další skryté kategorie vidět 24 až
 * 36 px, s mezerou nejvýš 24 px (rozestup 88 px). Když to s ní nejde, vezme
 * se mezera nejbližší 24 px, která odkryje 24–36 px, a když ani to ne,
 * nejbližší, která odkryje aspoň 24 px. Když se kategorie vejdou, zůstane
 * mezera 8 px jako bez posouvání.
 */
function categorySlotsFor(
  build: (gap: number) => MenuCategorySlot[],
  viewport: MenuBox,
  direction: 'row' | 'column',
): MenuCategorySlot[] {
  const tight = build(CATEGORY_GAP);
  const last = tight[tight.length - 1];
  if (last === undefined || endOf(last.hit, direction) <= endOf(viewport, direction)) {
    return tight;
  }
  const peekOf = (gap: number): number => categoryPeek(build(gap), viewport, direction);
  const isClearPeek = (gap: number): boolean =>
    peekOf(gap) >= CATEGORY_PEEK_MIN && peekOf(gap) <= CATEGORY_PEEK_MAX;
  const allGaps = Array.from(
    { length: MAX_CATEGORY_GAP - CATEGORY_GAP + 1 },
    (_, index) => CATEGORY_GAP + index,
  );
  const approvedGaps = allGaps.filter((gap) => gap <= APPROVED_MAX_CATEGORY_GAP);
  const gap =
    approvedGaps.find(isClearPeek) ??
    closestToApprovedGap(allGaps, isClearPeek) ??
    closestToApprovedGap(allGaps, (candidate) => peekOf(candidate) >= CATEGORY_PEEK_MIN);
  return gap === undefined ? tight : build(gap);
}

/** Kolik z výšky první řady, která není celá vidět, je vidět (0 až 1). */
function partialRowShare(available: number, tileHeight: number, gap: number): number {
  let rowTop = 0;
  while (rowTop + tileHeight <= available) {
    rowTop += tileHeight + gap;
  }
  return Math.max(0, available - rowTop) / tileHeight;
}

function isGoodPeek(share: number): boolean {
  return share >= ROW_PEEK_MIN && share <= ROW_PEEK_MAX;
}

/**
 * Výška dlaždic, když se mřížka posouvá: co nejblíž běžné výšce, ale tak,
 * aby z první skryté řady bylo vidět 20–60 %. `available` je výška od
 * horního okraje mřížky ke spodnímu okraji viditelné plochy.
 */
function scrollingTileHeight(
  baseHeight: number,
  available: number,
  gap: number,
  minHeight: number,
): number {
  if (isGoodPeek(partialRowShare(available, baseHeight, gap))) {
    return baseHeight;
  }
  let best: number | undefined;
  for (let fullRows = 1; fullRows <= MAX_FULL_ROWS; fullRows += 1) {
    const height = Math.floor((available - fullRows * gap) / (fullRows + ROW_PEEK_TARGET));
    if (height < minHeight) {
      break;
    }
    const isCloser =
      best === undefined || Math.abs(height - baseHeight) < Math.abs(best - baseHeight);
    if (isGoodPeek(partialRowShare(available, height, gap)) && isCloser) {
      best = height;
    }
  }
  return best ?? baseHeight;
}

function minScrollTileHeight(mode: LayoutMode): number {
  return mode === 'phoneLandscape'
    ? PHONE_LANDSCAPE_MIN_TILE_HEIGHT
    : TABLET_MIN_SCROLL_TILE_HEIGHT;
}

/** Spodní okraj mřížky s `rows` řadami. */
function gridBottom(grid: GridArea, rows: number, tileHeight: number, gap: number): number {
  return grid.top + rows * tileHeight + (rows - 1) * gap;
}

/** Posun, při kterém je poslední prvek celý vidět u konce mřížky; 0, když se obsah vejde. */
function maxOffsetFor(contentEnd: number, viewportEnd: number, scrolledEnd: number): number {
  return contentEnd > viewportEnd ? contentEnd - scrolledEnd : 0;
}

/**
 * Kolečko v levém horním rohu místa pro profil, přezdívka ve zbytku místa
 * vpravo od něj. Na telefonu na výšku je místo jen pro kolečko.
 */
function profileBadgeFor(
  mode: LayoutMode,
  slot: MenuBox,
  nickname: string | null,
): MenuProfileBadgeLayout {
  const circle = boxAt(slot.left, slot.top, BUTTON_SIZE, BUTTON_SIZE);
  const hasLabel = nickname !== null && nickname !== '' && mode !== 'phonePortrait';
  return {
    circle,
    label: hasLabel
      ? { left: circle.right, right: slot.right, top: slot.top, bottom: slot.bottom }
      : null,
    symbolFontSize: PROFILE_SYMBOL_FONT_SIZE,
    labelFontSize: PROFILE_LABEL_FONT_SIZE,
    labelInset: PROFILE_LABEL_INSET,
  };
}

/**
 * Výška viditelné části seznamu řádků 64 px s mezerou `gap`: celý, nebo
 * celé řady a `peekShare` další.
 */
function listHeight(count: number, available: number, gap: number, peekShare: number): number {
  const step = BUTTON_SIZE + gap;
  const content = Math.max(0, count * step - gap);
  if (content <= available) {
    return content;
  }
  const peek = peekShare * BUTTON_SIZE;
  const fullRows = Math.max(1, Math.floor((available - peek) / step));
  return Math.min(available, fullRows * step + peek);
}

/**
 * Panel nabídky jazyků pod tlačítkem jazyka, zarovnaný k jeho pravému
 * okraji. Široký je podle nejdelšího názvu, nejvýš přes celou volnou plochu.
 */
export function languagePanelFor(
  free: MenuBox,
  button: MenuBox,
  names: readonly string[],
): MenuLanguagePanel {
  const longest = Math.max(0, ...names.map((name) => textWidth(name, LANGUAGE_FONT_SIZE)));
  const rowWidth = Math.ceil(
    LANGUAGE_FLAG_WIDTH +
      LANGUAGE_FLAG_GAP +
      longest +
      2 * LANGUAGE_TEXT_INSET +
      LANGUAGE_CHECK_WIDTH,
  );
  const maxWidth = free.right - free.left - 2 * LANGUAGE_PANEL_EDGE;
  const width = Math.min(
    maxWidth,
    Math.max(LANGUAGE_PANEL_MIN_WIDTH, rowWidth + 2 * LANGUAGE_PANEL_PADDING),
  );
  const right = Math.min(button.right, free.right - LANGUAGE_PANEL_EDGE);
  const left = Math.max(free.left + LANGUAGE_PANEL_EDGE, right - width);
  const top = button.bottom + LANGUAGE_PANEL_GAP;
  const available = free.bottom - LANGUAGE_PANEL_EDGE - top - 2 * LANGUAGE_PANEL_PADDING;
  const height = listHeight(names.length, available, LANGUAGE_ROW_GAP, LANGUAGE_ROW_PEEK);
  const list: MenuBox = {
    left: left + LANGUAGE_PANEL_PADDING,
    right: left + width - LANGUAGE_PANEL_PADDING,
    top: top + LANGUAGE_PANEL_PADDING,
    bottom: top + LANGUAGE_PANEL_PADDING + height,
  };
  const rows = names.map((_, index) =>
    boxAt(
      list.left,
      list.top + index * (BUTTON_SIZE + LANGUAGE_ROW_GAP),
      list.right - list.left,
      BUTTON_SIZE,
    ),
  );
  const last = rows[rows.length - 1];
  return {
    panel: { left, right: left + width, top, bottom: list.bottom + LANGUAGE_PANEL_PADDING },
    rows,
    list: {
      viewport: list,
      clip: list,
      maxOffset: last === undefined ? 0 : Math.max(0, last.bottom - list.bottom),
    },
    fontSize: LANGUAGE_FONT_SIZE,
    textInset: LANGUAGE_TEXT_INSET,
    checkWidth: LANGUAGE_CHECK_WIDTH,
  };
}

/**
 * Rozdělení tlačítka jazyka (#138): zkratka a pod ní vlajka, obojí
 * vodorovně uprostřed a dohromady svisle uprostřed kolečka.
 */
export function languageButtonParts(button: MenuBox, fontSize: number): MenuLanguageButtonParts {
  const middleX = (button.left + button.right) / 2;
  const total = fontSize + BUTTON_CODE_FLAG_GAP + BUTTON_FLAG_HEIGHT;
  const top = (button.top + button.bottom) / 2 - total / 2;
  const codeWidth = BUTTON_CODE_WIDTH_PER_FONT * fontSize;
  const code = boxAt(middleX - codeWidth / 2, top, codeWidth, fontSize);
  const flag = boxAt(
    middleX - BUTTON_FLAG_WIDTH / 2,
    code.bottom + BUTTON_CODE_FLAG_GAP,
    BUTTON_FLAG_WIDTH,
    BUTTON_FLAG_HEIGHT,
  );
  return { code, flag };
}

/**
 * Rozdělení řádku nabídky jazyků (#138): vlajka vlevo s odsazením řádku,
 * za ní mezera a vlastní název jazyka, vpravo místo pro ✓.
 */
export function languageRowParts(panel: MenuLanguagePanel, row: MenuBox): MenuLanguageRowParts {
  const middle = (row.top + row.bottom) / 2;
  const flag = boxAt(
    row.left + panel.textInset,
    middle - LANGUAGE_FLAG_HEIGHT / 2,
    LANGUAGE_FLAG_WIDTH,
    LANGUAGE_FLAG_HEIGHT,
  );
  const check: MenuBox = {
    left: row.right - panel.textInset - panel.checkWidth,
    right: row.right - panel.textInset,
    top: row.top,
    bottom: row.bottom,
  };
  const name: MenuBox = {
    left: flag.right + LANGUAGE_FLAG_GAP,
    right: check.left,
    top: row.top,
    bottom: row.bottom,
  };
  return { flag, name, check };
}

/**
 * Výběr kategorie (#95): tlačítko přes šířku od `left` do `right` na místě
 * řady kategorií a pod ním seznam kategorií v kartě stejně široké.
 */
function categoryPickerFor(
  free: MenuBox,
  left: number,
  right: number,
  top: number,
  count: number,
): MenuCategoryPicker {
  const button = boxAt(left, top, right - left, BUTTON_SIZE);
  const drawnInset = (BUTTON_SIZE - PICKER_DRAWN_HEIGHT) / 2;
  const panelTop = button.bottom + PICKER_PANEL_GAP;
  const available = free.bottom - PICKER_PANEL_EDGE - panelTop - 2 * PICKER_PANEL_PADDING;
  const height = listHeight(count, available, PICKER_ROW_GAP, PICKER_ROW_PEEK);
  const list: MenuBox = {
    left: left + PICKER_PANEL_PADDING,
    right: right - PICKER_PANEL_PADDING,
    top: panelTop + PICKER_PANEL_PADDING,
    bottom: panelTop + PICKER_PANEL_PADDING + height,
  };
  const rows = Array.from({ length: count }, (_, index) =>
    boxAt(
      list.left,
      list.top + index * (BUTTON_SIZE + PICKER_ROW_GAP),
      list.right - list.left,
      BUTTON_SIZE,
    ),
  );
  const last = rows[rows.length - 1];
  return {
    button,
    buttonDrawn: { ...button, top: button.top + drawnInset, bottom: button.bottom - drawnInset },
    fontSize: PICKER_FONT_SIZE,
    textInset: PICKER_TEXT_INSET,
    symbolWidth: PICKER_SYMBOL_BOX_WIDTH + PICKER_CONTENT_GAP,
    symbolFontSize: PICKER_SYMBOL_FONT_SIZE,
    symbolBoxWidth: PICKER_SYMBOL_BOX_WIDTH,
    symbolBoxHeight: PICKER_SYMBOL_BOX_HEIGHT,
    contentGap: PICKER_CONTENT_GAP,
    markWidth: PICKER_MARK_WIDTH,
    arrowWidth: PICKER_CONTENT_GAP + PICKER_MARK_WIDTH + PICKER_ARROW_RIGHT_EXTRA,
    arrowFontSize: PICKER_ARROW_FONT_SIZE,
    checkWidth: PICKER_CONTENT_GAP + PICKER_MARK_WIDTH + PICKER_CHECK_RIGHT_EXTRA,
    panel: { left, right, top: panelTop, bottom: list.bottom + PICKER_PANEL_PADDING },
    rows,
    list: {
      viewport: list,
      clip: list,
      maxOffset: last === undefined ? 0 : Math.max(0, last.bottom - list.bottom),
    },
  };
}

/** Obrázek je od okrajů dlaždice aspoň tolik px, název od spodního okraje taky (#122). */
const TILE_IMAGE_EDGE = 8;
/** Mezera mezi obrázkem a názvem pod ním (#122). */
const TILE_IMAGE_GAP = 2;
/** Výška řádku názvu jako násobek velikosti písma (#122). */
const TILE_TITLE_LINE = 1.2;
/** Obrázek dlaždice má nejvýš 256 CSS px, aby zůstal ostrý ze zdroje 512 px (#156). */
const MAX_TILE_IMAGE = 256;

/**
 * Obrázek a název na dlaždici (#122): obrázek je co největší čtverec
 * (nejvýš 256 px, #156), který se s mezerou a názvem vejde do dlaždice
 * s okraji 8 px. Obrázek, mezera a název tvoří skupinu uprostřed dlaždice.
 */
function tileImageFor(tile: MenuBox, titleFontSize: number): MenuTileImage {
  const width = tile.right - tile.left;
  const height = tile.bottom - tile.top;
  const titleHeight = TILE_TITLE_LINE * titleFontSize;
  const size = Math.max(
    0,
    Math.min(
      MAX_TILE_IMAGE,
      width - 2 * TILE_IMAGE_EDGE,
      height - TILE_IMAGE_EDGE - TILE_IMAGE_GAP - titleHeight - TILE_IMAGE_EDGE,
    ),
  );
  const groupHeight = size + TILE_IMAGE_GAP + titleHeight;
  const imageTop = tile.top + (height - groupHeight) / 2;
  const centerX = (tile.left + tile.right) / 2;
  const image = boxAt(centerX - size / 2, imageTop, size, size);
  const title = boxAt(
    tile.left + TILE_IMAGE_EDGE,
    image.bottom + TILE_IMAGE_GAP,
    width - 2 * TILE_IMAGE_EDGE,
    titleHeight,
  );
  return { image, title };
}

/** Mezi vystředěnými dlaždicemi je aspoň 16 px, kde se to vejde (#156). */
const MIN_CENTERED_TILE_GAP = 16;
/** Vystředěný blok je od lišty, kategorií a výběru kategorie aspoň 8 px (#156). */
const CENTERED_BLOCK_EDGE = 8;

/** Velikost a mezera dlaždic vystředěného bloku (#156). */
interface CenteredGrid {
  readonly columns: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly gap: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Nejmenší dlaždice, na které má obrázek 256 px, v každém směru aspoň tak
 * velká jako dnešní. Větší dlaždice by měla jen prázdné místo navíc.
 */
function largestUsefulTile(today: Size, titleFontSize: number): Size {
  const titleHeight = TILE_TITLE_LINE * titleFontSize;
  return {
    width: Math.max(today.width, MAX_TILE_IMAGE + 2 * TILE_IMAGE_EDGE),
    height: Math.max(
      today.height,
      MAX_TILE_IMAGE + 2 * TILE_IMAGE_EDGE + TILE_IMAGE_GAP + titleHeight,
    ),
  };
}

/** Dnešní dlaždice zvětšená `scale`krát, v každém směru nejvýš na `largest`. */
function scaledTile(today: Size, largest: Size, scale: number): Size {
  return {
    width: Math.min(largest.width, today.width * scale),
    height: Math.min(largest.height, today.height * scale),
  };
}

/**
 * Největší zvětšení dnešní dlaždice v jednom směru, se kterým se `count`
 * dlaždic s mezerou `gap` vejde do `room`; `Infinity`, když se vejdou
 * i největší dlaždice.
 */
function scaleToFit(
  today: number,
  largest: number,
  room: number,
  count: number,
  gap: number,
): number {
  const gaps = (count - 1) * gap;
  return count * largest + gaps <= room ? Infinity : (room - gaps) / (count * today);
}

/** Dnešní dlaždice a největší dlaždice, která má ještě smysl (#156). */
interface TileSizes {
  readonly today: Size;
  readonly largest: Size;
}

/**
 * Nejlepší mřížka pro `count` her s mezerou `gap` v ploše `room` (#156):
 * počet sloupců s největší dlaždicí, při shodě víc sloupců. Dlaždice je
 * dnešní zvětšená ve stejném poměru stran, v každém směru nejvýš na
 * `largest`. `undefined`, když se nevejdou ani dnešní dlaždice.
 */
function bestGridWithGap(
  count: number,
  sizes: TileSizes,
  room: Size,
  gap: number,
): CenteredGrid | undefined {
  const { today, largest } = sizes;
  const largestScale = Math.max(largest.width / today.width, largest.height / today.height);
  let best: { readonly columns: number; readonly scale: number } | undefined;
  for (let columns = count; columns >= 1; columns -= 1) {
    const rows = Math.ceil(count / columns);
    const fitScale = Math.min(
      scaleToFit(today.width, largest.width, room.width, columns, gap),
      scaleToFit(today.height, largest.height, room.height, rows, gap),
    );
    if (fitScale < 1) {
      continue;
    }
    const scale = Math.min(largestScale, fitScale);
    if (best === undefined || scale > best.scale) {
      best = { columns, scale };
    }
  }
  if (best === undefined) {
    return undefined;
  }
  const tile = scaledTile(today, largest, best.scale);
  return { columns: best.columns, tileWidth: tile.width, tileHeight: tile.height, gap };
}

/**
 * Největší dlaždice pro `count` her, které se vejdou do `room` (#156),
 * nikdy menší než dnes a v každém směru nejvýš tak, aby měl obrázek 256 px.
 * Nejdřív se zkouší mezera 16 px (nebo dnešní, když je větší), a když se
 * dnešní dlaždice s ní nevejdou, dnešní mezera (upřesnění 1).
 * `undefined`, když se dnešní dlaždice nevejdou ani tak.
 */
function centeredGridFor(
  count: number,
  today: Size,
  todayGap: number,
  room: Size,
  titleFontSize: number,
): CenteredGrid | undefined {
  const sizes: TileSizes = { today, largest: largestUsefulTile(today, titleFontSize) };
  const widerGap = Math.max(MIN_CENTERED_TILE_GAP, todayGap);
  return (
    bestGridWithGap(count, sizes, room, widerGap) ?? bestGridWithGap(count, sizes, room, todayGap)
  );
}

/** `count` dlaždic mřížky `grid` jako blok uprostřed plochy `area` (#156). */
function centeredTiles(area: MenuBox, grid: CenteredGrid, count: number): MenuBox[] {
  const columns = Math.min(count, grid.columns);
  const rows = Math.ceil(count / grid.columns);
  const blockWidth = columns * grid.tileWidth + (columns - 1) * grid.gap;
  const blockHeight = rows * grid.tileHeight + (rows - 1) * grid.gap;
  const left = area.left + (area.right - area.left - blockWidth) / 2;
  const top = area.top + (area.bottom - area.top - blockHeight) / 2;
  return Array.from({ length: count }, (_, index) =>
    boxAt(
      left + (index % grid.columns) * (grid.tileWidth + grid.gap),
      top + Math.floor(index / grid.columns) * (grid.tileHeight + grid.gap),
      grid.tileWidth,
      grid.tileHeight,
    ),
  );
}

/**
 * Nejmenší vodorovný okraj vystředěného bloku (#156): na telefonu na výšku
 * jako lišta, vedle kategorií menší z mezery ke kategoriím a okraje okna.
 */
function centeredBlockMargin(isRow: boolean, metrics: MenuMetrics): number {
  return isRow ? metrics.sideMargin : Math.min(metrics.columnGap, metrics.sideMargin);
}

/** Plocha `area` bez okrajů `across` vlevo i vpravo a `down` nahoře i dole. */
function roomOf(area: MenuBox, across: number, down: number): Size {
  return {
    width: area.right - area.left - 2 * across,
    height: area.bottom - area.top - 2 * down,
  };
}

/** Co potřebuje mřížka dlaždic z rozložení menu. */
interface TileGridInput {
  readonly mode: LayoutMode;
  readonly metrics: MenuMetrics;
  readonly free: MenuBox;
  /** Mřížka jako před #156 (od ní se posouvá). */
  readonly grid: GridArea;
  /** Volná plocha, ve které stojí vystředěný blok (#156). */
  readonly tileArea: MenuBox;
  /** Levý okraj ořezu kamery mřížky. */
  readonly clipLeft: number;
  /** Spodní okraj lišty, na telefonu na výšku i výběru kategorie. */
  readonly aboveGrid: number;
  readonly isRow: boolean;
  readonly tileCount: number;
  readonly allTileCount: number;
}

interface TileGrid {
  readonly columns: number;
  readonly tiles: readonly MenuBox[];
  /** Dlaždice všech her („Vše“); u posouvané mřížky prázdné (panda tam není). */
  readonly allTiles: readonly MenuBox[];
  readonly tileHeight: number;
  readonly scroll: MenuScrollArea;
}

/** Dlaždice jako před #156: sloupce, velikost a mezera podle zařízení (#67, #69). */
interface TodayTiles {
  readonly columns: number;
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  /** Viditelná plocha posouvané mřížky. */
  readonly viewport: MenuBox;
  /** Vejdou se dlaždice všech her („Vše“) bez posouvání? */
  readonly allFit: boolean;
}

function todayTilesFor(input: TileGridInput): TodayTiles {
  const { mode, metrics, free, grid } = input;
  const gap = metrics.tileGap;
  const columns = columnsFor(mode, grid.right - grid.left, gap);
  const viewport: MenuBox = {
    left: grid.left - VIEWPORT_EDGE,
    right: free.right - VIEWPORT_EDGE,
    top: grid.top - VIEWPORT_EDGE,
    bottom: free.bottom - VIEWPORT_EDGE,
  };
  const allRows = Math.ceil(input.allTileCount / columns);
  const baseHeight = tileHeightFor(mode, grid, gap);
  const height =
    gridBottom(grid, allRows, baseHeight, gap) > viewport.bottom
      ? scrollingTileHeight(baseHeight, viewport.bottom - grid.top, gap, minScrollTileHeight(mode))
      : baseHeight;
  return {
    columns,
    width: (grid.right - grid.left - (columns - 1) * gap) / columns,
    height,
    gap,
    viewport,
    allFit: gridBottom(grid, allRows, height, gap) <= viewport.bottom,
  };
}

/** Mřížka jako před #156, když se dlaždice všech her nevejdou (posouvání #69). */
function scrollingTileGrid(input: TileGridInput, today: TodayTiles): TileGrid {
  const { grid } = input;
  const { columns, width, height, gap, viewport } = today;
  const tiles = Array.from({ length: input.tileCount }, (_, index) =>
    boxAt(
      grid.left + (index % columns) * (width + gap),
      grid.top + Math.floor(index / columns) * (height + gap),
      width,
      height,
    ),
  );
  const rows = Math.ceil(input.tileCount / columns);
  return {
    columns,
    tiles,
    allTiles: [],
    tileHeight: height,
    scroll: {
      viewport,
      clip: {
        left: input.clipLeft,
        right: input.free.right,
        top: Math.max(input.aboveGrid, viewport.top - GRID_CLIP_TOP_RESERVE),
        bottom: input.free.bottom,
      },
      maxOffset:
        rows === 0
          ? 0
          : maxOffsetFor(gridBottom(grid, rows, height, gap), viewport.bottom, grid.bottom),
    },
  };
}

/**
 * Vystředěný blok (#156) se neposouvá: ťuká se a kreslí v celé volné
 * ploše pro dlaždice, viditelná plocha je od lišty a kategorií 4 px.
 */
function centeredTileGrid(input: TileGridInput, centered: CenteredGrid): TileGrid {
  const { tileArea, free } = input;
  return {
    columns: centered.columns,
    tiles: centeredTiles(tileArea, centered, input.tileCount),
    allTiles: centeredTiles(tileArea, centered, input.allTileCount),
    tileHeight: centered.tileHeight,
    scroll: {
      viewport: {
        left: tileArea.left + VIEWPORT_EDGE,
        right: free.right - VIEWPORT_EDGE,
        top: tileArea.top + VIEWPORT_EDGE,
        bottom: free.bottom - VIEWPORT_EDGE,
      },
      clip: { left: input.clipLeft, right: free.right, top: input.aboveGrid, bottom: free.bottom },
      maxOffset: 0,
    },
  };
}

/**
 * Dlaždice menu: když se dlaždice všech her vejdou bez posouvání, jsou
 * větší a uprostřed volné plochy (#156), jinak jako dřív a posouvají se (#69).
 */
function tileGridFor(input: TileGridInput): TileGrid {
  const today = todayTilesFor(input);
  const centered = today.allFit
    ? centeredGridFor(
        input.allTileCount,
        { width: today.width, height: today.height },
        today.gap,
        roomOf(
          input.tileArea,
          centeredBlockMargin(input.isRow, input.metrics),
          CENTERED_BLOCK_EDGE,
        ),
        input.metrics.tileTitleFontSize,
      )
    : undefined;
  return centered === undefined
    ? scrollingTileGrid(input, today)
    : centeredTileGrid(input, centered);
}

export function menuLayoutFor(viewport: Viewport | undefined, content: MenuContent): MenuLayout {
  const mode = chooseLayoutMode(viewport);
  const metrics = metricsFor(mode);
  const free = freeAreaOf(viewport);

  // Horní lišta: profil vlevo, jazyk úplně vpravo a mezi nimi místo
  // vyhrazené pro budoucí volby (#157), aby vpravo od jazyka nebyla díra.
  const barTop = free.top + metrics.barTop;
  const profileSlot = boxAt(
    free.left + metrics.sideMargin,
    barTop,
    metrics.profileWidth,
    BUTTON_SIZE,
  );
  let right = free.right - metrics.sideMargin;
  const languageSlot = boxAt(right - BUTTON_SIZE, barTop, BUTTON_SIZE, BUTTON_SIZE);
  right -= BUTTON_SIZE + metrics.barGap;
  const reservedSlots: MenuBox[] = [];
  for (let index = 0; index < metrics.reservedSlotCount; index += 1) {
    reservedSlots.unshift(boxAt(right - BUTTON_SIZE, barTop, BUTTON_SIZE, BUTTON_SIZE));
    right -= BUTTON_SIZE + metrics.barGap;
  }

  const isRow = mode === 'phonePortrait';
  const direction = isRow ? 'row' : 'column';
  const categoryViewport: MenuBox = isRow
    ? {
        left: free.left + VIEWPORT_EDGE,
        right: free.right - VIEWPORT_EDGE,
        top: free.top + metrics.contentTop - VIEWPORT_EDGE,
        bottom: free.top + metrics.contentTop + BUTTON_SIZE + VIEWPORT_EDGE,
      }
    : {
        left: free.left + VIEWPORT_EDGE,
        right: free.left + metrics.sideMargin + metrics.categoryWidth + VIEWPORT_EDGE,
        top: free.top + metrics.contentTop - VIEWPORT_EDGE,
        bottom: free.bottom - VIEWPORT_EDGE,
      };
  // Na telefonu na výšku jsou kategorie v seznamu výběru (#95), ne v řadě.
  const categories = isRow
    ? []
    : categorySlotsFor(
        (categoryGap) => categoryColumn(free, metrics, content.categoryTitles.length, categoryGap),
        categoryViewport,
        direction,
      );
  const lastCategory = categories[categories.length - 1];
  const categoryEnd = isRow ? free.right - metrics.sideMargin : free.bottom - metrics.sideMargin;
  const categoryMaxOffset =
    lastCategory === undefined
      ? 0
      : maxOffsetFor(
          endOf(lastCategory.hit, direction),
          endOf(categoryViewport, direction),
          categoryEnd,
        );

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
  const barBottom = Math.max(
    profileSlot.bottom,
    languageSlot.bottom,
    ...reservedSlots.map((box) => box.bottom),
  );
  const tileGrid = tileGridFor({
    mode,
    metrics,
    free,
    grid,
    // Pár her (#156): volná plocha vedle kategorií od lišty dolů, na
    // telefonu na výšku přes celou šířku pod tlačítkem výběru kategorie.
    tileArea: {
      left: isRow ? free.left : free.left + metrics.sideMargin + metrics.categoryWidth,
      right: free.right,
      top: isRow ? free.top + metrics.contentTop + BUTTON_SIZE : barBottom,
      bottom: free.bottom,
    },
    // Kamera mřížky kreslí i kousek vedle viditelné plochy: nad ní až po
    // lištu nebo řadu kategorií, do stran a dolů až k okraji volné plochy.
    clipLeft: isRow ? free.left : categoryViewport.right,
    aboveGrid: isRow ? Math.max(barBottom, categoryViewport.bottom) : barBottom,
    isRow,
    tileCount: content.tileCount,
    allTileCount: Math.max(content.tileCount, content.allTileCount ?? content.tileCount),
  });

  const categoryPicker = isRow
    ? categoryPickerFor(
        free,
        profileSlot.left,
        Math.max(languageSlot.right, ...reservedSlots.map((box) => box.right)),
        free.top + metrics.contentTop,
        content.categoryTitles.length,
      )
    : null;

  return {
    mode,
    profileSlot,
    profileBadge: profileBadgeFor(mode, profileSlot, content.profileNickname ?? null),
    languageSlot,
    languageButtonFontSize: LANGUAGE_BUTTON_FONT_SIZE,
    languagePanel: languagePanelFor(free, languageSlot, content.languageNames ?? []),
    reservedSlots,
    categoryDirection: direction,
    categories,
    categoryFontSize: metrics.categoryFontSize,
    categoryTextInset: metrics.categoryTextInset,
    gridColumns: tileGrid.columns,
    tiles: tileGrid.tiles,
    tileRadius: metrics.tileRadius,
    tileSymbolFontSize: tileSymbolFontSize(mode, tileGrid.tileHeight),
    tileTitleFontSize: metrics.tileTitleFontSize,
    tileImages: tileGrid.tiles.map((tile) => tileImageFor(tile, metrics.tileTitleFontSize)),
    gridScroll: tileGrid.scroll,
    categoryScroll: {
      viewport: categoryViewport,
      clip: categoryViewport,
      maxOffset: categoryMaxOffset,
    },
    categoryPicker,
    mascot: menuMascotBox(tileGrid.scroll, tileGrid.allTiles),
  };
}
