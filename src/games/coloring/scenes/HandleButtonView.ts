/**
 * Úchyt panelu nástrojů (#96 AC2, AC5) se zástupným vzhledem A3: tlačítko
 * s modrým okrajem, uvnitř vybraný nástroj ve vybrané barvě (guma bez
 * barvy, #90) a malá šipka,
 * kam se panel po ťuknutí pohne. Ťuknutí pozná scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import { HANDLE_STYLE } from '../logic/theme';
import type { ToolId } from '../logic/toolPanel';
import { drawToolIcon } from './toolIcon';

export class HandleButtonView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private rect: LayoutRect | null = null;
  private slidesFrom: ColoringLayout['panelSlidesFrom'] = 'left';
  private cssScale = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Postaví úchyt na místo z rozložení v hloubce `depth`, např. po otočení. */
  place(layout: ColoringLayout, cssScale: number, depth: number): void {
    this.destroy();
    this.rect = layout.handle;
    this.slidesFrom = layout.panelSlidesFrom;
    this.cssScale = cssScale;
    this.graphics = this.scene.add
      .graphics({ x: layout.handle.left, y: layout.handle.top })
      .setDepth(depth);
  }

  /** Překreslí úchyt: nástroj `tool` v barvě `colorHex` a šipka podle stavu panelu. */
  show(tool: ToolId, colorHex: string | null, panelOpen: boolean): void {
    const graphics = this.graphics;
    const rect = this.rect;
    if (graphics === null || rect === null) {
      return;
    }
    graphics.clear();
    const style = HANDLE_STYLE;
    const side = Math.min(rect.width, rect.height);
    const borderWidth = style.borderWidthCss / this.cssScale;
    const radius = side * style.cornerRadiusShare;
    const inset = borderWidth / 2;
    graphics.fillStyle(colorNumber(style.background), 1);
    graphics.fillRoundedRect(0, 0, rect.width, rect.height, radius);
    graphics.lineStyle(borderWidth, colorNumber(style.borderColor), 1);
    graphics.strokeRoundedRect(
      inset,
      inset,
      rect.width - borderWidth,
      rect.height - borderWidth,
      Math.max(0, radius - inset),
    );
    drawToolIcon(graphics, tool, rect.width * 0.46, rect.height * 0.44, side * 0.6, colorHex);
    this.drawArrow(graphics, rect, panelOpen);
  }

  destroy(): void {
    this.graphics?.destroy();
    this.graphics = null;
  }

  /**
   * Šipka, kam se panel pohne: na šířku vpravo „›“ (vysunout) nebo vlevo
   * „‹“ (zasunout), na výšku dole „˄“ nebo „˅“.
   */
  private drawArrow(graphics: Phaser.GameObjects.Graphics, rect: LayoutRect, open: boolean): void {
    const side = Math.min(rect.width, rect.height);
    // Šipka je vysoká asi pětinu strany úchytu (2 × `size`).
    const size = side * 0.11;
    graphics.lineStyle(side * 0.055, colorNumber(HANDLE_STYLE.arrowColor), 1);
    if (this.slidesFrom === 'left') {
      const x = open ? rect.width * 0.12 : rect.width * 0.88;
      const y = rect.height / 2;
      const direction = open ? 1 : -1;
      graphics.lineBetween(x + direction * size, y - size, x, y);
      graphics.lineBetween(x, y, x + direction * size, y + size);
      return;
    }
    const x = rect.width / 2;
    const y = rect.height * 0.87;
    const direction = open ? -1 : 1;
    graphics.lineBetween(x - size, y + direction * size, x, y);
    graphics.lineBetween(x, y, x + size, y + direction * size);
  }
}
