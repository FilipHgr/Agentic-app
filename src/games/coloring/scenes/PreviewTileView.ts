/**
 * Dlaždice náhledu omalovánky na výběru (#124): bílá se zaoblením a jemným
 * stínem jako dlaždice v menu, obrázek přes celou dlaždici a zaoblené rohy
 * ho ořežou. Náhled se nejdřív ukáže jen s obrysem a barvy dítěte se
 * dokreslí, až je omalovánka připravená (AC7). Co je v pixelech náhledu,
 * řeší `logic/picturePreview.ts`; tady se jen kreslí.
 *
 * Od #129 je stejná dlaždice i velký obrázek z alba: umí se zvětšit
 * z místa náhledu, zmenšit zpátky a zmenšit a zmizet po smazání.
 *
 * Od #140 umí zamčená omalovánka ztlumení bílým závojem a zámek uprostřed
 * (`setLocked`): zámek se umí zhoupnout a otevřít.
 */

import Phaser from 'phaser';

import { CANVAS_PIXELS_PER_CSS_PX } from '../../../shared/logic/canvasResolution';
import type { LayoutRect } from '../logic/coloringLayout';
import { previewCellHex } from '../logic/picturePreview';
import type { PicturePreview, PreviewCell } from '../logic/picturePreview';
import { PICKER_TILE_STYLE, PICTURE_LOCK_STYLE, rgbOf } from '../logic/theme';
import { LOCK_ICON_FILE, UNLOCKED_ICON_FILE } from '../logic/toolIcons';
import { iconFileTexture } from './toolIconTextures';

/** Zámek bez načteného SVG: systémové emoji (symbol, ne text jazyka). */
const LOCK_SYMBOL = '🔒';
const UNLOCKED_SYMBOL = '🔓';

/** Závoj a zámek zamčené omalovánky (#140). */
interface LockLayer {
  readonly container: Phaser.GameObjects.Container;
  readonly icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  /** Zámek se otevírá: co se zavolá, až zmizí (i když se otevírání přeruší). */
  readonly onOpened?: () => void;
}

/** Kde a jak velká je dlaždice: obdélník a zaoblení v herních jednotkách, CSS px na jednotku. */
export interface PreviewTilePlace {
  readonly rect: LayoutRect;
  readonly cornerRadius: number;
  readonly cssScale: number;
}

/** Barva pixelu náhledu jako RGB; barvy se převádějí jen jednou. */
const rgbByHex = new Map<string, readonly [number, number, number]>();

function rgbOfCell(cell: PreviewCell): readonly [number, number, number] {
  const hex = previewCellHex(cell);
  let rgb = rgbByHex.get(hex);
  if (rgb === undefined) {
    rgb = rgbOf(hex);
    rgbByHex.set(hex, rgb);
  }
  return rgb;
}

/** Cesta obdélníku se zaoblenými rohy (bez `roundRect`, který starší Safari nemá). */
function roundedRectPath(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(r, 0);
  context.arcTo(width, 0, width, height, r);
  context.arcTo(width, height, 0, height, r);
  context.arcTo(0, height, 0, 0, r);
  context.arcTo(0, 0, width, 0, r);
  context.closePath();
}

/** Plátno s barvami náhledu (pozadí, obrys a barvy dítěte bez míchání). */
function colorsCanvasOf(preview: PicturePreview): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = preview.width;
  canvas.height = preview.height;
  const context = canvas.getContext('2d');
  if (context === null) {
    return null;
  }
  const pixels = context.createImageData(preview.width, preview.height);
  const data = pixels.data;
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      const [red, green, blue] = rgbOfCell(preview.cellAt(x, y));
      const offset = (y * preview.width + x) * 4;
      data[offset] = red;
      data[offset + 1] = green;
      data[offset + 2] = blue;
      data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export class PreviewTileView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Graphics;
  private image: Phaser.GameObjects.Image | null = null;
  private textureKey: string | null = null;
  private place: PreviewTilePlace | null = null;
  /** Číslo další textury, aby nová textura nikdy nepřepsala tu, která je vidět. */
  private textureCount = 0;
  /** Závoj a zámek zamčené omalovánky; `null` u odemčené (#140). */
  private lock: LockLayer | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly name: string,
  ) {
    this.shadow = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.shadow]);
  }

  /** Velikost obrázku náhledu v pixelech plátna. */
  pixelSize(): { readonly width: number; readonly height: number } | null {
    if (this.place === null) {
      return null;
    }
    const { rect, cssScale } = this.place;
    return {
      width: Math.max(1, Math.round(rect.width * cssScale * CANVAS_PIXELS_PER_CSS_PX)),
      height: Math.max(1, Math.round(rect.height * cssScale * CANVAS_PIXELS_PER_CSS_PX)),
    };
  }

  /** Postaví dlaždici na místo a nakreslí stín. Obrázek je potřeba nakreslit znovu (`show`). */
  setPlace(place: PreviewTilePlace): void {
    this.place = place;
    const { rect, cornerRadius, cssScale } = place;
    const unitsPerCss = 1 / cssScale;
    this.scene.tweens.killTweensOf(this.container);
    this.container
      .setPosition(rect.left + rect.width / 2, rect.top + rect.height / 2)
      .setAngle(0)
      .setScale(1)
      .setAlpha(1);
    this.shadow.clear();
    for (const spreadCss of PICKER_TILE_STYLE.shadowSpreadsCss) {
      const spread = spreadCss * unitsPerCss;
      this.shadow
        .fillStyle(0x000000, PICKER_TILE_STYLE.shadowAlpha)
        .fillRoundedRect(
          -rect.width / 2 - spread,
          -rect.height / 2 - spread + PICKER_TILE_STYLE.shadowOffsetCss * unitsPerCss,
          rect.width + 2 * spread,
          rect.height + 2 * spread,
          cornerRadius + spread,
        );
    }
    // Bílá plocha hned, aby dlaždice byla vidět ještě před načtením obrysu (#124 AC7).
    this.shadow
      .fillStyle(Phaser.Display.Color.HexStringToColor(PICKER_TILE_STYLE.background).color, 1)
      .fillRoundedRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, cornerRadius);
    // Zámek podle nového místa; otevírání zámku se dokončí hned.
    const wasLocked = this.lock !== null && this.lock.onOpened === undefined;
    this.removeLock();
    if (wasLocked) {
      this.setLocked(true);
    }
  }

  /** Ztlumí náhled a ukáže zámek (`true`), nebo zámek schová (#140). */
  setLocked(locked: boolean): void {
    if (!locked) {
      this.removeLock();
      return;
    }
    if (this.lock !== null || this.place === null) {
      return;
    }
    const { rect, cornerRadius, cssScale } = this.place;
    const style = PICTURE_LOCK_STYLE;
    const veil = this.scene.add.graphics();
    veil
      .fillStyle(Phaser.Display.Color.HexStringToColor(style.veil).color, style.veilAlpha)
      .fillRoundedRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height, cornerRadius);
    const side = Math.min(rect.width, rect.height) * style.lockShare;
    const icon = this.lockIcon(LOCK_ICON_FILE, LOCK_SYMBOL, side, cssScale);
    const container = this.scene.add.container(0, 0, [veil, icon]);
    this.container.add(container);
    this.lock = { container, icon };
  }

  /** Zámek se zhoupne (zamčená omalovánka bez klíče, #140 AC4). */
  wobbleLock(): void {
    const icon = this.lock?.icon;
    if (icon === undefined) {
      return;
    }
    const { wobbleAngle: angle, wobbleMs: ms } = PICTURE_LOCK_STYLE;
    this.scene.tweens.killTweensOf(icon);
    icon.setAngle(0).setScale(icon.getData('scale') as number);
    this.scene.tweens.chain({
      targets: icon,
      tweens: [
        { angle, duration: ms, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * ms, ease: 'Sine.easeInOut' },
        { angle: 0, duration: ms, ease: 'Sine.easeIn' },
      ],
    });
  }

  /**
   * Zámek se otevře (#140 AC5): vymění se za otevřený, poskočí a se
   * závojem zmizí; `onDone` se zavolá na konci (i bez zámku hned).
   */
  openLock(onDone: () => void): void {
    const lock = this.lock;
    if (lock === null || this.place === null) {
      onDone();
      return;
    }
    const style = PICTURE_LOCK_STYLE;
    const side = Math.min(this.place.rect.width, this.place.rect.height) * style.lockShare;
    lock.icon.destroy();
    const icon = this.lockIcon(UNLOCKED_ICON_FILE, UNLOCKED_SYMBOL, side, this.place.cssScale);
    lock.container.add(icon);
    const baseScale = icon.getData('scale') as number;
    this.scene.tweens.chain({
      targets: icon,
      tweens: [
        {
          scale: baseScale * style.openPopScale,
          duration: style.openPopMs,
          ease: 'Sine.easeOut',
          yoyo: true,
        },
      ],
    });
    this.scene.tweens.add({
      targets: lock.container,
      alpha: 0,
      delay: 2 * style.openPopMs,
      duration: style.openFadeMs,
      ease: 'Sine.easeIn',
      onComplete: () => this.removeLock(),
    });
    this.lock = { container: lock.container, icon, onOpened: onDone };
  }

  /** Ikona zámku ze SVG, bez něj emoji, se stranou `side` a středem v počátku. */
  private lockIcon(
    file: string,
    symbol: string,
    side: number,
    cssScale: number,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const key = iconFileTexture(this.scene, file, side * cssScale);
    const icon =
      key === null
        ? this.scene.add.text(0, 0, symbol, { fontSize: `${Math.round(side)}px` }).setOrigin(0.5)
        : this.scene.add.image(0, 0, key).setDisplaySize(side, side);
    // Velikost v klidu, aby zhoupnutí a poskočení vracely ikonu do ní.
    icon.setData('scale', icon.scale);
    return icon;
  }

  private removeLock(): void {
    const lock = this.lock;
    if (lock === null) {
      return;
    }
    this.scene.tweens.killTweensOf(lock.container);
    this.scene.tweens.killTweensOf(lock.icon);
    lock.container.destroy();
    this.lock = null;
    lock.onOpened?.();
  }

  /**
   * Nakreslí obrázek dlaždice: bílá plocha, barvy náhledu (když jsou)
   * a nad nimi ostře zmenšený obrys. Bez obrysu zůstane bílá dlaždice.
   */
  show(outline: HTMLImageElement | null, colors: PicturePreview | null): void {
    const size = this.pixelSize();
    if (this.place === null || size === null) {
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (context === null) {
      return;
    }
    const radiusPx = this.place.cornerRadius * this.place.cssScale * CANVAS_PIXELS_PER_CSS_PX;
    roundedRectPath(context, size.width, size.height, radiusPx);
    context.clip();
    context.fillStyle = PICKER_TILE_STYLE.background;
    context.fillRect(0, 0, size.width, size.height);
    const colorsCanvas = colors === null ? null : colorsCanvasOf(colors);
    if (colorsCanvas !== null) {
      // Barvy dítěte bez míchání: každý pixel náhledu má barvu pixelu obrázku (AC3).
      context.imageSmoothingEnabled = false;
      context.drawImage(colorsCanvas, 0, 0, size.width, size.height);
    }
    if (outline !== null) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(outline, 0, 0, size.width, size.height);
    }
    this.setCanvas(canvas);
  }

  /** Hloubka dlaždice ve scéně (velký obrázek je nad náhledy alba). */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Dlaždice se zvětší z místa `from` (herní jednotky) na své místo za
   * `ms`; `onDone` se zavolá na konci (#129, otevření velkého obrázku).
   */
  growFrom(from: LayoutRect, ms: number, onDone: () => void): void {
    const place = this.place;
    if (place === null) {
      onDone();
      return;
    }
    const { rect } = place;
    this.scene.tweens.killTweensOf(this.container);
    this.container
      .setPosition(from.left + from.width / 2, from.top + from.height / 2)
      .setScale(from.width / rect.width)
      .setAngle(0)
      .setAlpha(1);
    this.scene.tweens.add({
      targets: this.container,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      scale: 1,
      duration: ms,
      ease: 'Sine.easeOut',
      onComplete: onDone,
    });
  }

  /**
   * Dlaždice se za `ms` zmenší na místo `to` (návrat do alba), nebo bez
   * místa uprostřed do ztracena (smazaný obrázek, #129); `onDone` na konci.
   */
  shrinkTo(to: LayoutRect | null, ms: number, onDone: () => void): void {
    const place = this.place;
    if (place === null) {
      onDone();
      return;
    }
    const { rect } = place;
    const target = to ?? {
      left: rect.left + rect.width / 2,
      top: rect.top + rect.height / 2,
      width: 0,
      height: 0,
    };
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      x: target.left + target.width / 2,
      y: target.top + target.height / 2,
      scale: target.width / rect.width,
      alpha: to === null ? 0 : 1,
      angle: 0,
      duration: ms,
      ease: 'Sine.easeIn',
      onComplete: onDone,
    });
  }

  /** Zhoupnutí po ťuknutí; `onDone` se zavolá, až dlaždice dojde zpátky. */
  wobble(onDone: () => void): void {
    const { wobbleAngle: angle, wobbleMs: ms } = PICKER_TILE_STYLE;
    this.scene.tweens.killTweensOf(this.container);
    this.container.setAngle(0);
    this.scene.tweens.chain({
      targets: this.container,
      tweens: [
        { angle, duration: ms, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * ms, ease: 'Sine.easeInOut' },
        { angle: 0, duration: ms, ease: 'Sine.easeIn' },
      ],
      onComplete: onDone,
    });
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.container);
    this.removeLock();
    this.container.destroy();
    this.removeTexture();
  }

  /** Vymění obrázek dlaždice za nové plátno. */
  private setCanvas(canvas: HTMLCanvasElement): void {
    if (this.place === null) {
      return;
    }
    this.textureCount += 1;
    const key = `${this.name}:${this.textureCount}`;
    if (this.scene.textures.addCanvas(key, canvas) === null) {
      return;
    }
    const { rect } = this.place;
    if (this.image === null) {
      this.image = this.scene.add.image(0, 0, key);
      this.container.add(this.image);
      if (this.lock !== null) {
        // Závoj a zámek zůstanou nad obrázkem.
        this.container.bringToTop(this.lock.container);
      }
    } else {
      this.image.setTexture(key);
    }
    this.image.setDisplaySize(rect.width, rect.height);
    this.removeTexture();
    this.textureKey = key;
  }

  private removeTexture(): void {
    if (this.textureKey !== null && this.scene.textures.exists(this.textureKey)) {
      this.scene.textures.remove(this.textureKey);
    }
    this.textureKey = null;
  }
}
