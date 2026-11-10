import Phaser from 'phaser';

import { createTonePlayer } from '../../shared/audio/tonePlayer';
import { isSharedAudioUnlocked, sharedToneContext } from '../../shared/audio/sharedAudio';
import type { Tone } from '../../shared/audio/tonePlayer';
import { FONT_FAMILY, colorNumber } from '../../shared/logic/theme';
import type { Menu, MenuFeedback } from '../logic/menu';
import type {
  MenuBox,
  MenuCategoryPicker,
  MenuLanguagePanel,
  MenuLayout,
} from '../logic/menuLayout';
import { MENU_SOUNDS, menuSoundFor } from '../logic/menuSounds';
import type { MenuTouch, TouchPoint } from '../logic/menuTouch';
import { MENU_STYLE, PLACEHOLDER_BORDER_WIDTH } from '../logic/menuTheme';
import {
  LANGUAGE_PANEL_SHADOW,
  languageButtonArt,
  languageCardArt,
  languageRowArt,
} from './languageArt';
import { categoryButtonArt, categoryRowArt } from './categoryPickerArt';

/** Herní jednotky na 1 CSS px: plátno menu má dvojnásobné rozlišení okna. */
export const MENU_UNITS_PER_CSS_PX = 2;

/** Klíč scény menu ve hře Phaseru. */
export const MENU_SCENE_KEY = 'menu';

/** Symbol zástupného tlačítka (není to text jazyka). */
const PLACEHOLDER_SYMBOL = '…';
const PLACEHOLDER_DASHES = 14;
/** Barevné kolečko profilu je 48 px v bílém kolečku 64 px (obrázek palety, #71). */
const PROFILE_COLOR_INSET = 8;

const PRESS = { scale: 0.94, durationMs: 70 };
/** Zmáčknutí hned po dotyku prstem, ještě před zvednutím (#69). */
const HELD_SCALE = 0.97;
const PULSE = { scale: 1.05, durationMs: 450 };
const SHAKE = { distance: 10, durationMs: 50, repeat: 3 };
const WOBBLE = { angle: 6, durationMs: 90 };
/** Široká pilulka kategorie se zhoupne méně, aby nesahala k sousední. */
const CATEGORY_WOBBLE_ANGLE = 2.5;

export interface MenuSceneHost {
  readonly menu: Menu;
  /** Dotyky prstem: posouvání a ťuknutí (#69). */
  readonly touch: MenuTouch;
  /** Rozložení pro současné okno a obsah menu. */
  layout(): MenuLayout;
  /** Po každém zvednutí prstu. */
  onTapped(): void;
}

/** Prvek menu, který se dá zmáčknout, zhoupnout nebo zatřást. */
interface Tappable {
  readonly container: Phaser.GameObjects.Container;
  readonly homeX: number;
}

/**
 * Scéna menu (#67): kreslí rozložení z `menuLayout.ts` a dotyky prstů
 * předává logice dotyků (`menuTouch.ts`), která posouvá a ťuká (#69).
 * Odezvu, kterou logika menu ohlásí, zahraje jako animaci a zvuk.
 * Souřadnice z rozložení jsou CSS px okna, plátno má
 * `MENU_UNITS_PER_CSS_PX` jednotek na CSS px.
 *
 * Mřížka a kategorie mají každá svou kameru s výřezem podle viditelné
 * plochy z rozložení. Posun je jen posun kamery, nic se nepřekresluje,
 * takže posouvání zůstane plynulé.
 *
 * Nabídka jazyků (#70) má dvě kamery přidané až po mřížce, aby ležela nad
 * ní: jedna kreslí kartu panelu, druhá posouvaný seznam jazyků. Otevření
 * a zavření nabídky překreslí jen ji, výběr jiného jazyka celé menu.
 *
 * Výběr kategorie (#95, telefon na výšku) má tlačítko v liště a seznam
 * kategorií stejně jako nabídka jazyků ve dvou kamerách nad mřížkou
 * (karta a posouvané řádky). Otevření a zavření seznamu překreslí jen
 * tlačítko a seznam, výběr jiné kategorie celé menu.
 */
export class MenuScene extends Phaser.Scene {
  private readonly sounds = createTonePlayer(sharedToneContext);
  private tiles = new Map<string, Tappable>();
  private categories = new Map<string, Tappable>();
  private placeholders: Tappable[] = [];
  private languageButton: Tappable | undefined;
  private profileBadge: Tappable | undefined;
  private languageRows = new Map<string, Tappable>();
  private categoryRows = new Map<string, Tappable>();
  private categoryButton: Tappable | undefined;
  private drawn: Phaser.GameObjects.GameObject[] = [];
  /** Nakreslená nabídka jazyků; překresluje se zvlášť od zbytku menu. */
  private drawnPanel: Phaser.GameObjects.GameObject[] = [];
  /** Nakreslený výběr kategorie (tlačítko a seznam); překresluje se zvlášť (#95). */
  private drawnPicker: Phaser.GameObjects.GameObject[] = [];
  /** Vrstvy: lišta (hlavní kamera), kategorie a mřížka (každá svou kamerou). */
  private barLayer!: Phaser.GameObjects.Container;
  private categoryLayer!: Phaser.GameObjects.Container;
  private tileLayer!: Phaser.GameObjects.Container;
  private panelLayer!: Phaser.GameObjects.Container;
  private languageLayer!: Phaser.GameObjects.Container;
  private pickerPanelLayer!: Phaser.GameObjects.Container;
  private pickerListLayer!: Phaser.GameObjects.Container;
  private categoryCamera!: Phaser.Cameras.Scene2D.Camera;
  private gridCamera!: Phaser.Cameras.Scene2D.Camera;
  private panelCamera!: Phaser.Cameras.Scene2D.Camera;
  private languageCamera!: Phaser.Cameras.Scene2D.Camera;
  private pickerPanelCamera!: Phaser.Cameras.Scene2D.Camera;
  private pickerListCamera!: Phaser.Cameras.Scene2D.Camera;
  private layout: MenuLayout | undefined;
  /** Dlaždice nebo kategorie, která je teď nakreslená jako zmáčknutá. */
  private held: Tappable | undefined;
  /** Překreslí se až v dalším snímku, ne uprostřed zpracování ťuknutí. */
  private redrawWanted = false;
  /** Nabídka jazyků se otevřela nebo zavřela: překreslí se v dalším snímku. */
  private panelRedrawWanted = false;
  /** Seznam kategorií se otevřel nebo zavřel: překreslí se v dalším snímku (#95). */
  private pickerRedrawWanted = false;
  /** Kategorie vybraná při posledním kreslení. */
  private drawnSelection: string | undefined;

  constructor(private readonly host: MenuSceneHost) {
    super(MENU_SCENE_KEY);
  }

  create(): void {
    // Druhý prst Phaser ohlásí taky; logika dotyků ho ignoruje (#69 AC2).
    this.input.addPointer(1);
    this.barLayer = this.add.container(0, 0);
    this.categoryLayer = this.add.container(0, 0);
    this.tileLayer = this.add.container(0, 0);
    this.panelLayer = this.add.container(0, 0);
    this.languageLayer = this.add.container(0, 0);
    this.pickerPanelLayer = this.add.container(0, 0);
    this.pickerListLayer = this.add.container(0, 0);
    const layers = [
      this.barLayer,
      this.categoryLayer,
      this.tileLayer,
      this.panelLayer,
      this.languageLayer,
      this.pickerPanelLayer,
      this.pickerListLayer,
    ];
    const onlyLayer = (camera: Phaser.Cameras.Scene2D.Camera, shown: unknown): void => {
      camera.ignore(layers.filter((layer) => layer !== shown));
    };
    onlyLayer(this.cameras.main, this.barLayer);
    this.categoryCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.categoryCamera, this.categoryLayer);
    this.gridCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.gridCamera, this.tileLayer);
    // Nabídka jazyků až po mřížce, aby ležela nad ní.
    this.panelCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.panelCamera, this.panelLayer);
    this.languageCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.languageCamera, this.languageLayer);
    // Seznam kategorií (#95) také nad mřížkou.
    this.pickerPanelCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.pickerPanelCamera, this.pickerPanelLayer);
    this.pickerListCamera = this.cameras.add(0, 0, 1, 1);
    onlyLayer(this.pickerListCamera, this.pickerListLayer);
    this.listenToFingers();
    this.redraw();
  }

  override update(): void {
    this.host.touch.frame(performance.now());
    if (this.redrawWanted) {
      this.redrawWanted = false;
      this.panelRedrawWanted = false;
      this.pickerRedrawWanted = false;
      this.redraw();
    } else {
      if (this.panelRedrawWanted) {
        this.panelRedrawWanted = false;
        this.redrawLanguagePanel();
      }
      if (this.pickerRedrawWanted) {
        this.pickerRedrawWanted = false;
        this.redrawCategoryPicker();
      }
    }
    this.scrollCameras();
    this.showHeld();
  }

  /**
   * Dlaždice nebo kategorie pod prstem se hned po dotyku lehce zmenší.
   * Po tahu nebo zvednutí prstu se vrátí, pokud ji zrovna nehýbe animace
   * odezvy (zmáčknutí po ťuknutí, pulzování, zatřesení).
   */
  private showHeld(): void {
    const target = this.host.touch.pressed();
    let item: Tappable | undefined;
    if (target?.kind === 'tile') {
      item = this.tiles.get(target.gameId);
    } else if (target?.kind === 'category') {
      item = this.categories.get(target.categoryId);
    } else if (target?.kind === 'language') {
      item = this.languageRows.get(target.language);
    } else if (target?.kind === 'categoryRow') {
      item = this.categoryRows.get(target.categoryId);
    }
    if (item === this.held) {
      return;
    }
    const released = this.held;
    if (released !== undefined && !this.tweens.isTweening(released.container)) {
      released.container.setScale(1);
    }
    if (item !== undefined && !this.tweens.isTweening(item.container)) {
      item.container.setScale(HELD_SCALE);
    }
    this.held = item;
  }

  /** Dotyky prstů v CSS px okna jdou do logiky dotyků. */
  private listenToFingers(): void {
    const pointOf = (pointer: Phaser.Input.Pointer): TouchPoint => ({
      x: pointer.x / MENU_UNITS_PER_CSS_PX,
      y: pointer.y / MENU_UNITS_PER_CSS_PX,
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.host.touch.pointerDown(pointer.id, pointOf(pointer), performance.now());
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.host.touch.pointerMove(pointer.id, pointOf(pointer), performance.now());
    });
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.wasCanceled) {
        this.host.touch.pointerCancel(pointer.id);
        return;
      }
      this.host.touch.pointerUp(pointer.id, pointOf(pointer), performance.now());
      this.host.onTapped();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  /** Kamery mřížky a kategorií ukážou obsah posunutý podle logiky dotyků. */
  private scrollCameras(): void {
    const layout = this.layout;
    if (layout === undefined) {
      return;
    }
    const unit = MENU_UNITS_PER_CSS_PX;
    const grid = layout.gridScroll.clip;
    // Kamera začíná na zaokrouhleném rohu ořezu (`fitCamera`), posun je v CSS px.
    this.gridCamera.setScroll(
      Math.round(grid.left * unit),
      Math.round(grid.top * unit) + this.host.touch.gridOffset() * unit,
    );
    const categories = layout.categoryScroll.clip;
    const offset = this.host.touch.categoryOffset();
    const left = Math.round(categories.left * unit);
    const top = Math.round(categories.top * unit);
    if (layout.categoryDirection === 'row') {
      this.categoryCamera.setScroll(left + offset * unit, top);
    } else {
      this.categoryCamera.setScroll(left, top + offset * unit);
    }
    const languages = layout.languagePanel.list.clip;
    this.languageCamera.setScroll(
      Math.round(languages.left * unit),
      Math.round(languages.top * unit) + this.host.touch.languageOffset() * unit,
    );
    const picker = layout.categoryPicker;
    if (picker !== null) {
      this.pickerListCamera.setScroll(
        Math.round(picker.list.clip.left * unit),
        Math.round(picker.list.clip.top * unit) + this.host.touch.categoryListOffset() * unit,
      );
    }
  }

  /** Kamera kreslí jen do plochy ořezu (rozšířené o `margin` px), obsah mimo ni ořízne. */
  private fitCamera(camera: Phaser.Cameras.Scene2D.Camera, clip: MenuBox, margin = 0): void {
    const unit = MENU_UNITS_PER_CSS_PX;
    camera.setViewport(
      Math.round((clip.left - margin) * unit),
      Math.round((clip.top - margin) * unit),
      Math.round((clip.right - clip.left + 2 * margin) * unit),
      Math.round((clip.bottom - clip.top + 2 * margin) * unit),
    );
    camera.setScroll(
      Math.round((clip.left - margin) * unit),
      Math.round((clip.top - margin) * unit),
    );
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
    this.held = undefined;
    this.tiles = new Map();
    this.categories = new Map();
    this.placeholders = [];
    this.profileBadge = undefined;
    this.drawnSelection = this.selectedCategoryId();

    const layout = this.host.layout();
    this.layout = layout;
    this.host.touch.setLayout(layout);
    this.fitCamera(this.gridCamera, layout.gridScroll.clip);
    this.fitCamera(this.categoryCamera, layout.categoryScroll.clip);
    this.fitCamera(this.panelCamera, layout.languagePanel.panel, LANGUAGE_PANEL_SHADOW);
    this.fitCamera(this.languageCamera, layout.languagePanel.list.clip);
    if (layout.categoryPicker !== null) {
      this.fitCamera(this.pickerPanelCamera, layout.categoryPicker.panel, LANGUAGE_PANEL_SHADOW);
      this.fitCamera(this.pickerListCamera, layout.categoryPicker.list.clip);
    }
    this.drawProfileBadge(layout);
    this.drawLanguageButton(layout, layout.languageSlot);
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
    this.redrawLanguagePanel();
    this.redrawCategoryPicker();
  }

  /** Zahraje odezvu, kterou ohlásila logika menu: tón podle `menuSoundFor` a animaci. */
  play(event: MenuFeedback): void {
    const sound = menuSoundFor(event);
    if (sound !== undefined) {
      this.playSound(MENU_SOUNDS[sound]);
    }
    switch (event.kind) {
      case 'press':
        this.press(this.tiles.get(event.gameId));
        break;
      case 'pulse':
        this.pulse(this.tiles.get(event.gameId));
        break;
      case 'stopPulse':
        this.settle(this.tiles.get(event.gameId));
        break;
      case 'shake':
        this.shake(this.tiles.get(event.gameId));
        break;
      case 'select':
        break;
      case 'languageMenu':
        this.press(this.languageButton);
        this.panelRedrawWanted = true;
        break;
      case 'categoryMenu':
        // Šipka, okraj tlačítka a seznam se překreslí v dalším snímku.
        this.pickerRedrawWanted = true;
        break;
      case 'profilePress':
        this.press(this.profileBadge);
        break;
      case 'language':
        // Texty menu jsou teď v novém jazyce.
        this.requestRedraw();
        break;
      case 'wobble':
        if (event.target.kind === 'placeholder') {
          this.wobble(this.placeholders[event.target.index], WOBBLE.angle);
        } else if (event.target.kind === 'category') {
          this.wobble(this.categories.get(event.target.categoryId), CATEGORY_WOBBLE_ANGLE);
        }
        // Už vybraná kategorie v seznamu (#95) jen zazní, nic se nehoupe.
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

  /**
   * Kontejner uprostřed obdélníku ve vrstvě. Ťuknutí na něj pozná logika
   * dotyků podle rozložení, kontejner sám dotyky nepřijímá.
   */
  private tappable(box: MenuBox, layer: Phaser.GameObjects.Container): Tappable {
    const x = ((box.left + box.right) / 2) * MENU_UNITS_PER_CSS_PX;
    const y = ((box.top + box.bottom) / 2) * MENU_UNITS_PER_CSS_PX;
    const container = this.add.container(x, y);
    layer.add(container);
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

  /** Bílý podklad se stínem jako tlačítko jazyka: kolečko, nebo pilulka s přezdívkou. */
  private drawProfileBackground(width: number, height: number): Phaser.GameObjects.Graphics {
    const unit = MENU_UNITS_PER_CSS_PX;
    const radius = height / 2;
    const background = this.add.graphics();
    for (const spread of [3, 1]) {
      background
        .fillStyle(0x000000, MENU_STYLE.languageButtonShadowAlpha)
        .fillRoundedRect(
          -width / 2 - spread * unit,
          -height / 2 - spread * unit + 1.5 * unit,
          width + 2 * spread * unit,
          height + 2 * spread * unit,
          radius + spread * unit,
        );
    }
    background
      .fillStyle(colorNumber(MENU_STYLE.profileBackground), 1)
      .fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    return background;
  }

  /**
   * Kolečko aktivního profilu (obrázek B, #71): v bílém podkladu barevné
   * kolečko s bílým tučným písmenem (bez přezdívky ★), vedle přezdívka.
   */
  private drawProfileBadge(layout: MenuLayout): void {
    const badge = this.host.menu.profileBadge();
    const { circle, label } = layout.profileBadge;
    const area: MenuBox =
      label === null ? circle : { ...circle, right: label.right, bottom: label.bottom };
    const item = this.tappable(area, this.barLayer);
    const unit = MENU_UNITS_PER_CSS_PX;
    const width = (area.right - area.left) * unit;
    const height = (area.bottom - area.top) * unit;
    const background = this.drawProfileBackground(width, height);

    const circleX = ((circle.left + circle.right) / 2 - (area.left + area.right) / 2) * unit;
    const circleY = ((circle.top + circle.bottom) / 2 - (area.top + area.bottom) / 2) * unit;
    const colorRadius = ((circle.right - circle.left) / 2 - PROFILE_COLOR_INSET) * unit;
    const colored = this.add.graphics();
    colored.fillStyle(colorNumber(badge.color), 1).fillCircle(circleX, circleY, colorRadius);
    const symbol = this.text(
      badge.symbol,
      layout.profileBadge.symbolFontSize,
      MENU_STYLE.profileSymbol,
      'bold',
    ).setOrigin(0.5);
    symbol.setPosition(circleX, circleY);
    item.container.add([background, colored, symbol]);

    if (label !== null && badge.nickname !== null) {
      const nickname = this.text(
        badge.nickname,
        layout.profileBadge.labelFontSize,
        MENU_STYLE.profileNickname,
      ).setOrigin(0, 0.5);
      nickname.x =
        (label.left - (area.left + area.right) / 2 + layout.profileBadge.labelInset) * unit;
      // Odhad šířky (#65) počítá 0,6 písma na znak, široká písmena (W) jsou
      // ale širší. Přezdívka, která se skutečně nevejde, se zmenší. Vpravo
      // zůstane místo aspoň na poloměr pilulky, aby text nesahal do oblouku.
      const rightInset = (area.bottom - area.top) / 2;
      const available =
        (label.right - label.left - layout.profileBadge.labelInset - rightInset) * unit;
      if (nickname.width > available) {
        nickname.setScale(available / nickname.width);
      }
      item.container.add(nickname);
    }
    this.profileBadge = item;
  }

  /** Plné bílé kolečko se stínem a zkratkou jazyka (obrázek B, #70). */
  private drawLanguageButton(layout: MenuLayout, box: MenuBox): void {
    const item = this.tappable(box, this.barLayer);
    item.container.add(
      languageButtonArt(
        this,
        box,
        this.host.menu.languageButtonLabel(),
        layout.languageButtonFontSize,
        MENU_UNITS_PER_CSS_PX,
      ),
    );
    this.languageButton = item;
  }

  /** Nabídka jazyků podle logiky menu: otevřená se nakreslí, zavřená nic. */
  private redrawLanguagePanel(): void {
    for (const object of this.drawnPanel) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.drawnPanel = [];
    if (this.held !== undefined && [...this.languageRows.values()].includes(this.held)) {
      this.held = undefined;
    }
    this.languageRows = new Map();
    const open = this.host.menu.isLanguageMenuOpen();
    this.panelCamera.setVisible(open);
    this.languageCamera.setVisible(open);
    const layout = this.layout;
    if (!open || layout === undefined) {
      return;
    }
    this.drawLanguageCard(layout.languagePanel.panel);
    const languages = this.host.menu.languages();
    languages.forEach((language, index) => {
      const row = layout.languagePanel.rows[index];
      if (row !== undefined) {
        this.drawLanguageRow(layout.languagePanel, row, language);
      }
    });
  }

  /**
   * Výběr kategorie podle logiky menu (#95): tlačítko se šipkou ▾ nebo ▴
   * a otevřený seznam kategorií. Bez výběru (sloupec kategorií) nic.
   */
  private redrawCategoryPicker(): void {
    for (const object of this.drawnPicker) {
      this.tweens.killTweensOf(object);
      object.destroy();
    }
    this.drawnPicker = [];
    if (
      this.held !== undefined &&
      (this.held === this.categoryButton || [...this.categoryRows.values()].includes(this.held))
    ) {
      this.held = undefined;
    }
    this.categoryRows = new Map();
    this.categoryButton = undefined;
    const picker = this.layout?.categoryPicker ?? null;
    const open = picker !== null && this.host.menu.isCategoryMenuOpen();
    this.pickerPanelCamera.setVisible(open);
    this.pickerListCamera.setVisible(open);
    if (picker === null) {
      return;
    }
    this.drawCategoryButton(picker, open);
    if (!open) {
      return;
    }
    const card = languageCardArt(this, picker.panel, MENU_UNITS_PER_CSS_PX);
    this.pickerPanelLayer.add(card);
    this.drawnPicker.push(card);
    this.host.menu.categories().forEach((category, index) => {
      const row = picker.rows[index];
      if (row === undefined) {
        return;
      }
      const container = this.pickerContainer(row, this.pickerListLayer);
      container.add(categoryRowArt(this, picker, row, category, MENU_UNITS_PER_CSS_PX));
      this.categoryRows.set(category.id, { container, homeX: container.x });
    });
  }

  private drawCategoryButton(picker: MenuCategoryPicker, open: boolean): void {
    const container = this.pickerContainer(picker.buttonDrawn, this.barLayer);
    container.add(
      categoryButtonArt(this, picker, this.host.menu.categoryButton(), open, MENU_UNITS_PER_CSS_PX),
    );
    this.categoryButton = { container, homeX: container.x };
  }

  /** Kontejner výběru kategorie uprostřed obdélníku; maže se s výběrem. */
  private pickerContainer(
    box: MenuBox,
    layer: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Container {
    const unit = MENU_UNITS_PER_CSS_PX;
    const container = this.add.container(
      ((box.left + box.right) / 2) * unit,
      ((box.top + box.bottom) / 2) * unit,
    );
    layer.add(container);
    this.drawnPicker.push(container);
    return container;
  }

  private drawLanguageCard(panel: MenuBox): void {
    const card = languageCardArt(this, panel, MENU_UNITS_PER_CSS_PX);
    this.panelLayer.add(card);
    this.drawnPanel.push(card);
  }

  private drawLanguageRow(
    panel: MenuLanguagePanel,
    row: MenuBox,
    language: { code: string; name: string; selected: boolean },
  ): void {
    const unit = MENU_UNITS_PER_CSS_PX;
    const x = ((row.left + row.right) / 2) * unit;
    const y = ((row.top + row.bottom) / 2) * unit;
    const container = this.add.container(x, y);
    this.languageLayer.add(container);
    this.drawnPanel.push(container);
    container.add(languageRowArt(this, panel, row, language, unit));
    this.languageRows.set(language.code, { container, homeX: x });
  }

  private drawPlaceholder(layout: MenuLayout, box: MenuBox, index: number): void {
    const item = this.tappable(box, this.barLayer);
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
    const item = this.tappable(hit, this.categoryLayer);
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
    const item = this.tappable(box, this.tileLayer);
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
