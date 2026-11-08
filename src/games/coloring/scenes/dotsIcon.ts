/**
 * Zástupný symbol puntíkového fixu (#101) ve stylu A3: kulatá stopa
 * z pravidelné mřížky plných puntíků ve vybrané barvě, bez textu. Mřížka
 * 4 × 4 bez rohů vypadá jako ťuknutí puntíkovým fixem. Kreslí se do
 * úchytu a do místa puntíkového fixu v panelu.
 */

import type Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { DOTS_STYLE } from '../logic/theme';

/** Počet puntíků v řadě i ve sloupci mřížky symbolu. */
const GRID_COUNT = 4;

/** Rozestup středů puntíků jako díl velikosti symbolu. */
const SPACING_SHARE = 0.21;

/** Poloměr puntíku jako díl velikosti symbolu. */
const DOT_RADIUS_SHARE = 0.07;

/** Puntíky dál od středu symbolu, než je tento díl velikosti, se vynechají (rohy). */
const STROKE_RADIUS_SHARE = 0.42;

/** Puntíkový fix se středem `x`, `y` velikosti `size` (strana čtverce, do kterého se vejde). */
export function drawDots(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  inkHex: string | null,
): void {
  graphics.fillStyle(colorNumber(inkHex ?? DOTS_STYLE.noColor), 1);
  const firstOffset = (-(GRID_COUNT - 1) / 2) * SPACING_SHARE;
  for (let row = 0; row < GRID_COUNT; row += 1) {
    for (let column = 0; column < GRID_COUNT; column += 1) {
      const dx = firstOffset + column * SPACING_SHARE;
      const dy = firstOffset + row * SPACING_SHARE;
      if (Math.hypot(dx, dy) > STROKE_RADIUS_SHARE) {
        continue;
      }
      graphics.fillCircle(x + dx * size, y + dy * size, DOT_RADIUS_SHARE * size);
    }
  }
}
