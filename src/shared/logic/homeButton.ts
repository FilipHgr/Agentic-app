/**
 * Domeček ve hře (#68): tlačítko stránky vlevo nahoře, zrcadlově ke kolečku
 * nastavení (#36, #55). Podržením 1 s se dítě vrátí do menu. Poloha
 * a velikost jsou stejné jako u kolečka, jen u levého okraje.
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../audio/tonePlayer';
import { HOLD_TO_OPEN_SETTINGS_MS, settingsGearFor } from './settingsGear';
import { isValidViewport } from './viewportLayout';
import type { Viewport } from './viewportLayout';

/** Jak dlouho musí dítě domeček držet, aby se vrátilo do menu (stejně jako kolečko). */
export const HOLD_TO_GO_HOME_MS = HOLD_TO_OPEN_SETTINGS_MS;

/** Tichý krátký tón, když se domeček po ťuknutí jen zhoupne (stejný jako zhoupnutí v menu). */
export const HOME_WOBBLE_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.12 },
];

/** Domeček v CSS px: kreslený symbol, plocha pro prst a kroužek podržení. */
export interface HomeButton {
  readonly iconSize: number;
  readonly hitSize: number;
  /** Horní okraj plochy pro prst od horního okraje okna, i s výřezem. */
  readonly top: number;
  /** Levý okraj plochy pro prst od levého okraje okna, i s výřezem. */
  readonly left: number;
  /** Průměr středové čáry kroužku, který se při podržení plní. */
  readonly ringDiameter: number;
  readonly ringStrokeWidth: number;
}

/** Domeček podle okna: stejný jako kolečko, odstup od levého okraje místo pravého. */
export function homeButtonFor(viewport: Viewport | undefined): HomeButton {
  const gear = settingsGearFor(viewport);
  const safe = isValidViewport(viewport) ? viewport.safeArea : { left: 0, right: 0 };
  // Kolečko je `gear.right` od pravého okraje i s výřezem; domeček stejně daleko od levého.
  const insetFromEdge = gear.right - safe.right;
  const safeLeft = safe.left;
  return {
    iconSize: gear.gearSize,
    hitSize: gear.hitSize,
    top: gear.top,
    left: safeLeft + insetFromEdge,
    ringDiameter: gear.ringDiameter,
    ringStrokeWidth: gear.ringStrokeWidth,
  };
}
