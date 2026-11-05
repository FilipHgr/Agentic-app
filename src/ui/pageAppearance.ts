/**
 * Barva stránky kolem herní plochy a průhlednost kolečka nastavení (#45).
 * Hodnoty určuje logika (`pageAppearance`), tady se jen nastaví na stránku.
 */

import type { PageAppearance } from '../logic/settingsSession';

export function applyPageAppearance(
  appearance: PageAppearance,
  settingsButton: HTMLElement | null,
): void {
  const transition = `${appearance.transitionMs}ms ease`;
  for (const element of [document.documentElement, document.body]) {
    element.style.transition = `background-color ${transition}`;
    element.style.backgroundColor = appearance.background;
  }
  if (settingsButton) {
    settingsButton.style.transition = `opacity ${transition}`;
    settingsButton.style.opacity = String(appearance.gearOpacity);
  }
}
