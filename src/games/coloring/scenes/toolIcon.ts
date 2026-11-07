/**
 * Symbol nástroje (#90, #93) pro úchyt i panel: štětec, fix a pastelka
 * ve vybrané barvě, guma vždy bez barvy.
 */

import Phaser from 'phaser';

import type { ToolId } from '../logic/toolPanel';
import { drawBrush } from './brushIcon';
import { drawCrayon } from './crayonIcon';
import { drawEraser } from './eraserIcon';
import { drawMarker } from './markerIcon';

/** Nástroj `tool` se středem `x`, `y` velikosti `size`; `colorHex` gumu nemění. */
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
    case 'marker':
      drawMarker(graphics, x, y, size, colorHex);
      return;
    case 'crayon':
      drawCrayon(graphics, x, y, size, colorHex);
      return;
  }
}
