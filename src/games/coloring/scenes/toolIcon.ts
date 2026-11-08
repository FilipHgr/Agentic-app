/**
 * Symbol nástroje (#90, #93, #97, #98, #101, #102) pro úchyt i panel: štětec, fix,
 * pastelka, razítkový, puntíkový a proužkový fix ve vybrané barvě, guma vždy bez barvy a duha vždy v barvách duhy.
 */

import Phaser from 'phaser';

import type { ToolId } from '../logic/toolPanel';
import { drawBrush } from './brushIcon';
import { drawCrayon } from './crayonIcon';
import { drawDots } from './dotsIcon';
import { drawEraser } from './eraserIcon';
import { drawMarker } from './markerIcon';
import { drawRainbow } from './rainbowIcon';
import { drawStamp } from './stampIcon';
import { drawStripes } from './stripesIcon';

/** Nástroj `tool` se středem `x`, `y` velikosti `size`; `colorHex` gumu ani duhu nemění. */
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
    case 'rainbow':
      drawRainbow(graphics, x, y, size);
      return;
    case 'stamp':
      drawStamp(graphics, x, y, size, colorHex);
      return;
    case 'dots':
      drawDots(graphics, x, y, size, colorHex);
      return;
    case 'stripes':
      drawStripes(graphics, x, y, size, colorHex);
      return;
  }
}
