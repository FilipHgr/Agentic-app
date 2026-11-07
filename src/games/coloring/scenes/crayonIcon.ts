/**
 * Zástupný symbol pastelky (#93) ve stylu A3: šikmé tlusté tělo ve vybrané
 * barvě se špičatým hrotem a dvěma modrými proužky na papírovém obalu.
 * Proti fixu (modré tělo, čtvercový hrot) je hlavně v barvě. Kreslí se do
 * úchytu a do místa pastelky v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { CRAYON_STYLE } from '../logic/theme';
import { tiltedTool } from './tiltedTool';

/** Šířka těla pastelky jako díl velikosti. */
const BODY_THICKNESS = 0.36;

/** Pastelka se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawCrayon(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  const tool = tiltedTool(x, y, size, 0.84);
  const ink = colorNumber(inkHex ?? CRAYON_STYLE.noColor);
  const half = BODY_THICKNESS / 2;

  graphics.fillStyle(ink, 1);
  const tip = tool.point(0, 0);
  const tipLeft = tool.point(0.24, -half);
  const tipRight = tool.point(0.24, half);
  graphics.fillTriangle(tip.x, tip.y, tipLeft.x, tipLeft.y, tipRight.x, tipRight.y);
  graphics.fillPoints(tool.band(0.24, 1, BODY_THICKNESS), true);
  graphics.fillStyle(colorNumber(CRAYON_STYLE.stripeColor), 1);
  graphics.fillPoints(tool.band(0.4, 0.47, BODY_THICKNESS), true);
  graphics.fillPoints(tool.band(0.78, 0.85, BODY_THICKNESS), true);
}
