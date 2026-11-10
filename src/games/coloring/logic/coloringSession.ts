/**
 * Sezení Omalovánek se stránkou (#88 AC6): domeček jde použít hned po
 * otevření a kolečko nastavení se nenapojí, protože Omalovánky nastavení
 * nemají (doporučení k otázce 2). Při odchodu domečkem se malování zastaví.
 * Čistý TypeScript bez Phaseru.
 */

import type { GameHost } from '../../../shared/logic/gameHost';

/** Co Omalovánky od stránky potřebují. */
export type ColoringPage = Pick<GameHost, 'setHomeAvailable' | 'attachSettingsGear' | 'onLeave'>;

export interface ColoringSession {
  /** Odešlo dítě domečkem do menu? */
  hasLeft(): boolean;
}

/**
 * Ohlásí domeček jako použitelný. `onLeave` se zavolá při odchodu domečkem,
 * než se hra zničí (ukončí tah, ztiší zvuky).
 */
export function startColoringSession(
  page: ColoringPage,
  onLeave: () => void = () => undefined,
): ColoringSession {
  let left = false;
  page.onLeave(() => {
    left = true;
    onLeave();
  });
  page.setHomeAvailable(true);
  return { hasLeft: () => left };
}
