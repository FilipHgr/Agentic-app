/**
 * Barvy v panelu nástrojů (#88 AC4, #96 AC3) se zástupným vzhledem A3:
 * světle modrý čtverec s kolečkem barvy, označená barva má silný modrý
 * okraj. Místa bez barvy (12 míst, barev je zatím méně) jsou prázdná.
 * Dotyky sem nechodí: kam dotyk patří, rozhoduje scéna přes
 * `touchTargetAt`, co je vybrané, logika palety (`palette.ts`).
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { PALETTE } from '../logic/palette';
import { COLOR_BUTTON_STYLE } from '../logic/theme';
import { drawEmptySlot } from './emptySlot';

interface ColorButton {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly rect: LayoutRect;
}

export class PaletteView {
  private buttons: ColorButton[] = [];
  /** CSS px na herní jednotku; okraje tlačítek se zadávají v CSS px. */
  private cssScale = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Postaví tlačítka barev do panelu `parent` na místa `rects` (v pořadí palety). */
  place(
    rects: readonly LayoutRect[],
    marked: readonly boolean[],
    cssScale: number,
    parent: Phaser.GameObjects.Container,
  ): void {
    this.destroy();
    this.cssScale = cssScale;
    this.buttons = rects.map((rect) => {
      const graphics = this.scene.add.graphics({ x: rect.left, y: rect.top });
      parent.add(graphics);
      return { graphics, rect };
    });
    this.mark(marked);
  }

  /** Překreslí tlačítka tak, aby byla označená barva podle `marked`. */
  mark(marked: readonly boolean[]): void {
    this.buttons.forEach((button, index) => {
      button.graphics.clear();
      drawButton(button.graphics, button.rect, index, marked[index] === true, this.cssScale);
    });
  }

  destroy(): void {
    for (const button of this.buttons) {
      button.graphics.destroy();
    }
    this.buttons = [];
  }
}

/** Jedno tlačítko barvy v jeho vlastních souřadnicích (levý horní roh 0, 0). */
function drawButton(
  button: Phaser.GameObjects.Graphics,
  rect: LayoutRect,
  index: number,
  isMarked: boolean,
  cssScale: number,
): void {
  const swatch = PALETTE[index];
  if (swatch === undefined) {
    // Místo pro barvu z navazujícího úkolu: zatím jen slabý obrys.
    drawEmptySlot(button, rect, cssScale);
    return;
  }
  const style = COLOR_BUTTON_STYLE;
  const borderWidth = (isMarked ? style.selectedBorderWidthCss : style.borderWidthCss) / cssScale;
  const borderColor = isMarked ? style.selectedBorderColor : style.borderColor;
  const radius = Math.min(rect.width, rect.height) * style.cornerRadiusShare;
  const inset = borderWidth / 2;

  button.fillStyle(colorNumber(style.background), 1);
  button.fillRoundedRect(0, 0, rect.width, rect.height, radius);
  button.lineStyle(borderWidth, colorNumber(borderColor), 1);
  button.strokeRoundedRect(
    inset,
    inset,
    rect.width - borderWidth,
    rect.height - borderWidth,
    Math.max(0, radius - inset),
  );
  button.fillStyle(colorNumber(swatch.hex), 1);
  button.fillCircle(
    rect.width / 2,
    rect.height / 2,
    (Math.min(rect.width, rect.height) * style.swatchShare) / 2,
  );
}
