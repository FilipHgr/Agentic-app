/**
 * Ukazatel klíčů na výběru omalovánky (#140 AC3): vodorovný zlatý klíč
 * (#139, návrh B) a vedle číslice celých klíčů (symbol, ne text jazyka).
 * Když má dítě i půlku, je za číslicí (na šířku pod nimi) malá půlka
 * klíče (hlava s hvězdou jako u cíle mapy v Počítání). S 0 klíči je klíč jen šedý obrys a číslice 0 šedá. Na
 * ťuknutí ukazatel nereaguje, umí se jen zhoupnout (AC4).
 */

import Phaser from 'phaser';

import { FONT_FAMILY } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import type { KeyIndicatorState } from '../logic/pictureLocks';
import { KEY_INDICATOR_STYLE } from '../logic/theme';
import { KEY_HEAD_ICON_FILE, KEY_ICON_FILE } from '../logic/toolIcons';
import { iconFileTexture, iconVariantTexture } from './toolIconTextures';

/** Klíč bez načteného obrázku: systémové emoji (symbol, ne text jazyka). */
const KEY_SYMBOL = '🔑';

export class KeyIndicatorView {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Nakreslí ukazatel se stavem `state` na místo `rect` v hloubce `depth`;
   * `null` ukazatel schová (žádná zamčená omalovánka).
   */
  show(state: KeyIndicatorState | null, rect: LayoutRect, cssScale: number, depth: number): void {
    this.destroy();
    if (state === null) {
      return;
    }
    const style = KEY_INDICATOR_STYLE;
    const empty = state.wholeKeys === 0;
    // Střed ukazatele je počátek, aby se zhoupnutí točilo kolem středu.
    const container = this.scene.add.container(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    container.setDepth(depth);
    // Široký ukazatel: klíč, číslice a půlka v řadě; úzký: půlka pod nimi.
    const inRow = rect.width >= rect.height * style.rowMinAspect;
    const rowWidthShare = 1 + style.digitWidthShare + (inRow ? style.halfShare : 0);
    const rowHeight = inRow ? rect.height : rect.height / (1 + style.halfShare);
    const keySide = Math.min(rowHeight * style.keyShare, rect.width / rowWidthShare);
    const halfSide = keySide * style.halfShare;
    const rowWidth = keySide * rowWidthShare;
    const rowY = inRow ? 0 : -rect.height / 2 + rowHeight / 2;
    const keyX = -rowWidth / 2 + keySide / 2;
    const digitX = -rowWidth / 2 + keySide + (keySide * style.digitWidthShare) / 2;
    container.add(this.keyImage(keySide, cssScale, empty).setPosition(keyX, rowY));
    container.add(
      this.scene.add
        .text(digitX, rowY, String(state.wholeKeys), {
          fontFamily: FONT_FAMILY,
          fontSize: `${Math.round(keySide * style.digitShare)}px`,
          fontStyle: 'bold',
          color: empty ? style.emptyColor : style.digitColor,
        })
        .setOrigin(0.5),
    );
    if (state.hasHalf) {
      const halfX = inRow ? rowWidth / 2 - halfSide / 2 : 0;
      const halfY = inRow ? 0 : rect.height / 2 - halfSide / 2;
      container.add(this.halfImage(halfSide, cssScale).setPosition(halfX, halfY));
    }
    this.container = container;
  }

  /** Zhoupnutí: na jednu stranu, na druhou a zpět (bez klíče, #140 AC4). */
  wobble(): void {
    const target = this.container;
    if (target === null) {
      return;
    }
    this.scene.tweens.killTweensOf(target);
    target.setAngle(0);
    const { wobbleAngle: angle, wobbleMs: ms } = KEY_INDICATOR_STYLE;
    this.scene.tweens.chain({
      targets: target,
      tweens: [
        { angle, duration: ms, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * ms, ease: 'Sine.easeInOut' },
        { angle: 0, duration: ms, ease: 'Sine.easeIn' },
      ],
    });
  }

  /** Krátké poskočení (zvětšení tam a zpět) po utracení klíče (#140 AC5). */
  pulse(): void {
    const target = this.container;
    if (target === null) {
      return;
    }
    this.scene.tweens.killTweensOf(target);
    target.setAngle(0).setScale(1);
    this.scene.tweens.add({
      targets: target,
      scale: KEY_INDICATOR_STYLE.spendPulseScale,
      duration: KEY_INDICATOR_STYLE.spendPulseMs,
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
  }

  /** Klíč (s 0 klíči jen obrys) se stranou `side`; bez obrázku emoji. */
  private keyImage(
    side: number,
    cssScale: number,
    empty: boolean,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const sideCss = side * cssScale;
    const key = empty
      ? iconVariantTexture(
          this.scene,
          KEY_ICON_FILE,
          sideCss,
          'outline',
          KEY_INDICATOR_STYLE.emptyColor,
        )
      : iconFileTexture(this.scene, KEY_ICON_FILE, sideCss);
    if (key === null) {
      const text = this.scene.add
        .text(0, 0, KEY_SYMBOL, {
          fontSize: `${Math.round(side * KEY_INDICATOR_STYLE.fallbackSymbolShare)}px`,
        })
        .setOrigin(0.5);
      return empty ? text.setAlpha(KEY_INDICATOR_STYLE.emptyFallbackAlpha) : text;
    }
    return this.scene.add.image(0, 0, key).setDisplaySize(side, side);
  }

  /** Malá půlka klíče (hlava s hvězdou) se stranou `side`; bez obrázku malé průhlednější emoji. */
  private halfImage(
    side: number,
    cssScale: number,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const key = iconVariantTexture(
      this.scene,
      KEY_HEAD_ICON_FILE,
      side * cssScale,
      'keyHead',
      KEY_INDICATOR_STYLE.digitColor,
    );
    if (key === null) {
      return this.scene.add
        .text(0, 0, KEY_SYMBOL, {
          fontSize: `${Math.round(side * KEY_INDICATOR_STYLE.halfFallbackSymbolShare)}px`,
        })
        .setOrigin(0.5)
        .setAlpha(KEY_INDICATOR_STYLE.halfFallbackAlpha);
    }
    return this.scene.add.image(0, 0, key).setDisplaySize(side, side);
  }
}
