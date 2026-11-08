/**
 * Kreslení ikony nástroje (#106) do úchytu, místa v panelu i hlavičky
 * kroku barev. Tvary ikony dává logika (`toolIconShapes`) v CSS px,
 * tady se jen přepočtou na herní jednotky a nakreslí: tvar s obrysem se
 * nejdřív obtáhne tmavou čarou 2 × `outline` a pak vyplní.
 */

import type Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { TOOL_ICON_STYLE } from '../logic/theme';
import { starPoints } from '../logic/toolIcons';
import type { IconPoint, IconShape } from '../logic/toolIcons';

/** Kde ikona leží: levý horní roh jejího čtverce v herních jednotkách a CSS px na jednotku. */
export interface IconPlacement {
  readonly left: number;
  readonly top: number;
  readonly cssScale: number;
}

/** Nakreslí tvary ikony v pořadí, pozdější přes dřívější. */
export function drawToolIcon(
  graphics: Phaser.GameObjects.Graphics,
  shapes: readonly IconShape[],
  placement: IconPlacement,
): void {
  const toUnits = (p: IconPoint): IconPoint => ({
    x: placement.left + p.x / placement.cssScale,
    y: placement.top + p.y / placement.cssScale,
  });
  for (const shape of shapes) {
    drawShape(graphics, shape, toUnits, placement.cssScale);
  }
}

function drawShape(
  graphics: Phaser.GameObjects.Graphics,
  shape: IconShape,
  toUnits: (p: IconPoint) => IconPoint,
  cssScale: number,
): void {
  const outline = (shape.outline ?? 0) / cssScale;
  switch (shape.kind) {
    case 'circle': {
      const center = toUnits(shape);
      const radius = shape.radius / cssScale;
      if (outline > 0) {
        fillWith(graphics, TOOL_ICON_STYLE.outlineColor);
        graphics.fillCircle(center.x, center.y, radius + outline);
      }
      fillWith(graphics, shape.color);
      graphics.fillCircle(center.x, center.y, radius);
      return;
    }
    case 'polygon':
      drawPolygon(graphics, shape.points.map(toUnits), shape.color, outline);
      return;
    case 'star':
      drawPolygon(graphics, starPoints(shape).map(toUnits), shape.color, outline);
      return;
    case 'line':
      drawRoundLine(graphics, shape.points.map(toUnits), shape.width / cssScale, shape.color);
      return;
  }
}

/** Mnohoúhelník: obrys jako čára 2 × `outline` se zaoblenými rohy, pak výplň. */
function drawPolygon(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly IconPoint[],
  color: string,
  outline: number,
): void {
  if (outline > 0) {
    graphics.lineStyle(2 * outline, colorNumber(TOOL_ICON_STYLE.outlineColor), 1);
    graphics.strokePoints([...points], true);
    // Čára v Phaseru nemá zaoblené spoje, rohy obrysu doplní kolečka.
    fillWith(graphics, TOOL_ICON_STYLE.outlineColor);
    for (const corner of points) {
      graphics.fillCircle(corner.x, corner.y, outline);
    }
  }
  fillWith(graphics, color);
  graphics.fillPoints([...points], true);
}

/** Lomená čára se zaoblenými konci a spoji (odlesk). */
function drawRoundLine(
  graphics: Phaser.GameObjects.Graphics,
  points: readonly IconPoint[],
  width: number,
  color: string,
): void {
  graphics.lineStyle(width, colorNumber(color), 1);
  if (points.length > 1) {
    graphics.strokePoints([...points], false);
  }
  fillWith(graphics, color);
  for (const joint of points) {
    graphics.fillCircle(joint.x, joint.y, width / 2);
  }
}

function fillWith(graphics: Phaser.GameObjects.Graphics, color: string): void {
  graphics.fillStyle(colorNumber(color), 1);
}
