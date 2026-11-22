/**
 * Ztlumení kolečka stránky při otevřeném nastavení (#179, jako #45
 * v Počítání). Kolečko je prvek stránky mimo plátno hry.
 */

import { GEAR_OPACITY } from '../logic/theme';

export function dimSettingsGear(open: boolean): void {
  const button = document.getElementById('settings-button');
  if (!button) {
    return;
  }
  button.style.transition = `opacity ${GEAR_OPACITY.transitionMs}ms ease`;
  button.style.opacity = String(open ? GEAR_OPACITY.open : GEAR_OPACITY.closed);
}
