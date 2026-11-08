/**
 * Kolečko barvy nástroje (#106, #110): stejné v úchytu i u nástrojů
 * v panelu. Vybraná barva s bílým lemem a šedou linkou vně výplně, guma
 * bílé s čárkovanou linkou, duhový štětec výseče v barvách duhy. Vzhled
 * je v `HANDLE_COLOR_DOT_STYLE`, výplň určí `handleColorDotFill`.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutCircle } from '../logic/coloringLayout';
import { HANDLE_COLOR_DOT_STYLE } from '../logic/theme';
import type { HandleColorDotFill } from '../logic/toolIcons';

/**
 * Nakreslí kolečko `dot` (souřadnice v grafice `graphics`, `diameter` je
 * průměr výplně) s výplní `fill`; lem a linka jsou v CSS px.
 */
export function drawColorDot(
  graphics: Phaser.GameObjects.Graphics,
  dot: LayoutCircle,
  fill: HandleColorDotFill,
  cssScale: number,
): void {
  const style = HANDLE_COLOR_DOT_STYLE;
  const { centerX, centerY } = dot;
  const fillRadius = dot.diameter / 2;
  const rimRadius = fillRadius + style.rimCss / cssScale;
  const line = style.lineCss / cssScale;
  if (fill.kind === 'eraser') {
    graphics.fillStyle(colorNumber(style.eraserFill), 1);
    graphics.fillCircle(centerX, centerY, rimRadius + line);
    drawDashedRing(graphics, dot, rimRadius + line / 2, line, cssScale);
    return;
  }
  graphics.fillStyle(colorNumber(style.lineColor), 1);
  graphics.fillCircle(centerX, centerY, rimRadius + line);
  graphics.fillStyle(colorNumber(style.rimColor), 1);
  graphics.fillCircle(centerX, centerY, rimRadius);
  if (fill.kind === 'color') {
    graphics.fillStyle(colorNumber(fill.hex), 1);
    graphics.fillCircle(centerX, centerY, fillRadius);
    return;
  }
  // Duha: stejně velké výseče po směru hodinových ručiček od 12 hodin.
  const step = (2 * Math.PI) / fill.hexes.length;
  fill.hexes.forEach((hex, index) => {
    const start = -Math.PI / 2 + index * step;
    graphics.fillStyle(colorNumber(hex), 1);
    graphics.slice(centerX, centerY, fillRadius, start, start + step, false);
    graphics.fillPath();
  });
}

/** Čárkovaná šedá kružnice gumy: čárky dlouhé `eraserDashCss` se stejně dlouhými mezerami. */
function drawDashedRing(
  graphics: Phaser.GameObjects.Graphics,
  dot: LayoutCircle,
  radius: number,
  width: number,
  cssScale: number,
): void {
  const dash = HANDLE_COLOR_DOT_STYLE.eraserDashCss / cssScale;
  const dashes = Math.max(4, Math.round((2 * Math.PI * radius) / (2 * dash)));
  const step = (2 * Math.PI) / dashes;
  graphics.lineStyle(width, colorNumber(HANDLE_COLOR_DOT_STYLE.lineColor), 1);
  for (let index = 0; index < dashes; index += 1) {
    const start = index * step;
    graphics.beginPath();
    graphics.arc(dot.centerX, dot.centerY, radius, start, start + step / 2, false);
    graphics.strokePath();
  }
}
