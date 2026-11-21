/**
 * Dvě tlačítka rychlého přepínání v pruhu ovládání (#148, #163) místo
 * nedávných barev z #99, ve vzhledu tlačítek nástrojů v panelu. První
 * tlačítko ukazuje kreslicí nástroj: jeho ikonu a vpravo dole kolečko jeho
 * barvy velké podle velikosti čáry (#164 AC4, dřív v úchytu), duha
 * s duhovým kolečkem. Druhé tlačítko je vždy guma. Vybrané z obou tlačítek
 * má silný modrý okraj jako vybraný nástroj v panelu (#163 AC3). Ťuknutí
 * pozná scéna přes `touchTargetAt`, co se vybere, řídí logika
 * (`savedPicture.ts`, `quickTools.ts`).
 */

import Phaser from 'phaser';

import { quickToolColorDot, quickToolIcon } from '../logic/coloringLayout';
import type { LayoutRect } from '../logic/coloringLayout';
import { quickToolColorDotFill } from '../logic/quickTools';
import type { QuickDrawingToolView, QuickToolButton } from '../logic/quickTools';
import type { LineSize } from '../logic/toolPanel';
import { drawColorDot } from './colorDot';
import { showToolIcon } from './toolIconTextures';
import { drawToolButton } from './ToolPanelView';

/** Zhoupnutí jako u Zpět a dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

/** Krátké stisknutí po přepnutí: tlačítko se zmenší a vrátí. */
const PRESS = { scale: 0.9, durationMs: 70 };

/** Co tlačítka ukazují. */
export interface QuickToolsLook {
  /** Kreslicí nástroj na prvním tlačítku. */
  readonly drawingTool: QuickDrawingToolView;
  /** Je vybraná guma (označené druhé tlačítko), nebo kreslicí nástroj (první)? */
  readonly eraserSelected: boolean;
  /** Vybraná velikost čáry: podle ní je velké kolečko barvy na prvním tlačítku. */
  readonly lineSize: LineSize;
}

interface QuickButtonParts {
  /** Střed tlačítka je počátek, aby se zhoupnutí točilo kolem středu. */
  readonly container: Phaser.GameObjects.Container;
  readonly background: Phaser.GameObjects.Graphics;
  readonly icon: Phaser.GameObjects.Image;
  readonly dot: Phaser.GameObjects.Graphics;
  readonly rect: LayoutRect;
}

export class QuickToolsView {
  private buttons: Partial<Record<QuickToolButton, QuickButtonParts>> = {};
  /** CSS px na herní jednotku; okraje se zadávají v CSS px. */
  private cssScale = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Postaví obě tlačítka na místa z rozložení v hloubce `depth`, např. po otočení. */
  place(
    places: { readonly drawingTool: LayoutRect; readonly eraser: LayoutRect },
    cssScale: number,
    depth: number,
  ): void {
    this.destroy();
    this.cssScale = cssScale;
    this.buttons = {
      drawingTool: this.build(places.drawingTool, depth),
      eraser: this.build(places.eraser, depth),
    };
  }

  /** Překreslí obě tlačítka podle kreslicího nástroje a vybrané gumy. */
  show(look: QuickToolsLook): void {
    const drawing = this.buttons.drawingTool;
    if (drawing !== undefined) {
      this.showDrawingTool(drawing, look, !look.eraserSelected);
    }
    const eraser = this.buttons.eraser;
    if (eraser !== undefined) {
      this.showEraser(eraser, look.eraserSelected);
    }
  }

  /** Už vybrané tlačítko se jen zhoupne (#163 AC3). */
  wobble(button: QuickToolButton): void {
    const container = this.buttons[button]?.container;
    if (container === undefined) {
      return;
    }
    this.resetMotion(container);
    this.scene.tweens.chain({
      targets: container,
      tweens: [
        { angle: WOBBLE.angle, duration: WOBBLE.durationMs, ease: 'Sine.easeOut' },
        { angle: -WOBBLE.angle, duration: 2 * WOBBLE.durationMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: WOBBLE.durationMs, ease: 'Sine.easeIn' },
      ],
    });
  }

  /** Přepnutí nástroje: tlačítko se krátce stiskne (okamžitá odezva vedle tónu). */
  press(button: QuickToolButton): void {
    const container = this.buttons[button]?.container;
    if (container === undefined) {
      return;
    }
    this.resetMotion(container);
    this.scene.tweens.add({
      targets: container,
      scale: PRESS.scale,
      duration: PRESS.durationMs,
      ease: 'Sine.easeOut',
      yoyo: true,
    });
  }

  destroy(): void {
    for (const parts of Object.values(this.buttons)) {
      this.scene.tweens.killTweensOf(parts.container);
      parts.container.destroy();
    }
    this.buttons = {};
  }

  private build(rect: LayoutRect, depth: number): QuickButtonParts {
    const container = this.scene.add
      .container(rect.left + rect.width / 2, rect.top + rect.height / 2)
      .setDepth(depth);
    const background = this.scene.add.graphics();
    const icon = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    const dot = this.scene.add.graphics();
    container.add([background, icon, dot]);
    return { container, background, icon, dot, rect };
  }

  private resetMotion(container: Phaser.GameObjects.Container): void {
    this.scene.tweens.killTweensOf(container);
    container.setAngle(0).setScale(1);
  }

  /** Místo tlačítka v souřadnicích kontejneru (počátek ve středu). */
  private centered(rect: LayoutRect): LayoutRect {
    return { ...rect, left: -rect.width / 2, top: -rect.height / 2 };
  }

  private showDrawingTool(parts: QuickButtonParts, look: QuickToolsLook, selected: boolean): void {
    parts.background.clear();
    parts.dot.clear();
    const local = this.centered(parts.rect);
    drawToolButton(parts.background, parts.rect, this.cssScale, selected);
    showToolIcon(parts.icon, look.drawingTool.tool, quickToolIcon(local), this.cssScale);
    drawColorDot(
      parts.dot,
      quickToolColorDot(local, look.lineSize),
      quickToolColorDotFill(look.drawingTool, look.lineSize),
      this.cssScale,
    );
  }

  private showEraser(parts: QuickButtonParts, selected: boolean): void {
    parts.background.clear();
    parts.dot.clear();
    drawToolButton(parts.background, parts.rect, this.cssScale, selected);
    showToolIcon(parts.icon, 'eraser', quickToolIcon(this.centered(parts.rect)), this.cssScale);
  }
}
