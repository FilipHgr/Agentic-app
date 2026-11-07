/**
 * Paleta 8 barev vedle omalovánky (#88 AC4) se zástupným vzhledem A3:
 * světle modrý čtverec s kolečkem barvy, označená barva má silný modrý
 * okraj. Ťuknutí (už při dotyku) ohlásí scéně index barvy; co je vybrané,
 * řídí logika palety (`palette.ts`).
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { PALETTE } from '../logic/palette';
import { COLOR_BUTTON_STYLE } from '../logic/theme';

interface ColorButton {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly rect: LayoutRect;
}

export class PaletteView {
  private buttons: ColorButton[] = [];
  /** CSS px na herní jednotku; okraje tlačítek se zadávají v CSS px. */
  private cssScale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onColorTapped: (index: number) => void,
  ) {}

  /** Postaví tlačítka barev na místa `rects` (v pořadí palety), např. po otočení. */
  place(rects: readonly LayoutRect[], marked: readonly boolean[], cssScale: number): void {
    this.destroy();
    this.cssScale = cssScale;
    this.buttons = rects.map((rect, index) => {
      const graphics = this.scene.add.graphics({ x: rect.left, y: rect.top });
      graphics.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, rect.width, rect.height),
        Phaser.Geom.Rectangle.Contains,
      );
      graphics.on('pointerdown', () => this.onColorTapped(index));
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
  const swatch = PALETTE[index];
  if (swatch !== undefined) {
    button.fillStyle(colorNumber(swatch.hex), 1);
    button.fillCircle(
      rect.width / 2,
      rect.height / 2,
      (Math.min(rect.width, rect.height) * style.swatchShare) / 2,
    );
  }
}
