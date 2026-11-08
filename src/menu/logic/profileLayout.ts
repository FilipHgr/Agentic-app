/**
 * Rozložení výběru profilu (obrázek P) a formuláře nového profilu (#72)
 * v CSS px okna, i s výřezem a lištou domů. Čistý TypeScript bez Phaseru.
 *
 * Výběr profilu: kolečka v pořadí založení, pod každým přezdívka 16 px
 * nejvýš na dva řádky, vpravo od něj tužka 64 px (#107), za nimi „+“ bez
 * tužky. Vpravo nahoře plné tlačítko jazyka a pod ním nabídka jazyků jako
 * v menu (#70). Na iPadu kolečka 140 px v řadách co nejvyrovnanějších
 * (6 koleček ve 2 řadách po 3), na telefonu 110 px: na šířku stejně jako
 * na iPadu, na výšku jeden sloupec, a když se kolečka do jednoho sloupce
 * nevejdou, dva sloupce. Na menších telefonech se nejdřív zúží mezery
 * (až na 8 px) a pak zmenší kolečka (nejvýš na 92 px), nikde se neposouvá.
 *
 * Formulář (obrázky „5 · Mřížka písmen“ a „6 · Formulář, 2. krok“):
 * - telefon na výšku: nahoře nadpis a „1 / 2“, pole, mřížka 5 sloupců,
 *   dole u palce zpět a →; ve 2. kroku náhled, přezdívka a paleta 4 × 2,
 * - telefon na šířku: nahoře zpět, pole (přezdívka) a → (✓), pod tím
 *   mřížka 10 × 3 (náhled a paleta v jedné řadě), bez nadpisu,
 * - iPad: nadpis uprostřed, pole, mřížka s klávesami 84 px, pod ní zpět
 *   a →; ve 2. kroku náhled 180 px a paleta v jedné řadě.
 * Přepínač vrstvy a ⌫ jsou na konci poslední řady mřížky, v obou vrstvách
 * na stejném místě, takže se při přepnutí nic nepohne.
 *
 * Úprava profilu (#73, obrázky 6 a 8): ve 2. kroku je vpravo vedle náhledu
 * koš 64 px, ostatní plochy zůstanou, kde jsou bez něj. Potvrzení smazání
 * je bílý rámeček uprostřed nad formulářem: kolečko profilu, přezdívka,
 * otázka a dole „Smazat“ vlevo a „Zpět“ vpravo, na straně ✓. Na telefonu
 * na šířku je kolečko vlevo vedle textů, aby se rámeček vešel na výšku.
 */

import { boxAt, freeAreaOf, languagePanelFor } from './menuLayout';
import type { MenuBox, MenuLanguagePanel } from './menuLayout';
import { letterKeys } from './letterGrid';
import type { LetterLayer } from './letterGrid';
import { PROFILE_COLORS } from '../../shared/logic/profiles';
import { chooseLayoutMode } from '../../shared/logic/viewportLayout';
import type { LayoutMode, Viewport } from '../../shared/logic/viewportLayout';

/** Ťukací plochy a mezery podle společných pravidel. */
const BUTTON_SIZE = 64;
const MIN_GAP = 8;
/** Nic není blíž než 4 px k okraji volné plochy. */
const EDGE = 4;

// ---------------------------------------------------------------------------
// Výběr profilu
// ---------------------------------------------------------------------------

export interface ProfilePickerSlot {
  /** Kolečko profilu, zároveň ťukací plocha. */
  readonly circle: MenuBox;
  /** Plocha přezdívky pod kolečkem (dva řádky). */
  readonly nickname: MenuBox;
  /** Tužka vpravo od kolečka (#107): otevře úpravu profilu. */
  readonly pencil: MenuBox;
}

export interface ProfilePickerLayout {
  readonly mode: LayoutMode;
  readonly profiles: readonly ProfilePickerSlot[];
  /** Kolečko „+“ za profily, `null` při limitu profilů. */
  readonly add: MenuBox | null;
  readonly symbolFontSize: number;
  readonly nicknameFontSize: number;
  readonly nicknameMaxLines: number;
  readonly nicknameLineHeight: number;
  readonly languageSlot: MenuBox;
  readonly languageButtonFontSize: number;
  readonly languagePanel: MenuLanguagePanel;
}

export interface ProfilePickerContent {
  readonly profileCount: number;
  readonly showAdd: boolean;
  /** Vlastní názvy jazyků v pořadí nabídky (#70). */
  readonly languageNames: readonly string[];
}

interface PickerMetrics {
  /** Největší kolečko; na menších oknech se zmenší až na `minCircle`. */
  readonly circle: number;
  readonly minCircle: number;
  /** Vodorovná mezera mezi tužkou a dalším kolečkem; při nedostatku místa až 8 px. */
  readonly columnGap: number;
  /** Svislá mezera mezi spodkem přezdívky a dalším kolečkem; při nedostatku místa až 8 px. */
  readonly rowGap: number;
  readonly languageSize: number;
  readonly languageInset: number;
  readonly languageFontSize: number;
}

/** Zkratka jazyka na větším tlačítku iPadu (obrázek 7). */
const TABLET_LANGUAGE_FONT_SIZE = 24;

/** iPad podle obrázku P: kolečka 140 px, tlačítko jazyka 76 px jako kolečko nastavení. */
const TABLET_PICKER: PickerMetrics = {
  circle: 140,
  minCircle: 140,
  columnGap: 56,
  rowGap: 32,
  languageSize: 76,
  languageInset: 12,
  languageFontSize: TABLET_LANGUAGE_FONT_SIZE,
};

/**
 * Telefon na šířku (obrázek tuzka-telefon-sirka.png, #107): kolečka 110 px,
 * 6 koleček ve 2 řadách po 3; v nejmenším okně se kolečka zmenší až na 92 px.
 */
const PHONE_LANDSCAPE_PICKER: PickerMetrics = {
  circle: 110,
  minCircle: 92,
  columnGap: 16,
  rowGap: 16,
  languageSize: BUTTON_SIZE,
  languageInset: 8,
  languageFontSize: 20,
};

/** Telefon na výšku (obrázek tuzka-telefon-vyska.png, #107): jeden nebo dva sloupce. */
const PHONE_PORTRAIT_PICKER: PickerMetrics = {
  ...PHONE_LANDSCAPE_PICKER,
  rowGap: 24,
};

/** Přezdívka pod kolečkem: 16 px, nejvýš dva řádky po 20 px, 4 px pod kolečkem. */
const NICKNAME_FONT_SIZE = 16;
const NICKNAME_MAX_LINES = 2;
const NICKNAME_LINE_HEIGHT = 20;
const NICKNAME_GAP = 4;
/** Přezdívka přesahuje kolečko z každé strany o 4 px (aby se i u 92 px vešlo 6 písmen W). */
const NICKNAME_OVERHANG = 4;

/** Tužka (#107): kulaté tlačítko 64 px vpravo od kolečka, 8 px od něj i od okraje plochy. */
const PENCIL_SIZE = BUTTON_SIZE;
const PENCIL_GAP = MIN_GAP;
const PENCIL_EDGE = MIN_GAP;

function pickerMetricsFor(mode: LayoutMode): PickerMetrics {
  switch (mode) {
    case 'phoneLandscape':
      return PHONE_LANDSCAPE_PICKER;
    case 'phonePortrait':
      return PHONE_PORTRAIT_PICKER;
    case 'tablet':
    case 'scaled':
      return TABLET_PICKER;
  }
}

function insetBox(outer: MenuBox, margin: number): MenuBox {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

function widthOf(box: MenuBox): number {
  return box.right - box.left;
}

function heightOf(box: MenuBox): number {
  return box.bottom - box.top;
}

/** Jedno kolečko s přezdívkou pod ním a tužkou vpravo. */
interface PickerItemSize {
  readonly circle: number;
  /** Od levého okraje kolečka po pravý okraj tužky. */
  readonly width: number;
  /** Od horního okraje kolečka po spodek přezdívky. */
  readonly height: number;
}

function itemSizeFor(circle: number): PickerItemSize {
  return {
    circle,
    width: circle + PENCIL_GAP + PENCIL_SIZE,
    height: circle + NICKNAME_GAP + NICKNAME_MAX_LINES * NICKNAME_LINE_HEIGHT,
  };
}

/** Mřížka koleček: sloupce, řady, mezery a levý horní roh prvního kolečka. */
interface PickerGrid {
  readonly item: PickerItemSize;
  readonly columns: number;
  readonly rows: number;
  readonly columnGap: number;
  readonly rowGap: number;
  readonly left: number;
  readonly top: number;
}

/** Mezera mezi `count` prvky, aby se vešly do `space`: nejvýš `preferred`, `null` pod 8 px. */
function gapThatFits(space: number, count: number, size: number, preferred: number): number | null {
  if (count <= 1) {
    return 0;
  }
  const gap = Math.min(preferred, (space - count * size) / (count - 1));
  return gap >= MIN_GAP ? gap : null;
}

/**
 * Kolik sloupců koleček: na výšku jeden, a dva, jen když se kolečka do
 * jednoho sloupce nevejdou; jinak co nejvíc a řady co nejvyrovnanější.
 */
function pickerColumns(
  mode: LayoutMode,
  items: number,
  space: { readonly width: number; readonly height: number },
  item: PickerItemSize,
  metrics: PickerMetrics,
): number {
  if (mode === 'phonePortrait') {
    const rows = Math.floor((space.height + metrics.rowGap) / (item.height + metrics.rowGap));
    return items <= Math.max(1, rows) ? 1 : 2;
  }
  const maxColumns = Math.floor(
    (space.width + metrics.columnGap) / (item.width + metrics.columnGap),
  );
  const rows = Math.ceil(items / Math.max(1, maxColumns));
  return Math.max(1, Math.ceil(items / rows));
}

/**
 * Mřížka s kolečky `circle` v `columns` sloupcích, nebo `null`, když se do
 * volné plochy nevejde. Kolečka jsou uprostřed okna, vždy níž než horní
 * okraj tlačítka jazyka; když by tužka sahala k tlačítku jazyka, jsou pod ním.
 */
function pickerGridFor(
  items: number,
  columns: number,
  circle: number,
  free: MenuBox,
  languageSlot: MenuBox,
  metrics: PickerMetrics,
): PickerGrid | null {
  const item = itemSizeFor(circle);
  const width = widthOf(free) - 2 * PENCIL_EDGE;
  const bottom = free.bottom - EDGE;
  const rows = Math.ceil(items / columns);
  const columnGap = gapThatFits(width, columns, item.width, metrics.columnGap);
  if (columnGap === null) {
    return null;
  }
  const blockWidth = columns * item.width + (columns - 1) * columnGap;
  const left = free.left + (widthOf(free) - blockWidth) / 2;
  const reachesLanguage = left + blockWidth > languageSlot.left - MIN_GAP;
  const highest = reachesLanguage ? languageSlot.bottom + MIN_GAP : languageSlot.top + EDGE;
  const rowGap = gapThatFits(bottom - highest, rows, item.height, metrics.rowGap);
  if (rowGap === null) {
    return null;
  }
  const blockHeight = rows * item.height + (rows - 1) * rowGap;
  const top = Math.max(highest, free.top + (heightOf(free) - blockHeight) / 2);
  if (top + blockHeight > bottom) {
    return null;
  }
  return { item, columns, rows, columnGap, rowGap, left, top };
}

/**
 * Počet sloupců podle největších koleček, pak největší kolečka, se kterými
 * se všechno vejde; nevejde-li se nic, nejmenší kolečka od horního okraje.
 */
function largestPickerGrid(
  mode: LayoutMode,
  items: number,
  free: MenuBox,
  languageSlot: MenuBox,
  metrics: PickerMetrics,
): PickerGrid {
  // Na výšku zůstane pod kolečky stejně místa jako nad nimi pro tlačítko jazyka.
  const reservedAbove = languageSlot.bottom + MIN_GAP - free.top;
  const columns = pickerColumns(
    mode,
    items,
    { width: widthOf(free) - 2 * PENCIL_EDGE, height: heightOf(free) - 2 * reservedAbove },
    itemSizeFor(metrics.circle),
    metrics,
  );
  for (let circle = metrics.circle; circle >= metrics.minCircle; circle -= 1) {
    const grid = pickerGridFor(items, columns, circle, free, languageSlot, metrics);
    if (grid !== null) {
      return grid;
    }
  }
  // Nevejde se ani tak (okno mimo zkušební okna): nejmenší kolečka pod tlačítkem jazyka.
  return {
    item: itemSizeFor(metrics.minCircle),
    columns,
    rows: Math.ceil(items / columns),
    columnGap: MIN_GAP,
    rowGap: MIN_GAP,
    left: free.left + PENCIL_EDGE,
    top: languageSlot.bottom + MIN_GAP,
  };
}

function pickerSlotAt(grid: PickerGrid, index: number): ProfilePickerSlot {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  const size = grid.item.circle;
  const left = grid.left + column * (grid.item.width + grid.columnGap);
  const top = grid.top + row * (grid.item.height + grid.rowGap);
  const circle = boxAt(left, top, size, size);
  return {
    circle,
    nickname: boxAt(
      left - NICKNAME_OVERHANG,
      circle.bottom + NICKNAME_GAP,
      size + 2 * NICKNAME_OVERHANG,
      NICKNAME_MAX_LINES * NICKNAME_LINE_HEIGHT,
    ),
    pencil: boxAt(circle.right + PENCIL_GAP, top, PENCIL_SIZE, PENCIL_SIZE),
  };
}

export function profilePickerLayoutFor(
  viewport: Viewport | undefined,
  content: ProfilePickerContent,
): ProfilePickerLayout {
  const mode = chooseLayoutMode(viewport);
  const metrics = pickerMetricsFor(mode);
  const free = freeAreaOf(viewport);

  const languageSlot = boxAt(
    free.right - metrics.languageInset - metrics.languageSize,
    free.top + metrics.languageInset,
    metrics.languageSize,
    metrics.languageSize,
  );

  const items = content.profileCount + (content.showAdd ? 1 : 0);
  const grid = largestPickerGrid(mode, Math.max(1, items), free, languageSlot, metrics);
  const slots = Array.from({ length: items }, (_, index) => pickerSlotAt(grid, index));

  const profiles = slots.slice(0, content.profileCount);
  const addSlot = content.showAdd ? slots[content.profileCount] : undefined;
  return {
    mode,
    profiles,
    add: addSlot?.circle ?? null,
    symbolFontSize: grid.item.circle / 2,
    nicknameFontSize: NICKNAME_FONT_SIZE,
    nicknameMaxLines: NICKNAME_MAX_LINES,
    nicknameLineHeight: NICKNAME_LINE_HEIGHT,
    languageSlot,
    languageButtonFontSize: metrics.languageFontSize,
    languagePanel: languagePanelFor(free, languageSlot, content.languageNames),
  };
}

// ---------------------------------------------------------------------------
// Formulář nového profilu
// ---------------------------------------------------------------------------

/** Nadpis kroku (jen tam, kde je na něj podle obrázku místo) a „1 / 2“ vedle něj. */
interface StepHeading {
  readonly title: MenuBox | null;
  readonly titleFontSize: number;
  /** Kde je „1 / 2“ nebo „2 / 2“ (symbol v kódu), `null` bez něj. */
  readonly stepCounter: MenuBox | null;
  readonly stepCounterFontSize: number;
}

export interface NicknameStepLayout extends StepHeading {
  /** Ťukací plochy kláves v pořadí `letterKeys(layer)`. */
  readonly keys: readonly MenuBox[];
  readonly keyFontSize: number;
  readonly keyRadius: number;
  readonly field: MenuBox;
  readonly fieldFontSize: number;
  readonly fieldRadius: number;
  readonly back: MenuBox;
  readonly next: MenuBox;
}

export interface ColorStepLayout extends StepHeading {
  readonly preview: MenuBox;
  readonly previewSymbolFontSize: number;
  /** Přezdívka u náhledu. */
  readonly nickname: MenuBox;
  readonly nicknameFontSize: number;
  /** Barvy v pořadí palety. */
  readonly swatches: readonly MenuBox[];
  readonly back: MenuBox;
  readonly save: MenuBox;
  /** Koš vpravo vedle náhledu (#73); bez koše (nový nebo poslední profil) `null`. */
  readonly trash: MenuBox | null;
}

/** Potvrzení smazání profilu (#73, obrázek 8). */
export interface DeleteConfirmLayout {
  /** Bílý rámeček nad ztmaveným formulářem. */
  readonly panel: MenuBox;
  readonly panelRadius: number;
  readonly preview: MenuBox;
  readonly previewSymbolFontSize: number;
  readonly nickname: MenuBox;
  readonly nicknameFontSize: number;
  /** „Smazat profil?“ */
  readonly question: MenuBox;
  readonly questionFontSize: number;
  /** „Smazat“ (červené), vlevo. */
  readonly confirm: MenuBox;
  /** „Zpět“ (šedé), vpravo na straně ✓. */
  readonly cancel: MenuBox;
  readonly buttonFontSize: number;
}

/** Jak je formulář rozložený: telefon na výšku, telefon na šířku, nebo iPad. */
type FormFamily = 'portrait' | 'landscape' | 'tablet';

/** Všechny klávesy mřížky: 26 písmen, přepínač a ⌫ (větší vrstva). */
const GRID_SLOTS = letterKeys('base').length;

const PHONE_KEY = 64;
const PHONE_KEY_GAP = 8;
const PHONE_KEY_FONT_SIZE = 28;
const PHONE_KEY_RADIUS = 16;
/** Široké tlačítko → a ✓ na telefonu. */
const PHONE_WIDE_BUTTON = 136;
const PORTRAIT_COLUMNS = 5;
const LANDSCAPE_COLUMNS = 10;
const PORTRAIT_FIELD_FONT_SIZE = 24;
const LANDSCAPE_FIELD_FONT_SIZE = 26;
const PHONE_TITLE_FONT_SIZE = 17;
const PHONE_TITLE_HEIGHT = 24;
const PHONE_TITLE_TOP = 8;
const PHONE_COUNTER_FONT_SIZE = 15;
const PHONE_COUNTER_WIDTH = 52;
/** Pole na výšku začíná pod nadpisem. */
const PORTRAIT_FIELD_TOP = 40;
const PORTRAIT_GRID_GAP = 16;

const TABLET_KEY = 84;
const TABLET_KEY_GAP = 12;
const TABLET_KEY_FONT_SIZE = 34;
const TABLET_KEY_RADIUS = 20;
const TABLET_MAX_COLUMNS = 10;
/** Užší mřížka by měla víc než 4 řady a nevešla by se. */
const TABLET_MIN_COLUMNS = 7;
const TABLET_FIELD_HEIGHT = 84;
const TABLET_FIELD_FONT_SIZE = 40;
/** Pole je o tolik užší než mřížka (obrázek), pokud se přezdívka vejde. */
const TABLET_FIELD_NARROWING = 240;
const TABLET_BUTTON = 76;
const TABLET_WIDE_BUTTON = 160;
const TABLET_TITLE_FONT_SIZE = 28;
const TABLET_TITLE_HEIGHT = 36;
const TABLET_TITLE_GAP = 16;
const TABLET_FIELD_GAP = 36;
const TABLET_BUTTONS_GAP = 40;
const TABLET_PREVIEW = 180;
const TABLET_SWATCH = 84;
const TABLET_SWATCH_MAX_GAP = 20;

const NICKNAME_WIDEST_LETTERS = 12;
/** Okraj textu v poli a u přezdívky. */
const TEXT_PADDING = 8;

const PHONE_PREVIEW_PORTRAIT = 140;
const PHONE_PREVIEW_LANDSCAPE = 110;
const PHONE_SWATCH = 64;
const PORTRAIT_SWATCH_GAP = 16;
const PORTRAIT_SWATCH_COLUMNS = 4;
const COLOR_NICKNAME_FONT_SIZE = 20;
const TABLET_COLOR_NICKNAME_FONT_SIZE = 26;
const COLOR_NICKNAME_HEIGHT = 32;
const TABLET_COLOR_NICKNAME_HEIGHT = 36;

function gridWidth(columns: number, key: number, gap: number): number {
  return columns * key + (columns - 1) * gap;
}

function tabletColumns(usableWidth: number): number {
  const fit = Math.floor((usableWidth + TABLET_KEY_GAP) / (TABLET_KEY + TABLET_KEY_GAP));
  return Math.min(TABLET_MAX_COLUMNS, fit);
}

function tabletGridHeight(columns: number): number {
  const rows = Math.ceil(GRID_SLOTS / columns);
  return gridWidth(rows, TABLET_KEY, TABLET_KEY_GAP);
}

/** Výška 1. kroku na iPadu: nadpis, pole, mřížka a tlačítka. */
function tabletNicknameHeight(columns: number): number {
  return (
    TABLET_TITLE_HEIGHT +
    TABLET_TITLE_GAP +
    TABLET_FIELD_HEIGHT +
    TABLET_FIELD_GAP +
    tabletGridHeight(columns) +
    TABLET_BUTTONS_GAP +
    TABLET_BUTTON
  );
}

/**
 * Rozložení formuláře: telefon podle svého okna, iPad a zmenšené zobrazení
 * s velkými klávesami, když se vejdou, jinak jako telefon.
 */
function formFamilyFor(mode: LayoutMode, usable: MenuBox): FormFamily {
  if (mode === 'phonePortrait') {
    return 'portrait';
  }
  if (mode === 'phoneLandscape') {
    return 'landscape';
  }
  const columns = tabletColumns(widthOf(usable));
  if (columns >= TABLET_MIN_COLUMNS && tabletNicknameHeight(columns) <= heightOf(usable)) {
    return 'tablet';
  }
  const landscapeWidth = gridWidth(LANDSCAPE_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  return widthOf(usable) >= landscapeWidth ? 'landscape' : 'portrait';
}

/** Klávesy mřížky: písmena od začátku, přepínač a ⌫ na konci poslední řady. */
function keyBoxes(
  layer: LetterLayer,
  grid: { left: number; top: number; columns: number; key: number; gap: number },
): MenuBox[] {
  const rows = Math.ceil(GRID_SLOTS / grid.columns);
  const lastSlot = rows * grid.columns - 1;
  const at = (slot: number): MenuBox =>
    boxAt(
      grid.left + (slot % grid.columns) * (grid.key + grid.gap),
      grid.top + Math.floor(slot / grid.columns) * (grid.key + grid.gap),
      grid.key,
      grid.key,
    );
  let letterSlot = 0;
  return letterKeys(layer).map((key) => {
    switch (key.kind) {
      case 'letter':
        letterSlot += 1;
        return at(letterSlot - 1);
      case 'switch':
        return at(lastSlot - 1);
      case 'backspace':
        return at(lastSlot);
    }
  });
}

/** Nadpis vlevo nahoře a „1 / 2“ vpravo (telefon na výšku). */
function portraitHeading(free: MenuBox, left: number, width: number): StepHeading {
  const top = free.top + PHONE_TITLE_TOP;
  const right = left + width;
  return {
    title: {
      left,
      right: right - PHONE_COUNTER_WIDTH - MIN_GAP,
      top,
      bottom: top + PHONE_TITLE_HEIGHT,
    },
    titleFontSize: PHONE_TITLE_FONT_SIZE,
    stepCounter: {
      left: right - PHONE_COUNTER_WIDTH,
      right,
      top,
      bottom: top + PHONE_TITLE_HEIGHT,
    },
    stepCounterFontSize: PHONE_COUNTER_FONT_SIZE,
  };
}

const NO_HEADING: StepHeading = {
  title: null,
  titleFontSize: PHONE_TITLE_FONT_SIZE,
  stepCounter: null,
  stepCounterFontSize: PHONE_COUNTER_FONT_SIZE,
};

function tabletHeading(left: number, width: number, top: number): StepHeading {
  return {
    title: boxAt(left, top, width, TABLET_TITLE_HEIGHT),
    titleFontSize: TABLET_TITLE_FONT_SIZE,
    stepCounter: null,
    stepCounterFontSize: PHONE_COUNTER_FONT_SIZE,
  };
}

/** Zpět a → (✓) u palce dole na telefonu na výšku. */
function portraitButtons(
  free: MenuBox,
  left: number,
  width: number,
  above: number,
): { back: MenuBox; forward: MenuBox } {
  const top = Math.max(above + MIN_GAP, free.bottom - EDGE - PHONE_KEY);
  return {
    back: boxAt(left, top, PHONE_KEY, PHONE_KEY),
    forward: boxAt(left + width - PHONE_WIDE_BUTTON, top, PHONE_WIDE_BUTTON, PHONE_KEY),
  };
}

/** Horní řada na telefonu na šířku: zpět, střed (pole nebo přezdívka) a → (✓). */
function landscapeTopRow(
  left: number,
  width: number,
  top: number,
): { back: MenuBox; middle: MenuBox; forward: MenuBox } {
  const back = boxAt(left, top, PHONE_KEY, PHONE_KEY);
  const forward = boxAt(left + width - PHONE_WIDE_BUTTON, top, PHONE_WIDE_BUTTON, PHONE_KEY);
  const middle: MenuBox = {
    left: back.right + MIN_GAP,
    right: forward.left - MIN_GAP,
    top,
    bottom: top + PHONE_KEY,
  };
  return { back, middle, forward };
}

/** Horní okraj obsahu vysokého `height` uprostřed volné plochy, aspoň 4 px od okraje. */
function centeredTop(free: MenuBox, height: number): number {
  return free.top + Math.max(EDGE, (heightOf(free) - height) / 2);
}

function centeredLeft(free: MenuBox, width: number): number {
  return free.left + (widthOf(free) - width) / 2;
}

function portraitNicknameStep(free: MenuBox, layer: LetterLayer): NicknameStepLayout {
  const width = gridWidth(PORTRAIT_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const left = centeredLeft(free, width);
  const field = boxAt(left, free.top + PORTRAIT_FIELD_TOP, width, PHONE_KEY);
  const rows = Math.ceil(GRID_SLOTS / PORTRAIT_COLUMNS);
  const gridHeight = gridWidth(rows, PHONE_KEY, PHONE_KEY_GAP);
  const roomy =
    field.bottom + PORTRAIT_GRID_GAP + gridHeight + MIN_GAP + PHONE_KEY <= free.bottom - EDGE;
  const gridTop = field.bottom + (roomy ? PORTRAIT_GRID_GAP : MIN_GAP);
  const buttons = portraitButtons(free, left, width, gridTop + gridHeight);
  return {
    ...portraitHeading(free, left, width),
    keys: keyBoxes(layer, {
      left,
      top: gridTop,
      columns: PORTRAIT_COLUMNS,
      key: PHONE_KEY,
      gap: PHONE_KEY_GAP,
    }),
    keyFontSize: PHONE_KEY_FONT_SIZE,
    keyRadius: PHONE_KEY_RADIUS,
    field,
    fieldFontSize: PORTRAIT_FIELD_FONT_SIZE,
    fieldRadius: PHONE_KEY_RADIUS,
    back: buttons.back,
    next: buttons.forward,
  };
}

function landscapeNicknameStep(free: MenuBox, layer: LetterLayer): NicknameStepLayout {
  const width = gridWidth(LANDSCAPE_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const rows = Math.ceil(GRID_SLOTS / LANDSCAPE_COLUMNS);
  const height = PHONE_KEY + MIN_GAP + gridWidth(rows, PHONE_KEY, PHONE_KEY_GAP);
  const left = centeredLeft(free, width);
  const top = centeredTop(free, height);
  const row = landscapeTopRow(left, width, top);
  return {
    ...NO_HEADING,
    keys: keyBoxes(layer, {
      left,
      top: row.back.bottom + MIN_GAP,
      columns: LANDSCAPE_COLUMNS,
      key: PHONE_KEY,
      gap: PHONE_KEY_GAP,
    }),
    keyFontSize: PHONE_KEY_FONT_SIZE,
    keyRadius: PHONE_KEY_RADIUS,
    field: row.middle,
    fieldFontSize: LANDSCAPE_FIELD_FONT_SIZE,
    fieldRadius: PHONE_KEY_RADIUS,
    back: row.back,
    next: row.forward,
  };
}

/** Šířka obsahu formuláře na iPadu (mřížka písmen). */
function tabletContentWidth(usable: MenuBox): number {
  return gridWidth(tabletColumns(widthOf(usable)), TABLET_KEY, TABLET_KEY_GAP);
}

function tabletNicknameStep(
  free: MenuBox,
  usable: MenuBox,
  layer: LetterLayer,
): NicknameStepLayout {
  const columns = tabletColumns(widthOf(usable));
  const width = gridWidth(columns, TABLET_KEY, TABLET_KEY_GAP);
  const left = centeredLeft(free, width);
  const top = centeredTop(free, tabletNicknameHeight(columns));
  const heading = tabletHeading(left, width, top);
  const widestNickname = NICKNAME_WIDEST_LETTERS * TABLET_FIELD_FONT_SIZE + 2 * TEXT_PADDING;
  const narrowField = width - TABLET_FIELD_NARROWING;
  const fieldWidth = narrowField >= widestNickname ? narrowField : width;
  const field = boxAt(
    left + (width - fieldWidth) / 2,
    top + TABLET_TITLE_HEIGHT + TABLET_TITLE_GAP,
    fieldWidth,
    TABLET_FIELD_HEIGHT,
  );
  const gridTop = field.bottom + TABLET_FIELD_GAP;
  const buttonsTop = gridTop + tabletGridHeight(columns) + TABLET_BUTTONS_GAP;
  return {
    ...heading,
    keys: keyBoxes(layer, { left, top: gridTop, columns, key: TABLET_KEY, gap: TABLET_KEY_GAP }),
    keyFontSize: TABLET_KEY_FONT_SIZE,
    keyRadius: TABLET_KEY_RADIUS,
    field,
    fieldFontSize: TABLET_FIELD_FONT_SIZE,
    fieldRadius: TABLET_KEY_RADIUS,
    back: boxAt(left, buttonsTop, TABLET_BUTTON, TABLET_BUTTON),
    next: boxAt(left + width - TABLET_WIDE_BUTTON, buttonsTop, TABLET_WIDE_BUTTON, TABLET_BUTTON),
  };
}

export function nicknameStepLayoutFor(
  viewport: Viewport | undefined,
  content: { readonly layer: LetterLayer },
): NicknameStepLayout {
  const free = freeAreaOf(viewport);
  const usable = insetBox(free, EDGE);
  switch (formFamilyFor(chooseLayoutMode(viewport), usable)) {
    case 'portrait':
      return portraitNicknameStep(free, content.layer);
    case 'landscape':
      return landscapeNicknameStep(free, content.layer);
    case 'tablet':
      return tabletNicknameStep(free, usable, content.layer);
  }
}

/** Kolečka palety v řadách po `columns`, celá paleta uprostřed od `top`. */
function swatchBoxes(
  free: MenuBox,
  top: number,
  columns: number,
  size: number,
  gap: number,
): MenuBox[] {
  const left = centeredLeft(free, gridWidth(columns, size, gap));
  return PROFILE_COLORS.map((_, index) =>
    boxAt(
      left + (index % columns) * (size + gap),
      top + Math.floor(index / columns) * (size + gap),
      size,
      size,
    ),
  );
}

/** Náhled kolečka vodorovně uprostřed. */
function previewBox(free: MenuBox, top: number, size: number): MenuBox {
  return boxAt(centeredLeft(free, size), top, size, size);
}

/** Koš 64 px: mezera od náhledu 32 px jako na obrázku, v úzkém okně menší. */
const TRASH_SIZE = BUTTON_SIZE;
const TRASH_PREVIEW_GAP = 32;

/**
 * Koš vpravo vedle náhledu, svisle uprostřed náhledu. Nikdy nepřeteče za
 * okraj volné plochy: v úzkém okně se mezera od náhledu zmenší.
 */
function trashBox(preview: MenuBox, usable: MenuBox): MenuBox {
  const room = usable.right - TRASH_SIZE - preview.right;
  const gap = Math.min(TRASH_PREVIEW_GAP, Math.max(0, room));
  const left = Math.min(preview.right + gap, usable.right - TRASH_SIZE);
  const middle = (preview.top + preview.bottom) / 2;
  return boxAt(left, middle - TRASH_SIZE / 2, TRASH_SIZE, TRASH_SIZE);
}

/** Bez koše `ColorStepLayout`, ale s ním (`trash`) doplní volající. */
type ColorStepWithoutTrash = Omit<ColorStepLayout, 'trash'>;

function portraitColorStep(free: MenuBox): ColorStepWithoutTrash {
  const width = gridWidth(PORTRAIT_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const left = centeredLeft(free, width);
  const preview = previewBox(free, free.top + PORTRAIT_FIELD_TOP, PHONE_PREVIEW_PORTRAIT);
  const nickname = boxAt(left, preview.bottom + 12, width, COLOR_NICKNAME_HEIGHT);
  const swatches = swatchBoxes(
    free,
    nickname.bottom + 32,
    PORTRAIT_SWATCH_COLUMNS,
    PHONE_SWATCH,
    PORTRAIT_SWATCH_GAP,
  );
  const lastSwatch = swatches[swatches.length - 1];
  const buttons = portraitButtons(free, left, width, lastSwatch?.bottom ?? nickname.bottom);
  return {
    ...portraitHeading(free, left, width),
    preview,
    previewSymbolFontSize: PHONE_PREVIEW_PORTRAIT / 2,
    nickname,
    nicknameFontSize: COLOR_NICKNAME_FONT_SIZE,
    swatches,
    back: buttons.back,
    save: buttons.forward,
  };
}

function landscapeColorStep(free: MenuBox): ColorStepWithoutTrash {
  const width = gridWidth(LANDSCAPE_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const gap = 12;
  const height = PHONE_KEY + gap + PHONE_PREVIEW_LANDSCAPE + gap + PHONE_SWATCH;
  const left = centeredLeft(free, width);
  const top = centeredTop(free, height);
  const row = landscapeTopRow(left, width, top);
  const preview = previewBox(free, row.back.bottom + gap, PHONE_PREVIEW_LANDSCAPE);
  return {
    ...NO_HEADING,
    preview,
    previewSymbolFontSize: PHONE_PREVIEW_LANDSCAPE / 2,
    nickname: row.middle,
    nicknameFontSize: COLOR_NICKNAME_FONT_SIZE,
    swatches: swatchBoxes(free, preview.bottom + gap, PROFILE_COLORS.length, PHONE_SWATCH, MIN_GAP),
    back: row.back,
    save: row.forward,
  };
}

function tabletColorStep(free: MenuBox, usable: MenuBox): ColorStepWithoutTrash {
  const width = tabletContentWidth(usable);
  const left = centeredLeft(free, width);
  const count = PROFILE_COLORS.length;
  const swatchGap = Math.max(
    MIN_GAP,
    Math.min(
      TABLET_SWATCH_MAX_GAP,
      Math.floor((widthOf(usable) - count * TABLET_SWATCH) / (count - 1)),
    ),
  );
  const previewGap = 24;
  const nicknameGap = 12;
  const swatchesGap = 40;
  const buttonsGap = 64;
  const height =
    TABLET_TITLE_HEIGHT +
    previewGap +
    TABLET_PREVIEW +
    nicknameGap +
    TABLET_COLOR_NICKNAME_HEIGHT +
    swatchesGap +
    TABLET_SWATCH +
    buttonsGap +
    TABLET_BUTTON;
  const top = centeredTop(free, height);
  const heading = tabletHeading(left, width, top);
  const preview = previewBox(free, top + TABLET_TITLE_HEIGHT + previewGap, TABLET_PREVIEW);
  const nickname = boxAt(left, preview.bottom + nicknameGap, width, TABLET_COLOR_NICKNAME_HEIGHT);
  const swatches = swatchBoxes(
    free,
    nickname.bottom + swatchesGap,
    count,
    TABLET_SWATCH,
    swatchGap,
  );
  const buttonsTop = nickname.bottom + swatchesGap + TABLET_SWATCH + buttonsGap;
  return {
    ...heading,
    preview,
    previewSymbolFontSize: TABLET_PREVIEW / 2,
    nickname,
    nicknameFontSize: TABLET_COLOR_NICKNAME_FONT_SIZE,
    swatches,
    back: boxAt(left, buttonsTop, TABLET_BUTTON, TABLET_BUTTON),
    save: boxAt(left + width - TABLET_WIDE_BUTTON, buttonsTop, TABLET_WIDE_BUTTON, TABLET_BUTTON),
  };
}

function colorStepWithoutTrash(free: MenuBox, usable: MenuBox, family: FormFamily) {
  switch (family) {
    case 'portrait':
      return portraitColorStep(free);
    case 'landscape':
      return landscapeColorStep(free);
    case 'tablet':
      return tabletColorStep(free, usable);
  }
}

/** 2. krok formuláře; `withTrash` jen u úpravy profilu, když nejde o poslední profil. */
export function colorStepLayoutFor(
  viewport: Viewport | undefined,
  options: { readonly withTrash?: boolean } = {},
): ColorStepLayout {
  const free = freeAreaOf(viewport);
  const usable = insetBox(free, EDGE);
  const family = formFamilyFor(chooseLayoutMode(viewport), usable);
  const layout = colorStepWithoutTrash(free, usable, family);
  return {
    ...layout,
    trash: options.withTrash === true ? trashBox(layout.preview, usable) : null,
  };
}

// ---------------------------------------------------------------------------
// Potvrzení smazání profilu (#73)
// ---------------------------------------------------------------------------

interface ConfirmMetrics {
  readonly maxWidth: number;
  readonly height: number;
  readonly radius: number;
  readonly padding: number;
  readonly preview: number;
  readonly nicknameFontSize: number;
  readonly nicknameHeight: number;
  readonly questionFontSize: number;
  readonly questionHeight: number;
  readonly buttonHeight: number;
  /** Šířka tlačítka; `null` = polovina rámečku bez okrajů a mezery. */
  readonly buttonWidth: number | null;
  readonly buttonFontSize: number;
}

/** iPad podle obrázku 8: rámeček 520 × 420, kolečko 140, tlačítka 200 × 76. */
const TABLET_CONFIRM: ConfirmMetrics = {
  maxWidth: 520,
  height: 420,
  radius: 28,
  padding: 24,
  preview: 140,
  nicknameFontSize: 20,
  nicknameHeight: 28,
  questionFontSize: 30,
  questionHeight: 40,
  buttonHeight: 76,
  buttonWidth: 200,
  buttonFontSize: 24,
};

/** Telefon na výšku podle obrázku 8: rámeček přes šířku, výška 360, kolečko 110. */
const PORTRAIT_CONFIRM: ConfirmMetrics = {
  maxWidth: 400,
  height: 360,
  radius: 28,
  padding: 24,
  preview: 110,
  nicknameFontSize: 20,
  nicknameHeight: 28,
  questionFontSize: 26,
  questionHeight: 34,
  buttonHeight: BUTTON_SIZE,
  buttonWidth: null,
  buttonFontSize: 22,
};

/** Telefon na šířku: kolečko vlevo vedle přezdívky a otázky, tlačítka pod nimi. */
const LANDSCAPE_CONFIRM: ConfirmMetrics = {
  maxWidth: 480,
  height: 216,
  radius: 24,
  padding: 20,
  preview: 96,
  nicknameFontSize: 20,
  nicknameHeight: 28,
  questionFontSize: 26,
  questionHeight: 34,
  buttonHeight: BUTTON_SIZE,
  buttonWidth: null,
  buttonFontSize: 22,
};

/** Okraj rámečku od volné plochy na telefonu (obrázek 8: 16 px). */
const CONFIRM_SIDE_MARGIN = 16;
/** Mezery mezi kolečkem, přezdívkou a otázkou. */
const CONFIRM_TOP = 36;
const CONFIRM_NICKNAME_GAP = 12;
const CONFIRM_QUESTION_GAP = 8;
const CONFIRM_BUTTON_GAP = 16;

function confirmMetricsFor(family: FormFamily): ConfirmMetrics {
  switch (family) {
    case 'portrait':
      return PORTRAIT_CONFIRM;
    case 'landscape':
      return LANDSCAPE_CONFIRM;
    case 'tablet':
      return TABLET_CONFIRM;
  }
}

/** „Smazat“ vlevo dole a „Zpět“ vpravo dole v rámečku. */
function confirmButtons(
  panel: MenuBox,
  metrics: ConfirmMetrics,
): { confirm: MenuBox; cancel: MenuBox } {
  const inner = widthOf(panel) - 2 * metrics.padding;
  const width = metrics.buttonWidth ?? (inner - CONFIRM_BUTTON_GAP) / 2;
  const top = panel.bottom - metrics.padding - metrics.buttonHeight;
  return {
    confirm: boxAt(panel.left + metrics.padding, top, width, metrics.buttonHeight),
    cancel: boxAt(panel.right - metrics.padding - width, top, width, metrics.buttonHeight),
  };
}

export function deleteConfirmLayoutFor(viewport: Viewport | undefined): DeleteConfirmLayout {
  const free = freeAreaOf(viewport);
  const usable = insetBox(free, EDGE);
  const family = formFamilyFor(chooseLayoutMode(viewport), usable);
  const metrics = confirmMetricsFor(family);
  const width = Math.min(metrics.maxWidth, widthOf(free) - 2 * CONFIRM_SIDE_MARGIN);
  const height = Math.min(metrics.height, heightOf(usable));
  const panel = boxAt(
    centeredLeft(free, width),
    free.top + (heightOf(free) - height) / 2,
    width,
    height,
  );
  const buttons = confirmButtons(panel, metrics);
  const innerLeft = panel.left + metrics.padding;
  const innerWidth = width - 2 * metrics.padding;
  const shared = {
    panel,
    panelRadius: metrics.radius,
    previewSymbolFontSize: metrics.preview / 2,
    nicknameFontSize: metrics.nicknameFontSize,
    questionFontSize: metrics.questionFontSize,
    buttonFontSize: metrics.buttonFontSize,
    ...buttons,
  };
  if (family === 'landscape') {
    // Kolečko vlevo, vedle něj přezdívka a otázka svisle uprostřed kolečka.
    const preview = boxAt(innerLeft, panel.top + metrics.padding, metrics.preview, metrics.preview);
    const textLeft = preview.right + CONFIRM_BUTTON_GAP;
    const textWidth = panel.right - metrics.padding - textLeft;
    const textHeight = metrics.nicknameHeight + CONFIRM_QUESTION_GAP + metrics.questionHeight;
    const textTop = (preview.top + preview.bottom - textHeight) / 2;
    const nickname = boxAt(textLeft, textTop, textWidth, metrics.nicknameHeight);
    const question = boxAt(
      textLeft,
      nickname.bottom + CONFIRM_QUESTION_GAP,
      textWidth,
      metrics.questionHeight,
    );
    return { ...shared, preview, nickname, question };
  }
  const preview = boxAt(
    panel.left + (width - metrics.preview) / 2,
    panel.top + CONFIRM_TOP,
    metrics.preview,
    metrics.preview,
  );
  const nickname = boxAt(
    innerLeft,
    preview.bottom + CONFIRM_NICKNAME_GAP,
    innerWidth,
    metrics.nicknameHeight,
  );
  const question = boxAt(
    innerLeft,
    nickname.bottom + CONFIRM_QUESTION_GAP,
    innerWidth,
    metrics.questionHeight,
  );
  return { ...shared, preview, nickname, question };
}
