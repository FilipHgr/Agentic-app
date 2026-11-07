/**
 * Zástupný symbol gumy (#90) ve stylu A3: šikmý kvádr s modrým obalem
 * a šedou pryží, pod ním krátká stopa. Guma nemá barvu, kreslí se vždy
 * stejně do úchytu i do místa gumy v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { ERASER_STYLE } from '../logic/theme';

/** Guma je skloněná o tento úhel (pryž vlevo dole). */
const TILT_RADIANS = -Math.PI / 4;

/** Guma se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawEraser(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const length = size * 0.82;
  const thickness = size * 0.36;
  // Bod gumy: `along` od levého dolního konce (0) k pravému hornímu (1), `across` napříč (−0,5 až 0,5).
  const pointOf = (along: number, across: number): Phaser.Math.Vector2 => {
    const localX = (along - 0.5) * length;
    const localY = across * thickness;
    return new Phaser.Math.Vector2(
      x + localX * Math.cos(TILT_RADIANS) - localY * Math.sin(TILT_RADIANS),
      y + localX * Math.sin(TILT_RADIANS) + localY * Math.cos(TILT_RADIANS),
    );
  };
  const band = (from: number, to: number): Phaser.Math.Vector2[] => [
    pointOf(from, -0.5),
    pointOf(to, -0.5),
    pointOf(to, 0.5),
    pointOf(from, 0.5),
  ];

  const trailStart = pointOf(0, 0.5);
  graphics.lineStyle(size * 0.05, colorNumber(ERASER_STYLE.trailColor), 1);
  graphics.lineBetween(
    trailStart.x - size * 0.12,
    trailStart.y + size * 0.06,
    trailStart.x + size * 0.34,
    trailStart.y + size * 0.06,
  );

  graphics.fillStyle(colorNumber(ERASER_STYLE.rubberColor), 1);
  graphics.fillPoints(band(0, 0.42), true);
  graphics.fillStyle(colorNumber(ERASER_STYLE.sleeveColor), 1);
  graphics.fillPoints(band(0.42, 1), true);
}
