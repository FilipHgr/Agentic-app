/**
 * Stránka Chyby v přehledu pro rodiče (#184): nadpis, podíl příkladů
 * napoprvé pro sčítání a odčítání, nejvýš 3 nejčastější chyby, nápověda
 * za týden a Zpět. Do přehledu vyřešených příkladů (#183) se nevešla, je
 * to druhá stránka za tlačítkem Chyby. Řádky jdou pod sebou v jednom
 * sloupci: na iPadu v jednotkách panelu 1024 × 768, na telefonu na šířku
 * vlevo vedle sloupce se Zpět (pravý horní roh patří kolečku), na výšku
 * pod rohem kolečka a Zpět dole u palce. Zpět je na středu místa, kde
 * jsou v přehledu Zpět a Chyby vedle sebe. Na telefonu je písmo na šířku
 * i na výšku stejné. Telefon se počítá v CSS px a na konci převede na herní
 * jednotky. Čistý TypeScript.
 */

import type { GameSize } from '../../../shared/logic/viewportLayout';
import type { Language } from '../../../shared/texts/languages';
import type { MistakeTexts, OverviewTexts } from '../texts/countingTexts';
import type { MistakeOverview, MistakenProblem, OperationShare } from './mistakeActivity';
import {
  LANDSCAPE_COLUMN_WIDTH,
  PHONE_GEAR_CORNER,
  PHONE_SIDE,
  TABLET_BACK,
  TABLET_MISTAKES_BUTTON,
  besideBack,
  buttonInUnits,
  overviewTotalLine,
  phoneLandscapeBack,
  phonePortraitBack,
  textSlot,
} from './overviewLayout';
import type { OverviewButtonSlot, OverviewTextSlot } from './overviewLayout';
import { cssSizeOf, units } from './phoneScreenParts';
import { formatProblemTerms } from './problems';

/** Řádky podílu napoprvé: sčítání a odčítání. */
export const OPERATION_ROWS = 2;

/** Řádky nejčastějších chyb. */
export const FREQUENT_ROWS = 3;

export interface MistakesLayout {
  readonly title: OverviewTextSlot;
  readonly firstTryHeading: OverviewTextSlot;
  /** Řádky podílu shora; hraný druh zabírá řádek, bez dat je v prvním nápis. */
  readonly operations: readonly OverviewTextSlot[];
  readonly frequentHeading: OverviewTextSlot;
  /** Řádky častých chyb shora; bez nich je v prvním „Bez častých chyb“. */
  readonly frequent: readonly OverviewTextSlot[];
  readonly hints: OverviewTextSlot;
  readonly back: OverviewButtonSlot;
  /** Násobek tloušťky okrajů proti iPadu. */
  readonly borderScale: number;
}

// ---------------------------------------------------------------------------
// Texty řádků
// ---------------------------------------------------------------------------

/** Procenta podle zvyklostí jazyka: česky „75 %“, anglicky „75%“. */
function percentText(percent: number, language: Language): string {
  return new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 }).format(
    percent / 100,
  );
}

/** Řádek podílu: „Sčítání: 75 % (3/4)“. Dvojtečka, lomítko a závorky jsou znaky. */
export function operationShareLine(
  label: string,
  share: OperationShare,
  language: Language,
): string {
  return `${label}: ${percentText(share.percent, language)} (${share.firstTry}/${share.solved})`;
}

/**
 * Řádek časté chyby podle vzoru z textů jazyka, například „8 + 5 (4×)“:
 * `{problem}` je příklad, `{count}` počet chyb.
 */
export function frequentMistakeLine(template: string, mistake: MistakenProblem): string {
  return template
    .replace('{problem}', formatProblemTerms(mistake))
    .replace('{count}', String(mistake.mistakes));
}

/** Texty, které stránka Chyby ukazuje, řádek po řádku. */
export interface MistakeLines {
  readonly title: string;
  readonly firstTryHeading: string;
  readonly operations: readonly string[];
  readonly frequentHeading: string;
  readonly frequent: readonly string[];
  readonly hints: string;
  readonly back: string;
}

/**
 * Texty řádků pro přehled `overview`: bez hraní je místo podílu nápis
 * „Zatím žádné příklady“, bez častých chyb „Bez častých chyb“ (AC4).
 */
export function mistakeLines(
  overview: MistakeOverview,
  texts: MistakeTexts,
  overviewTexts: OverviewTexts,
  language: Language,
): MistakeLines {
  const operations = overview.operations.map((share) =>
    operationShareLine(
      share.operation === 'plus' ? texts.addition : texts.subtraction,
      share,
      language,
    ),
  );
  const frequent = overview.frequent.map((mistake) =>
    frequentMistakeLine(texts.frequentItem, mistake),
  );
  return {
    title: texts.title,
    firstTryHeading: texts.firstTryHeading,
    operations: operations.length > 0 ? operations : [overviewTexts.empty],
    frequentHeading: texts.frequentHeading,
    frequent: frequent.length > 0 ? frequent : [texts.noFrequent],
    hints: overviewTotalLine(texts.hintsUsed, overview.hintsUsed),
    back: overviewTexts.back,
  };
}

// ---------------------------------------------------------------------------
// Rozložení
// ---------------------------------------------------------------------------

/** Zpět na středu mezi místy, kde jsou v přehledu Zpět (`back`) a Chyby (`other`). */
function centredBetween(back: OverviewButtonSlot, other: OverviewButtonSlot): OverviewButtonSlot {
  return { ...back, x: (back.x + other.x) / 2 };
}

/** Řádků pod sebou: nadpis podílu, 2 druhy, nadpis chyb, 3 chyby a nápověda. */
const ROW_COUNT = 1 + OPERATION_ROWS + 1 + FREQUENT_ROWS + 1;

/** Písmo na telefonu, na šířku i na výšku stejné (review #184). */
const PHONE_FONT_SIZE = 16;
const PHONE_HEADING_FONT_SIZE = 17;
const PHONE_TITLE_FONT_SIZE = 17;
/** Mezera mezi oddíly; na nízkém telefonu na šířku menší, aby řádky zůstaly 28 px od sebe. */
const PORTRAIT_SECTION_GAP = 12;
const LANDSCAPE_SECTION_GAP = 8;
/** Vzdálenost řádků na telefonu: nejvýš 32; na nízkém telefonu na šířku méně, aby se vešly. */
const PHONE_MAX_PITCH = 32;
/** Řádek je o tolik nižší než vzdálenost řádků, aby se nedotýkaly. */
const ROW_SPACING = 4;

/** Míry sloupce na telefonu: řádky od `top` do `bottom` (CSS px). */
function phoneColumn(
  left: number,
  width: number,
  top: number,
  bottom: number,
  sectionGap: number,
): RowColumn {
  const fitting = (bottom - top - 2 * sectionGap) / ROW_COUNT;
  const pitch = Math.min(PHONE_MAX_PITCH, fitting);
  return {
    left,
    width,
    top,
    pitch,
    rowHeight: Math.min(24, pitch - ROW_SPACING),
    fontSize: PHONE_FONT_SIZE,
    headingFontSize: PHONE_HEADING_FONT_SIZE,
    sectionGap,
  };
}

/** Míry sloupce řádků. */
interface RowColumn {
  readonly left: number;
  readonly width: number;
  /** Horní okraj prvního řádku (nadpisu podílu). */
  readonly top: number;
  /** Vzdálenost středů řádků. */
  readonly pitch: number;
  readonly rowHeight: number;
  readonly fontSize: number;
  readonly headingFontSize: number;
  /** Mezera navíc mezi oddíly (podíl, časté chyby, nápověda). */
  readonly sectionGap: number;
}

type RowParts = Pick<
  MistakesLayout,
  'firstTryHeading' | 'operations' | 'frequentHeading' | 'frequent' | 'hints'
>;

/** Řádky pod sebou: nadpis podílu, 2 druhy, nadpis chyb, 3 chyby a nápověda. */
function rowsOf(column: RowColumn): RowParts {
  let y = column.top + column.pitch / 2;
  const next = (fontSize: number): OverviewTextSlot => {
    const slot = textSlot(
      column.left + column.width / 2,
      y,
      column.width,
      column.rowHeight,
      fontSize,
      'left',
    );
    y += column.pitch;
    return slot;
  };
  const rows = (count: number): OverviewTextSlot[] =>
    Array.from({ length: count }, () => next(column.fontSize));
  const firstTryHeading = next(column.headingFontSize);
  const operations = rows(OPERATION_ROWS);
  y += column.sectionGap;
  const frequentHeading = next(column.headingFontSize);
  const frequent = rows(FREQUENT_ROWS);
  y += column.sectionGap;
  const hints = next(column.fontSize);
  return { firstTryHeading, operations, frequentHeading, frequent, hints };
}

/** iPad a zmenšená okna: plocha panelu 1024 × 768, sloupec široký jako graf přehledu. */
export function layoutTabletMistakes(): MistakesLayout {
  return {
    title: textSlot(512, 60, 900, 48, 38),
    ...rowsOf({
      left: 162,
      width: 700,
      top: 126,
      pitch: 48,
      rowHeight: 40,
      fontSize: 28,
      headingFontSize: 30,
      sectionGap: 24,
    }),
    back: centredBetween(TABLET_BACK, TABLET_MISTAKES_BUTTON),
    borderScale: 1,
  };
}

/** Rozložení telefonu v CSS px převedené na herní jednotky. */
function phoneLayoutInUnits(layout: MistakesLayout): MistakesLayout {
  const text = (slot: OverviewTextSlot): OverviewTextSlot => ({
    x: units(slot.x),
    y: units(slot.y),
    width: units(slot.width),
    height: units(slot.height),
    fontSize: units(slot.fontSize),
    align: slot.align,
  });
  return {
    title: text(layout.title),
    firstTryHeading: text(layout.firstTryHeading),
    operations: layout.operations.map(text),
    frequentHeading: text(layout.frequentHeading),
    frequent: layout.frequent.map(text),
    hints: text(layout.hints),
    back: buttonInUnits(layout.back),
    borderScale: units(1),
  };
}

/**
 * Telefon na šířku: nadpis a řádky vlevo, kde je v přehledu graf; pravý
 * sloupec má jen Zpět dole na stejném místě jako v přehledu.
 */
export function layoutPhoneLandscapeMistakes(area: GameSize): MistakesLayout {
  const free = cssSizeOf(area);
  const contentRight = free.width - PHONE_SIDE - LANDSCAPE_COLUMN_WIDTH - PHONE_SIDE;
  const width = contentRight - PHONE_SIDE;
  const back = phoneLandscapeBack(free);
  return phoneLayoutInUnits({
    title: textSlot(
      PHONE_SIDE + width / 2,
      PHONE_SIDE + 4,
      width,
      24,
      PHONE_TITLE_FONT_SIZE,
      'left',
    ),
    ...rowsOf(phoneColumn(PHONE_SIDE, width, 36, free.height - PHONE_SIDE, LANDSCAPE_SECTION_GAP)),
    back: centredBetween(back, besideBack(back)),
    borderScale: 1,
  });
}

/** Na výšku: nadpis pod rohem kolečka, řádky pod ním a Zpět dole jako v přehledu. */
export function layoutPhonePortraitMistakes(area: GameSize): MistakesLayout {
  const free = cssSizeOf(area);
  const width = free.width - 2 * PHONE_SIDE;
  const titleTop = PHONE_GEAR_CORNER + 8;
  const titleHeight = 24;
  const overviewBack = phonePortraitBack(free);
  const back = centredBetween(overviewBack, besideBack(overviewBack));
  return phoneLayoutInUnits({
    title: textSlot(
      free.width / 2,
      titleTop + titleHeight / 2,
      width,
      titleHeight,
      PHONE_TITLE_FONT_SIZE,
    ),
    ...rowsOf(
      phoneColumn(
        PHONE_SIDE,
        width,
        titleTop + titleHeight + 12,
        back.y - back.height / 2 - 16,
        PORTRAIT_SECTION_GAP,
      ),
    ),
    back,
    borderScale: 1,
  });
}
