/**
 * Dvě tlačítka rychlého přepínání v pruhu ovládání (#148) místo nedávných
 * barev z #99, ve vzhledu tlačítek nástrojů v panelu. První tlačítko
 * ukazuje předchozí nástroj: jeho ikonu a vpravo dole kolečko jeho barvy
 * jako u nástroje v panelu a v úchytu (#110, #114), duha bez kolečka.
 * Bez předchozího nástroje je první tlačítko prázdné místo (slabý obrys).
 * Druhé tlačítko je vždy guma; vybraná guma má silný modrý okraj jako
 * vybraný nástroj v panelu. Ťuknutí pozná scéna přes `touchTargetAt`, co
 * se vybere, řídí logika (`savedPicture.ts`, `quickTools.ts`).
 */

import Phaser from 'phaser';

import { toolSlotColorDot, toolSlotIcon } from '../logic/coloringLayout';
import type { LayoutRect } from '../logic/coloringLayout';
import type { PreviousToolView, QuickToolButton } from '../logic/quickTools';
import { colorHex } from '../logic/toolColorSets';
import { drawColorDot } from './colorDot';
import { drawEmptySlot } from './emptySlot';
import { showToolIcon } from './toolIconTextures';
import { drawToolButton } from './ToolPanelView';

/** Zhoupnutí jako u Zpět a dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

/** Krátké stisknutí po přepnutí: tlačítko se zmenší a vrátí. */
const PRESS = { scale: 0.9, durationMs: 70 };

/** Co tlačítka ukazují. */
export interface QuickToolsLook {
  /** Předchozí nástroj na prvním tlačítku, `null` u prázdného místa. */
  readonly previous: PreviousToolView | null;
  /** Je vybraná guma (druhé tlačítko označené)? */
  readonly eraserSelected: boolean;
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
    places: { readonly previousTool: LayoutRect; readonly eraser: LayoutRect },
    cssScale: number,
    depth: number,
  ): void {
    this.destroy();
    this.cssScale = cssScale;
    this.buttons = {
      previousTool: this.build(places.previousTool, depth),
      eraser: this.build(places.eraser, depth),
    };
  }

  /** Překreslí obě tlačítka podle předchozího nástroje a vybrané gumy. */
  show(look: QuickToolsLook): void {
    const previous = this.buttons.previousTool;
    if (previous !== undefined) {
      this.showPrevious(previous, look.previous);
    }
    const eraser = this.buttons.eraser;
    if (eraser !== undefined) {
      this.showEraser(eraser, look.eraserSelected);
    }
  }

  /** Prázdné místo nebo už vybraná guma: tlačítko se jen zhoupne (#148 AC3). */
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

  private showPrevious(parts: QuickButtonParts, previous: PreviousToolView | null): void {
    parts.background.clear();
    parts.dot.clear();
    const local = this.centered(parts.rect);
    if (previous === null) {
      parts.icon.setVisible(false);
      drawEmptySlot(parts.background, parts.rect, this.cssScale, local.left, local.top);
      return;
    }
    drawToolButton(parts.background, parts.rect, this.cssScale, false);
    showToolIcon(parts.icon, previous.tool, toolSlotIcon(local), this.cssScale);
    // Duha je bez kolečka (#148 AC1); malovací nástroj má kolečko své barvy.
    const hex = previous.color === null ? undefined : colorHex(previous.color);
    if (hex !== undefined) {
      drawColorDot(parts.dot, toolSlotColorDot(local), { kind: 'color', hex }, this.cssScale);
    }
  }

  private showEraser(parts: QuickButtonParts, selected: boolean): void {
    parts.background.clear();
    parts.dot.clear();
    drawToolButton(parts.background, parts.rect, this.cssScale, selected);
    showToolIcon(parts.icon, 'eraser', toolSlotIcon(this.centered(parts.rect)), this.cssScale);
  }
}
