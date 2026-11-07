/**
 * Zástupný symbol duhového štětce (#97) ve stylu A3: šest soustředných
 * oblouků v barvách duhy z palety (červená venku, fialová uvnitř), bez
 * textu. Duha nemá jednu vybranou barvu, kreslí se vždy stejně do úchytu
 * i do místa duhy v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { PALETTE, RAINBOW_COLORS } from '../logic/palette';

/** Poloměr vnějšího oblouku jako díl velikosti symbolu. */
const OUTER_RADIUS_SHARE = 0.46;

/** Tloušťka jednoho barevného oblouku jako díl velikosti symbolu. */
const ARC_THICKNESS_SHARE = 0.065;

/** Střed oblouků je pod středem symbolu, aby duha seděla uprostřed čtverce. */
const CENTER_DROP_SHARE = 0.2;

/** Duha se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawRainbow(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const thickness = size * ARC_THICKNESS_SHARE;
  const centerY = y + size * CENTER_DROP_SHARE;
  RAINBOW_COLORS.forEach((colorIndex, ring) => {
    const hex = PALETTE[colorIndex]?.hex;
    if (hex === undefined) {
      return;
    }
    // Oblouky se o kousek překrývají, aby mezi barvami nesvítila mezera.
    const radius = size * OUTER_RADIUS_SHARE - thickness * (ring + 0.5);
    graphics.lineStyle(thickness * 1.15, colorNumber(hex), 1);
    graphics.beginPath();
    graphics.arc(x, centerY, radius, Math.PI, 2 * Math.PI);
    graphics.strokePath();
  });
}
