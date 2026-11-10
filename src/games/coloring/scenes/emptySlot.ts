/**
 * Prázdné místo pro nehotovou položku panelu (#96 AC3): jen slabý obrys
 * bez výplně, aby nevypadalo jako tlačítko.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { EMPTY_SLOT_STYLE } from '../logic/theme';

/** Obrys místa `slot` s levým horním rohem v `left`, `top` souřadnic grafiky. */
export function drawEmptySlot(
  graphics: Phaser.GameObjects.Graphics,
  slot: LayoutRect,
  cssScale: number,
  left = 0,
  top = 0,
): void {
  const borderWidth = EMPTY_SLOT_STYLE.borderWidthCss / cssScale;
  const radius = Math.min(slot.width, slot.height) * EMPTY_SLOT_STYLE.cornerRadiusShare;
  const inset = borderWidth / 2;
  graphics.lineStyle(borderWidth, colorNumber(EMPTY_SLOT_STYLE.borderColor), 1);
  graphics.strokeRoundedRect(
    left + inset,
    top + inset,
    slot.width - borderWidth,
    slot.height - borderWidth,
    Math.max(0, radius - inset),
  );
}
