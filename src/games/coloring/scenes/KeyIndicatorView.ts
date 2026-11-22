/**
 * Ukazatel klíčů na výběru omalovánky (#140 AC3, od #159 AC1): vodorovný
 * zlatý klíč (#139, návrh B), vedle číslice celých klíčů (symbol, ne text
 * jazyka) a za ní (na šířku pod nimi) obrys celého klíče, prázdný, nebo
 * při půlce se zlatou hlavou (`key-head.webp` leží v obrázku na stejném
 * místě jako hlava v `key.webp`). S 0 klíči je klíč jen šedý obrys (při
 * půlce se zlatou hlavou) a číslice 0 šedá, obrys vedle není. Na ťuknutí
 * ukazatel nereaguje, umí se jen zhoupnout (#140 AC4).
 *
 * Od #159 ukazatel kreslí i klíč, který letí do zámku náhledu (`sendKey`),
 * v zámku poskakuje, aby zval k druhému ťuknutí, při odemčení se otočí
 * (`turnKey`) a jinak se vrátí do ukazatele (`returnKey`). Klíč se otáčí
 * kolem hrotu v klíčové dírce (`KEY_IN_LOCK.tipShare`).
 *
 * Od #195 je klíč na výběru vidět jen jednou (`keyIndicatorLook`): vedle
 * celého klíče je obrys jen jako půlka a klíč mimo ukazatel ukazatel
 * nepočítá (místo ztlumeného zlatého klíče se nakreslí znovu bez něj,
 * s posledním klíčem venku jako šedý obrys s 0).
 */

import Phaser from 'phaser';

import { FONT_FAMILY } from '../../../shared/logic/theme';
import type { LayoutRect } from '../logic/coloringLayout';
import { KEY_IN_LOCK } from '../logic/pickerLayout';
import { KEY_FLIGHT_MS } from '../logic/pictureChoice';
import { keyIndicatorLook } from '../logic/pictureLocks';
import type { KeyIndicatorState } from '../logic/pictureLocks';
import { KEY_INDICATOR_STYLE, KEY_IN_LOCK_STYLE } from '../logic/theme';
import { KEY_HEAD_ICON_FILE, KEY_ICON_FILE } from '../logic/toolIcons';
import { iconFileTexture, iconVariantTexture } from './toolIconTextures';

/** Klíč bez načteného obrázku: systémové emoji (symbol, ne text jazyka). */
const KEY_SYMBOL = '🔑';

/** Kde je zlatý klíč ukazatele (střed a strana v herních jednotkách). */
interface KeySpot {
  readonly x: number;
  readonly y: number;
  readonly side: number;
}

/** Klíč mimo ukazatel (#159): letí, je v zámku, otáčí se, nebo se vrací. */
interface LooseKey {
  readonly image: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  /** Strana klíče při měřítku 1. */
  readonly unitSide: number;
  state: 'flying' | 'inLock' | 'turning' | 'returning';
  /** Co se zavolá po doletu do zámku (i když se let dokončí hned). */
  onLanded: (() => void) | null;
}

/** Co ukazatel dostal k nakreslení, aby se mohl nakreslit znovu, když klíč vyletí nebo se vrátí. */
interface ShownIndicator {
  readonly state: KeyIndicatorState;
  readonly rect: LayoutRect;
  readonly cssScale: number;
}

export class KeyIndicatorView {
  private container: Phaser.GameObjects.Container | null = null;
  /** Zlatý klíč ukazatele, odkud klíč vylétá a kam se vrací. */
  private keySpot: KeySpot | null = null;
  private looseKey: LooseKey | null = null;
  /** Co ukazatel naposledy dostal k nakreslení; `null`, když je schovaný nebo zrušený. */
  private shown: ShownIndicator | null = null;
  private depth = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Nakreslí ukazatel se stavem `state` na místo `rect` v hloubce `depth`;
   * `null` ukazatel schová (žádná zamčená omalovánka). Klíč mimo ukazatel
   * zůstane, kde je.
   */
  show(state: KeyIndicatorState | null, rect: LayoutRect, cssScale: number, depth: number): void {
    this.depth = depth;
    this.shown = state === null ? null : { state, rect, cssScale };
    this.destroyIndicator();
    this.drawIndicator();
  }

  /** Je jeden klíč mimo ukazatel (letí, čeká v zámku, nebo se vrací)? Otáčející se už je utracený. */
  private isKeyOut(): boolean {
    return this.looseKey !== null && this.looseKey.state !== 'turning';
  }

  /**
   * Nakreslí obsah ukazatele podle toho, co dostal, a jestli je klíč mimo
   * něj (#195 AC3). Když ukazatel už je, vymění jen obsah, aby běžící
   * zhoupnutí nebo poskočení doběhlo.
   */
  private drawIndicator(): void {
    const shown = this.shown;
    if (shown === null) {
      this.destroyIndicator();
      return;
    }
    const { rect, cssScale } = shown;
    const look = keyIndicatorLook(shown.state, this.isKeyOut());
    // Rozměry řady podle ukazatele s klíčem doma: klíč, který vyletí, ji
    // neposune, a vracející se klíč tak míří na stejné místo.
    const restLook = keyIndicatorLook(shown.state, false);
    const style = KEY_INDICATOR_STYLE;
    const container = this.container ?? this.newContainer(rect);
    container.removeAll(true);
    // Široký ukazatel: klíč, číslice a půlka v řadě; úzký: půlka pod nimi.
    // Velikost klíče počítá vždy s půlkou, aby se po utracení klíče nezměnila.
    const inRow = rect.width >= rect.height * style.rowMinAspect;
    const rowWidthShare = 1 + style.digitWidthShare + (inRow ? style.progressShare : 0);
    const rowHeight = inRow ? rect.height : rect.height / (1 + style.progressShare);
    const keySide = Math.min(rowHeight * style.keyShare, rect.width / rowWidthShare);
    const progressSide = keySide * style.progressShare;
    const rowWidth =
      keySide *
      (1 + style.digitWidthShare + (inRow && restLook.halfBeside ? style.progressShare : 0));
    const rowY = inRow ? 0 : -rect.height / 2 + rowHeight / 2;
    const keyX = -rowWidth / 2 + keySide / 2;
    const digitX = -rowWidth / 2 + keySide + (keySide * style.digitWidthShare) / 2;
    for (const part of this.mainKey(look.mainKey, keySide, cssScale)) {
      container.add(part.setPosition(keyX, rowY));
    }
    container.add(
      this.scene.add
        .text(digitX, rowY, String(look.wholeKeys), {
          fontFamily: FONT_FAMILY,
          fontSize: `${Math.round(keySide * style.digitShare)}px`,
          fontStyle: 'bold',
          color: look.wholeKeys === 0 ? style.emptyColor : style.digitColor,
        })
        .setOrigin(0.5),
    );
    if (look.halfBeside) {
      const progressX = inRow ? rowWidth / 2 - progressSide / 2 : 0;
      // Úzký ukazatel: půlka hned pod řadou klíče s číslicí.
      const progressY = inRow ? 0 : rowY + keySide * style.columnProgressDrop;
      for (const part of this.outlineKey(progressSide, cssScale, true)) {
        container.add(part.setPosition(progressX, progressY));
      }
    }
    this.container = container;
    this.keySpot = { x: container.x + keyX, y: container.y + rowY, side: keySide };
  }

  /** Prázdný ukazatel na místě `rect`; střed je počátek, aby se zhoupnutí točilo kolem středu. */
  private newContainer(rect: LayoutRect): Phaser.GameObjects.Container {
    const container = this.scene.add.container(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    container.setDepth(this.depth);
    return container;
  }

  /** Hlavní klíč ukazatele podle vzhledu `mainKey` (#195). */
  private mainKey(
    mainKey: 'gold' | 'half' | 'empty',
    side: number,
    cssScale: number,
  ): (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] {
    switch (mainKey) {
      case 'gold':
        return [this.goldKey(side, cssScale)];
      case 'half':
        return this.outlineKey(side, cssScale, true);
      case 'empty':
        return this.outlineKey(side, cssScale, false);
    }
  }

  /**
   * Klíč letí za `KEY_FLIGHT_MS` do zámku na místo `target` (čtverec
   * obrázku klíče, `keyInLockAt`): z ukazatele, nebo odtud, kde právě je
   * (přelet k jiné zamčené omalovánce). Po doletu zavolá `onLanded`
   * a začne poskakovat (#159 AC2).
   */
  sendKey(target: LayoutRect, cssScale: number, onLanded: () => void): void {
    const fresh = !this.hasKeyInPlay();
    const key = this.looseKeyFor(target, cssScale);
    if (key === null) {
      onLanded();
      return;
    }
    this.scene.tweens.killTweensOf(key.image);
    const start = fresh ? this.keySpot : null;
    if (start !== null) {
      const startSide = start.side;
      key.image
        .setPosition(start.x + (KEY_IN_LOCK.tipShare - 0.5) * startSide, start.y)
        .setScale(startSide / key.unitSide);
    }
    key.image.setAngle(0).setAlpha(1);
    key.state = 'flying';
    key.onLanded = onLanded;
    if (fresh) {
      // Klíč opustil ukazatel: ukazatel ho už nepočítá (#195 AC3).
      this.drawIndicator();
    }
    const end = tipOf(target);
    this.scene.tweens.add({
      targets: key.image,
      x: end.x,
      y: end.y,
      scale: target.width / key.unitSide,
      duration: KEY_FLIGHT_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.land(key),
    });
  }

  /**
   * Klíč v zámku po změně okna nebo novém nakreslení výběru: hned na místě
   * `target`. Let se dokončí hned a zavolá `onLanded` (i u klíče, který
   * se nakreslil znovu rovnou v zámku).
   */
  placeKey(target: LayoutRect, cssScale: number, onLanded: () => void): void {
    const fresh = !this.hasKeyInPlay();
    const key = this.looseKeyFor(target, cssScale);
    if (key === null || key.state === 'turning' || key.state === 'returning') {
      return;
    }
    if (fresh || key.state === 'flying') {
      key.onLanded = onLanded;
    }
    if (fresh) {
      // Klíč nakreslený rovnou v zámku: ukazatel ho nepočítá (#195 AC3).
      this.drawIndicator();
    }
    this.scene.tweens.killTweensOf(key.image);
    const end = tipOf(target);
    key.image
      .setPosition(end.x, end.y)
      .setScale(target.width / key.unitSide)
      .setAngle(0);
    this.land(key);
  }

  /** Je klíč na cestě do zámku nebo v zámku (ne v ukazateli, neotáčí se ani nevrací)? */
  hasKeyInPlay(): boolean {
    return (
      this.looseKey !== null &&
      (this.looseKey.state === 'flying' || this.looseKey.state === 'inLock')
    );
  }

  /**
   * Klíč se v zámku otočí a zmizí (#159 AC3), pak se zavolá `onDone`
   * (bez klíče hned).
   */
  turnKey(onDone: () => void): void {
    const key = this.looseKey;
    if (key === null || key.state === 'returning') {
      onDone();
      return;
    }
    this.scene.tweens.killTweensOf(key.image);
    key.state = 'turning';
    key.onLanded = null;
    this.scene.tweens.add({
      targets: key.image,
      angle: KEY_IN_LOCK_STYLE.turnAngle,
      duration: KEY_IN_LOCK_STYLE.turnMs,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Utracený klíč: nový stav ukazatele nakreslí scéna v `onDone` (jen jednou).
        this.destroyLooseKey(false);
        onDone();
      },
    });
  }

  /** Klíč odletí zpátky do ukazatele a zmizí (#159 AC4). */
  returnKey(): void {
    const key = this.looseKey;
    if (key === null || key.state === 'returning' || key.state === 'turning') {
      return;
    }
    this.scene.tweens.killTweensOf(key.image);
    key.state = 'returning';
    key.onLanded = null;
    const spot = this.keySpot;
    const target =
      spot === null
        ? { alpha: 0 }
        : {
            x: spot.x + (KEY_IN_LOCK.tipShare - 0.5) * spot.side,
            y: spot.y,
            scale: spot.side / key.unitSide,
            angle: 0,
          };
    this.scene.tweens.add({
      targets: key.image,
      ...target,
      duration: KEY_IN_LOCK_STYLE.returnMs,
      ease: 'Sine.easeInOut',
      onComplete: () => this.destroyLooseKey(),
    });
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

  /** Zahodí ukazatel i klíč mimo něj. */
  destroy(): void {
    this.shown = null;
    this.destroyIndicator();
    this.destroyLooseKey();
  }

  private destroyIndicator(): void {
    if (this.container !== null) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy();
    }
    this.container = null;
    this.keySpot = null;
  }

  /** Zahodí klíč mimo ukazatel; `redraw` ukazatel nakreslí znovu s klíčem doma. */
  private destroyLooseKey(redraw = true): void {
    const key = this.looseKey;
    if (key === null) {
      return;
    }
    this.scene.tweens.killTweensOf(key.image);
    key.image.destroy();
    this.looseKey = null;
    if (redraw) {
      // Klíč je zpátky v ukazateli.
      this.drawIndicator();
    }
  }

  /** Klíč doletěl: zavolá, co čeká na dolet, a poskakuje, aby zval k ťuknutí. */
  private land(key: LooseKey): void {
    key.state = 'inLock';
    const onLanded = key.onLanded;
    key.onLanded = null;
    const style = KEY_IN_LOCK_STYLE;
    const scale = key.image.scale;
    const angle = style.inviteTurnAngle;
    // Poskočení a pootočení tam a zpět kolem hrotu, pořád dokola: napoví, že se klíčem otáčí.
    this.scene.tweens.chain({
      targets: key.image,
      loop: -1,
      loopDelay: style.invitePauseMs,
      tweens: [
        {
          scale: scale * style.invitePulseScale,
          duration: style.invitePulseMs,
          ease: 'Sine.easeInOut',
          yoyo: true,
        },
        { angle, duration: style.inviteTurnMs, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * style.inviteTurnMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: style.inviteTurnMs, ease: 'Sine.easeIn' },
      ],
    });
    onLanded?.();
  }

  /**
   * Klíč mimo ukazatel, a když ještě není, nový (v zámku na místě `target`,
   * odkud ho `sendKey` přesune do ukazatele); `null`, když nejde nakreslit.
   */
  private looseKeyFor(target: LayoutRect, cssScale: number): LooseKey | null {
    if (this.looseKey !== null && this.looseKey.state !== 'returning') {
      return this.looseKey;
    }
    this.destroyLooseKey();
    const side = target.width;
    if (side <= 0) {
      return null;
    }
    const texture = iconFileTexture(this.scene, KEY_ICON_FILE, side * cssScale);
    const image =
      texture === null
        ? this.scene.add
            .text(0, 0, KEY_SYMBOL, {
              fontSize: `${Math.round(side * KEY_INDICATOR_STYLE.fallbackSymbolShare)}px`,
            })
            .setOrigin(KEY_IN_LOCK.tipShare, 0.5)
        : this.scene.add.image(0, 0, texture).setOrigin(KEY_IN_LOCK.tipShare, 0.5);
    const unitSide = image.width;
    const end = tipOf(target);
    image
      .setPosition(end.x, end.y)
      .setScale(side / unitSide)
      .setDepth(this.depth + 1);
    this.looseKey = { image, unitSide, state: 'inLock', onLanded: null };
    return this.looseKey;
  }

  /** Zlatý klíč se stranou `side`; bez obrázku emoji. */
  private goldKey(
    side: number,
    cssScale: number,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
    const key = iconFileTexture(this.scene, KEY_ICON_FILE, side * cssScale);
    if (key === null) {
      return this.fallbackKey(side, 1);
    }
    return this.scene.add.image(0, 0, key).setDisplaySize(side, side);
  }

  /**
   * Šedý obrys celého klíče se stranou `side`, při půlce (`withHead`) se
   * zlatou hlavou pod obrysem; bez obrázku průhledné emoji.
   */
  private outlineKey(
    side: number,
    cssScale: number,
    withHead: boolean,
  ): (Phaser.GameObjects.Image | Phaser.GameObjects.Text)[] {
    const sideCss = side * cssScale;
    const outline = iconVariantTexture(
      this.scene,
      KEY_ICON_FILE,
      sideCss,
      'outline',
      KEY_INDICATOR_STYLE.outlineColor,
    );
    const head = withHead ? iconFileTexture(this.scene, KEY_HEAD_ICON_FILE, sideCss) : null;
    if (outline === null) {
      return [this.fallbackKey(side, KEY_INDICATOR_STYLE.emptyFallbackAlpha)];
    }
    const parts: Phaser.GameObjects.Image[] = [];
    if (head !== null) {
      parts.push(this.scene.add.image(0, 0, head).setDisplaySize(side, side));
    }
    parts.push(this.scene.add.image(0, 0, outline).setDisplaySize(side, side));
    return parts;
  }

  /** Klíč jako emoji se stranou `side` a průhledností `alpha`. */
  private fallbackKey(side: number, alpha: number): Phaser.GameObjects.Text {
    return this.scene.add
      .text(0, 0, KEY_SYMBOL, {
        fontSize: `${Math.round(side * KEY_INDICATOR_STYLE.fallbackSymbolShare)}px`,
      })
      .setOrigin(0.5)
      .setAlpha(alpha);
  }
}

/** Hrot klíče v klíčové dírce: bod otáčení klíče v zámku `target`. */
function tipOf(target: LayoutRect): { readonly x: number; readonly y: number } {
  return {
    x: target.left + target.width * KEY_IN_LOCK.tipShare,
    y: target.top + target.height / 2,
  };
}
