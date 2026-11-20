/**
 * Úchyt panelu nástrojů (#96 AC2, AC5) se zástupným vzhledem A3: tlačítko
 * s běžným okrajem nevybraného tlačítka (#164 AC2), uvnitř stálý symbol
 * panelu, paleta 🎨 z Noto Emoji s tmavým obrysem (#164 AC1, AC5), a malá
 * šipka, kam se panel po ťuknutí pohne. Vybraný nástroj a jeho barvu
 * ukazuje první tlačítko rychlého přepínání, ne úchyt. Kam se kreslí symbol a šipka, určují
 * `handleSymbol` a `handleArrowShape`. Ťuknutí pozná scéna přes `touchTargetAt`.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import { handleArrowShape, handleSymbol } from '../logic/coloringLayout';
import type { ColoringLayout, LayoutRect } from '../logic/coloringLayout';
import { HANDLE_STYLE } from '../logic/theme';
import { HANDLE_ICON_FILE } from '../logic/toolIcons';
import { iconWithOutlineTexture } from './toolIconTextures';

export class HandleButtonView {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  /** Symbol panelu nad grafikou úchytu, počátek v levém horním rohu úchytu. */
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

  /** Překreslí úchyt: podklad a okraj jsou stálé, šipka a místo symbolu podle stavu panelu. */
  show(panelOpen: boolean): void {
    const graphics = this.graphics;
    const symbolImage = this.icon;
    const rect = this.rect;
    if (graphics === null || symbolImage === null || rect === null) {
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
    this.showSymbol(symbolImage, rect, panelOpen);
    this.drawArrow(graphics, rect, panelOpen);
  }

  destroy(): void {
    this.graphics?.destroy();
    this.icon?.destroy();
    this.graphics = null;
    this.icon = null;
  }

  /**
   * Paleta přes čtverec z `handleSymbol` s tmavým obrysem vně tvaru
   * (#164 AC5), se šipkou dohromady uprostřed úchytu (#165); bez načteného
   * SVG se schová a úchyt funguje dál.
   */
  private showSymbol(image: Phaser.GameObjects.Image, rect: LayoutRect, panelOpen: boolean): void {
    const style = HANDLE_STYLE;
    const outline = style.symbolOutlineCss / this.cssScale;
    const symbol = handleSymbol(rect, this.slidesFrom, panelOpen, outline);
    const key = iconWithOutlineTexture(
      this.scene,
      HANDLE_ICON_FILE,
      symbol.width * this.cssScale,
      style.symbolOutlineCss,
      style.symbolOutlineColor,
    );
    if (key === null) {
      image.setVisible(false);
      return;
    }
    // Textura je o obrys větší na každé straně, ikona v ní zůstane na místě `symbol`.
    image
      .setTexture(key)
      .setOrigin(0, 0)
      .setPosition(symbol.left - outline, symbol.top - outline)
      .setDisplaySize(symbol.width + 2 * outline, symbol.width + 2 * outline)
      .setVisible(true);
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
