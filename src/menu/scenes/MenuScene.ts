import Phaser from 'phaser';

import { createTonePlayer } from '../../shared/audio/tonePlayer';
import { isSharedAudioUnlocked, sharedToneContext } from '../../shared/audio/sharedAudio';
import type { Tone } from '../../shared/audio/tonePlayer';
import { FONT_FAMILY, colorNumber } from '../../shared/logic/theme';
import type { Menu, MenuFeedback } from '../logic/menu';
import type { MenuBox, MenuLayout } from '../logic/menuLayout';
import { MENU_SOUNDS } from '../logic/menuSounds';
import { MENU_STYLE, PLACEHOLDER_BORDER_WIDTH } from '../logic/menuTheme';

/** Herní jednotky na 1 CSS px: plátno menu má dvojnásobné rozlišení okna. */
export const MENU_UNITS_PER_CSS_PX = 2;

/** Symbol zástupného tlačítka (není to text jazyka). */
const PLACEHOLDER_SYMBOL = '…';
const PLACEHOLDER_DASHES = 14;

const PRESS = { scale: 0.94, durationMs: 70 };
const PULSE = { scale: 1.05, durationMs: 450 };
const SHAKE = { distance: 10, durationMs: 50, repeat: 3 };
const WOBBLE = { angle: 6, durationMs: 90 };
/** Široká pilulka kategorie se zhoupne méně, aby nesahala k sousední. */
const CATEGORY_WOBBLE_ANGLE = 2.5;

export interface MenuSceneHost {
  readonly menu: Menu;
  /** Rozložení pro současné okno a obsah menu. */
  layout(): MenuLayout;
  /** Po každém ťuknutí. */
  onTapped(): void;
}

/** Prvek menu, který se dá zmáčknout, zhoupnout nebo zatřást. */
interface Tappable {
  readonly container: Phaser.GameObjects.Container;
  readonly homeX: number;
}

/**
 * Scéna menu (#67): kreslí rozložení z `menuLayout.ts` a ťuknutí předává
 * logice menu (`menu.ts`). Odezvu, kterou logika ohlásí, zahraje jako
 * animaci a zvuk. Souřadnice z rozložení jsou CSS px okna, plátno má
 * `MENU_UNITS_PER_CSS_PX` jednotek na CSS px.
 */
export class MenuScene extends Phaser.Scene {
  private readonly sounds = createTonePlayer(sharedToneContext);
  private tiles = new Map<string, Tappable>();
  private categories = new Map<string, Tappable>();
  private placeholders: Tappable[] = [];
  private drawn: Phaser.GameObjects.GameObject[] = [];
  /** Překreslí se až v dalším snímku, ne uprostřed zpracování ťuknutí. */
  private redrawWanted = false;
  /** Kategorie vybraná při posledním kreslení. */
  private drawnSelection: string | undefined;

  constructor(private readonly host: MenuSceneHost) {
    super('menu');
  }

  create(): void {
    this.redraw();
  }

  override update(): void {
    if (this.redrawWanted) {
      this.redrawWanted = false;
      this.redraw();
    }
  }

  /** Menu se nakreslí znovu v dalším snímku (po změně kategorie, otočení nebo změně okna). */
  requestRedraw(): void {
    this.redrawWanted = true;
  }

  /** Po ťuknutí: nová kategorie překreslí mřížku, jinak animace dohrají. */
  redrawIfSelectionChanged(): void {
    if (this.selectedCategoryId() !== this.drawnSelection) {
      this.requestRedraw();
    }
  }

  private selectedCategoryId(): string | undefined {
    return this.host.menu.categories().find((category) => category.selected)?.id;
  }

  private redraw(): void {
    for (const object of this.drawn) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.drawn = [];
    this.tiles = new Map();
    this.categories = new Map();
    this.placeholders = [];
    this.drawnSelection = this.selectedCategoryId();

    const layout = this.host.layout();
    layout.placeholders.forEach((box, index) => this.drawPlaceholder(layout, box, index));
    const categories = this.host.menu.categories();
    categories.forEach((category, index) => {
      const slot = layout.categories[index];
      if (slot !== undefined) {
        this.drawCategory(layout, slot.hit, slot.pill, category);
      }
    });
    const tiles = this.host.menu.tiles();
    tiles.forEach((tile, index) => {
      const box = layout.tiles[index];
      if (box !== undefined) {
        this.drawTile(layout, box, tile.gameId, tile.symbol, tile.title);
      }
    });
  }

  /** Zahraje odezvu, kterou ohlásila logika menu. */
  play(event: MenuFeedback): void {
    switch (event.kind) {
      case 'press':
        this.playSound(MENU_SOUNDS.press);
        this.press(this.tiles.get(event.gameId));
        break;
      case 'pulse':
        this.pulse(this.tiles.get(event.gameId));
        break;
      case 'stopPulse':
        this.settle(this.tiles.get(event.gameId));
        break;
      case 'shake':
        this.playSound(MENU_SOUNDS.shake);
        this.shake(this.tiles.get(event.gameId));
        break;
      case 'select':
        this.playSound(MENU_SOUNDS.select);
        break;
      case 'wobble':
        this.playSound(MENU_SOUNDS.wobble);
        if (event.target.kind === 'placeholder') {
          this.wobble(this.placeholders[event.target.index], WOBBLE.angle);
        } else {
          this.wobble(this.categories.get(event.target.categoryId), CATEGORY_WOBBLE_ANGLE);
        }
        break;
    }
  }

  /**
   * Tón jen s odemčeným zvukem. Safari by jinak pokus o zapnutí zvuku při
   * dotyku prstu (ještě před zvednutím) mohl odmítnout a přehrávač by zvuk
   * vypnul natrvalo. Bez odemčení první ťuknutí zůstane potichu.
   */
  private playSound(tones: readonly Tone[]): void {
    if (isSharedAudioUnlocked()) {
      this.sounds.play(tones);
    }
  }

  // ---------------------------------------------------------------------------
  // Kreslení
  // ---------------------------------------------------------------------------

  /** Kontejner uprostřed obdélníku, ťukací plocha je celý obdélník. */
  private tappable(box: MenuBox, onTap: () => void): Tappable {
    const width = (box.right - box.left) * MENU_UNITS_PER_CSS_PX;
    const height = (box.bottom - box.top) * MENU_UNITS_PER_CSS_PX;
    const x = ((box.left + box.right) / 2) * MENU_UNITS_PER_CSS_PX;
    const y = ((box.top + box.bottom) / 2) * MENU_UNITS_PER_CSS_PX;
    const container = this.add.container(x, y);
    container.setSize(width, height).setInteractive();
    container.on('pointerdown', () => {
      onTap();
      this.host.onTapped();
    });
    this.drawn.push(container);
    return { container, homeX: x };
  }

  private text(
    content: string,
    fontSizeCss: number,
    color: string,
    fontStyle = 'normal',
  ): Phaser.GameObjects.Text {
    return this.add.text(0, 0, content, {
      fontFamily: FONT_FAMILY,
      fontSize: `${fontSizeCss * MENU_UNITS_PER_CSS_PX}px`,
      fontStyle,
      color,
    });
  }

  private drawPlaceholder(layout: MenuLayout, box: MenuBox, index: number): void {
    const item = this.tappable(box, () => this.host.menu.tapPlaceholder(index));
    const radius = ((box.right - box.left) / 2) * MENU_UNITS_PER_CSS_PX;
    const border = PLACEHOLDER_BORDER_WIDTH * MENU_UNITS_PER_CSS_PX;
    const ring = this.add.graphics();
    ring.lineStyle(border, colorNumber(MENU_STYLE.placeholderBorder), 1);
    // Čárkovaný kruh: střídají se stejně dlouhé čárky a mezery.
    const step = (2 * Math.PI) / PLACEHOLDER_DASHES;
    for (let dash = 0; dash < PLACEHOLDER_DASHES; dash += 1) {
      ring.beginPath();
      ring.arc(0, 0, radius - border / 2, dash * step, dash * step + step / 2);
      ring.strokePath();
    }
    const symbol = this.text(
      PLACEHOLDER_SYMBOL,
      layout.placeholderFontSize,
      MENU_STYLE.placeholderSymbol,
    ).setOrigin(0.5);
    item.container.add([ring, symbol]);
    this.placeholders[index] = item;
  }

  private drawCategory(
    layout: MenuLayout,
    hit: MenuBox,
    pill: MenuBox,
    category: { id: string; title: string; selected: boolean },
  ): void {
    const item = this.tappable(hit, () => this.host.menu.tapCategory(category.id));
    const width = (pill.right - pill.left) * MENU_UNITS_PER_CSS_PX;
    const height = (pill.bottom - pill.top) * MENU_UNITS_PER_CSS_PX;
    const background = this.add.graphics();
    background
      .fillStyle(
        colorNumber(
          category.selected ? MENU_STYLE.selectedCategoryBackground : MENU_STYLE.categoryBackground,
        ),
        1,
      )
      .fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    const label = this.text(
      category.title,
      layout.categoryFontSize,
      category.selected ? MENU_STYLE.selectedCategoryText : MENU_STYLE.categoryText,
      category.selected ? '600' : 'normal',
    ).setOrigin(0, 0.5);
    label.x = -width / 2 + layout.categoryTextInset * MENU_UNITS_PER_CSS_PX;
    item.container.add([background, label]);
    this.categories.set(category.id, item);
  }

  private drawTile(
    layout: MenuLayout,
    box: MenuBox,
    gameId: string,
    symbolText: string,
    titleText: string,
  ): void {
    const item = this.tappable(box, () => this.host.menu.tapTile(gameId));
    const width = (box.right - box.left) * MENU_UNITS_PER_CSS_PX;
    const height = (box.bottom - box.top) * MENU_UNITS_PER_CSS_PX;
    const radius = layout.tileRadius * MENU_UNITS_PER_CSS_PX;
    const unit = MENU_UNITS_PER_CSS_PX;

    // Jemný stín: dvě větší průhledné plochy posunuté dolů.
    const shadow = this.add.graphics();
    for (const spread of [4, 1.5]) {
      shadow
        .fillStyle(0x000000, MENU_STYLE.tileShadowAlpha)
        .fillRoundedRect(
          -width / 2 - spread * unit,
          -height / 2 - spread * unit + 2 * unit,
          width + 2 * spread * unit,
          height + 2 * spread * unit,
          radius + spread * unit,
        );
    }
    const background = this.add.graphics();
    background
      .fillStyle(colorNumber(MENU_STYLE.tileBackground), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius);

    const symbol = this.text(
      symbolText,
      layout.tileSymbolFontSize,
      MENU_STYLE.tileSymbolColor,
      '300',
    ).setOrigin(0.5);
    const title = this.text(
      titleText,
      layout.tileTitleFontSize,
      MENU_STYLE.tileTitleColor,
    ).setOrigin(0.5);
    // Symbol nad názvem, oba dohromady uprostřed dlaždice.
    const gap = 6 * unit;
    const total = symbol.height + gap + title.height;
    symbol.y = -total / 2 + symbol.height / 2;
    title.y = total / 2 - title.height / 2;
    item.container.add([shadow, background, symbol, title]);
    this.tiles.set(gameId, item);
  }

  // ---------------------------------------------------------------------------
  // Odezva
  // ---------------------------------------------------------------------------

  private settle(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.tweens.killTweensOf(item.container);
    item.container.setScale(1).setAngle(0);
    item.container.x = item.homeX;
  }

  private press(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.settle(item);
    this.tweens.add({
      targets: item.container,
      scale: PRESS.scale,
      duration: PRESS.durationMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private pulse(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.settle(item);
    this.tweens.add({
      targets: item.container,
      scale: PULSE.scale,
      duration: PULSE.durationMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private shake(item: Tappable | undefined): void {
    if (item === undefined) {
      return;
    }
    this.settle(item);
    this.tweens.add({
      targets: item.container,
      x: item.homeX + SHAKE.distance * MENU_UNITS_PER_CSS_PX,
      duration: SHAKE.durationMs,
      yoyo: true,
      repeat: SHAKE.repeat,
      onComplete: () => {
        item.container.x = item.homeX;
      },
    });
  }

  /** Zhoupnutí: krátce na jednu stranu, na druhou a zpět. */
  private wobble(item: Tappable | undefined, angle: number): void {
    if (item === undefined) {
      return;
    }
    this.settle(item);
    this.tweens.chain({
      targets: item.container,
      tweens: [
        { angle, duration: WOBBLE.durationMs, ease: 'Sine.easeOut' },
        { angle: -angle, duration: 2 * WOBBLE.durationMs, ease: 'Sine.easeInOut' },
        { angle: 0, duration: WOBBLE.durationMs, ease: 'Sine.easeIn' },
      ],
    });
  }
}
