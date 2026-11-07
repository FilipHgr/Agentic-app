/**
 * Zástupný symbol štětce (#96): šikmá rukojeť, objímka a špička ve
 * vybrané barvě. Kreslí se do úchytu a do místa štětce v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { BRUSH_STYLE } from '../logic/theme';

/** Štětec se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawBrush(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  tipHex: string | null,
): void {
  // Osa štětce jde z pravého horního rohu do levého dolního.
  const along = (share: number): { x: number; y: number } => ({
    x: x + size * (0.42 - 0.84 * share),
    y: y + size * (-0.42 + 0.84 * share),
  });
  const handleStart = along(0);
  const handleEnd = along(0.45);
  const ferruleEnd = along(0.56);
  const tip = along(1);

  graphics.lineStyle(size * 0.11, colorNumber(BRUSH_STYLE.handleColor), 1);
  graphics.lineBetween(handleStart.x, handleStart.y, handleEnd.x, handleEnd.y);
  graphics.fillStyle(colorNumber(BRUSH_STYLE.handleColor), 1);
  graphics.fillCircle(handleStart.x, handleStart.y, size * 0.055);

  graphics.lineStyle(size * 0.17, colorNumber(BRUSH_STYLE.ferruleColor), 1);
  graphics.lineBetween(handleEnd.x, handleEnd.y, ferruleEnd.x, ferruleEnd.y);

  // Špička: kapka od objímky ke hrotu.
  const tipColor = colorNumber(tipHex ?? BRUSH_STYLE.noColor);
  const middle = along(0.74);
  const width = size * 0.17;
  graphics.fillStyle(tipColor, 1);
  graphics.fillCircle(middle.x, middle.y, width);
  graphics.fillTriangle(
    middle.x - width * 0.72,
    middle.y - width * 0.72,
    middle.x + width * 0.72,
    middle.y + width * 0.72,
    tip.x,
    tip.y,
  );
  graphics.fillTriangle(
    ferruleEnd.x - width * 0.5,
    ferruleEnd.y - width * 0.5,
    ferruleEnd.x + width * 0.5,
    ferruleEnd.y + width * 0.5,
    middle.x,
    middle.y,
  );
}
