/**
 * Rozložení nastavení Porovnávání pro rodiče (#179, #187: řada „Do
 * kolika“ 10 a 20, #188: řada „Odpověď“ ťuknutím „123“ nebo psaním
 * s tužkou jako v Počítání) podle obrázků S (2026-11-04) jako v Počítání: na
 * iPadu řady na středu s popisky nad nimi a ✓ pod nimi, na telefonu na
 * šířku řady vlevo s popisky před nimi a ✓ vpravo, na výšku řady pod
 * sebou a ✓ dole u palce.
 * Míry jsou v CSS px a na konci se převedou na herní jednotky plochy.
 * Čistý TypeScript.
 */

import { gearSizingFor } from '../../../shared/logic/settingsGear';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { compareTexts } from '../texts/compareTexts';
import type { CompareTexts } from '../texts/compareTexts';
import { ANSWER_INPUT_OPTIONS, MAX_NUMBER_OPTIONS } from './compareSettings';
import type { AnswerInput, MaxNumber } from './compareSettings';

export type SettingsRowKind = 'maxNumber' | 'answerInput';

/** Hodnota volby: rozsah, nebo způsob odpovědi. */
export type SettingsOptionValue = MaxNumber | AnswerInput;

export type SettingsRowLabels = CompareTexts['rowLabels'];

/** Jedna volba; `x` a `y` je její střed. */
export interface SettingsOptionSlot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly value: SettingsOptionValue;
  /** Písmo čísla ve volbě. */
  readonly fontSize: number;
  /** Strana čtverce kreslené tužky ve volbě psaní. */
  readonly pencilSize: number;
}

/** Popisek řady; `x` a `y` je střed jeho pruhu. */
export interface SettingsRowLabel {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  /** Na středu nad řadou, nebo zarovnaný vpravo před řadou (telefon na šířku). */
  readonly align: 'center' | 'right';
}

export interface SettingsRow {
  readonly kind: SettingsRowKind;
  /** Svislý střed řady. */
  readonly y: number;
  readonly label: SettingsRowLabel;
  readonly options: readonly SettingsOptionSlot[];
}

export interface CompareSettingsLayout {
  /** Řady shora dolů: „Do kolika“ a „Odpověď“ (#188). */
  readonly rows: readonly SettingsRow[];
  readonly confirm: { readonly x: number; readonly y: number; readonly size: number };
  /** Zaoblení a okraj voleb v herních jednotkách. */
  readonly optionLook: { readonly cornerRadius: number; readonly borderWidth: number };
}

/** Rozměry jednoho rozložení v CSS px. */
interface Sizes {
  readonly optionWidth: number;
  readonly optionHeight: number;
  readonly optionGap: number;
  readonly optionFontSize: number;
  readonly labelFontSize: number;
  readonly labelHeight: number;
  readonly confirmSize: number;
}

/** iPad: řady na středu, popisek nad řadou, ✓ pod řadami. */
const TABLET: Sizes & {
  readonly labelToRow: number;
  readonly rowToLabel: number;
  readonly confirmGap: number;
} = {
  optionWidth: 160,
  optionHeight: 100,
  optionGap: 24,
  optionFontSize: 48,
  labelFontSize: 24,
  labelHeight: 30,
  confirmSize: 120,
  labelToRow: 8,
  rowToLabel: 24,
  confirmGap: 32,
};

/** Telefon na šířku (S-sirka-nast): popisky vlevo, řady za nimi, ✓ vpravo. */
const PHONE_LANDSCAPE: Sizes & {
  readonly labelLeft: number;
  readonly labelWidth: number;
  readonly labelToOptions: number;
  readonly rowStep: number;
  readonly confirmRightMargin: number;
} = {
  // I víc řad (#188) se vejde pod rohy i na nejnižší telefon: volby 64 px, mezi řadami 8 px.
  optionWidth: 96,
  optionHeight: 64,
  optionGap: 8,
  optionFontSize: 28,
  labelFontSize: 16,
  labelHeight: 20,
  confirmSize: 96,
  labelLeft: 12,
  labelWidth: 88,
  labelToOptions: 12,
  rowStep: 72,
  confirmRightMargin: 24,
};

/** Telefon na výšku (S-vyska-nast): řady pod sebou na středu, ✓ dole u palce. */
const PHONE_PORTRAIT: Sizes & {
  readonly firstRowTop: number;
  readonly rowStep: number;
  readonly labelToRow: number;
  readonly confirmBottomMargin: number;
} = {
  optionWidth: 104,
  optionHeight: 80,
  optionGap: 8,
  optionFontSize: 32,
  labelFontSize: 16,
  labelHeight: 20,
  confirmSize: 104,
  firstRowTop: 114,
  rowStep: 130,
  labelToRow: 6,
  confirmBottomMargin: 16,
};

const OPTION_CORNER_SHARE = 0.18;
const OPTION_BORDER_CSS = 2;
/** Odstup od kraje plochy, když se iPadové rozložení musí zmenšit (CSS px). */
const FIT_MARGIN_CSS = 8;
const CORNER_GAP_CSS = 4;

/** Tužka zabere tuto část výšky volby, nejvýš jako v Počítání (72 px). */
const PENCIL_HEIGHT_SHARE = 0.72;
const MAX_PENCIL_CSS = 72;

const ROW_VALUES: Readonly<Record<SettingsRowKind, readonly SettingsOptionValue[]>> = {
  maxNumber: MAX_NUMBER_OPTIONS,
  answerInput: ANSWER_INPUT_OPTIONS,
};
const ROW_ORDER: readonly SettingsRowKind[] = ['maxNumber', 'answerInput'];

/** Plocha v CSS px. */
interface CssArea {
  readonly width: number;
  readonly height: number;
}

function rowWidth(sizes: Sizes, kind: SettingsRowKind): number {
  const count = ROW_VALUES[kind].length;
  return count * sizes.optionWidth + (count - 1) * sizes.optionGap;
}

/** Řada v CSS px: volby od `left` se středem `centerY` a popisek. */
function buildRow(
  kind: SettingsRowKind,
  sizes: Sizes,
  left: number,
  centerY: number,
  label: Omit<SettingsRowLabel, 'fontSize' | 'height'>,
): SettingsRow {
  const options = ROW_VALUES[kind].map((value, index) => ({
    x: left + index * (sizes.optionWidth + sizes.optionGap) + sizes.optionWidth / 2,
    y: centerY,
    width: sizes.optionWidth,
    height: sizes.optionHeight,
    value,
    fontSize: sizes.optionFontSize,
    pencilSize: Math.min(MAX_PENCIL_CSS, sizes.optionHeight * PENCIL_HEIGHT_SHARE),
  }));
  return {
    kind,
    y: centerY,
    options,
    label: { ...label, fontSize: sizes.labelFontSize, height: sizes.labelHeight },
  };
}

/** Strana čtverce v horních rozích (domeček, kolečko) v CSS px. */
function cornerSize(area: GameArea): number {
  const { sizes, inset } = gearSizingFor(isPhoneMode(area.mode));
  return inset + sizes.hitSize + CORNER_GAP_CSS;
}

/**
 * iPad a zmenšené zobrazení: obsah na středu plochy. Když se nevejde
 * (malé okno), celý se zmenší, aby zůstal na obrazovce.
 */
function tabletLayout(css: CssArea, labels: SettingsRowLabels): Layout {
  const sizes = TABLET;
  const rowBlock = sizes.labelHeight + sizes.labelToRow + sizes.optionHeight;
  const rowCount = ROW_ORDER.length;
  const contentHeight =
    rowCount * rowBlock + (rowCount - 1) * sizes.rowToLabel + sizes.confirmGap + sizes.confirmSize;
  const contentWidth = Math.max(...ROW_ORDER.map((kind) => rowWidth(sizes, kind)));
  const fit = Math.min(
    1,
    (css.height - 2 * FIT_MARGIN_CSS) / contentHeight,
    (css.width - 2 * FIT_MARGIN_CSS) / contentWidth,
  );
  const top = (css.height - contentHeight * fit) / 2;
  const centerX = css.width / 2;
  const rows = ROW_ORDER.map((kind, index) => {
    const blockTop = index * (rowBlock + sizes.rowToLabel);
    const width = rowWidth(sizes, kind);
    return buildRow(kind, sizes, -width / 2, blockTop + rowBlock - sizes.optionHeight / 2, {
      text: labels[kind],
      x: 0,
      y: blockTop + sizes.labelHeight / 2,
      width,
      align: 'center',
    });
  });
  const confirmY = contentHeight - sizes.confirmSize / 2;
  return scaled(
    { rows, confirm: { x: 0, y: confirmY, size: sizes.confirmSize }, cornerRadius: corner(sizes) },
    fit,
    centerX,
    top,
  );
}

/** Telefon na šířku: řady svisle na středu pod rohy, ✓ vpravo na středu. */
function phoneLandscapeLayout(css: CssArea, labels: SettingsRowLabels, corners: number): Layout {
  const sizes = PHONE_LANDSCAPE;
  const rowsHeight = (ROW_ORDER.length - 1) * sizes.rowStep + sizes.optionHeight;
  const top = Math.max((css.height - rowsHeight) / 2, Math.min(corners, css.height - rowsHeight));
  const optionsLeft = sizes.labelLeft + sizes.labelWidth + sizes.labelToOptions;
  const rows = ROW_ORDER.map((kind, index) => {
    const centerY = top + index * sizes.rowStep + sizes.optionHeight / 2;
    return buildRow(kind, sizes, optionsLeft, centerY, {
      text: labels[kind],
      x: sizes.labelLeft + sizes.labelWidth / 2,
      y: centerY,
      width: sizes.labelWidth,
      align: 'right',
    });
  });
  const confirm = {
    x: css.width - sizes.confirmRightMargin - sizes.confirmSize / 2,
    y: css.height / 2,
    size: sizes.confirmSize,
  };
  return { rows, confirm, cornerRadius: corner(sizes) };
}

/** Telefon na výšku: řady pod sebou na středu, popisek nad řadou, ✓ dole na středu. */
function phonePortraitLayout(css: CssArea, labels: SettingsRowLabels): Layout {
  const sizes = PHONE_PORTRAIT;
  const centerX = css.width / 2;
  const rows = ROW_ORDER.map((kind, index) => {
    const rowTop = sizes.firstRowTop + index * sizes.rowStep;
    const width = rowWidth(sizes, kind);
    return buildRow(kind, sizes, centerX - width / 2, rowTop + sizes.optionHeight / 2, {
      text: labels[kind],
      x: centerX,
      y: rowTop - sizes.labelToRow - sizes.labelHeight / 2,
      width,
      align: 'center',
    });
  });
  const confirm = {
    x: centerX,
    y: css.height - sizes.confirmBottomMargin - sizes.confirmSize / 2,
    size: sizes.confirmSize,
  };
  return { rows, confirm, cornerRadius: corner(sizes) };
}

/** Rozložení v CSS px, než se převede na herní jednotky. */
interface Layout {
  readonly rows: readonly SettingsRow[];
  readonly confirm: CompareSettingsLayout['confirm'];
  readonly cornerRadius: number;
}

function corner(sizes: Sizes): number {
  return sizes.optionHeight * OPTION_CORNER_SHARE;
}

/** Zvětší rozložení `factor`krát a posune ho o `dx`, `dy` (všechno v CSS px). */
function scaled(layout: Layout, factor: number, dx: number, dy: number): Layout {
  const x = (value: number): number => dx + value * factor;
  const y = (value: number): number => dy + value * factor;
  return {
    rows: layout.rows.map((row) => ({
      kind: row.kind,
      y: y(row.y),
      label: {
        ...row.label,
        x: x(row.label.x),
        y: y(row.label.y),
        width: row.label.width * factor,
        height: row.label.height * factor,
        fontSize: row.label.fontSize * factor,
      },
      options: row.options.map((option) => ({
        ...option,
        x: x(option.x),
        y: y(option.y),
        width: option.width * factor,
        height: option.height * factor,
        fontSize: option.fontSize * factor,
        pencilSize: option.pencilSize * factor,
      })),
    })),
    confirm: { x: x(layout.confirm.x), y: y(layout.confirm.y), size: layout.confirm.size * factor },
    cornerRadius: layout.cornerRadius * factor,
  };
}

/**
 * Nastavení pro herní plochu `area`. Popisky řad jsou z textů aktuálního
 * jazyka; test je dává pro každý jazyk zvlášť.
 */
export function layoutCompareSettings(
  area: GameArea,
  labels: SettingsRowLabels = compareTexts().rowLabels,
): CompareSettingsLayout {
  const unit = 1 / area.scale;
  const css: CssArea = { width: area.width * area.scale, height: area.height * area.scale };
  let layout: Layout;
  if (area.mode === 'phoneLandscape') {
    layout = phoneLandscapeLayout(css, labels, cornerSize(area));
  } else if (area.mode === 'phonePortrait') {
    layout = phonePortraitLayout(css, labels);
  } else {
    layout = tabletLayout(css, labels);
  }
  const inUnits = scaled(layout, unit, 0, 0);
  return {
    rows: inUnits.rows,
    confirm: inUnits.confirm,
    optionLook: { cornerRadius: inUnits.cornerRadius, borderWidth: OPTION_BORDER_CSS * unit },
  };
}
