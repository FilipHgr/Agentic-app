/**
 * Nastavení pro rodiče na telefonu (#59): na šířku podle obrázku
 * S-sirka-nast (řady vlevo s popisky, ✓ vpravo), na výšku podle
 * S-vyska-nast (řady pod sebou na středu, ✓ dole u palce). Rozměry jsou
 * v CSS px a na konci se převedou na herní jednotky telefonu.
 * Řady voleb sdílí i průvodce nastavením na telefonu (#60,
 * `phoneGuideLayout.ts`). Čistý TypeScript.
 */

import type { GameSize } from './deviceLayout';
import { PHONE_UNITS_PER_CSS_PX, cssSizeOf, units } from './phoneScreenParts';
import { ANSWER_INPUT_OPTIONS, MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from './settings';
import type { AnswerInput, MaxNumber, OperationMode } from './settings';
import { ROW_LABELS } from './settingsLayout';
import type {
  SettingsLabelAlign,
  SettingsLayout,
  SettingsOptionSlot,
  SettingsRow,
  SettingsRowKind,
} from './settingsLayout';

type OptionValue = MaxNumber | OperationMode | AnswerInput;

const ROW_VALUES: Record<SettingsRowKind, readonly OptionValue[]> = {
  maxNumber: MAX_NUMBER_OPTIONS,
  operations: OPERATION_OPTIONS,
  answerInput: ANSWER_INPUT_OPTIONS,
};
const ROW_ORDER: readonly SettingsRowKind[] = ['maxNumber', 'operations', 'answerInput'];

/** Společné rozměry na telefonu (CSS px, AC2). */
const LABEL_FONT_SIZE = 16;
const LABEL_HEIGHT = 20;
const OPTION_WIDTH = 104;
export const PHONE_OPTION_GAP = 8;
const OPTION_CORNER_RADIUS = 18;
/** Okraj voleb 2 CSS px jako na obrázcích S (na iPadu 2 jednotky). */
const OPTION_BORDER_SCALE = PHONE_UNITS_PER_CSS_PX;
/** Tužka ve volbě: delší strana aspoň 48 px a okraj aspoň 4 px (AC2). */
const PENCIL_SIZE = 48;

/** Na šířku (AC3). */
const LANDSCAPE = {
  labelLeft: 12,
  labelRight: 100,
  optionsLeft: 112,
  optionHeight: 72,
  rowStep: 88,
  rowsHeight: 248,
  optionFontSize: 28,
  confirmSize: 96,
  confirmRightMargin: 24,
} as const;

/** Na výšku (AC5). */
const PORTRAIT = {
  firstRowTop: 114,
  optionHeight: 80,
  rowStep: 130,
  labelToRowGap: 6,
  optionFontSize: 32,
  confirmSize: 104,
  confirmBottomMargin: 16,
} as const;

/** Rozměry řady v CSS px, ze kterých se postaví řada v jednotkách. */
export interface PhoneRowPlan {
  readonly kind: SettingsRowKind;
  /** Levý okraj první volby a svislý střed řady. */
  readonly optionsLeft: number;
  readonly centerY: number;
  readonly optionWidth: number;
  readonly optionHeight: number;
  readonly optionFontSize: number;
  readonly label: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly align: SettingsLabelAlign;
  };
}

/** Šířka řady voleb v CSS px (volby a mezery mezi nimi). */
export function phoneRowWidth(kind: SettingsRowKind, optionWidth: number): number {
  const count = ROW_VALUES[kind].length;
  return count * optionWidth + (count - 1) * PHONE_OPTION_GAP;
}

/** Řada z plánu v CSS px převedená na herní jednotky. */
function rowInUnits(plan: PhoneRowPlan): SettingsRow {
  const step = plan.optionWidth + PHONE_OPTION_GAP;
  const options: SettingsOptionSlot[] = ROW_VALUES[plan.kind].map((value, index) => ({
    x: units(plan.optionsLeft + index * step + plan.optionWidth / 2),
    y: units(plan.centerY),
    width: units(plan.optionWidth),
    height: units(plan.optionHeight),
    value,
    fontSize: units(plan.optionFontSize),
  }));
  return {
    kind: plan.kind,
    y: units(plan.centerY),
    options,
    label: {
      text: ROW_LABELS[plan.kind],
      x: units(plan.label.x),
      y: units(plan.label.y),
      width: units(plan.label.width),
      height: units(LABEL_HEIGHT),
      fontSize: units(LABEL_FONT_SIZE),
      align: plan.label.align,
    },
  };
}

/** Řady Do kolika, Příklady a Odpověď podle plánu jednotlivých řad. */
export function phoneRows(
  plan: (kind: SettingsRowKind, index: number) => PhoneRowPlan,
): SettingsLayout['rows'] {
  const [first, second, third] = ROW_ORDER.map((kind, index) => rowInUnits(plan(kind, index)));
  return [first as SettingsRow, second as SettingsRow, third as SettingsRow];
}

export const PHONE_OPTION_LOOK: SettingsLayout['optionLook'] = {
  cornerRadius: units(OPTION_CORNER_RADIUS),
  borderScale: OPTION_BORDER_SCALE,
  pencilSize: units(PENCIL_SIZE),
};

/**
 * Na šířku (S-sirka-nast, AC3): tři řady vlevo svisle na středu, popisek
 * zarovnaný vpravo před řadou, ✓ vpravo svisle na středu.
 */
export function layoutPhoneLandscapeSettings(area: GameSize): SettingsLayout {
  const free = cssSizeOf(area);
  const top = (free.height - LANDSCAPE.rowsHeight) / 2;
  const labelWidth = LANDSCAPE.labelRight - LANDSCAPE.labelLeft;
  const rows = phoneRows((kind, index) => {
    const centerY = top + index * LANDSCAPE.rowStep + LANDSCAPE.optionHeight / 2;
    return {
      kind,
      optionsLeft: LANDSCAPE.optionsLeft,
      centerY,
      optionWidth: OPTION_WIDTH,
      optionHeight: LANDSCAPE.optionHeight,
      optionFontSize: LANDSCAPE.optionFontSize,
      label: {
        x: LANDSCAPE.labelLeft + labelWidth / 2,
        y: centerY,
        width: labelWidth,
        align: 'right',
      },
    };
  });
  const confirmX = free.width - LANDSCAPE.confirmRightMargin - LANDSCAPE.confirmSize / 2;
  return {
    rows,
    confirm: { x: units(confirmX), y: units(free.height / 2), size: units(LANDSCAPE.confirmSize) },
    optionLook: PHONE_OPTION_LOOK,
  };
}

/**
 * Na výšku (S-vyska-nast, AC5): řady pod sebou vodorovně na středu,
 * popisek na středu nad řadou, ✓ dole na středu u palce.
 */
export function layoutPhonePortraitSettings(area: GameSize): SettingsLayout {
  const free = cssSizeOf(area);
  const centerX = free.width / 2;
  const rows = phoneRows((kind, index) => {
    const rowTop = PORTRAIT.firstRowTop + index * PORTRAIT.rowStep;
    const width = phoneRowWidth(kind, OPTION_WIDTH);
    return {
      kind,
      optionsLeft: centerX - width / 2,
      centerY: rowTop + PORTRAIT.optionHeight / 2,
      optionWidth: OPTION_WIDTH,
      optionHeight: PORTRAIT.optionHeight,
      optionFontSize: PORTRAIT.optionFontSize,
      label: {
        x: centerX,
        y: rowTop - PORTRAIT.labelToRowGap - LABEL_HEIGHT / 2,
        width,
        align: 'center',
      },
    };
  });
  const confirmY = free.height - PORTRAIT.confirmBottomMargin - PORTRAIT.confirmSize / 2;
  return {
    rows,
    confirm: { x: units(centerX), y: units(confirmY), size: units(PORTRAIT.confirmSize) },
    optionLook: PHONE_OPTION_LOOK,
  };
}
