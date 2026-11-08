/**
 * Úchyt panelu nástrojů (#96 AC2, AC5) se zástupným vzhledem A3: tlačítko
 * s modrým okrajem, uvnitř ikona vybraného nástroje v barvách autora
 * (Noto Emoji, #106), v pravém dolním rohu kolečko vybrané barvy velké
 * podle velikosti čáry (#91, #106; guma bílé čárkované, duha duhové)
 * a malá šipka, kam se panel po ťuknutí pohne. Kam se kreslí ikona,
 * kolečko a šipka, určují `handleFace` a `handleArrowShape`. Ťuknutí
 * pozná scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { handleArrowShape, handleFace } from '../logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import type { LayoutCircle } from '../logic/coloringLayout';
import { HANDLE_COLOR_DOT_STYLE, HANDLE_STYLE } from '../logic/theme';
import { handleColorDotFill } from '../logic/toolIcons';
import type { HandleColorDotFill } from '../logic/toolIcons';
import type { HandleView } from '../logic/toolPanel';
import { showToolIcon } from './toolIconTextures';

export class HandleButtonView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  /** Ikona nástroje nad grafikou úchytu, počátek v levém horním rohu úchytu. */
  private icon: Phaser.GameObjects.Image | null = null;
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
    this.icon = this.scene.add
      .image(layout.handle.left, layout.handle.top, '__DEFAULT')
      .setDepth(depth)
      .setVisible(false);
  }

  /**
   * Překreslí úchyt hned (#106 AC6): ikona nástroje a kolečko barvy
   * a velikosti z `view`, šipka podle stavu panelu.
   */
  show(view: HandleView, panelOpen: boolean): void {
    const graphics = this.graphics;
    const iconImage = this.icon;
    const rect = this.rect;
    if (graphics === null || iconImage === null || rect === null) {
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
    // `handleFace` počítá v herních jednotkách; grafika má počátek v levém horním rohu úchytu.
    const { icon, colorDot } = handleFace({ ...rect, left: 0, top: 0 }, view.size);
    showToolIcon(
      iconImage,
      view.tool,
      { ...icon, left: rect.left + icon.left, top: rect.top + icon.top },
      this.cssScale,
    );
    this.drawColorDot(graphics, colorDot, handleColorDotFill(view));
    this.drawArrow(graphics, rect, panelOpen);
  }

  destroy(): void {
    this.graphics?.destroy();
    this.icon?.destroy();
    this.graphics = null;
    this.icon = null;
  }

  /**
   * Kolečko barvy: šedá linka, bílý lem a uvnitř vybraná barva. Guma má
   * kolečko bílé s čárkovanou linkou, duhový štětec výseče v barvách duhy.
   */
  private drawColorDot(
    graphics: Phaser.GameObjects.Graphics,
    dot: LayoutCircle,
    fill: HandleColorDotFill,
  ): void {
    const style = HANDLE_COLOR_DOT_STYLE;
    const { centerX, centerY } = dot;
    const fillRadius = dot.diameter / 2;
    const rimRadius = fillRadius + style.rimCss / this.cssScale;
    const line = style.lineCss / this.cssScale;
    if (fill.kind === 'eraser') {
      graphics.fillStyle(colorNumber(style.eraserFill), 1);
      graphics.fillCircle(centerX, centerY, rimRadius + line);
      this.drawDashedRing(graphics, centerX, centerY, rimRadius + line / 2, line);
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
  private drawDashedRing(
    graphics: Phaser.GameObjects.Graphics,
    centerX: number,
    centerY: number,
    radius: number,
    width: number,
  ): void {
    const style = HANDLE_COLOR_DOT_STYLE;
    const dash = style.eraserDashCss / this.cssScale;
    const dashes = Math.max(4, Math.round((2 * Math.PI * radius) / (2 * dash)));
    const step = (2 * Math.PI) / dashes;
    graphics.lineStyle(width, colorNumber(style.lineColor), 1);
    for (let index = 0; index < dashes; index += 1) {
      const start = index * step;
      graphics.beginPath();
      graphics.arc(centerX, centerY, radius, start, start + step / 2, false);
      graphics.strokePath();
    }
  }

  /**
   * Šipka, kam se panel pohne: na šířku vpravo „›“ (vysunout) nebo vlevo
   * „‹“ (zasunout), na výšku dole „˄“ nebo „˅“.
   */
  private drawArrow(graphics: Phaser.GameObjects.Graphics, rect: LayoutRect, open: boolean): void {
    // Grafika má počátek v levém horním rohu úchytu.
    const arrow = handleArrowShape({ ...rect, left: 0, top: 0 }, this.slidesFrom, open);
    const { tipX, tipY, arm } = arrow;
    // Konce obou ramen: vrchol míří ke směru šipky, ramena od něj odstupují o `arm`.
    const back = { right: -arm, left: arm, up: arm, down: -arm }[arrow.points];
    const across = arrow.points === 'left' || arrow.points === 'right';
    const first = across ? { x: tipX + back, y: tipY - arm } : { x: tipX - arm, y: tipY + back };
    const second = across ? { x: tipX + back, y: tipY + arm } : { x: tipX + arm, y: tipY + back };
    graphics.lineStyle(arrow.lineWidth, colorNumber(HANDLE_STYLE.arrowColor), 1);
    graphics.lineBetween(first.x, first.y, tipX, tipY);
    graphics.lineBetween(tipX, tipY, second.x, second.y);
  }
}
