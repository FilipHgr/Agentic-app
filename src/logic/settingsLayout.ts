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

export interface SettingsRow {
  readonly kind: SettingsRowKind;
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

/** Okraj nad první řadou a mezera mezi řadami. */
const TOP_MARGIN = 45;
const ROW_GAP = 40;

/** ✓ je od poslední řady dál, aby působilo jako samostatný krok. */
const CONFIRM_SIZE = 150;
const CONFIRM_GAP = 60;

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
  const rowY = (index: number): number =>
    TOP_MARGIN + OPTION_HEIGHT / 2 + index * (OPTION_HEIGHT + ROW_GAP);

  const rows: [SettingsRow, SettingsRow, SettingsRow] = [
    { kind: 'maxNumber', y: rowY(0), options: layoutRow(MAX_NUMBER_OPTIONS, centerX, rowY(0)) },
    { kind: 'operations', y: rowY(1), options: layoutRow(OPERATION_OPTIONS, centerX, rowY(1)) },
    {
      kind: 'answerInput',
      y: rowY(2),
      options: layoutRow(ANSWER_INPUT_OPTIONS, centerX, rowY(2)),
    },
  ];
  const lastRowBottom = rowY(2) + OPTION_HEIGHT / 2;
  // Na nižší ploše ✓ nevyjede pod spodní okraj, zůstane celé vidět.
  const confirmY = Math.min(
    lastRowBottom + CONFIRM_GAP + CONFIRM_SIZE / 2,
    height - CONFIRM_SIZE / 2,
  );

  return { rows, confirm: { x: centerX, y: confirmY, size: CONFIRM_SIZE } };
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
