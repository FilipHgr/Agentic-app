/**
 * Rudy přímo na obrazovce (#186 AC2) bez Phaseru: kde panda stojí, jak je
 * velká a kudy přiskočí zdola a odskočí dolů. Kreslí
 * `src/shared/ui/rudyWindow.ts`.
 *
 * Bez karty, okraje a ztmavení: panda s průhledným pozadím stojí přes hru
 * uprostřed obrazovky. Má výšku 70 % menší strany okna, nejméně 200 px,
 * a vždy se celá vejde do bezpečné oblasti (mimo výřez, stavový řádek
 * a lištu domů) a na plátno hry. Přískok začne celý pod spodním okrajem
 * plátna a skončí s malým přeskokem nahoru na místě; odskok se nejdřív
 * maličko odrazí a pak spadne zpátky pod spodní okraj. Horní okraj
 * obrazovky panda nepřeskočí nikdy. Míry jsou v CSS px okna, čas v ms.
 */

import { RUDY_SHEET } from './rudy';
import { safeAreaOrNone } from './viewportLayout';
import type { GameArea, Viewport } from './viewportLayout';

/** Nejmenší výška pandy (snímku) v CSS px. */
export const RUDY_MIN_HEIGHT_CSS = 200;

/**
 * Jaký díl menší strany okna panda zabere na výšku. Víc než 55 % by snímek
 * 439 × 480 px na Retině iPadu zvětšilo nad 2× a byl by rozmazaný.
 */
export const RUDY_HEIGHT_SHARE = 0.55;

/** Jak dlouho trvá přískok zdola na místo a odskok dolů. */
export const RUDY_HOP_TIMES = { inMs: 450, outMs: 350 } as const;

/** Jak silný je přeskok na konci přískoku a odraz na začátku odskoku (easing „back“). */
const HOP_OVERSHOOT = 1.4;

/** Obdélník v CSS px okna. */
export interface RudyRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Rudy na obrazovce: kde stojí a odkud přiskočí. */
export interface RudyStageLayout {
  /** Snímek pandy na místě, uprostřed obrazovky. */
  readonly panda: RudyRect;
  /** Horní okraj pandy schované celé pod spodním okrajem plátna. */
  readonly hiddenTop: number;
  /** Nejvyšší horní okraj pandy během skoků (výřez a horní okraj plátna). */
  readonly highestTop: number;
}

/** Přískok zdola (`in`), nebo odskok dolů (`out`). */
export type RudyHopPhase = 'in' | 'out';

/** Kde jde pandu nakreslit: bezpečná oblast okna a zároveň plátno hry. */
function drawableRect(viewport: Viewport, area: GameArea): RudyRect {
  const safe = safeAreaOrNone(viewport.safeArea);
  const left = Math.max(safe.left, area.offsetX);
  const top = Math.max(safe.top, area.offsetY);
  const right = Math.min(viewport.width - safe.right, area.offsetX + area.width * area.scale);
  const bottom = Math.min(viewport.height - safe.bottom, area.offsetY + area.height * area.scale);
  // Celé CSS px dovnitř, aby panda po zaokrouhlení nepřečnívala.
  const whole = { left: Math.ceil(left), top: Math.ceil(top) };
  return {
    ...whole,
    width: Math.max(0, Math.floor(right) - whole.left),
    height: Math.max(0, Math.floor(bottom) - whole.top),
  };
}

/** Výška pandy: 70 % menší strany okna, aspoň 200 px, nejvýš co se vejde. */
function pandaHeight(viewport: Viewport, drawable: RudyRect): number {
  const wanted = Math.max(
    Math.round(RUDY_HEIGHT_SHARE * Math.min(viewport.width, viewport.height)),
    RUDY_MIN_HEIGHT_CSS,
  );
  const fitsWidth = (drawable.width * RUDY_SHEET.frameHeight) / RUDY_SHEET.frameWidth;
  return Math.max(0, Math.min(wanted, drawable.height, fitsWidth));
}

/** Rudy v okně `viewport` nad herní plochou `area`: uprostřed a celý vidět. */
export function layoutRudyStage(viewport: Viewport, area: GameArea): RudyStageLayout {
  const drawable = drawableRect(viewport, area);
  const height = pandaHeight(viewport, drawable);
  const width = (height * RUDY_SHEET.frameWidth) / RUDY_SHEET.frameHeight;
  const panda: RudyRect = {
    left: drawable.left + (drawable.width - width) / 2,
    top: drawable.top + (drawable.height - height) / 2,
    width,
    height,
  };
  return {
    panda,
    hiddenTop: area.offsetY + area.height * area.scale,
    highestTop: drawable.top,
  };
}

/** Postup skoku 0–1 podle času; nesmyslný nebo záporný čas je začátek. */
function hopProgress(elapsed: number, durationMs: number): number {
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return 0;
  }
  return Math.min(elapsed / durationMs, 1);
}

/** Zpomalení na konci s malým přeskokem (dopad na místo). */
function easeOutBack(progress: number): number {
  const rest = progress - 1;
  return 1 + (HOP_OVERSHOOT + 1) * rest ** 3 + HOP_OVERSHOOT * rest ** 2;
}

/** Zrychlení s malým odrazem na začátku (odraz před pádem). */
function easeInBack(progress: number): number {
  return (HOP_OVERSHOOT + 1) * progress ** 3 - HOP_OVERSHOOT * progress ** 2;
}

/**
 * Horní okraj pandy (CSS px) `elapsed` ms od začátku skoku. Přískok vede
 * ze schované polohy na místo, odskok z místa zpátky pod okraj.
 */
export function rudyHopTop(layout: RudyStageLayout, phase: RudyHopPhase, elapsed: number): number {
  const { panda, hiddenTop, highestTop } = layout;
  const travel = hiddenTop - panda.top;
  const top =
    phase === 'in'
      ? hiddenTop - travel * easeOutBack(hopProgress(elapsed, RUDY_HOP_TIMES.inMs))
      : panda.top + travel * easeInBack(hopProgress(elapsed, RUDY_HOP_TIMES.outMs));
  return Math.max(top, Math.min(highestTop, panda.top));
}

/** Doběhl už skok, který začal před `elapsed` ms? */
export function isRudyHopDone(phase: RudyHopPhase, elapsed: number): boolean {
  const duration = phase === 'in' ? RUDY_HOP_TIMES.inMs : RUDY_HOP_TIMES.outMs;
  return Number.isFinite(elapsed) && elapsed >= duration;
}
