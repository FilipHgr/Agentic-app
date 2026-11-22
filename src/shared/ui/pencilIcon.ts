import Phaser from 'phaser';

import { PENCIL_ICON } from '../logic/pencilIcon';
import { colorNumber } from '../logic/theme';

/**
 * Tužka ve volbě psaní v nastavení pro rodiče (#41, od #188 sdílená):
 * šikmo hrotem vlevo dole, kreslená čarou, aby nezávisela na písmu.
 * Zvětší se na velikost `size` (strana čtverce, ve kterém tužka leží).
 */
export function drawPencilIcon(
  scene: Phaser.Scene,
  colorHex: string,
  size: number,
): Phaser.GameObjects.Graphics {
  const color = colorNumber(colorHex);
  const zoom = size / PENCIL_ICON.width;
  const tip = { x: PENCIL_ICON.tip.x * zoom, y: PENCIL_ICON.tip.y * zoom };
  const tail = { x: PENCIL_ICON.tail.x * zoom, y: PENCIL_ICON.tail.y * zoom };
  const strokeWidth = PENCIL_ICON.strokeWidth * zoom;
  const length = Math.hypot(tail.x - tip.x, tail.y - tip.y);
  const along = { x: (tail.x - tip.x) / length, y: (tail.y - tip.y) / length };
  const across = { x: -along.y, y: along.x };
  const half = strokeWidth * 1.1;
  const tipLength = strokeWidth * 2;
  const at = (distance: number, side: number) => ({
    x: tip.x + along.x * distance + across.x * side,
    y: tip.y + along.y * distance + across.y * side,
  });

  const pencil = scene.add.graphics();
  pencil.lineStyle(strokeWidth, color, 1);
  // Tělo tužky: obdélník od hrotu k zadnímu konci, hrot je plný trojúhelník.
  const bodyLeft = at(tipLength, half);
  const bodyRight = at(tipLength, -half);
  const endRight = at(length, -half);
  const endLeft = at(length, half);
  pencil.strokePoints(
    [bodyLeft, endLeft, endRight, bodyRight].map(
      (point) => new Phaser.Math.Vector2(point.x, point.y),
    ),
    true,
  );
  pencil.fillStyle(color, 1);
  pencil.fillTriangle(bodyLeft.x, bodyLeft.y, bodyRight.x, bodyRight.y, tip.x, tip.y);
  return pencil;
}
