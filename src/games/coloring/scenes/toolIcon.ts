/**
 * Symbol nástroje (#90) pro úchyt i panel: štětec ve vybrané barvě,
 * guma vždy bez barvy.
 */

import Phaser from 'phaser';

import type { ToolId } from '../logic/toolPanel';
import { drawBrush } from './brushIcon';
import { drawEraser } from './eraserIcon';

/** Nástroj `tool` se středem `x`, `y` velikosti `size`; `colorHex` platí jen pro štětec. */
export function drawToolIcon(
  graphics: Phaser.GameObjects.Graphics,
  tool: ToolId,
  x: number,
  y: number,
  size: number,
  colorHex: string | null,
): void {
  switch (tool) {
    case 'brush':
      drawBrush(graphics, x, y, size, colorHex);
      return;
    case 'eraser':
      drawEraser(graphics, x, y, size);
      return;
  }
}
