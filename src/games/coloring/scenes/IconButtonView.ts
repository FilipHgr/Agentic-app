/**
 * Tlačítko s ikonou Noto Emoji (#126): fotoaparát v malování a kniha na
 * výběru. Podklad a okraj jsou jako u tlačítka Zpět (světle modrý čtverec),
 * ikona uprostřed, bez textu. Ťuknutí pozná scéna; tlačítko se umí
 * zhoupnout, stisknout a poskočit.
 */

import Phaser from 'phaser';

import { colorNumber } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { CAMERA_PHOTO_STYLE, ICON_BUTTON_STYLE } from '../logic/theme';
import { iconFileTexture } from './toolIconTextures';

export class IconButtonView {
  private container: Phaser.GameObjects.Container | null = null;
  private rect: LayoutRect | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly iconFile: string,
  ) {}

  /** Střed tlačítka v herních jednotkách; `null`, když tlačítko není postavené. */
  center(): { readonly x: number; readonly y: number } | null {
    const rect = this.rect;
    return rect === null ? null : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  /** Strana tlačítka v herních jednotkách; `null`, když tlačítko není postavené. */
  side(): number | null {
    const rect = this.rect;
    return rect === null ? null : Math.min(rect.width, rect.height);
  }

  /** Postaví tlačítko na místo `rect` v hloubce `depth`, např. po otočení. */
  place(rect: LayoutRect, cssScale: number, depth: number): void {
    this.destroy();
    this.rect = rect;
    // Střed tlačítka je počátek, aby se zhoupnutí točilo kolem středu.
    const container = this.scene.add.container(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    container.setDepth(depth);
    container.add(backgroundOf(this.scene, rect, cssScale));
    const iconSide = Math.min(rect.width, rect.height) * ICON_BUTTON_STYLE.iconShare;
    const key = iconFileTexture(this.scene, this.iconFile, iconSide * cssScale);
    if (key !== null) {
      // Bez načteného SVG (výpadek) zůstane tlačítko bez ikony a funguje dál.
      container.add(this.scene.add.image(0, 0, key).setDisplaySize(iconSide, iconSide));
    }
    this.container = container;
  }

  /** Zhoupnutí: na jednu stranu, na druhou a zpět (jako Zpět a domeček). */
  wobble(onDone?: () => void): void {
    const target = this.restart();
    if (target === null) {
      onDone?.();
      return;
    }
    const { wobbleAngle: angle, wobbleMs: ms } = ICON_BUTTON_STYLE;
    this.scene.tweens.chain({
      targets: target,
      tweens: [
        { angle, duration: ms, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * ms, ease: 'Sine.easeInOut' },
        { angle: 0, duration: ms, ease: 'Sine.easeIn' },
      ],
      onComplete: () => onDone?.(),
    });
  }

  /** Velikost tlačítka (1 je běžná) pro stisknutí a poskočení během animace uložení. */
  setPressScale(scale: number): void {
    this.container?.setScale(scale);
  }

  /** Poskočení po doletu fotky do fotoaparátu. */
  bounce(): void {
    const target = this.restart();
    if (target === null) {
      return;
    }
    this.scene.tweens.add({
      targets: target,
      scale: CAMERA_PHOTO_STYLE.bounceScale,
      duration: CAMERA_PHOTO_STYLE.bounceMs,
      ease: 'Sine.easeOut',
      yoyo: true,
    });
  }

  destroy(): void {
    if (this.container !== null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy();
    }
    this.container = null;
    this.rect = null;
  }

  /** Zastaví rozběhnutý pohyb tlačítka a vrátí ho do klidu. */
  private restart(): Phaser.GameObjects.Container | null {
    const target = this.container;
    if (target === null) {
      return null;
    }
    this.scene.tweens.killTweensOf(target);
    target.setAngle(0).setScale(1);
    return target;
  }
}

/** Podklad s okrajem se středem v počátku, jako u tlačítka Zpět. */
function backgroundOf(
  scene: Phaser.Scene,
  rect: LayoutRect,
  cssScale: number,
): Phaser.GameObjects.Graphics {
  const style = ICON_BUTTON_STYLE;
  const side = Math.min(rect.width, rect.height);
  const borderWidth = style.borderWidthCss / cssScale;
  const radius = side * style.cornerRadiusShare;
  const inset = borderWidth / 2;
  const graphics = scene.add.graphics();
  graphics.fillStyle(colorNumber(style.background), 1);
  graphics.fillRoundedRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, radius);
  graphics.lineStyle(borderWidth, colorNumber(style.borderColor), 1);
  graphics.strokeRoundedRect(
    -rect.width / 2 + inset,
    -rect.height / 2 + inset,
    rect.width - borderWidth,
    rect.height - borderWidth,
    Math.max(0, radius - inset),
  );
  return graphics;
}
