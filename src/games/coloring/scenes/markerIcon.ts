/**
 * Zástupný symbol fixu (#93) ve stylu A3: šikmé modré tělo, víčko na konci
 * a čtvercový hrot ve vybrané barvě. Kreslí se do úchytu a do místa fixu
 * v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { MARKER_STYLE } from '../logic/theme';
import { tiltedTool } from './tiltedTool';

/** Fix se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawMarker(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  const tool = tiltedTool(x, y, size, 0.9);
  const ink = colorNumber(inkHex ?? MARKER_STYLE.noColor);

  // Čtvercový hrot: krátký široký kvádr, ať je vidět rozdíl proti pastelce.
  graphics.fillStyle(ink, 1);
  graphics.fillPoints(tool.band(0, 0.13, 0.2), true);
  graphics.fillStyle(colorNumber(MARKER_STYLE.collarColor), 1);
  graphics.fillPoints(tool.band(0.13, 0.24, 0.26), true);
  graphics.fillStyle(colorNumber(MARKER_STYLE.bodyColor), 1);
  graphics.fillPoints(tool.band(0.24, 0.76, 0.32), true);
  graphics.fillStyle(ink, 1);
  graphics.fillPoints(tool.band(0.76, 1, 0.32), true);
}
