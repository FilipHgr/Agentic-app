import Phaser from 'phaser';

import type { KeyReward } from '../../../shared/logic/keyRewards';
import { FONT_FAMILY, colorNumber } from '../../../shared/logic/theme';
import { keyRewardMomentAt } from '../logic/mapAnimation';
import type { MapRect } from '../logic/progressMapLayout';
import { PROGRESS_MAP_SHAPE } from '../logic/theme';
import type { ProgressMapStyle } from '../logic/theme';
import { keyHalfTextures } from './mapPictureTextures';

/**
 * Poměr délky klíče k jeho výšce: rozměr obrázků půlek klíče
 * (`icons/key-head.webp` a `icons/key-blade.webp`, 256 × 127 px).
 */
const KEY_ASPECT = 256 / 127;

/** Okraj štítku kolem klíče jako díl výšky štítku. */
const BADGE_PADDING_SHARE = 0.14;

/** Jak daleko od sebe stojí půlky celého klíče před spojením (díl výšky štítku na každou stranu). */
const MAX_APART_SHARE = 0.3;

/** Nejmenší rozestup půlek, pro který se klíč zkrátí, když je štítek úzký (díl výšky štítku). */
const MIN_APART_SHARE = 0.15;

/** Chybějící dřík u samotné půlky klíče: šedá silueta, velmi slabá (jen „tady něco chybí“). */
const MISSING_HALF_ALPHA = 0.12;
const MISSING_HALF_COLOR = 0x6e6e73;

/** Spojený klíč krátce poskočí (zvětšení tam a zpět). */
const JOIN_PULSE_SCALE = 1.15;
const JOIN_PULSE_MS = 180;

/** Půlka klíče: obrázek, nebo emoji, když se obrázek nenačetl. */
type KeyHalf = Phaser.GameObjects.Image | Phaser.GameObjects.Text;

/**
 * Půlka klíče u cíle mapy (#139 AC2) na světlém štítku jako symbol cíle.
 * U `'half'` je vidět hlava klíče s hvězdou (levá půlka po spoj skládačky)
 * a místo dříku jen šedá silueta, u `'wholeKey'` se objeví obě půlky kousek od sebe, přiblíží se, spojí a klíč poskočí.
 * Kdy co je vidět, řídí časová osa `keyRewardMomentAt` podle času od
 * ukázání mapy, takže po otočení se štítek překreslí ve stejném okamžiku.
 */
export class GoalKeyBadge {
  readonly container: Phaser.GameObjects.Container;
  private readonly parts: Phaser.GameObjects.Container;
  private readonly left: KeyHalf;
  private readonly right: KeyHalf;
  /** Jak daleko se půlky před spojením rozestoupí (v herních jednotkách). */
  private readonly apart: number;
  /** Spojený klíč už poskočil (po otočení se to neopakuje). */
  private pulsed: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    rect: MapRect,
    style: ProgressMapStyle,
    private readonly reward: KeyReward,
    elapsedMs: number,
  ) {
    const padding = rect.height * BADGE_PADDING_SHARE;
    const minApart = rect.height * MIN_APART_SHARE;
    const keyLength = Math.min(
      (rect.height - padding * 2) * KEY_ASPECT,
      rect.width - padding * 2 - minApart * 2,
    );
    this.apart = Math.min(
      (rect.width - padding * 2 - keyLength) / 2,
      rect.height * MAX_APART_SHARE,
    );
    const [left, right] = this.drawHalves(keyLength);
    this.left = left;
    this.right = right;
    if (reward === 'half') {
      // Dřík chybí: šedá silueta tvaru dříku, ne bledý celý klíč.
      right.setTintFill(MISSING_HALF_COLOR).setAlpha(MISSING_HALF_ALPHA);
    }
    this.parts = scene.add.container(0, 0, [left, right]);
    this.container = scene.add.container(rect.x, rect.y, [
      drawBadge(scene, rect, style),
      this.parts,
    ]);
    this.pulsed = keyRewardMomentAt(reward, elapsedMs).joined;
    this.update(elapsedMs);
  }

  /** Každý snímek: objevení, rozestup půlek a spojení podle času. */
  update(elapsedMs: number): void {
    const moment = keyRewardMomentAt(this.reward, elapsedMs);
    this.container.setVisible(moment.visible);
    this.container.setScale(moment.popShare);
    this.left.x = -this.apart * moment.separation;
    this.right.x = this.apart * moment.separation;
    if (moment.joined && !this.pulsed) {
      this.pulsed = true;
      this.scene.tweens.add({
        targets: this.parts,
        scale: JOIN_PULSE_SCALE,
        duration: JOIN_PULSE_MS,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  /** Zastaví poskočení klíče; volá se, než mapa zmizí. */
  stopAnimations(): void {
    this.scene.tweens.killTweensOf(this.parts);
  }

  /**
   * Levá (hlava) a pravá (dřík) půlka klíče délky `keyLength`. Obě mají
   * rozměr celého klíče se středem v počátku, takže bez rozestupu se spojí.
   */
  private drawHalves(keyLength: number): [KeyHalf, KeyHalf] {
    const textures = keyHalfTextures(this.scene);
    if (textures === null) {
      return this.drawEmojiHalves(keyLength / KEY_ASPECT);
    }
    const half = (texture: string): Phaser.GameObjects.Image =>
      this.scene.add.image(0, 0, texture).setDisplaySize(keyLength, keyLength / KEY_ASPECT);
    return [half(textures.head), half(textures.blade)];
  }

  /** Bez načtených obrázků systémové emoji klíče (symbol, ne text jazyka), rozdělené napůl. */
  private drawEmojiHalves(keyHeight: number): [KeyHalf, KeyHalf] {
    const half = (side: 'left' | 'right'): Phaser.GameObjects.Text => {
      const text = this.scene.add
        .text(0, 0, '🔑', { fontFamily: FONT_FAMILY, fontSize: `${Math.round(keyHeight)}px` })
        .setOrigin(0.5);
      const width = text.width / 2;
      return text.setCrop(side === 'left' ? 0 : width, 0, width, text.height);
    };
    return [half('left'), half('right')];
  }
}

/** Světlý štítek s okrajem v barvách podkladu symbolu cíle, se středem v počátku. */
function drawBadge(
  scene: Phaser.Scene,
  rect: MapRect,
  style: ProgressMapStyle,
): Phaser.GameObjects.Graphics {
  const border = rect.height * PROGRESS_MAP_SHAPE.goalBadgeBorderShare;
  const width = rect.width - border;
  const height = rect.height - border;
  const badge = scene.add.graphics();
  badge.fillStyle(colorNumber(style.goalBadgeColor));
  badge.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  badge.lineStyle(border, colorNumber(style.goalBadgeBorderColor));
  badge.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  return badge;
}
