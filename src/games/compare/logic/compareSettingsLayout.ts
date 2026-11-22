/**
 * Rozložení nastavení Porovnávání pro rodiče (#179, řada „Otázka“ #182)
 * podle obrázků S (2026-11-04) jako v Počítání: na iPadu řady na středu
 * s popisky nad nimi a ✓ pod nimi, na telefonu na šířku řady vlevo
 * s popisky před nimi a ✓ vpravo, na výšku řady pod sebou a ✓ dole u palce. Míry jsou v CSS px
 * a na konci se převedou na herní jednotky plochy. Čistý TypeScript.
 */

import { gearSizingFor } from '../../../shared/logic/settingsGear';
import { isPhoneMode } from '../../../shared/logic/viewportLayout';
import type { GameArea } from '../../../shared/logic/viewportLayout';
import { compareTexts } from '../texts/compareTexts';
import type { CompareTexts } from '../texts/compareTexts';
import type { Dot, Numeral, Rect } from './compareLayout';
import { questionPicture } from './compareQuestion';
import type { QuestionPicture } from './compareQuestion';
import { MAX_NUMBER_OPTIONS, QUESTION_OPTIONS, SHOW_OPTIONS } from './compareSettings';
import type { MaxNumber, QuestionSetting, ShowMode } from './compareSettings';

export type SettingsRowKind = 'maxNumber' | 'show' | 'question';

/** Hodnota volby: rozsah, způsob ukázání, nebo otázka. */
export type SettingsOptionValue = MaxNumber | ShowMode | QuestionSetting;

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
  /** Do kolika, Ukázat a Otázka, v tomto pořadí. */
  readonly rows: readonly [SettingsRow, SettingsRow, SettingsRow];
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
  // Tři řady (#182) se vejdou pod rohy i na nejnižší telefon: volby 64 px, mezi řadami 8 px.
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

const ROW_VALUES: Readonly<Record<SettingsRowKind, readonly SettingsOptionValue[]>> = {
  maxNumber: MAX_NUMBER_OPTIONS,
  show: SHOW_OPTIONS,
  question: QUESTION_OPTIONS,
};
const ROW_ORDER = ['maxNumber', 'show', 'question'] as const;

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
  const [first, second, third] = inUnits.rows;
  return {
    rows: [first as SettingsRow, second as SettingsRow, third as SettingsRow],
    confirm: inUnits.confirm,
    optionLook: { cornerRadius: inUnits.cornerRadius, borderWidth: OPTION_BORDER_CSS * unit },
  };
}

/** Obrázek ve volbě „Ukázat“: tečky, číslo, nebo obojí (číslo pod tečkami). */
export interface ShowOptionIcon {
  readonly dots: readonly Dot[];
  readonly numeral: Numeral | null;
}

/** Tři tečky v obrázku volby (počet je symbol, ne text). */
const ICON_DOTS = 3;
const ICON_DOT_GAP_SHARE = 0.6;

/** Tři tečky vedle sebe se středem `centerY` a poloměrem `radius`. */
function iconDots(centerX: number, centerY: number, radius: number): Dot[] {
  const step = 2 * radius * (1 + ICON_DOT_GAP_SHARE);
  const firstX = centerX - ((ICON_DOTS - 1) * step) / 2;
  return Array.from({ length: ICON_DOTS }, (_, index) => ({
    x: firstX + index * step,
    y: centerY,
    radius,
  }));
}

/**
 * Obrázek volby „Ukázat“ uvnitř volby `slot`: tečky jsou tři tečky
 * v řadě, čísla velká trojka, obojí menší tečky a trojka pod nimi.
 */
export function showOptionIcon(slot: SettingsOptionSlot, value: ShowMode): ShowOptionIcon {
  const { x, y, width, height } = slot;
  switch (value) {
    case 'dots':
      return { dots: iconDots(x, y, Math.min(width * 0.09, height * 0.13)), numeral: null };
    case 'numbers':
      return { dots: [], numeral: { x, y, fontSize: slot.fontSize } };
    case 'both':
      return {
        dots: iconDots(x, y - height * 0.2, Math.min(width * 0.065, height * 0.09)),
        numeral: { x, y: y + height * 0.17, fontSize: height * 0.38 },
      };
  }
}

/** Okraj kolem hromádek ve volbě „Otázka“ jako díl strany volby. */
const QUESTION_ICON_INSET_SHARE = 0.08;

/**
 * Obrázek volby „Otázka“ (#182) uvnitř volby `slot`: stejné hromádky jako
 * symbol nad kartami. „Víc“ velká hromádka, „míň“ malá a „střídat“ malá
 * a velká vedle sebe.
 */
export function questionOptionIcon(
  slot: SettingsOptionSlot,
  value: QuestionSetting,
): QuestionPicture {
  // Hromádky nesahají k okraji volby.
  const width = slot.width * (1 - 2 * QUESTION_ICON_INSET_SHARE);
  const height = slot.height * (1 - 2 * QUESTION_ICON_INSET_SHARE);
  const box: Rect = { left: slot.x - width / 2, top: slot.y - height / 2, width, height };
  if (value !== 'alternate') {
    return questionPicture(value, box);
  }
  // Mezi malou a velkou hromádkou zůstane mezera.
  const half = { ...box, width: box.width * 0.46 };
  const small = questionPicture('less', half);
  const big = questionPicture('more', { ...half, left: box.left + box.width * 0.54 });
  return { dots: [...small.dots, ...big.dots], grounds: [...small.grounds, ...big.grounds] };
}
