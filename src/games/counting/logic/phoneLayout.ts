/**
 * Rozložení telefonu na šířku podle návrhu C (#68), v CSS px volné
 * plochy (bez výřezu a lišty, levý horní roh je 0, 0): nahoře pás
 * s příkladem, tečkami nápovědy a hvězdičkami mezi domečkem a kolečkem,
 * dole číselník nebo okénka na psaní přes šířku (`phoneBandPlan.ts`).
 * Dřívější V2 (#54) vlastník po obrázcích nahradil.
 *
 * Převod na herní jednotky je v `deviceLayout.ts`. Čistý TypeScript.
 */

import {
  KEYPAD_ROW_LENGTH,
  MIN_KEYPAD_BUTTON_SIZE,
  MIN_TWO_BOX_SIDE,
  keypadControls,
  writingControls,
} from './phoneControls';
import { basePlan, problemBox } from './phoneElements';
import { EDGE_MARGIN, MIN_FONT_SIZE, STAR_ROW_BOTTOM } from './phonePlan';
import type { PhonePlan, PhonePlanRequest } from './phonePlan';
import { planBandScreen } from './phoneBandPlan';
import { writingBoxCount } from './settings';

export type { FreeSize, PhonePlan, PhonePlanRequest, WritingControls } from './phonePlan';

/**
 * Největší rozložení C (#68), ve kterém se všechno vejde.
 *
 * Kdyby se nevešlo žádné, použije se vědomě nouzový plán: hra se tak
 * zobrazí vždy a nespadne. Na zkušebních oknech telefonu (od 744 × 296 px)
 * se to nestane, hlídají to testy v
 * `tests/games/counting/phoneLandscapeLayout.test.ts`.
 */
export function planPhoneScreen(request: PhonePlanRequest): PhonePlan {
  return planBandScreen(request) ?? fallbackPlan(request);
}

/** Nouzový plán, když žádný kandidát nevznikl: všechno co nejmenší, ovládání dole vlevo. */
function fallbackPlan(request: PhonePlanRequest): PhonePlan {
  const sizes = {
    font: MIN_FONT_SIZE,
    problem: problemBox(MIN_FONT_SIZE, request.maxNumber),
  };
  const controls =
    request.answerInput === 'keypad'
      ? keypadControls(request.maxNumber + 1, MIN_KEYPAD_BUTTON_SIZE, KEYPAD_ROW_LENGTH)
      : writingControls(writingBoxCount(request.maxNumber), MIN_TWO_BOX_SIDE);
  return {
    ...basePlan(request, sizes, null),
    problem: { x: request.free.width / 2, y: STAR_ROW_BOTTOM + sizes.problem.height / 2 },
    hintDots: [],
    ...controls.place(EDGE_MARGIN, request.free.height - controls.height),
  };
}
