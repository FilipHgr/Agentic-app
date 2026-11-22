/**
 * Rozložení přehledu pro rodiče (#183): nadpis, graf 7 sloupečků se
 * zkratkami dnů, vysvětlivky obou odstínů, součty za týden a Zpět;
 * k tomu tlačítko Přehled v nastavení. Na iPadu (a ve zmenšených oknech)
 * v jednotkách panelu 1024 × 768 jako nastavení, na telefonu podle
 * rozložení nastavení S: na šířku graf se součty vlevo a vysvětlivky a Zpět
 * vpravo pod rohem kolečka, na výšku vše pod sebou a Zpět dole u palce.
 * Telefon se počítá v CSS px a na konci převede na herní jednotky.
 * Čistý TypeScript.
 */

import type { GameSize } from '../../../shared/logic/viewportLayout';
import { cssSizeOf, units } from './phoneScreenParts';
import type { Point } from './screenLayout';
import { OVERVIEW_DAY_COUNT } from './weekActivity';
import type { WeekOverview } from './weekActivity';

/** Obdélník se středem `x`, `y`. */
export interface OverviewRect extends Point {
  readonly width: number;
  readonly height: number;
}

/** Plocha textu; `align` říká, jestli text začíná u levého okraje plochy, nebo je na středu. */
export interface OverviewTextSlot extends OverviewRect {
  readonly fontSize: number;
  readonly align: 'left' | 'center';
}

/** Tlačítko s nápisem (Přehled v nastavení, Zpět v přehledu). */
export interface OverviewButtonSlot extends OverviewRect {
  readonly fontSize: number;
  readonly cornerRadius: number;
}

export interface OverviewLegendEntry {
  /** Čtvereček s odstínem sloupečku. */
  readonly swatch: OverviewRect;
  readonly label: OverviewTextSlot;
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

export interface OverviewLayout {
  readonly title: OverviewTextSlot;
  readonly chart: OverviewChart;
  /** Zkratky 7 dní pod sloupečky, od nejstaršího dne po dnešek. */
  readonly days: readonly OverviewTextSlot[];
  /** Vyřešeno (světlejší) a z toho napoprvé (tmavší). */
  readonly legend: readonly [OverviewLegendEntry, OverviewLegendEntry];
  /** Součet za týden a z toho napoprvé. */
  readonly totals: readonly [OverviewTextSlot, OverviewTextSlot];
  /** Nápis bez dat na středu grafu (AC4). */
  readonly empty: OverviewTextSlot;
  readonly back: OverviewButtonSlot;
  /** Násobek tloušťky okrajů proti iPadu. */
  readonly borderScale: number;
}

/** Jeden sloupeček grafu: vyřešené, uvnitř tmavší napoprvé a nad nimi počet. */
export interface OverviewBar {
  readonly solved: OverviewRect;
  readonly firstTry: OverviewRect;
  readonly value: OverviewTextSlot;
}

/** Řádek součtu: „Za týden vyřešeno: 23“. Dvojtečka je znak, ne text jazyka. */
export function overviewTotalLine(label: string, count: number): string {
  return `${label}: ${count}`;
}

// ---------------------------------------------------------------------------
// Tlačítko Přehled v nastavení
// ---------------------------------------------------------------------------

/**
 * iPad (jednotky panelu): vlevo od ✓ (✓ má střed 512, 669 a stranu 150),
 * levým okrajem zarovnané s řadami voleb (x 142).
 */
const TABLET_OVERVIEW_BUTTON: OverviewButtonSlot = {
  x: 262,
  y: 669,
  width: 240,
  height: 110,
  fontSize: 34,
  cornerRadius: 28,
};

/** Telefon na šířku (CSS px): mezi řadami (končí na 440) a ✓ vpravo, svisle na středu. */
const LANDSCAPE_ROWS_RIGHT = 440;
const LANDSCAPE_CONFIRM_LEFT_FROM_RIGHT = 24 + 96;
const PHONE_BUTTON_RADIUS = 18;

/** Telefon na výšku (CSS px): vlevo od ✓ dole u palce (✓ 104 px, 16 px od spodu). */
const PORTRAIT_CONFIRM_SIZE = 104;
const PORTRAIT_CONFIRM_BOTTOM = 16;
const PORTRAIT_SIDE = 16;
const BUTTON_GAP = 8;

/** Tlačítko Přehled na iPadu, v jednotkách panelu nastavení. */
export function tabletOverviewButton(): OverviewButtonSlot {
  return TABLET_OVERVIEW_BUTTON;
}

function buttonInUnits(slot: OverviewButtonSlot): OverviewButtonSlot {
  return {
    x: units(slot.x),
    y: units(slot.y),
    width: units(slot.width),
    height: units(slot.height),
    fontSize: units(slot.fontSize),
    cornerRadius: units(slot.cornerRadius),
  };
}

/** Tlačítko Přehled v nastavení na telefonu na šířku. */
export function phoneLandscapeOverviewButton(area: GameSize): OverviewButtonSlot {
  const free = cssSizeOf(area);
  const confirmLeft = free.width - LANDSCAPE_CONFIRM_LEFT_FROM_RIGHT;
  return buttonInUnits({
    x: (LANDSCAPE_ROWS_RIGHT + confirmLeft) / 2,
    y: free.height / 2,
    width: 136,
    height: 72,
    fontSize: 20,
    cornerRadius: PHONE_BUTTON_RADIUS,
  });
}

/** Tlačítko Přehled v nastavení na telefonu na výšku. */
export function phonePortraitOverviewButton(area: GameSize): OverviewButtonSlot {
  const free = cssSizeOf(area);
  const confirmLeft = free.width / 2 - PORTRAIT_CONFIRM_SIZE / 2;
  const confirmY = free.height - PORTRAIT_CONFIRM_BOTTOM - PORTRAIT_CONFIRM_SIZE / 2;
  return buttonInUnits({
    x: (PORTRAIT_SIDE + confirmLeft - BUTTON_GAP) / 2,
    y: confirmY,
    width: 104,
    height: 80,
    fontSize: 18,
    cornerRadius: PHONE_BUTTON_RADIUS,
  });
}

// ---------------------------------------------------------------------------
// Přehled
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
function chartOf(frame: ChartFrame): Pick<OverviewLayout, 'chart' | 'days'> {
  const column = (frame.right - frame.left) / OVERVIEW_DAY_COUNT;
  const days = Array.from({ length: OVERVIEW_DAY_COUNT }, (_, index): OverviewTextSlot => ({
    x: frame.left + column * (index + 0.5),
    y: frame.baseline + frame.dayGap + frame.dayHeight / 2,
    width: column,
    height: frame.dayHeight,
    fontSize: frame.dayFontSize,
    align: 'center',
  }));
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

function textSlot(
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  align: 'left' | 'center' = 'center',
): OverviewTextSlot {
  return { x, y, width, height, fontSize, align };
}

/** Čtvereček odstínu a vedle něj vysvětlivka; `left` je levý okraj čtverečku. */
function legendEntry(
  left: number,
  y: number,
  swatchSize: number,
  gap: number,
  labelWidth: number,
  labelHeight: number,
  fontSize: number,
): OverviewLegendEntry {
  const labelLeft = left + swatchSize + gap;
  return {
    swatch: { x: left + swatchSize / 2, y, width: swatchSize, height: swatchSize },
    label: textSlot(labelLeft + labelWidth / 2, y, labelWidth, labelHeight, fontSize, 'left'),
  };
}

function emptyOf(chart: OverviewChart, height: number, fontSize: number): OverviewTextSlot {
  return textSlot(
    (chart.left + chart.right) / 2,
    (chart.top + chart.baseline) / 2,
    chart.right - chart.left,
    height,
    fontSize,
  );
}

/** iPad a zmenšená okna: plocha panelu 1024 × 768, vše vodorovně na středu. */
export function layoutTabletOverview(): OverviewLayout {
  const { chart, days } = chartOf({
    left: 162,
    right: 862,
    top: 96,
    baseline: 440,
    valueHeight: 34,
    valueFontSize: 26,
    dayHeight: 40,
    dayFontSize: 28,
    dayGap: 6,
  });
  return {
    title: textSlot(512, 48, 900, 48, 38),
    chart,
    days,
    legend: [
      // Delší vysvětlivka „po chybě nebo s nápovědou“ má širší plochu.
      legendEntry(160, 520, 28, 14, 400, 34, 24),
      legendEntry(642, 520, 28, 14, 180, 34, 24),
    ],
    totals: [textSlot(512, 572, 700, 34, 26), textSlot(512, 612, 700, 34, 26)],
    empty: emptyOf(chart, 50, 34),
    back: { x: 512, y: 694, width: 260, height: 100, fontSize: 34, cornerRadius: 28 },
    borderScale: 1,
  };
}

/** Rozložení telefonu v CSS px převedené na herní jednotky. */
function phoneLayoutInUnits(layout: OverviewLayout): OverviewLayout {
  const rect = (r: OverviewRect): OverviewRect => ({
    x: units(r.x),
    y: units(r.y),
    width: units(r.width),
    height: units(r.height),
  });
  const text = (slot: OverviewTextSlot): OverviewTextSlot => ({
    ...rect(slot),
    fontSize: units(slot.fontSize),
    align: slot.align,
  });
  const entry = (legend: OverviewLegendEntry): OverviewLegendEntry => ({
    swatch: rect(legend.swatch),
    label: text(legend.label),
  });
  const { chart } = layout;
  return {
    title: text(layout.title),
    chart: {
      left: units(chart.left),
      right: units(chart.right),
      top: units(chart.top),
      baseline: units(chart.baseline),
      barWidth: units(chart.barWidth),
      maxBarHeight: units(chart.maxBarHeight),
      valueHeight: units(chart.valueHeight),
      valueFontSize: units(chart.valueFontSize),
    },
    days: layout.days.map(text),
    legend: [entry(layout.legend[0]), entry(layout.legend[1])],
    totals: [text(layout.totals[0]), text(layout.totals[1])],
    empty: text(layout.empty),
    back: buttonInUnits(layout.back),
    borderScale: units(1),
  };
}

/** Okraj ťukacích ploch a obsahu na telefonu (CSS px). */
const PHONE_SIDE = 16;
/** Roh kolečka, do kterého nic nepatří: x > W − 80, y < 80 (#59 AC2). */
const PHONE_GEAR_CORNER = 80;

/** Na šířku (CSS px): pravý sloupec s vysvětlivkami, součty a Zpět. */
const LANDSCAPE_COLUMN_WIDTH = 240;

/**
 * Telefon na šířku podle S-sirka-nast: graf vlevo a pod ním součty na
 * jednom řádku, vpravo pod rohem kolečka vysvětlivky a dole Zpět.
 */
export function layoutPhoneLandscapeOverview(area: GameSize): OverviewLayout {
  const free = cssSizeOf(area);
  const columnLeft = free.width - PHONE_SIDE - LANDSCAPE_COLUMN_WIDTH;
  const chartRight = columnLeft - PHONE_SIDE;
  const dayHeight = 22;
  const totalHeight = 20;
  const totalsY = free.height - PHONE_SIDE - totalHeight / 2;
  const { chart, days } = chartOf({
    left: PHONE_SIDE,
    right: chartRight,
    top: 40,
    baseline: free.height - PHONE_SIDE - totalHeight - 8 - dayHeight - 4,
    valueHeight: 18,
    valueFontSize: 14,
    dayHeight,
    dayFontSize: 14,
    dayGap: 4,
  });
  const chartWidth = chartRight - PHONE_SIDE;
  const legendTop = PHONE_GEAR_CORNER + 16;
  const backHeight = 72;
  return phoneLayoutInUnits({
    title: textSlot(
      (PHONE_SIDE + chartRight) / 2,
      PHONE_SIDE + 4,
      chartRight - PHONE_SIDE,
      24,
      18,
      'left',
    ),
    chart,
    days,
    legend: [
      legendEntry(columnLeft, legendTop, 16, 8, LANDSCAPE_COLUMN_WIDTH - 24, 20, 13),
      legendEntry(columnLeft, legendTop + 26, 16, 8, LANDSCAPE_COLUMN_WIDTH - 24, 20, 13),
    ],
    // Součty vedle sebe na jednom řádku pod zkratkami dnů (AC7).
    totals: [
      textSlot(PHONE_SIDE + chartWidth / 4, totalsY, chartWidth / 2, totalHeight, 14),
      textSlot(PHONE_SIDE + (chartWidth * 3) / 4, totalsY, chartWidth / 2, totalHeight, 14),
    ],
    empty: emptyOf(chart, 24, 18),
    back: {
      x: columnLeft + 136 / 2,
      y: free.height - PHONE_SIDE - backHeight / 2,
      width: 136,
      height: backHeight,
      fontSize: 20,
      cornerRadius: PHONE_BUTTON_RADIUS,
    },
    borderScale: 1,
  });
}

/** Na výšku: nejvyšší sloupeček (CSS px), aby graf na vysokém okně nebyl přes celou výšku. */
const PORTRAIT_MAX_BAR = 420;

/** Na výšku: nadpis stojí 8 px nad grafem, nejvýš však pod rohem kolečka. */
const PORTRAIT_TITLE_HEIGHT = 22;
const PORTRAIT_TITLE_GAP = 8;
const PORTRAIT_TITLE_TOP_MIN = PHONE_GEAR_CORNER + 8;

/**
 * Telefon na výšku podle S-vyska-nast: nadpis hned nad grafem (pod rohem
 * kolečka), graf, vysvětlivky pod sebou, součty a dole na středu Zpět u palce.
 */
export function layoutPhonePortraitOverview(area: GameSize): OverviewLayout {
  const free = cssSizeOf(area);
  const centerX = free.width / 2;
  const backHeight = 80;
  const backY = free.height - PHONE_SIDE - backHeight / 2;
  const secondTotalY = backY - backHeight / 2 - 16 - 10;
  const firstTotalY = secondTotalY - 24;
  // Vysvětlivky pod sebou, delší text se vedle druhé nevejde.
  const secondLegendY = firstTotalY - 34;
  const firstLegendY = secondLegendY - 26;
  const dayHeight = 22;
  const baseline = firstLegendY - 10 - 12 - dayHeight - 4;
  const valueHeight = 18;
  const chartTopMin = PORTRAIT_TITLE_TOP_MIN + PORTRAIT_TITLE_HEIGHT + PORTRAIT_TITLE_GAP;
  const chartTop = Math.max(chartTopMin, baseline - valueHeight - PORTRAIT_MAX_BAR);
  const titleY = chartTop - PORTRAIT_TITLE_GAP - PORTRAIT_TITLE_HEIGHT / 2;
  const { chart, days } = chartOf({
    left: PHONE_SIDE,
    right: free.width - PHONE_SIDE,
    top: chartTop,
    baseline,
    valueHeight,
    valueFontSize: 12,
    dayHeight,
    dayFontSize: 14,
    dayGap: 4,
  });
  const contentWidth = free.width - 2 * PHONE_SIDE;
  return phoneLayoutInUnits({
    title: textSlot(centerX, titleY, contentWidth, PORTRAIT_TITLE_HEIGHT, 15),
    chart,
    days,
    legend: [
      legendEntry(centerX - 132, firstLegendY, 16, 8, 240, 20, 14),
      legendEntry(centerX - 132, secondLegendY, 16, 8, 240, 20, 14),
    ],
    totals: [
      textSlot(centerX, firstTotalY, contentWidth, 20, 14),
      textSlot(centerX, secondTotalY, contentWidth, 20, 14),
    ],
    empty: emptyOf(chart, 24, 16),
    back: {
      x: centerX,
      y: backY,
      width: 160,
      height: backHeight,
      fontSize: 20,
      cornerRadius: PHONE_BUTTON_RADIUS,
    },
    borderScale: 1,
  });
}

/**
 * Sloupečky přehledu `overview`: den s nejvíc příklady má nejvyšší
 * sloupeček, ostatní poměrně. Den s 0 příklady sloupeček nemá (výška 0),
 * jen počet 0 nad základnou. Tmavší část napoprvé stojí uvnitř na stejné
 * základně (AC7).
 */
export function overviewBars(layout: OverviewLayout, overview: WeekOverview): OverviewBar[] {
  const { chart } = layout;
  const most = Math.max(1, ...overview.days.map((day) => day.solved));
  const barOf = (x: number, count: number): OverviewRect => {
    const height = (chart.maxBarHeight * count) / most;
    return { x, y: chart.baseline - height / 2, width: chart.barWidth, height };
  };
  return layout.days.map((day, index) => {
    const data = overview.days[index] ?? { solved: 0, firstTry: 0 };
    const solved = barOf(day.x, data.solved);
    const solvedTop = solved.y - solved.height / 2;
    return {
      solved,
      firstTry: barOf(day.x, data.firstTry),
      value: textSlot(
        day.x,
        solvedTop - chart.valueHeight / 2,
        day.width,
        chart.valueHeight,
        chart.valueFontSize,
      ),
    };
  });
}
