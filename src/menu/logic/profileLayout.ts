/**
 * Rozložení výběru profilu (obrázek P) a formuláře nového profilu (#72)
 * v CSS px okna, i s výřezem a lištou domů. Čistý TypeScript bez Phaseru.
 *
 * Výběr profilu: kolečka v pořadí založení, pod každým přezdívka 16 px
 * nejvýš na dva řádky, za nimi „+“. Vpravo nahoře plné tlačítko jazyka
 * a pod ním nabídka jazyků jako v menu (#70), vlevo od jazyka jediná tužka
 * 64 px, která přepne výběr do úprav (#160); v úpravách má každé kolečko
 * odznak tužky vpravo nahoře na obvodu (#197). Na iPadu kolečka 140 px v řadách co
 * nejvyrovnanějších (6 koleček ve 2 řadách po 3), na telefonu 110 px: na
 * šířku stejně jako na iPadu, na výšku jeden sloupec, a když se kolečka do
 * jednoho sloupce nevejdou, dva sloupce. Na menších telefonech se nejdřív
 * zúží mezery a pak zmenší kolečka (nejvýš na 92 px), nikde se neposouvá.
 * Rozestup koleček zůstává jako s tužkou u kolečka (#107, #113), aby se
 * mřížka po přesunu tužky do lišty nezměnila a kolečka nezmenšila. Mřížka
 * stojí vodorovně uprostřed volné plochy (#162); vedle lišty se kvůli tomu
 * raději zúží mezery (kolečka nejméně 32 px od sebe).
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
 * Kolečko rozepsaného profilu (#161) je v 1. kroku vlevo vedle pole: na
 * telefonu 40 px, menší než tlačítka (na šířku v horní řadě 16 px od „‹“,
 * pole se zúží), na iPadu 84 px a obojí uprostřed.
 * Ve 2. kroku je kolečkem profilu náhled.
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
  /**
   * Čtverec, do kterého se vepíše kulatý odznak tužky (#160). Leží vpravo
   * nahoře na obvodu kolečka a celý v jeho čtverci (#197), scéna ho kreslí
   * jen v režimu úprav. Není samostatná
   * ťukací plocha: ťuknutí na odznak je ťuknutí na kolečko.
   */
  readonly editBadge: MenuBox;
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
  /** Jediná tužka v liště vlevo od jazyka (#160): přepne výběr do úprav. */
  readonly editPencil: MenuBox;
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
  /** Vodorovná mezera mezi sousedními kolečky; při nedostatku místa až `MIN_CIRCLE_GAP`. */
  readonly circleGap: number;
  /** Svislá mezera mezi spodkem přezdívky a dalším kolečkem; při nedostatku místa až 8 px. */
  readonly rowGap: number;
  readonly languageSize: number;
  /** Odstup tlačítka jazyka od okraje volné plochy a tužky od jazyka. */
  readonly languageInset: number;
  readonly languageFontSize: number;
}

/** Zkratka jazyka na větším tlačítku iPadu (obrázek 7). */
const TABLET_LANGUAGE_FONT_SIZE = 24;

/**
 * Rozestup koleček z doby tužky u kolečka (#107, #113): tužka 64 px a mezera
 * 16 px před ní. Mřížka ho drží dál, aby se po přesunu tužky do lišty (#160)
 * nezměnila. Nejmenší rozestup je tužka a dvakrát 8 px.
 */
const FORMER_PENCIL_SPACE = 16 + BUTTON_SIZE;
const MIN_CIRCLE_GAP = MIN_GAP + BUTTON_SIZE + MIN_GAP;

/** iPad podle obrázku P: kolečka 140 px, tlačítko jazyka 76 px jako kolečko nastavení. */
const TABLET_PICKER: PickerMetrics = {
  circle: 140,
  minCircle: 140,
  circleGap: FORMER_PENCIL_SPACE + 56,
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
  circleGap: FORMER_PENCIL_SPACE + 16,
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
/**
 * Nejmenší rozestup koleček vedle lišty, aby mřížka zůstala uprostřed
 * (#162). Kde se nevejde ani s ním, mřížka se posune doleva od tužky.
 */
const CENTERED_MIN_CIRCLE_GAP = 32;

/** Tužka v liště (#160): kulaté tlačítko 64 px. */
const PENCIL_SIZE = BUTTON_SIZE;
/** Kolečka jsou od levého a pravého okraje volné plochy aspoň 8 px. */
const SIDE_EDGE = MIN_GAP;

/**
 * Odznak tužky (#160, #197): průměr 24 % kolečka, střed na obvodu kolečka
 * vpravo nahoře (45°), takže odznak je vidět „nad kolečkem“. Celý zůstává
 * ve čtverci kolečka (ťukací ploše), i když se kolečko v úpravách pohupuje
 * (při 2,5° je vnější okraj odznaku nejvýš asi 0,98 poloměru od středu
 * na každé ose). Od velkého písmene (i širokého W, písmo je polovina
 * průměru) ho dělí asi 0,15 poloměru.
 */
const BADGE_RATIO = 0.24;
const BADGE_ANGLE_DEGREES = -45;

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

/** Od horního okraje kolečka po spodek přezdívky. */
function itemHeightFor(circle: number): number {
  return circle + NICKNAME_GAP + NICKNAME_MAX_LINES * NICKNAME_LINE_HEIGHT;
}

/** Lišta výběru: tlačítko jazyka a tužka vlevo od něj. */
interface PickerBar {
  readonly languageSlot: MenuBox;
  readonly editPencil: MenuBox;
}

/** Mřížka koleček: sloupce, řady, mezery a levý horní roh prvního kolečka. */
interface PickerGrid {
  readonly circle: number;
  readonly columns: number;
  readonly rows: number;
  readonly columnGap: number;
  readonly rowGap: number;
  readonly left: number;
  readonly top: number;
}

/**
 * Mezera mezi `count` prvky, aby se vešly do `space`: nejvýš `preferred`
 * (ale aspoň `minimum`), `null`, když by byla menší než `minimum`.
 */
function gapThatFits(
  space: number,
  count: number,
  size: number,
  preferred: number,
  minimum: number,
): number | null {
  if (count <= 1) {
    return 0;
  }
  const gap = Math.min(Math.max(preferred, minimum), (space - count * size) / (count - 1));
  return gap >= minimum ? gap : null;
}

/**
 * Kolik sloupců koleček: na výšku jeden, a dva, jen když se kolečka do
 * jednoho sloupce nevejdou; jinak co nejvíc a řady co nejvyrovnanější.
 * Na šířku se počítá jako s tužkou u kolečka (#107), aby se počet sloupců
 * po přesunu tužky do lišty (#160) nezměnil.
 */
function pickerColumns(
  mode: LayoutMode,
  items: number,
  space: { readonly width: number; readonly height: number },
  metrics: PickerMetrics,
): number {
  if (mode === 'phonePortrait') {
    const rowHeight = itemHeightFor(metrics.circle) + metrics.rowGap;
    const rows = Math.floor((space.height + metrics.rowGap) / rowHeight);
    return items <= Math.max(1, rows) ? 1 : 2;
  }
  // Každý sloupec i s místem, kde byla tužka (#107); za posledním jen bez mezery.
  const columnWidth = metrics.circle + metrics.circleGap;
  const lastColumnGap = metrics.circleGap - FORMER_PENCIL_SPACE;
  const maxColumns = Math.floor((space.width + lastColumnGap) / columnWidth);
  const rows = Math.ceil(items / Math.max(1, maxColumns));
  return Math.max(1, Math.ceil(items / rows));
}

/** Kde leží řada koleček vodorovně: levý okraj prvního kolečka a mezera. */
interface PickerColumns {
  readonly left: number;
  readonly columnGap: number;
}

function blockWidthOf(columns: number, circle: number, columnGap: number): number {
  return columns * circle + (columns - 1) * columnGap;
}

/** Kolečka uprostřed okna s co největší mezerou, nebo `null`, když se nevejdou. */
function centeredColumns(
  columns: number,
  circle: number,
  free: MenuBox,
  metrics: PickerMetrics,
): PickerColumns | null {
  const width = widthOf(free) - 2 * SIDE_EDGE;
  const columnGap = gapThatFits(width, columns, circle, metrics.circleGap, MIN_CIRCLE_GAP);
  if (columnGap === null) {
    return null;
  }
  const left = free.left + (widthOf(free) - blockWidthOf(columns, circle, columnGap)) / 2;
  return { left, columnGap };
}

/** Pravý okraj, za který kolečka ani přezdívky vedle lišty nesmí (8 px od tužky). */
function rightLimitBeside(bar: PickerBar): number {
  return bar.editPencil.left - MIN_GAP - NICKNAME_OVERHANG;
}

function reachesBar(placement: PickerColumns, columns: number, circle: number, bar: PickerBar) {
  const right = placement.left + blockWidthOf(columns, circle, placement.columnGap);
  return right > rightLimitBeside(bar);
}

/**
 * Kolečka vedle lišty, když pod lištou není místo: uprostřed okna a celá
 * vlevo od tužky, s co největší mezerou, při nedostatku místa až
 * `CENTERED_MIN_CIRCLE_GAP` (#162). Nevejdou-li se ani tak, co nejblíž
 * středu vlevo od tužky; jinak `null`.
 */
function columnsBesideBar(
  columns: number,
  circle: number,
  free: MenuBox,
  bar: PickerBar,
  metrics: PickerMetrics,
): PickerColumns | null {
  const leftLimit = free.left + SIDE_EDGE;
  const rightLimit = rightLimitBeside(bar);
  const halfBesideCenter = rightLimit - (free.left + widthOf(free) / 2);
  const centeredSpace = Math.min(rightLimit - leftLimit, 2 * halfBesideCenter);
  const columnGap =
    gapThatFits(centeredSpace, columns, circle, metrics.circleGap, CENTERED_MIN_CIRCLE_GAP) ??
    gapThatFits(rightLimit - leftLimit, columns, circle, MIN_CIRCLE_GAP, MIN_CIRCLE_GAP);
  if (columnGap === null) {
    return null;
  }
  const blockWidth = blockWidthOf(columns, circle, columnGap);
  const centeredLeft = free.left + (widthOf(free) - blockWidth) / 2;
  return { left: Math.min(centeredLeft, rightLimit - blockWidth), columnGap };
}

/**
 * Řady koleček od výšky `highest` dolů, uprostřed volné plochy, nebo
 * `null`, když se do ní nevejdou.
 */
function gridFrom(
  placement: PickerColumns,
  items: number,
  columns: number,
  circle: number,
  highest: number,
  free: MenuBox,
  metrics: PickerMetrics,
): PickerGrid | null {
  const bottom = free.bottom - EDGE;
  const rows = Math.ceil(items / columns);
  const itemHeight = itemHeightFor(circle);
  const rowGap = gapThatFits(bottom - highest, rows, itemHeight, metrics.rowGap, MIN_GAP);
  if (rowGap === null) {
    return null;
  }
  const blockHeight = rows * itemHeight + (rows - 1) * rowGap;
  const top = Math.max(highest, free.top + (heightOf(free) - blockHeight) / 2);
  if (top + blockHeight > bottom) {
    return null;
  }
  return { circle, columns, rows, rowGap, top, ...placement };
}

/**
 * Mřížka s kolečky `circle` v `columns` sloupcích, nebo `null`, když se do
 * volné plochy nevejde. Kolečka jsou uprostřed okna, vždy níž než horní
 * okraj tlačítka jazyka; když by sahala k tužce v liště, jsou pod lištou,
 * a když se tam nevejdou, vedle lišty posunutá doleva od tužky.
 */
function pickerGridFor(
  items: number,
  columns: number,
  circle: number,
  free: MenuBox,
  bar: PickerBar,
  metrics: PickerMetrics,
): PickerGrid | null {
  const centered = centeredColumns(columns, circle, free, metrics);
  if (centered === null) {
    return null;
  }
  const besideTop = bar.languageSlot.top + EDGE;
  const belowTop = bar.languageSlot.bottom + MIN_GAP;
  if (!reachesBar(centered, columns, circle, bar)) {
    return gridFrom(centered, items, columns, circle, besideTop, free, metrics);
  }
  const below = gridFrom(centered, items, columns, circle, belowTop, free, metrics);
  if (below !== null) {
    return below;
  }
  const beside = columnsBesideBar(columns, circle, free, bar, metrics);
  return beside === null
    ? null
    : gridFrom(beside, items, columns, circle, besideTop, free, metrics);
}

/**
 * Počet sloupců podle největších koleček, pak největší kolečka, se kterými
 * se všechno vejde; nevejde-li se nic, nejmenší kolečka od horního okraje.
 */
function largestPickerGrid(
  mode: LayoutMode,
  items: number,
  free: MenuBox,
  bar: PickerBar,
  metrics: PickerMetrics,
): PickerGrid {
  // Na výšku zůstane pod kolečky stejně místa jako nad nimi pro lištu.
  const reservedAbove = bar.languageSlot.bottom + MIN_GAP - free.top;
  const columns = pickerColumns(
    mode,
    items,
    { width: widthOf(free) - 2 * SIDE_EDGE, height: heightOf(free) - 2 * reservedAbove },
    metrics,
  );
  for (let circle = metrics.circle; circle >= metrics.minCircle; circle -= 1) {
    const grid = pickerGridFor(items, columns, circle, free, bar, metrics);
    if (grid !== null) {
      return grid;
    }
  }
  // Nevejde se ani tak (okno mimo zkušební okna): nejmenší kolečka pod lištou.
  return {
    circle: metrics.minCircle,
    columns,
    rows: Math.ceil(items / columns),
    columnGap: MIN_CIRCLE_GAP,
    rowGap: MIN_GAP,
    left: free.left + SIDE_EDGE,
    top: bar.languageSlot.bottom + MIN_GAP,
  };
}

/** Odznak tužky vpravo nahoře na obvodu kolečka (#197), mimo písmeno. */
function editBadgeIn(circle: MenuBox): MenuBox {
  const radius = widthOf(circle) / 2;
  const badgeSize = Math.round(widthOf(circle) * BADGE_RATIO);
  const angle = (BADGE_ANGLE_DEGREES * Math.PI) / 180;
  const centerX = circle.left + radius + radius * Math.cos(angle);
  const centerY = circle.top + radius + radius * Math.sin(angle);
  return boxAt(centerX - badgeSize / 2, centerY - badgeSize / 2, badgeSize, badgeSize);
}

function pickerSlotAt(grid: PickerGrid, index: number): ProfilePickerSlot {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  const size = grid.circle;
  const left = grid.left + column * (size + grid.columnGap);
  const top = grid.top + row * (itemHeightFor(size) + grid.rowGap);
  const circle = boxAt(left, top, size, size);
  return {
    circle,
    nickname: boxAt(
      left - NICKNAME_OVERHANG,
      circle.bottom + NICKNAME_GAP,
      size + 2 * NICKNAME_OVERHANG,
      NICKNAME_MAX_LINES * NICKNAME_LINE_HEIGHT,
    ),
    editBadge: editBadgeIn(circle),
  };
}

/** Tlačítko jazyka vpravo nahoře a tužka vlevo od něj ve stejné výšce (#160). */
function pickerBarFor(free: MenuBox, metrics: PickerMetrics): PickerBar {
  const languageSlot = boxAt(
    free.right - metrics.languageInset - metrics.languageSize,
    free.top + metrics.languageInset,
    metrics.languageSize,
    metrics.languageSize,
  );
  const editPencil = boxAt(
    languageSlot.left - metrics.languageInset - PENCIL_SIZE,
    languageSlot.top + (metrics.languageSize - PENCIL_SIZE) / 2,
    PENCIL_SIZE,
    PENCIL_SIZE,
  );
  return { languageSlot, editPencil };
}

export function profilePickerLayoutFor(
  viewport: Viewport | undefined,
  content: ProfilePickerContent,
): ProfilePickerLayout {
  const mode = chooseLayoutMode(viewport);
  const metrics = pickerMetricsFor(mode);
  const free = freeAreaOf(viewport);
  const bar = pickerBarFor(free, metrics);

  const items = content.profileCount + (content.showAdd ? 1 : 0);
  const grid = largestPickerGrid(mode, Math.max(1, items), free, bar, metrics);
  const slots = Array.from({ length: items }, (_, index) => pickerSlotAt(grid, index));

  const profiles = slots.slice(0, content.profileCount);
  const addSlot = content.showAdd ? slots[content.profileCount] : undefined;
  return {
    mode,
    profiles,
    add: addSlot?.circle ?? null,
    symbolFontSize: grid.circle / 2,
    nicknameFontSize: NICKNAME_FONT_SIZE,
    nicknameMaxLines: NICKNAME_MAX_LINES,
    nicknameLineHeight: NICKNAME_LINE_HEIGHT,
    languageSlot: bar.languageSlot,
    languageButtonFontSize: metrics.languageFontSize,
    languagePanel: languagePanelFor(free, bar.languageSlot, content.languageNames),
    editPencil: bar.editPencil,
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
  /**
   * Kolečko rozepsaného profilu (#161) vlevo vedle pole, v obou vrstvách
   * na stejném místě; jen obrázek, ťuknutí na něj nic nedělá.
   */
  readonly badge: MenuBox;
  readonly badgeSymbolFontSize: number;
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
/** Mezera mezi kolečkem profilu a polem (#161). */
const PHONE_BADGE_GAP = MIN_GAP;
const TABLET_BADGE_GAP = 24;
/**
 * Kolečko profilu v 1. kroku na telefonu (#161), na výšku i na šířku stejné
 * a menší než tlačítka, aby nevypadalo jako tlačítko.
 */
const PHONE_BADGE = 40;
/** Na telefonu na šířku je kolečko od „‹“ dál, aby k němu nepatřilo. */
const LANDSCAPE_BADGE_BACK_GAP = 16;
/** Kolečko profilu v 1. kroku na iPadu (#161), výška pole. */
const TABLET_BADGE = TABLET_FIELD_HEIGHT;
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

/** Šířka pole, do kterého se vejde nejširší přezdívka písmem `fontSize`. */
function widestNicknameWidth(fontSize: number): number {
  return NICKNAME_WIDEST_LETTERS * fontSize + 2 * TEXT_PADDING;
}

function portraitNicknameStep(free: MenuBox, layer: LetterLayer): NicknameStepLayout {
  const width = gridWidth(PORTRAIT_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const left = centeredLeft(free, width);
  // Kolečko profilu (#161) vlevo vedle pole, pole je dost široké na nejširší přezdívku.
  const fieldTop = free.top + PORTRAIT_FIELD_TOP;
  const badge = boxAt(left, fieldTop + (PHONE_KEY - PHONE_BADGE) / 2, PHONE_BADGE, PHONE_BADGE);
  const fieldLeft = badge.right + PHONE_BADGE_GAP;
  const field = boxAt(fieldLeft, fieldTop, left + width - fieldLeft, PHONE_KEY);
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
    badge,
    badgeSymbolFontSize: PHONE_BADGE / 2,
  };
}

function landscapeNicknameStep(free: MenuBox, layer: LetterLayer): NicknameStepLayout {
  const width = gridWidth(LANDSCAPE_COLUMNS, PHONE_KEY, PHONE_KEY_GAP);
  const rows = Math.ceil(GRID_SLOTS / LANDSCAPE_COLUMNS);
  const height = PHONE_KEY + MIN_GAP + gridWidth(rows, PHONE_KEY, PHONE_KEY_GAP);
  const left = centeredLeft(free, width);
  const top = centeredTop(free, height);
  const row = landscapeTopRow(left, width, top);
  // Kolečko profilu (#161) v horní řadě vlevo vedle pole, od „‹“ dál; pole se o ně zúží.
  const badge = boxAt(
    row.back.right + LANDSCAPE_BADGE_BACK_GAP,
    top + (PHONE_KEY - PHONE_BADGE) / 2,
    PHONE_BADGE,
    PHONE_BADGE,
  );
  const field: MenuBox = { ...row.middle, left: badge.right + PHONE_BADGE_GAP };
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
    field,
    fieldFontSize: LANDSCAPE_FIELD_FONT_SIZE,
    fieldRadius: PHONE_KEY_RADIUS,
    back: row.back,
    next: row.forward,
    badge,
    badgeSymbolFontSize: PHONE_BADGE / 2,
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
  // Kolečko profilu (#161) vlevo vedle pole, obojí uprostřed nad mřížkou.
  const badgeRoom = TABLET_BADGE + TABLET_BADGE_GAP;
  const narrowField = width - TABLET_FIELD_NARROWING;
  const narrowFits =
    narrowField >= widestNicknameWidth(TABLET_FIELD_FONT_SIZE) && narrowField + badgeRoom <= width;
  const fieldWidth = narrowFits ? narrowField : width - badgeRoom;
  const rowLeft = left + (width - badgeRoom - fieldWidth) / 2;
  const fieldTop = top + TABLET_TITLE_HEIGHT + TABLET_TITLE_GAP;
  const badge = boxAt(rowLeft, fieldTop, TABLET_BADGE, TABLET_BADGE);
  const field = boxAt(rowLeft + badgeRoom, fieldTop, fieldWidth, TABLET_FIELD_HEIGHT);
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
    badge,
    badgeSymbolFontSize: TABLET_BADGE / 2,
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
