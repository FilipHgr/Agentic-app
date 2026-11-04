/**
 * Rozložení nastavení pro rodiče (#45): tři řady voleb a ✓. Je tady, a ne ve
 * scéně, aby šlo bez prohlížeče ověřit rozměry a mezery. Čistý TypeScript.
 */

import type { ButtonSlot, Point } from './screenLayout';
import { ANSWER_INPUT_OPTIONS, MAX_NUMBER_OPTIONS, OPERATION_OPTIONS } from './settings';
import type { AnswerInput, MaxNumber, OperationMode } from './settings';

export type SettingsRowKind = 'maxNumber' | 'operations' | 'answerInput';

/** Jedna volba; `x` a `y` je její střed. */
export interface SettingsOptionSlot extends Point {
  readonly width: number;
  readonly height: number;
  readonly value: MaxNumber | OperationMode | AnswerInput;
}

/** Popisek nad řadou pro rodiče (#47); `x` a `y` je střed pruhu. */
export interface SettingsRowLabel extends Point {
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}

const ROW_LABELS: Record<SettingsRowKind, string> = {
  maxNumber: 'Do kolika',
  operations: 'Příklady',
  answerInput: 'Odpověď',
};

export interface SettingsRow {
  readonly kind: SettingsRowKind;
  readonly label: SettingsRowLabel;
  /** Svislý střed řady. */
  readonly y: number;
  readonly options: readonly SettingsOptionSlot[];
}

export interface SettingsLayout {
  /** Rozsah, druh příkladů a způsob odpovědi, v tomto pořadí. */
  readonly rows: readonly [SettingsRow, SettingsRow, SettingsRow];
  readonly confirm: ButtonSlot;
}

const OPTION_WIDTH = 220;
const OPTION_HEIGHT = 130;
const OPTION_GAP = 40;

/** Okraj nad prvním popiskem; popisek a jeho řada; mezera k dalšímu popisku (#47). */
const TOP_MARGIN = 12;
const LABEL_HEIGHT = 32;
const LABEL_FONT_SIZE = 28;
const LABEL_TO_ROW_GAP = 8;
const ROW_TO_LABEL_GAP = 20;

/** Mezera mezi poslední řadou a ✓ (#47 AC3). */
const CONFIRM_SIZE = 150;
const CONFIRM_GAP = 32;

/**
 * Tužka ve volbě psaní, kreslená čarou (nezávisí na písmu). Souřadnice jsou
 * vůči středu volby, osa y míří dolů; hrot je vlevo dole jako při psaní.
 */
export const PENCIL_ICON = {
  width: 72,
  height: 72,
  strokeWidth: 10,
  tip: { x: -30, y: 30 },
  tail: { x: 30, y: -30 },
} as const;

/** Tři řady voleb pod sebou a pod nimi ✓, vše vodorovně na středu. */
export function layoutSettingsPanel(width: number, height: number): SettingsLayout {
  const centerX = width / 2;
  const rowStep = LABEL_HEIGHT + LABEL_TO_ROW_GAP + OPTION_HEIGHT + ROW_TO_LABEL_GAP;
  const rowY = (index: number): number =>
    TOP_MARGIN + LABEL_HEIGHT + LABEL_TO_ROW_GAP + OPTION_HEIGHT / 2 + index * rowStep;

  const rows: [SettingsRow, SettingsRow, SettingsRow] = [
    layoutRowWithLabel('maxNumber', MAX_NUMBER_OPTIONS, centerX, rowY(0)),
    layoutRowWithLabel('operations', OPERATION_OPTIONS, centerX, rowY(1)),
    layoutRowWithLabel('answerInput', ANSWER_INPUT_OPTIONS, centerX, rowY(2)),
  ];
  const lastRowBottom = rowY(2) + OPTION_HEIGHT / 2;
  // Na nižší ploše ✓ nevyjede pod spodní okraj, zůstane celé vidět.
  const confirmY = Math.min(
    lastRowBottom + CONFIRM_GAP + CONFIRM_SIZE / 2,
    height - CONFIRM_SIZE / 2,
  );

  return { rows, confirm: { x: centerX, y: confirmY, size: CONFIRM_SIZE } };
}

/** Řada voleb se středem `y` a nad ní popisek široký jako řada. */
function layoutRowWithLabel(
  kind: SettingsRowKind,
  values: readonly (MaxNumber | OperationMode | AnswerInput)[],
  centerX: number,
  y: number,
): SettingsRow {
  const options = layoutRow(values, centerX, y);
  const rowWidth = values.length * OPTION_WIDTH + (values.length - 1) * OPTION_GAP;
  const labelBottom = y - OPTION_HEIGHT / 2 - LABEL_TO_ROW_GAP;
  return {
    kind,
    y,
    options,
    label: {
      text: ROW_LABELS[kind],
      x: centerX,
      y: labelBottom - LABEL_HEIGHT / 2,
      width: rowWidth,
      height: LABEL_HEIGHT,
      fontSize: LABEL_FONT_SIZE,
    },
  };
}

function layoutRow(
  values: readonly (MaxNumber | OperationMode | AnswerInput)[],
  centerX: number,
  y: number,
): SettingsOptionSlot[] {
  const rowWidth = values.length * OPTION_WIDTH + (values.length - 1) * OPTION_GAP;
  const firstX = centerX - rowWidth / 2 + OPTION_WIDTH / 2;
  return values.map((value, index) => ({
    x: firstX + index * (OPTION_WIDTH + OPTION_GAP),
    y,
    width: OPTION_WIDTH,
    height: OPTION_HEIGHT,
    value,
  }));
}
