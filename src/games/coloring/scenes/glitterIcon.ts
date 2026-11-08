/**
 * Zástupný symbol třpytek (#103) ve stylu A3: tři plné čtyřcípé jiskry ✦
 * ve vybrané barvě, jedna velká a dvě menší vedle ní, bez textu. Kreslí
 * se do úchytu a do místa třpytek v panelu. Stejný tvar jiskry kreslí
 * i lesk během tahu (`drawSparkle`).
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { GLITTER_STYLE } from '../logic/theme';

/** Hloubka zářezů mezi cípy jako díl délky cípu. */
const NOTCH_SHARE = 0.3;

/** Jiskry symbolu: střed a délka cípu jako díly velikosti symbolu. */
const SPARKLES = [
  { x: -0.08, y: 0.06, reach: 0.34 },
  { x: 0.26, y: -0.24, reach: 0.15 },
  { x: 0.24, y: 0.3, reach: 0.1 },
] as const;

/** Body čtyřcípé jiskry s cípy nahoru, doprava, dolů a doleva. */
function sparklePoints(x: number, y: number, reach: number): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let corner = 0; corner < 8; corner += 1) {
    const angle = -Math.PI / 2 + (corner * Math.PI) / 4;
    const distance = corner % 2 === 0 ? reach : reach * NOTCH_SHARE;
    points.push(
      new Phaser.Math.Vector2(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance),
    );
  }
  return points;
}

/**
 * Plná čtyřcípá jiskra se středem `x`, `y` a cípy dlouhými `reach` aktuální
 * výplní, s `outlined` navíc s okrajem aktuálním stylem čáry.
 */
export function drawSparkle(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  reach: number,
  outlined = false,
): void {
  const points = sparklePoints(x, y, reach);
  graphics.fillPoints(points, true);
  if (outlined) {
    graphics.strokePoints(points, true);
  }
}

/** Třpytky se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejdou). */
export function drawGlitter(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  graphics.fillStyle(colorNumber(inkHex ?? GLITTER_STYLE.noColor), 1);
  for (const sparkle of SPARKLES) {
    drawSparkle(graphics, x + sparkle.x * size, y + sparkle.y * size, sparkle.reach * size);
  }
}
