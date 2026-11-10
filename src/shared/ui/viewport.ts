/**
 * Okno prohlížeče pro rozložení podle zařízení (#54, #56): velikost okna,
 * výřez a lišta domů z CSS `env(safe-area-inset-*)` a umístění herní
 * plochy na stránce. Rozhodování je v `src/shared/logic/viewportLayout.ts`.
 */

import type { CanvasResolution } from '../logic/canvasResolution';
import { safeAreaOrNone } from '../logic/viewportLayout';
import type { GameArea, SafeArea, Viewport } from '../logic/viewportLayout';

/** Klíč v `game.registry`, pod kterým scéna najde aktuální herní plochu. */
export const GAME_AREA_KEY = 'gameArea';

/** iOS při otočení a změně lišty pošle víc událostí; přepočítá se až po ustálení. */
const SETTLE_MS = 250;

/**
 * Výřez z CSS. Skrytý prvek `#safe-area-probe` má padding
 * `env(safe-area-inset-*)` (index.html), prohlížeč ho přepočítá na px.
 */
function readSafeArea(): SafeArea {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) {
    return safeAreaOrNone(undefined);
  }
  const style = window.getComputedStyle(probe);
  return safeAreaOrNone({
    top: parseFloat(style.paddingTop),
    right: parseFloat(style.paddingRight),
    bottom: parseFloat(style.paddingBottom),
    left: parseFloat(style.paddingLeft),
  });
}

/** Současné okno: velikost v CSS px a výřez. */
export function readViewport(): Viewport {
  return { width: window.innerWidth, height: window.innerHeight, safeArea: readSafeArea() };
}

/**
 * Umístí prvek s hrou přesně tam, kde se má plátno ukázat (#77): na
 * telefonu přes volnou plochu (bez výřezu a lišty) jako dřív, jinak na
 * střed okna ve velikosti zmenšené plochy 1024 × 768. Phaser plátno do
 * prvku roztáhne celé, poměr stran je stejný.
 */
export function placeGameParent(parent: HTMLElement, resolution: CanvasResolution): void {
  const style = parent.style;
  style.left = `${resolution.offsetX}px`;
  style.top = `${resolution.offsetY}px`;
  style.width = `${resolution.cssWidth}px`;
  style.height = `${resolution.cssHeight}px`;
}

/**
 * Zavolá `onSettled`, až se okno po otočení nebo změně lišty přestane měnit.
 * Vrátí funkci, která sledování ukončí (menu po spuštění hry, #67).
 */
export function watchViewport(onSettled: () => void): () => void {
  let timer: number | undefined;
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onSettled, SETTLE_MS);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  };
}

/**
 * Mají dvě herní plochy stejné rozložení (druh a velikost v jednotkách)?
 * Pak se scéna nepřekresluje, jen se plocha posune nebo zmenší.
 */
export function hasSameLayout(first: GameArea, second: GameArea): boolean {
  return (
    first.mode === second.mode && first.width === second.width && first.height === second.height
  );
}
