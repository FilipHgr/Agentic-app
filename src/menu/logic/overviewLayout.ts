/**
 * Rozložení přehledu pro rodiče v menu (#192) v CSS px okna, i s výřezem
 * a lištou domů. Nahoře Zpět, kolečko aktivního profilu a nadpis, pod nimi
 * záložky her (Počítání, Znaménka) a záložky stránek (7 dní, Chyby), pod
 * nimi obsah stránky:
 *
 * - 7 dní: nadpis, graf 7 sloupečků se zkratkami dnů a počty, vysvětlivky
 *   obou odstínů a součty za týden (dřív v nastavení Počítání, #183),
 * - Chyby: nadpis a oddíly řádků pod sebou (#184).
 *
 * iPad: záložky her vlevo a stránek vpravo v jedné řadě pod Zpět. Telefon
 * na šířku: Zpět, kolečko a všechny záložky v jedné řadě nahoře (bez
 * nadpisu, výška je vzácná), graf vlevo a vysvětlivky se součty vpravo,
 * oddíly chyb ve dvou sloupcích. Telefon na výšku: záložky her a stránek
 * ve dvou řadách přes šířku, obsah pod sebou. Ťukací plochy mají 64 px
 * a mezi sebou aspoň 8 px. Čistý TypeScript bez Phaseru.
 */

import { chooseLayoutMode } from '../../shared/logic/viewportLayout';
import type { LayoutMode, Viewport } from '../../shared/logic/viewportLayout';
import { OVERVIEW_DAY_COUNT } from '../../shared/logic/weekActivity';
import type { WeekOverview } from '../../shared/logic/weekActivity';
import { boxAt, freeAreaOf } from './menuLayout';
import type { MenuBox } from './menuLayout';

/** Plocha textu; `align` říká, jestli text začíná u levého okraje plochy, nebo je na středu. */
export interface OverviewText {
  readonly box: MenuBox;
  readonly fontSize: number;
  readonly align: 'left' | 'center';
  /** U textu zleva: o kolik px od levého okraje plochy text začíná (výchozí 0). */
  readonly inset?: number;
}

/** Záložka: ťukací plocha 64 px a nakreslená pilulka uvnitř. */
export interface OverviewTab {
  readonly hit: MenuBox;
  readonly pill: MenuBox;
}

export interface OverviewChart {
  readonly left: number;
  readonly right: number;
  /** Horní okraj grafu (nad nejvyšším sloupečkem je ještě místo pro počet). */
  readonly top: number;
  /** Základna, na které sloupečky stojí. */
  readonly baseline: number;
  readonly barWidth: number;
  /** Výška sloupečku dne s nejvíc příklady. */
  readonly maxBarHeight: number;
  readonly valueHeight: number;
  readonly valueFontSize: number;
}

export interface OverviewLegendEntry {
  /** Čtvereček s odstínem sloupečku. */
  readonly swatch: MenuBox;
  readonly label: OverviewText;
}

/** Stránka 7 dní. */
export interface OverviewWeekLayout {
  readonly title: OverviewText;
  readonly chart: OverviewChart;
  /** Zkratky 7 dní pod sloupečky, od nejstaršího dne po dnešek. */
  readonly days: readonly OverviewText[];
  /** Vyřešeno po chybě (světlejší) a napoprvé (tmavší). */
  readonly legend: readonly [OverviewLegendEntry, OverviewLegendEntry];
  /** Součet za týden a z toho napoprvé. */
  readonly totals: readonly [OverviewText, OverviewText];
  /** Nápis bez dat na středu grafu. */
  readonly empty: OverviewText;
}

/** Stránka Chyby: nadpis a řádky oddílů v pořadí oddílů. */
export interface OverviewMistakesLayout {
  readonly title: OverviewText;
  /** Řádky každého oddílu shora; počet podle `sectionSizes`. */
  readonly sections: readonly (readonly OverviewText[])[];
  /** Písmo nadpisu oddílu (první řádek oddílu, když je nadpis). */
  readonly headingFontSize: number;
}

export interface OverviewScreenLayout {
  readonly mode: LayoutMode;
  readonly free: MenuBox;
  /** Zpět do menu, vlevo nahoře na místě profilu v menu. */
  readonly back: MenuBox;
  readonly buttonFontSize: number;
  /** Kolečko aktivního profilu (64 px, neťuká se). */
  readonly profile: MenuBox;
  readonly profileSymbolFontSize: number;
  /** Nadpis „Přehled“ vedle kolečka; na telefonu na šířku `null`. */
  readonly title: OverviewText | null;
  /** Záložky her v pořadí her. */
  readonly gameTabs: readonly OverviewTab[];
  /** Záložky stránek: 7 dní a Chyby. */
  readonly pageTabs: readonly [OverviewTab, OverviewTab];
  readonly tabFontSize: number;
  readonly week: OverviewWeekLayout;
  readonly mistakes: OverviewMistakesLayout;
}

export interface OverviewContent {
  /** Kolik her má přehled (záložky her). */
  readonly gameCount: number;
  /** Kolik nejvýš řádků má každý oddíl stránky Chyby vybrané hry. */
  readonly sectionSizes: readonly number[];
  /**
   * Text první vysvětlivky (po chybě); na iPadu za ním následuje druhá
   * vysvětlivka 8–16 px po konci textu. Bez něj je druhá na středu.
   */
  readonly firstLegendLabel?: string;
}

/** Odhad šířky textu jako v #65: znaky × 0,6 × velikost písma. */
export function estimatedTextWidth(text: string, fontSize: number): number {
  return [...text].length * 0.6 * fontSize;
}

/** Na iPadu je druhá vysvětlivka 12 px za koncem textu první (8–16 px). */
export const LEGEND_TEXT_GAP = 12;

/** Odsazení textu od okraje jeho plochy (pravidlo „text se vejde“ počítá 8 px). */
const TEXT_PADDING = 8;

const BUTTON_SIZE = 64;
/** Nakreslená pilulka záložky je 48 px vysoká jako kategorie v menu. */
const PILL_HEIGHT = 48;
const TAB_GAP = 8;

/** Rozměry, které se liší podle zařízení. */
interface OverviewMetrics {
  readonly side: number;
  readonly top: number;
  readonly backWidth: number;
  /** Mezera mezi Zpět, kolečkem a nadpisem. */
  readonly barGap: number;
  readonly buttonFontSize: number;
  readonly titleFontSize: number;
  readonly gameTabWidth: number;
  readonly pageTabWidth: number;
  readonly tabFontSize: number;
  /** Mezera mezi řadami záložek a pod nimi k obsahu. */
  readonly rowGap: number;
  readonly contentGap: number;
  readonly contentSide: number;
  readonly contentBottom: number;
}

const TABLET_METRICS: OverviewMetrics = {
  side: 24,
  top: 12,
  backWidth: 120,
  barGap: 16,
  buttonFontSize: 18,
  titleFontSize: 24,
  gameTabWidth: 200,
  pageTabWidth: 160,
  tabFontSize: 17,
  rowGap: 16,
  contentGap: 24,
  contentSide: 24,
  contentBottom: 24,
};

const PHONE_LANDSCAPE_METRICS: OverviewMetrics = {
  side: 8,
  top: 8,
  backWidth: 88,
  barGap: 8,
  buttonFontSize: 17,
  titleFontSize: 0,
  gameTabWidth: 128,
  pageTabWidth: 112,
  tabFontSize: 16,
  rowGap: 0,
  contentGap: 12,
  contentSide: 16,
  contentBottom: 8,
};

const PHONE_PORTRAIT_METRICS: OverviewMetrics = {
  side: 16,
  top: 12,
  backWidth: 96,
  barGap: 12,
  buttonFontSize: 17,
  titleFontSize: 20,
  gameTabWidth: 0,
  pageTabWidth: 0,
  tabFontSize: 17,
  rowGap: 8,
  contentGap: 20,
  contentSide: 16,
  contentBottom: 16,
};

function metricsFor(mode: LayoutMode): OverviewMetrics {
  if (mode === 'phoneLandscape') {
    return PHONE_LANDSCAPE_METRICS;
  }
  return mode === 'phonePortrait' ? PHONE_PORTRAIT_METRICS : TABLET_METRICS;
}

function widthOf(box: MenuBox): number {
  return box.right - box.left;
}

function heightOf(box: MenuBox): number {
  return box.bottom - box.top;
}

function text(box: MenuBox, fontSize: number, align: OverviewText['align'] = 'left'): OverviewText {
  return { box, fontSize, align };
}

/** Záložka s ťukací plochou `hit`; pilulka 48 px je svisle na jejím středu. */
function tabOf(hit: MenuBox): OverviewTab {
  const inset = (heightOf(hit) - PILL_HEIGHT) / 2;
  return { hit, pill: { ...hit, top: hit.top + inset, bottom: hit.bottom - inset } };
}

/** Záložky `count` vedle sebe od `left`, každá široká `width`. */
function tabRow(left: number, top: number, width: number, count: number): OverviewTab[] {
  return Array.from({ length: count }, (_, index) =>
    tabOf(boxAt(left + index * (width + TAB_GAP), top, width, BUTTON_SIZE)),
  );
}

/** Šířka záložky, aby se `count` záložek vešlo do `available` px. */
function fittedTabWidth(available: number, count: number): number {
  return (available - (count - 1) * TAB_GAP) / Math.max(1, count);
}

function pagePair(tabs: OverviewTab[]): readonly [OverviewTab, OverviewTab] {
  const [week, mistakes] = tabs;
  if (week === undefined || mistakes === undefined) {
    throw new Error('přehled má vždy dvě záložky stránek');
  }
  return [week, mistakes];
}

// ---------------------------------------------------------------------------
// Graf stránky 7 dní
// ---------------------------------------------------------------------------

interface ChartFrame {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly baseline: number;
  readonly valueHeight: number;
  readonly valueFontSize: number;
  readonly dayHeight: number;
  readonly dayFontSize: number;
  readonly dayGap: number;
}

/** Sloupečky přes šířku grafu: každý den stejně široký pruh, sloupeček na jeho středu. */
function chartOf(frame: ChartFrame): Pick<OverviewWeekLayout, 'chart' | 'days'> {
  const column = (frame.right - frame.left) / OVERVIEW_DAY_COUNT;
  const dayTop = frame.baseline + frame.dayGap;
  // Okraje pruhů ze stejného výpočtu, aby se sousední dny nepřekrývaly ani o zaokrouhlení.
  const edge = (index: number): number => frame.left + column * index;
  const days = Array.from({ length: OVERVIEW_DAY_COUNT }, (_, index) =>
    text(
      { left: edge(index), right: edge(index + 1), top: dayTop, bottom: dayTop + frame.dayHeight },
      frame.dayFontSize,
      'center',
    ),
  );
  return {
    chart: {
      left: frame.left,
      right: frame.right,
      top: frame.top,
      baseline: frame.baseline,
      barWidth: column * 0.6,
      maxBarHeight: frame.baseline - frame.top - frame.valueHeight,
      valueHeight: frame.valueHeight,
      valueFontSize: frame.valueFontSize,
    },
    days,
  };
}

/** Čtvereček odstínu a vedle něj vysvětlivka; `left` je levý okraj čtverečku, `top` řádku. */
function legendEntry(
  left: number,
  top: number,
  rowHeight: number,
  swatchSize: number,
  labelWidth: number,
  fontSize: number,
): OverviewLegendEntry {
  const swatchTop = top + (rowHeight - swatchSize) / 2;
  return {
    swatch: boxAt(left, swatchTop, swatchSize, swatchSize),
    // Plocha vysvětlivky začíná hned u čtverečku, text 8 px za ním.
    label: {
      ...text(boxAt(left + swatchSize, top, labelWidth + TEXT_PADDING, rowHeight), fontSize),
      inset: TEXT_PADDING,
    },
  };
}

function emptyOf(chart: OverviewChart, height: number, fontSize: number): OverviewText {
  const middle = (chart.top + chart.baseline) / 2;
  return text(
    { left: chart.left, right: chart.right, top: middle - height / 2, bottom: middle + height / 2 },
    fontSize,
    'center',
  );
}

/** Míry stránky 7 dní pod sebou (iPad a telefon na výšku). */
interface StackedWeekMetrics {
  readonly titleHeight: number;
  readonly titleFontSize: number;
  readonly valueHeight: number;
  readonly valueFontSize: number;
  readonly dayHeight: number;
  readonly dayFontSize: number;
  readonly legendHeight: number;
  readonly legendFontSize: number;
  readonly swatchSize: number;
  /** Vysvětlivky vedle sebe (iPad), nebo pod sebou (telefon). */
  readonly legendSideBySide: boolean;
  readonly totalHeight: number;
  readonly totalFontSize: number;
  /** Nejvyšší sloupeček, aby graf na vysokém okně nebyl přes celou výšku. */
  readonly maxBar: number;
  readonly emptyHeight: number;
  readonly emptyFontSize: number;
}

const TABLET_WEEK: StackedWeekMetrics = {
  titleHeight: 32,
  titleFontSize: 22,
  valueHeight: 28,
  valueFontSize: 18,
  dayHeight: 30,
  dayFontSize: 20,
  legendHeight: 28,
  legendFontSize: 20,
  swatchSize: 24,
  legendSideBySide: true,
  totalHeight: 28,
  totalFontSize: 20,
  maxBar: 400,
  emptyHeight: 40,
  emptyFontSize: 26,
};

const PORTRAIT_WEEK: StackedWeekMetrics = {
  titleHeight: 22,
  titleFontSize: 15,
  valueHeight: 18,
  valueFontSize: 12,
  dayHeight: 22,
  dayFontSize: 14,
  legendHeight: 22,
  legendFontSize: 14,
  swatchSize: 16,
  legendSideBySide: false,
  totalHeight: 20,
  totalFontSize: 14,
  maxBar: 420,
  emptyHeight: 24,
  emptyFontSize: 16,
};

/** iPad a telefon na výšku: nadpis nad grafem, pod grafem vysvětlivky a součty. */
function stackedWeek(
  content: MenuBox,
  metrics: StackedWeekMetrics,
  firstLegendLabel: string | undefined,
): OverviewWeekLayout {
  const width = widthOf(content);
  const secondTotal = boxAt(
    content.left,
    content.bottom - metrics.totalHeight,
    width,
    metrics.totalHeight,
  );
  const firstTotal = boxAt(
    content.left,
    secondTotal.top - 4 - metrics.totalHeight,
    width,
    metrics.totalHeight,
  );
  const legendRows = metrics.legendSideBySide ? 1 : 2;
  const legendTop = firstTotal.top - 12 - legendRows * metrics.legendHeight - (legendRows - 1) * 6;
  const sideBySide = metrics.legendSideBySide;
  // Na iPadu je první vysvětlivka jen tak široká jako její text s okraji
  // a druhá hned za ní (12 px po konci textu), ne až na středu.
  const firstLabelWidth =
    sideBySide && firstLegendLabel !== undefined
      ? estimatedTextWidth(firstLegendLabel, metrics.legendFontSize) + TEXT_PADDING
      : sideBySide
        ? width / 2 - metrics.swatchSize - 16
        : width - metrics.swatchSize - 8;
  const firstLabelRight = content.left + metrics.swatchSize + 8 + firstLabelWidth;
  const secondLegendLeft = !sideBySide
    ? content.left
    : firstLegendLabel !== undefined
      ? firstLabelRight - TEXT_PADDING + LEGEND_TEXT_GAP
      : content.left + width / 2;
  const secondLabelWidth = sideBySide
    ? content.right - (secondLegendLeft + metrics.swatchSize + 8)
    : firstLabelWidth;
  const secondLegendTop = metrics.legendSideBySide
    ? legendTop
    : legendTop + metrics.legendHeight + 6;
  const legend: readonly [OverviewLegendEntry, OverviewLegendEntry] = [
    legendEntry(
      content.left,
      legendTop,
      metrics.legendHeight,
      metrics.swatchSize,
      firstLabelWidth,
      metrics.legendFontSize,
    ),
    legendEntry(
      secondLegendLeft,
      secondLegendTop,
      metrics.legendHeight,
      metrics.swatchSize,
      secondLabelWidth,
      metrics.legendFontSize,
    ),
  ];
  const baseline = legendTop - 12 - metrics.dayHeight - 4;
  const chartTopMin = content.top + metrics.titleHeight + 8;
  const chartTop = Math.max(chartTopMin, baseline - metrics.valueHeight - metrics.maxBar);
  const { chart, days } = chartOf({
    left: content.left,
    right: content.right,
    top: chartTop,
    baseline,
    valueHeight: metrics.valueHeight,
    valueFontSize: metrics.valueFontSize,
    dayHeight: metrics.dayHeight,
    dayFontSize: metrics.dayFontSize,
    dayGap: 4,
  });
  return {
    // Nadpis stojí 8 px nad grafem.
    title: text(
      boxAt(content.left, chartTop - 8 - metrics.titleHeight, width, metrics.titleHeight),
      metrics.titleFontSize,
    ),
    chart,
    days,
    legend,
    totals: [text(firstTotal, metrics.totalFontSize), text(secondTotal, metrics.totalFontSize)],
    empty: emptyOf(chart, metrics.emptyHeight, metrics.emptyFontSize),
  };
}

/** Telefon na šířku: pravý sloupec s vysvětlivkami a součty. */
const LANDSCAPE_COLUMN_WIDTH = 240;

/** Telefon na šířku: graf vlevo s nadpisem nad ním, vpravo vysvětlivky a pod nimi součty. */
function landscapeWeek(content: MenuBox): OverviewWeekLayout {
  const columnLeft = content.right - LANDSCAPE_COLUMN_WIDTH;
  const chartRight = columnLeft - 16;
  const title = text(boxAt(content.left, content.top, chartRight - content.left, 22), 15);
  const dayHeight = 22;
  const { chart, days } = chartOf({
    left: content.left,
    right: chartRight,
    top: title.box.bottom + 6,
    baseline: content.bottom - dayHeight - 4,
    valueHeight: 16,
    valueFontSize: 12,
    dayHeight,
    dayFontSize: 13,
    dayGap: 4,
  });
  const rowHeight = 22;
  const legendTop = chart.top;
  const labelWidth = LANDSCAPE_COLUMN_WIDTH - 16 - 8;
  const totalsTop = legendTop + 2 * rowHeight + 6 + 14;
  return {
    title,
    chart,
    days,
    legend: [
      legendEntry(columnLeft, legendTop, rowHeight, 16, labelWidth, 13),
      legendEntry(columnLeft, legendTop + rowHeight + 6, rowHeight, 16, labelWidth, 13),
    ],
    totals: [
      text(boxAt(columnLeft, totalsTop, LANDSCAPE_COLUMN_WIDTH, rowHeight), 14),
      text(boxAt(columnLeft, totalsTop + rowHeight + 6, LANDSCAPE_COLUMN_WIDTH, rowHeight), 14),
    ],
    empty: emptyOf(chart, 24, 15),
  };
}

// ---------------------------------------------------------------------------
// Stránka Chyby
// ---------------------------------------------------------------------------

/** Míry řádků stránky Chyby. */
interface RowMetrics {
  readonly titleHeight: number;
  readonly titleFontSize: number;
  readonly maxPitch: number;
  /** Řádek je o tolik nižší než vzdálenost řádků, aby se nedotýkaly. */
  readonly spacing: number;
  readonly maxRowHeight: number;
  readonly fontSize: number;
  readonly headingFontSize: number;
  readonly sectionGap: number;
}

const TABLET_ROWS: RowMetrics = {
  titleHeight: 32,
  titleFontSize: 22,
  maxPitch: 44,
  spacing: 8,
  maxRowHeight: 36,
  fontSize: 22,
  headingFontSize: 24,
  sectionGap: 20,
};

const PHONE_ROWS: RowMetrics = {
  titleHeight: 22,
  titleFontSize: 15,
  maxPitch: 32,
  spacing: 4,
  maxRowHeight: 24,
  fontSize: 16,
  headingFontSize: 17,
  sectionGap: 12,
};

/** Oddíly `sizes` pod sebou ve sloupci od `top` do `bottom`; vrátí řádky každého oddílu. */
function columnRows(
  left: number,
  width: number,
  top: number,
  bottom: number,
  sizes: readonly number[],
  metrics: RowMetrics,
): OverviewText[][] {
  const rowCount = sizes.reduce((sum, size) => sum + size, 0);
  const gaps = Math.max(0, sizes.length - 1) * metrics.sectionGap;
  const pitch = Math.min(metrics.maxPitch, (bottom - top - gaps) / Math.max(1, rowCount));
  const rowHeight = Math.min(metrics.maxRowHeight, pitch - metrics.spacing);
  let y = top;
  return sizes.map((size) => {
    const rows = Array.from({ length: size }, (_, index) =>
      text(
        boxAt(left, y + index * pitch + (pitch - rowHeight) / 2, width, rowHeight),
        metrics.fontSize,
      ),
    );
    y += size * pitch + metrics.sectionGap;
    return rows;
  });
}

/**
 * Stránka Chyby: nadpis nahoře, oddíly pod ním. Na telefonu na šířku
 * je první oddíl (napoprvé) vlevo a ostatní (časté chyby, nápověda) vpravo
 * pod sebou, aby se četly zleva a shora dolů ve stejném pořadí jako jinde.
 */
function mistakesLayout(
  content: MenuBox,
  sizes: readonly number[],
  metrics: RowMetrics,
  twoColumns: boolean,
): OverviewMistakesLayout {
  const title = text(
    boxAt(content.left, content.top, widthOf(content), metrics.titleHeight),
    metrics.titleFontSize,
  );
  const rowsTop = title.box.bottom + 8;
  if (!twoColumns || sizes.length < 2) {
    const width = Math.min(widthOf(content), 760);
    return {
      title,
      sections: columnRows(content.left, width, rowsTop, content.bottom, sizes, metrics),
      headingFontSize: metrics.headingFontSize,
    };
  }
  const columnWidth = (widthOf(content) - 16) / 2;
  const leftIndexes = [0];
  const rightIndexes = sizes.map((_, index) => index).filter((index) => index > 0);
  const sizesAt = (indexes: number[]): number[] => indexes.map((index) => sizes[index] ?? 0);
  const leftRows = columnRows(
    content.left,
    columnWidth,
    rowsTop,
    content.bottom,
    sizesAt(leftIndexes),
    metrics,
  );
  const rightRows = columnRows(
    content.left + columnWidth + 16,
    columnWidth,
    rowsTop,
    content.bottom,
    sizesAt(rightIndexes),
    metrics,
  );
  const sections = sizes.map((_, index) =>
    index === 0
      ? (leftRows[leftIndexes.indexOf(index)] ?? [])
      : (rightRows[rightIndexes.indexOf(index)] ?? []),
  );
  return { title, sections, headingFontSize: metrics.headingFontSize };
}

// ---------------------------------------------------------------------------
// Obrazovka
// ---------------------------------------------------------------------------

export function overviewLayoutFor(
  viewport: Viewport | undefined,
  content: OverviewContent,
): OverviewScreenLayout {
  const mode = chooseLayoutMode(viewport);
  const metrics = metricsFor(mode);
  const free = freeAreaOf(viewport);
  const barTop = free.top + metrics.top;
  const back = boxAt(free.left + metrics.side, barTop, metrics.backWidth, BUTTON_SIZE);
  const profile = boxAt(back.right + metrics.barGap, barTop, BUTTON_SIZE, BUTTON_SIZE);
  const right = free.right - metrics.side;
  const gameCount = Math.max(1, content.gameCount);

  let gameTabs: OverviewTab[];
  let pageTabs: OverviewTab[];
  let title: OverviewText | null = null;
  let tabsBottom: number;
  if (mode === 'phoneLandscape') {
    gameTabs = tabRow(profile.right + 16, barTop, metrics.gameTabWidth, gameCount);
    const pagesLeft = right - 2 * metrics.pageTabWidth - TAB_GAP;
    pageTabs = tabRow(pagesLeft, barTop, metrics.pageTabWidth, 2);
    tabsBottom = back.bottom;
  } else {
    const titleLeft = profile.right + metrics.barGap;
    title = text(
      { left: titleLeft, right, top: barTop, bottom: barTop + BUTTON_SIZE },
      metrics.titleFontSize,
    );
    const rowTop = back.bottom + metrics.rowGap;
    const width = right - (free.left + metrics.side);
    if (mode === 'phonePortrait') {
      gameTabs = tabRow(back.left, rowTop, fittedTabWidth(width, gameCount), gameCount);
      pageTabs = tabRow(
        back.left,
        rowTop + BUTTON_SIZE + metrics.rowGap,
        fittedTabWidth(width, 2),
        2,
      );
      tabsBottom = rowTop + 2 * BUTTON_SIZE + metrics.rowGap;
    } else {
      const pagesLeft = right - 2 * metrics.pageTabWidth - TAB_GAP;
      const gameWidth = Math.min(
        metrics.gameTabWidth,
        fittedTabWidth(pagesLeft - 16 - back.left, gameCount),
      );
      gameTabs = tabRow(back.left, rowTop, gameWidth, gameCount);
      pageTabs = tabRow(pagesLeft, rowTop, metrics.pageTabWidth, 2);
      tabsBottom = rowTop + BUTTON_SIZE;
    }
  }

  const contentBox: MenuBox = {
    left: free.left + metrics.contentSide,
    right: free.right - metrics.contentSide,
    top: tabsBottom + metrics.contentGap,
    bottom: free.bottom - metrics.contentBottom,
  };
  const phone = mode === 'phoneLandscape' || mode === 'phonePortrait';
  const week =
    mode === 'phoneLandscape'
      ? landscapeWeek(contentBox)
      : stackedWeek(contentBox, phone ? PORTRAIT_WEEK : TABLET_WEEK, content.firstLegendLabel);
  const mistakes = mistakesLayout(
    contentBox,
    content.sectionSizes,
    phone ? PHONE_ROWS : TABLET_ROWS,
    mode === 'phoneLandscape',
  );
  return {
    mode,
    free,
    back,
    buttonFontSize: metrics.buttonFontSize,
    profile,
    profileSymbolFontSize: 22,
    title,
    gameTabs,
    pageTabs: pagePair(pageTabs),
    tabFontSize: metrics.tabFontSize,
    week,
    mistakes,
  };
}

/** Jeden sloupeček grafu: vyřešené, uvnitř tmavší napoprvé a nad nimi počet. */
export interface OverviewBar {
  readonly solved: MenuBox;
  readonly firstTry: MenuBox;
  readonly value: OverviewText;
}

/**
 * Sloupečky přehledu `overview`: den s nejvíc příklady má nejvyšší
 * sloupeček, ostatní poměrně. Den s 0 příklady sloupeček nemá (výška 0),
 * jen počet 0 nad základnou. Tmavší část napoprvé stojí uvnitř na stejné
 * základně.
 */
export function overviewBars(week: OverviewWeekLayout, overview: WeekOverview): OverviewBar[] {
  const { chart } = week;
  const most = Math.max(1, ...overview.days.map((day) => day.solved));
  const barOf = (center: number, count: number): MenuBox => {
    const height = (chart.maxBarHeight * count) / most;
    return {
      left: center - chart.barWidth / 2,
      right: center + chart.barWidth / 2,
      top: chart.baseline - height,
      bottom: chart.baseline,
    };
  };
  return week.days.map((day, index) => {
    const data = overview.days[index] ?? { solved: 0, firstTry: 0 };
    const center = (day.box.left + day.box.right) / 2;
    const solved = barOf(center, data.solved);
    return {
      solved,
      firstTry: barOf(center, data.firstTry),
      value: text(
        {
          left: day.box.left,
          right: day.box.right,
          top: solved.top - chart.valueHeight,
          bottom: solved.top,
        },
        chart.valueFontSize,
        'center',
      ),
    };
  });
}

/** Na co prst v přehledu ťukl. */
export type OverviewTarget =
  | { readonly kind: 'back' }
  | { readonly kind: 'game'; readonly index: number }
  | { readonly kind: 'page'; readonly page: 'week' | 'mistakes' };

function contains(box: MenuBox, point: { x: number; y: number }): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

/** Ťukací plocha pod prstem, nebo `undefined` na prázdném místě. */
export function overviewTargetAt(
  layout: OverviewScreenLayout,
  point: { x: number; y: number },
): OverviewTarget | undefined {
  if (contains(layout.back, point)) {
    return { kind: 'back' };
  }
  const game = layout.gameTabs.findIndex((tab) => contains(tab.hit, point));
  if (game >= 0) {
    return { kind: 'game', index: game };
  }
  const [week, mistakes] = layout.pageTabs;
  if (contains(week.hit, point)) {
    return { kind: 'page', page: 'week' };
  }
  return contains(mistakes.hit, point) ? { kind: 'page', page: 'mistakes' } : undefined;
}
