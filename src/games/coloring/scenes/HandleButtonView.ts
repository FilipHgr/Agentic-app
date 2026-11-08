/**
 * Úchyt panelu nástrojů (#96 AC2, AC5) se zástupným vzhledem A3: tlačítko
 * s modrým okrajem, uvnitř ikona vybraného nástroje ve vybrané barvě
 * (guma bez barvy, duha v barvách duhy, #90, #97, ikony #106), v pravém dolním rohu
 * tmavá tečka vybrané velikosti čáry (#91) a malá šipka, kam se panel po
 * ťuknutí pohne. Kam se kreslí ikona, tečka a šipka, určují `handleFace`
 * a `handleArrowShape`. Ťuknutí pozná scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { handleArrowShape, handleFace } from '../logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import { HANDLE_STYLE, SIZE_DOT_STYLE } from '../logic/theme';
import { handleIconShapes } from '../logic/toolIcons';
import type { HandleView } from '../logic/toolPanel';
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

  /**
   * Překreslí úchyt hned (#106 AC6): ikona nástroje ve vybrané barvě
   * a velikost z `view`, šipka podle stavu panelu.
   */
  show(view: HandleView, panelOpen: boolean): void {
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
    // `handleFace` počítá v herních jednotkách; grafika má počátek v levém horním rohu úchytu.
    const { icon, sizeDot } = handleFace({ ...rect, left: 0, top: 0 }, view.size);
    const iconSideCss = Math.min(icon.width, icon.height) * this.cssScale;
    drawToolIcon(graphics, handleIconShapes(view, iconSideCss), {
      left: icon.left,
      top: icon.top,
      cssScale: this.cssScale,
    });
    graphics.fillStyle(colorNumber(SIZE_DOT_STYLE.color), 1);
    graphics.fillCircle(sizeDot.centerX, sizeDot.centerY, sizeDot.diameter / 2);
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
