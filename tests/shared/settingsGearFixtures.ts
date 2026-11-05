import type { GameArea } from '../../src/shared/logic/viewportLayout';
import { settingsGearFor } from '../../src/shared/logic/settingsGear';
import type { SettingsGear } from '../../src/shared/logic/settingsGear';
import {
  IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  NO_NOTCH,
  box,
  toCss,
  viewportOf,
} from './viewportFixtures';
import type { Box, TestSafeArea, TestWindow } from './viewportFixtures';

/**
 * Rozměry kolečka nastavení (#55), okna a pomocné funkce pro testy
 * kolečka ve sdílené části i v Počítání.
 */

export const PHONE_GEAR_SIZE = 48;
export const PHONE_HIT_SIZE = 64;
export const PHONE_EDGE_OFFSET = 8;
export const MIN_GAP_TO_CONTROLS = 8;
export const MIN_RING_STROKE = 3;

export const TABLET_GEAR_SIZE = 76;
export const TABLET_EDGE_OFFSET = 12;

export const TOLERANCE = 0.01;

export function windowOf(
  name: string,
  width: number,
  height: number,
  safeArea = NO_NOTCH,
): TestWindow {
  return { name, width, height, safeArea };
}

/** iPhone SE na šířku: telefon, ale hra je zmenšená (režim `scaled`). */
export const IPHONE_SE_LANDSCAPE = windowOf('667×320 iPhone SE', 667, 320);

export const IPHONE_PORTRAIT_NOTCH: TestSafeArea = { top: 47, right: 0, bottom: 34, left: 0 };

/** Telefon na výšku (AC4). */
export const PHONE_PORTRAIT_WINDOWS: readonly TestWindow[] = [
  windowOf('390×844 iPhone na výšku', 390, 844, IPHONE_PORTRAIT_NOTCH),
  windowOf('360×780 Samsung na výšku', 360, 780),
];

/** iPad, kde se kolečko nemění (AC3). */
export const TABLET_GEAR_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  JUST_ABOVE_LIMIT,
  windowOf('820×1180 iPad na výšku', 820, 1180),
];

export function gearOf(window: TestWindow): SettingsGear {
  return settingsGearFor(viewportOf(window));
}

/** Plocha pro prst v souřadnicích okna. */
export function hitBoxOf(window: TestWindow, gear: SettingsGear): Box {
  const right = window.width - gear.right;
  return { left: right - gear.hitSize, right, top: gear.top, bottom: gear.top + gear.hitSize };
}

/** Kreslené kolečko: uprostřed plochy pro prst. */
export function gearBoxOf(window: TestWindow, gear: SettingsGear): Box {
  const hit = hitBoxOf(window, gear);
  const centerX = (hit.left + hit.right) / 2;
  const centerY = (hit.top + hit.bottom) / 2;
  return box(centerX, centerY, gear.gearSize, gear.gearSize);
}

/** Celá herní plocha v okně v CSS px. */
export function gameBoxOf(area: GameArea): Box {
  return toCss({ left: 0, right: area.width, top: 0, bottom: area.height }, area);
}
