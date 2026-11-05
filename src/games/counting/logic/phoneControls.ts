/**
 * Ovládání dole na telefonu (V2, #54) v CSS px: číselník po řadách, nebo
 * smazání, okénka na psaní a ✓ vedle sebe. Čistý TypeScript.
 */

import type { ControlsPlacement, PhonePlanRequest } from './phonePlan';
import type { ButtonSlot } from './screenLayout';
import { writingBoxCount } from './settings';

const KEYPAD_BUTTON_SIZES = [104, 96, 88, 80, 72, 64];
export const MIN_KEYPAD_BUTTON_SIZE = 64;
const MIN_BUTTON_GAP = 8;
/** Mezera mezi tlačítky jako část jejich strany. */
const BUTTON_GAP_RATIO = 0.14;

/** Číselník do 10 má horní řadu 0–5, do 20 řady po 7. */
export const KEYPAD_ROW_LENGTH = 6;
export const WIDE_KEYPAD_ROW_LENGTH = 7;

/** Okénko do 5 smí mít na nízkém telefonu 180 px (rozhodnutí vlastníka, #54). */
const ONE_BOX_SIDES = [260, 240, 220, 200, 190, 180];
const TWO_BOX_SIDES = [220, 200, 180, 170, 160, 150];
export const MIN_TWO_BOX_SIDE = 150;
const BOX_GAP = 12;
const WRITING_BUTTON_SIZE = 72;
const WRITING_BUTTON_GAP = 12;

export interface Controls {
  readonly width: number;
  readonly height: number;
  /** Ovládání s levým horním rohem v `left`, `top`. */
  readonly place: (left: number, top: number) => ControlsPlacement;
}

function buttonGap(size: number): number {
  return Math.max(MIN_BUTTON_GAP, Math.floor(size * BUTTON_GAP_RATIO));
}

function keypadRowLengths(buttonCount: number, rowLength: number): number[] {
  const rows: number[] = [];
  for (let left = buttonCount; left > 0; left -= rowLength) {
    rows.push(Math.min(rowLength, left));
  }
  return rows;
}

/** Číselník po řadách od 0, každá řada vodorovně uprostřed. */
export function keypadControls(buttonCount: number, size: number, rowLength: number): Controls {
  const gap = buttonGap(size);
  const rows = keypadRowLengths(buttonCount, rowLength);
  const rowWidth = (count: number): number => count * size + (count - 1) * gap;
  const width = Math.max(...rows.map(rowWidth));
  const height = rows.length * size + (rows.length - 1) * gap;

  const placeRow = (count: number, row: number, left: number, top: number): ButtonSlot[] => {
    const rowLeft = left + (width - rowWidth(count)) / 2;
    return Array.from({ length: count }, (_, index) => ({
      x: rowLeft + index * (size + gap) + size / 2,
      y: top + row * (size + gap) + size / 2,
      size,
    }));
  };

  return {
    width,
    height,
    place: (left, top) => ({
      answerButtons: rows.flatMap((count, row) => placeRow(count, row, left, top)),
      writing: null,
    }),
  };
}

/**
 * Číselník se širokými tlačítky přes šířku `width` (#68, návrh C): řady
 * po `rowLength` zleva od 0, kratší poslední řada začíná vlevo pod 0.
 * Výška tlačítek je `height`, šířka se dopočítá; mezera aspoň 8 px.
 */
export function wideKeypadControls(
  buttonCount: number,
  rowLength: number,
  width: number,
  height: number,
): Controls {
  const gap = MIN_BUTTON_GAP;
  const columns = Math.min(rowLength, buttonCount);
  const buttonWidth = Math.floor((width - (columns - 1) * gap) / columns);
  const rows = keypadRowLengths(buttonCount, rowLength);
  const usedWidth = columns * buttonWidth + (columns - 1) * gap;
  const usedHeight = rows.length * height + (rows.length - 1) * gap;

  return {
    width: usedWidth,
    height: usedHeight,
    place: (left, top) => ({
      answerButtons: Array.from({ length: buttonCount }, (_, index) => ({
        x: left + (index % rowLength) * (buttonWidth + gap) + buttonWidth / 2,
        y: top + Math.floor(index / rowLength) * (height + gap) + height / 2,
        size: height,
        width: buttonWidth,
      })),
      writing: null,
    }),
  };
}

/** Smazání vlevo, okénka uprostřed (desítky vlevo), ✓ vpravo; vše ve výšce středu okének. */
export function writingControls(boxCount: number, side: number): Controls {
  const boxesWidth = boxCount * side + (boxCount - 1) * BOX_GAP;
  const width = 2 * (WRITING_BUTTON_SIZE + WRITING_BUTTON_GAP) + boxesWidth;
  const height = Math.max(side, WRITING_BUTTON_SIZE);

  return {
    width,
    height,
    place: (left, top) => {
      const centerY = top + height / 2;
      const boxesLeft = left + WRITING_BUTTON_SIZE + WRITING_BUTTON_GAP;
      const button = (x: number): ButtonSlot => ({ x, y: centerY, size: WRITING_BUTTON_SIZE });
      return {
        answerButtons: [],
        writing: {
          areas: Array.from({ length: boxCount }, (_, index) => ({
            x: boxesLeft + index * (side + BOX_GAP) + side / 2,
            y: centerY,
            width: side,
            height: side,
          })),
          clear: button(left + WRITING_BUTTON_SIZE / 2),
          confirm: button(left + width - WRITING_BUTTON_SIZE / 2),
        },
      };
    },
  };
}

/** Možné ovládání dole přes šířku od největšího. */
export function controlsOptions(request: PhonePlanRequest): Controls[] {
  if (request.answerInput === 'keypad') {
    return KEYPAD_BUTTON_SIZES.map((size) =>
      keypadControls(request.maxNumber + 1, size, KEYPAD_ROW_LENGTH),
    );
  }
  const boxCount = writingBoxCount(request.maxNumber);
  const sides = boxCount === 1 ? ONE_BOX_SIDES : TWO_BOX_SIDES;
  return sides.map((side) => writingControls(boxCount, side));
}
