/**
 * Okno prohlížeče pro rozložení podle zařízení (#54, #56): velikost okna,
 * výřez a lišta domů z CSS `env(safe-area-inset-*)` a umístění herní
 * plochy na stránce. Rozhodování je v `src/logic/deviceLayout.ts`.
 */

import { isPhoneMode, safeAreaOrNone } from '../logic/deviceLayout';
import type { GameArea, SafeArea, Viewport } from '../logic/deviceLayout';

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
 * Umístí prvek s hrou. Na telefonu přesně přes volnou plochu (bez výřezu
 * a lišty), jinak přes celé okno a Phaser hru zmenší a vycentruje jako dřív.
 */
export function placeGameParent(parent: HTMLElement, area: GameArea): void {
  const style = parent.style;
  if (isPhoneMode(area.mode)) {
    style.left = `${area.offsetX}px`;
    style.top = `${area.offsetY}px`;
    style.width = `${area.width * area.scale}px`;
    style.height = `${area.height * area.scale}px`;
    return;
  }
  style.left = '0px';
  style.top = '0px';
  style.width = '100%';
  style.height = '100%';
}

/** Zavolá `onSettled`, až se okno po otočení nebo změně lišty přestane měnit. */
export function watchViewport(onSettled: () => void): void {
  let timer: number | undefined;
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(onSettled, SETTLE_MS);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
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
