/**
 * Kolečko nastavení pro rodiče na stránce, společné pro všechny hry (#36,
 * #55): poloha, velikost a podržení 1 s. Obsah nastavení patří hře.
 * Čistý TypeScript bez Phaseru.
 */

import { isValidViewport } from './viewportLayout';
import type { Viewport } from './viewportLayout';

/** Jak dlouho musí rodič držet ozubené kolečko, aby se nastavení otevřelo. */
export const HOLD_TO_OPEN_SETTINGS_MS = 1000;

/** Otevře se nastavení po takto dlouhém držení kolečka? */
export function isHoldLongEnough(heldMs: number): boolean {
  return Number.isFinite(heldMs) && heldMs >= HOLD_TO_OPEN_SETTINGS_MS;
}

// ---------------------------------------------------------------------------
// Kolečko nastavení pro rodiče (#55). Je to prvek stránky mimo herní plochu.
// ---------------------------------------------------------------------------

/** Kolečko nastavení v CSS px: kreslené kolečko, plocha pro prst a kroužek podržení. */
export interface SettingsGear {
  readonly gearSize: number;
  readonly hitSize: number;
  /** Horní okraj plochy pro prst od horního okraje okna, i s výřezem. */
  readonly top: number;
  /** Pravý okraj plochy pro prst od pravého okraje okna, i s výřezem. */
  readonly right: number;
  /** Průměr středové čáry kroužku, který se při podržení plní. */
  readonly ringDiameter: number;
  readonly ringStrokeWidth: number;
}

/** Telefon pro kolečko: kratší strana okna pod 500 px (i úzký iPad ve Split View). */
const PHONE_GEAR_MAX_SHORT_SIDE = 500;

/** Na telefonu malé kolečko 48 px, prst má dál plochu 64 px. */
const PHONE_GEAR: Omit<SettingsGear, 'top' | 'right'> = {
  gearSize: 48,
  hitSize: 64,
  ringDiameter: 60,
  ringStrokeWidth: 4,
};
const PHONE_GEAR_INSET = 8;

/** iPad jako dnes (#36): kolečko 76 px, kroužek uvnitř (r 29 a čára 5 ve viewBoxu 64). */
const TABLET_GEAR: Omit<SettingsGear, 'top' | 'right'> = {
  gearSize: 76,
  hitSize: 76,
  ringDiameter: (2 * 29 * 76) / 64,
  ringStrokeWidth: (5 * 76) / 64,
};
const TABLET_GEAR_INSET = 12;

/** Velikost kolečka a jeho odstup od rohu volné plochy v CSS px: telefon, nebo iPad. */
export function gearSizingFor(isPhone: boolean): {
  readonly sizes: Omit<SettingsGear, 'top' | 'right'>;
  readonly inset: number;
} {
  return isPhone
    ? { sizes: PHONE_GEAR, inset: PHONE_GEAR_INSET }
    : { sizes: TABLET_GEAR, inset: TABLET_GEAR_INSET };
}

export function settingsGearFor(viewport: Viewport | undefined): SettingsGear {
  if (!isValidViewport(viewport)) {
    return { ...TABLET_GEAR, top: TABLET_GEAR_INSET, right: TABLET_GEAR_INSET };
  }
  const isPhone = Math.min(viewport.width, viewport.height) < PHONE_GEAR_MAX_SHORT_SIDE;
  const { sizes, inset } = gearSizingFor(isPhone);
  return {
    ...sizes,
    top: viewport.safeArea.top + inset,
    right: viewport.safeArea.right + inset,
  };
}
