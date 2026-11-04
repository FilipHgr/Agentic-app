/**
 * Ovládání dole u palce na telefonu na výšku (#56, rozložení P2), v CSS px:
 * číselník ve 3 sloupcích (do 20 v 5), nebo okénka na psaní vedle sebe
 * a pod nimi smazání vlevo a ✓ vpravo. Čistý TypeScript.
 */

import { keypadControls } from './phoneControls';
import type { Controls } from './phoneControls';
import type { ButtonSlot } from './screenLayout';
import type { MaxNumber } from './settings';
import { writingBoxCount } from './settings';

const KEYPAD_BUTTON_SIZES = [104, 96, 88, 80, 72, 64];
const MIN_KEYPAD_BUTTON_SIZE = 64;

/** Do 5 a do 10 tři sloupce (velká tlačítka u palce), do 20 pět (5 × 5, rozhodnutí #56). */
function keypadColumns(maxNumber: MaxNumber): number {
  return maxNumber === 20 ? 5 : 3;
}

/** Jedno okénko do 5 aspoň 200 px, dvě okénka aspoň 160 px (AC6). */
const ONE_BOX_SIDES = [260, 240, 220, 200];
const TWO_BOX_SIDES = [200, 190, 180, 170, 160];
const MIN_ONE_BOX_SIDE = 200;
const MIN_TWO_BOX_SIDE = 160;
/** Okénko smí být vyšší než široké, nejvýš 1,6× (AC6). */
const MAX_BOX_HEIGHT_RATIO = 1.6;
const BOX_GAP = 12;
const WRITING_BUTTON_SIZE = 72;
/** Mezera mezi okénky a tlačítky pod nimi. */
const BOXES_TO_BUTTONS_GAP = 16;

/** Okénka vedle sebe (desítky vlevo) a pod nimi smazání vlevo a ✓ vpravo. */
function portraitWritingControls(boxCount: number, side: number, boxHeight: number): Controls {
  const width = boxCount * side + (boxCount - 1) * BOX_GAP;
  const height = boxHeight + BOXES_TO_BUTTONS_GAP + WRITING_BUTTON_SIZE;

  return {
    width,
    height,
    place: (left, top) => {
      const buttonY = top + height - WRITING_BUTTON_SIZE / 2;
      const button = (x: number): ButtonSlot => ({ x, y: buttonY, size: WRITING_BUTTON_SIZE });
      return {
        answerButtons: [],
        writing: {
          areas: Array.from({ length: boxCount }, (_, index) => ({
            x: left + index * (side + BOX_GAP) + side / 2,
            y: top + boxHeight / 2,
            width: side,
            height: boxHeight,
          })),
          clear: button(left + WRITING_BUTTON_SIZE / 2),
          confirm: button(left + width - WRITING_BUTTON_SIZE / 2),
        },
      };
    },
  };
}

/**
 * Nejvyšší okénko, které se vejde do výšky `availableHeight`: aspoň čtverec,
 * nejvýš 1,6× vyšší než široké. Když se nevejde ani čtverec, zůstane
 * čtverec a ovládání bude vyšší než místo (kandidát pak neprojde).
 */
function boxHeightFor(side: number, availableHeight: number): number {
  const room = availableHeight - BOXES_TO_BUTTONS_GAP - WRITING_BUTTON_SIZE;
  return Math.max(side, Math.min(side * MAX_BOX_HEIGHT_RATIO, room));
}

/** Možné ovládání od největšího pro místo vysoké `availableHeight`. */
export function portraitControlsOptions(
  maxNumber: MaxNumber,
  answerInput: 'keypad' | 'writing',
  availableHeight: number,
): Controls[] {
  if (answerInput === 'keypad') {
    return KEYPAD_BUTTON_SIZES.map((size) =>
      keypadControls(maxNumber + 1, size, keypadColumns(maxNumber)),
    );
  }
  const boxCount = writingBoxCount(maxNumber);
  const sides = boxCount === 1 ? ONE_BOX_SIDES : TWO_BOX_SIDES;
  return sides.map((side) =>
    portraitWritingControls(boxCount, side, boxHeightFor(side, availableHeight)),
  );
}

/** Nejmenší ovládání pro nouzové rozložení: tlačítka 64 px, čtvercová okénka. */
export function smallestPortraitControls(
  maxNumber: MaxNumber,
  answerInput: 'keypad' | 'writing',
): Controls {
  if (answerInput === 'keypad') {
    return keypadControls(maxNumber + 1, MIN_KEYPAD_BUTTON_SIZE, keypadColumns(maxNumber));
  }
  const boxCount = writingBoxCount(maxNumber);
  const side = boxCount === 1 ? MIN_ONE_BOX_SIDE : MIN_TWO_BOX_SIDE;
  return portraitWritingControls(boxCount, side, side);
}
