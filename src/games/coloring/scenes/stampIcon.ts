/**
 * Zástupný symbol razítkového fixu (#98) ve stylu A3: velká plná
 * pěticípá hvězdička a pod ní dvě menší jako stopa tahu (stranou od šipky úchytu), všechny ve
 * vybrané barvě, bez textu. Kreslí se do úchytu a do místa razítkového
 * fixu v panelu.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { STAMP_STYLE } from '../logic/theme';

/** Vnitřní poloměr hvězdičky jako díl vnějšího, stejně baculatá jako stopa. */
const INNER_SHARE = 0.45;

/** Hvězdičky symbolu: střed a poloměr jako díly velikosti symbolu. */
const STARS = [
  { x: 0.1, y: -0.1, radius: 0.34 },
  { x: -0.18, y: 0.3, radius: 0.14 },
  { x: 0.1, y: 0.4, radius: 0.09 },
] as const;

/** Body plné pěticípé hvězdičky se špičkou nahoru. */
function starPoints(x: number, y: number, radius: number): Phaser.Math.Vector2[] {
  const points: Phaser.Math.Vector2[] = [];
  for (let corner = 0; corner < 10; corner += 1) {
    const angle = -Math.PI / 2 + (corner * Math.PI) / 5;
    const distance = corner % 2 === 0 ? radius : radius * INNER_SHARE;
    points.push(
      new Phaser.Math.Vector2(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance),
    );
  }
  return points;
}

/** Razítkový fix se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawStamp(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  graphics.fillStyle(colorNumber(inkHex ?? STAMP_STYLE.noColor), 1);
  for (const star of STARS) {
    graphics.fillPoints(starPoints(x + star.x * size, y + star.y * size, star.radius * size), true);
  }
}
