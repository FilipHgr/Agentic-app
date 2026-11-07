/**
 * Dvě nedávné barvy v pruhu ovládání vedle úchytu (#99) se zástupným
 * vzhledem A3: obsazené místo je tlačítko barvy jako v panelu (světle
 * modrý čtverec s kolečkem barvy), prázdné místo jen slabý obrys jako
 * prázdná místa v panelu. Ťuknutí pozná scéna přes `touchTargetAt`; co se
 * vybere, řídí logika (`savedPicture.ts`). Prázdné místo scéna jen zhoupne.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { PALETTE } from '../logic/palette';
import type { RecentColors } from '../logic/recentColors';
import { COLOR_BUTTON_STYLE } from '../logic/theme';
import { drawEmptySlot } from './emptySlot';

/** Zhoupnutí jako u Zpět a dlaždic v menu: na jednu stranu, na druhou a zpět. */
const WOBBLE = { angle: 8, durationMs: 90 };

interface RecentPlace {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly rect: LayoutRect;
}

export class RecentColorsView {
  private places: RecentPlace[] = [];
  /** CSS px na herní jednotku; okraje se zadávají v CSS px. */
  private cssScale = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Postaví místa na `rects` z rozložení v hloubce `depth`, např. po otočení. */
  place(rects: readonly LayoutRect[], cssScale: number, depth: number): void {
    this.destroy();
    this.cssScale = cssScale;
    this.places = rects.map((rect) => {
      // Střed místa je počátek, aby se zhoupnutí točilo kolem středu.
      const graphics = this.scene.add
        .graphics({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        .setDepth(depth);
      return { graphics, rect };
    });
  }

  /** Překreslí místa podle nedávných barev (`null` je prázdné místo). */
  show(recent: RecentColors): void {
    this.places.forEach((place, index) => {
      place.graphics.clear();
      const hex = colorHexAt(recent, index);
      if (hex === null) {
        drawEmptySlot(
          place.graphics,
          place.rect,
          this.cssScale,
          -place.rect.width / 2,
          -place.rect.height / 2,
        );
      } else {
        drawColorButton(place.graphics, place.rect, hex, this.cssScale);
      }
    });
  }

  /** Ťuknutí na prázdné místo: místo se jen zhoupne (#99 AC3). */
  wobble(index: number): void {
    const graphics = this.places[index]?.graphics;
    if (graphics === undefined) {
      return;
    }
    this.scene.tweens.killTweensOf(graphics);
    graphics.setAngle(0);
    this.scene.tweens.chain({
      targets: graphics,
      tweens: [
        { angle: WOBBLE.angle, duration: WOBBLE.durationMs, ease: 'Sine.easeOut' },
        { angle: -WOBBLE.angle, duration: 2 * WOBBLE.durationMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: WOBBLE.durationMs, ease: 'Sine.easeIn' },
      ],
    });
  }

  destroy(): void {
    for (const place of this.places) {
      this.scene.tweens.killTweensOf(place.graphics);
      place.graphics.destroy();
    }
    this.places = [];
  }
}

/** Odstín nedávné barvy na místě `index`, nebo `null` u prázdného místa. */
function colorHexAt(recent: RecentColors, index: number): string | null {
  const color = recent[index] ?? null;
  return color === null ? null : (PALETTE[color]?.hex ?? null);
}

/** Tlačítko barvy se středem v počátku: podklad s okrajem a kolečko barvy. */
function drawColorButton(
  button: Phaser.GameObjects.Graphics,
  rect: LayoutRect,
  hex: string,
  cssScale: number,
): void {
  const style = COLOR_BUTTON_STYLE;
  const side = Math.min(rect.width, rect.height);
  const borderWidth = style.borderWidthCss / cssScale;
  const radius = side * style.cornerRadiusShare;
  const left = -rect.width / 2;
  const top = -rect.height / 2;
  const inset = borderWidth / 2;

  button.fillStyle(colorNumber(style.background), 1);
  button.fillRoundedRect(left, top, rect.width, rect.height, radius);
  button.lineStyle(borderWidth, colorNumber(style.borderColor), 1);
  button.strokeRoundedRect(
    left + inset,
    top + inset,
    rect.width - borderWidth,
    rect.height - borderWidth,
    Math.max(0, radius - inset),
  );
  button.fillStyle(colorNumber(hex), 1);
  button.fillCircle(0, 0, (side * style.swatchShare) / 2);
}
