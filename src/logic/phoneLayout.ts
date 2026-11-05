/**
 * Rozložení telefonu na šířku podle návrhu V2 (#54), v CSS px volné
 * plochy (bez výřezu a lišty, levý horní roh je 0, 0).
 *
 * Nahoře uprostřed hvězdičky, pod nimi uprostřed postavička a příklad,
 * dole přes šířku číselník nebo okénka na psaní (`phoneStackedPlan.ts`).
 * Nápověda je vpravo od příkladu. Výjimka: číselník do 20 je vpravo
 * a příklad s postavičkou vlevo od něj (`phoneWideKeypadPlan.ts`).
 *
 * Velikosti se zkouší od největších; použije se první rozložení, které
 * projde kontrolou (`phonePlanCheck.ts`). Převod na herní jednotky je
 * v `deviceLayout.ts`. Čistý TypeScript.
 */

import {
  KEYPAD_ROW_LENGTH,
  MIN_KEYPAD_BUTTON_SIZE,
  MIN_TWO_BOX_SIDE,
  keypadControls,
  writingControls,
} from './phoneControls';
import { basePlan, mascotCenterBelow, problemBox } from './phoneElements';
import { EDGE_MARGIN, MIN_FONT_SIZE, MIN_MASCOT_SIZE, STAR_ROW_BOTTOM } from './phonePlan';
import type { PhonePlan, PhonePlanRequest } from './phonePlan';
import { isValidPlan } from './phonePlanCheck';
import { stackedCandidates } from './phoneStackedPlan';
import { wideKeypadCandidates } from './phoneWideKeypadPlan';
import { writingBoxCount } from './settings';

export type { FreeSize, PhonePlan, PhonePlanRequest, WritingControls } from './phonePlan';

function allCandidates(request: PhonePlanRequest): Generator<PhonePlan> {
  if (request.answerInput === 'keypad' && request.maxNumber === 20) {
    return wideKeypadCandidates(request);
  }
  return stackedCandidates(request);
}

/**
 * Největší rozložení, ve kterém se všechno vejde.
 *
 * Kdyby kontrolou neprošel žádný kandidát, použije se vědomě poslední
 * (nejmenší) zkoušený, nebo nouzový plán: hra se tak zobrazí vždy a nespadne.
 * Na zkušebních oknech telefonu (od 744 × 296 px) se to nestane, hlídají to
 * testy v `tests/phoneLandscapeLayout.test.ts`.
 */
export function planPhoneScreen(request: PhonePlanRequest): PhonePlan {
  let last: PhonePlan | null = null;
  for (const plan of allCandidates(request)) {
    if (isValidPlan(plan, request.free)) {
      return plan;
    }
    last = plan;
  }
  return last ?? fallbackPlan(request);
}

/** Nouzový plán, když žádný kandidát nevznikl: všechno co nejmenší, ovládání dole vlevo. */
function fallbackPlan(request: PhonePlanRequest): PhonePlan {
  const sizes = {
    font: MIN_FONT_SIZE,
    problem: problemBox(MIN_FONT_SIZE, request.maxNumber),
    mascotSize: MIN_MASCOT_SIZE,
  };
  const controls =
    request.answerInput === 'keypad'
      ? keypadControls(request.maxNumber + 1, MIN_KEYPAD_BUTTON_SIZE, KEYPAD_ROW_LENGTH)
      : writingControls(writingBoxCount(request.maxNumber), MIN_TWO_BOX_SIDE);
  return {
    ...basePlan(request, sizes, null),
    mascot: mascotCenterBelow(EDGE_MARGIN + MIN_MASCOT_SIZE, STAR_ROW_BOTTOM, MIN_MASCOT_SIZE),
    problem: { x: request.free.width / 2, y: STAR_ROW_BOTTOM + sizes.problem.height / 2 },
    hintDots: [],
    ...controls.place(EDGE_MARGIN, request.free.height - controls.height),
  };
}
