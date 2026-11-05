/**
 * Kolečko nastavení je tlačítko stránky v pravém horním rohu obrazovky,
 * mimo herní plochu. Nastavení otevře až podržení; během držení se kolem
 * kolečka plní kruh (CSS třída `is-holding` v index.html).
 */

import { HOLD_TO_OPEN_SETTINGS_MS, isHoldLongEnough } from '../logic/settingsGear';

/** Časovač se pustí o chvilku později, aby měřené držení nevyšlo kratší kvůli zaokrouhlení. */
const TIMER_SLACK_MS = 50;

/** Napojí podržení kolečka na otevření nastavení. */
export function attachSettingsButton(button: HTMLElement, onOpen: () => void): void {
  let timer: number | undefined;
  let startedAt = 0;

  const cancelHold = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
    button.classList.remove('is-holding');
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    cancelHold();
    keepPointer(button, event.pointerId);
    startedAt = performance.now();
    button.classList.add('is-holding');

    timer = window.setTimeout(() => {
      const heldMs = performance.now() - startedAt;
      cancelHold();
      if (isHoldLongEnough(heldMs)) {
        onOpen();
      }
    }, HOLD_TO_OPEN_SETTINGS_MS + TIMER_SLACK_MS);
  });

  // Podržení končí až puštěním prstu; malé ujetí z kolečka ho nepřeruší.
  for (const type of ['pointerup', 'pointercancel'] as const) {
    button.addEventListener(type, cancelHold);
  }

  // Chrome na Androidu by při dlouhém podržení otevřel vlastní nabídku.
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** Prst zůstane „na kolečku“, i když z něj trochu ujede. */
function keepPointer(button: HTMLElement, pointerId: number): void {
  try {
    button.setPointerCapture(pointerId);
  } catch {
    // Některé prohlížeče zachycení nepodporují; podržení pak funguje bez něj.
    return;
  }
}
