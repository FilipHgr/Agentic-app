/// <reference types="vite/client" />
/**
 * Phaser okno s pandou Rudym (#169): ztmavení přes celé okno, karta
 * s bílým okrajem a stínem jako karta mapy (#145) a uprostřed velká panda.
 * O všem rozhoduje logika: průběh okna a paměť `logic/rudyWindow.ts`,
 * rozložení `logic/rudyCard.ts`. Tady se jen kreslí, stahuje a ťuká.
 *
 * Během okna nereaguje nic pod ním: přes celou stránku leží průhledná
 * vrstva, která chytá všechny dotyky (i nad domečkem a kolečkem nastavení,
 * které jsou prvky stránky nad plátnem), takže se pod ní nezačne ani
 * podržení. Ťuknutí do vrstvy předá logice (zavře okno po 1 s). Domeček
 * a kolečko nastavení jsou během okna ztmavené stejně jako hra pod kartou
 * (#170), aby bylo vidět, že teď nereagují.
 *
 * Archy pohybů se stahují Phaser loaderem až při použití okna. Chyba
 * stažení se jen zapíše do konzole, hráč nic nevidí a hra jde dál.
 * Odchod stránky na pozadí okno zavře.
 */

import Phaser from 'phaser';

import rudyCelebrateUrl from '../mascot/rudy-celebrate.webp';
import rudyIdleUrl from '../mascot/rudy-idle.webp';
import rudyTalkUrl from '../mascot/rudy-talk.webp';
import rudyWaveUrl from '../mascot/rudy-wave.webp';

import type { PageBackdrop } from '../logic/gameHost';
import { RUDY_MOVES, RUDY_SHEET } from '../logic/rudy';
import type { RudyLineMove, RudyMove } from '../logic/rudy';
import { RUDY_CARD_STYLE, layoutRudyCard, rudyCardPageBackdrop } from '../logic/rudyCard';
import type { RudyRect } from '../logic/rudyCard';
import { dimPageButtons } from '../logic/rudyPageButtons';
import { createRudyWindowModel } from '../logic/rudyWindow';
import type { RudyCommand, RudyWindowModel } from '../logic/rudyWindow';
import { colorNumber } from '../logic/theme';
import { gameAreaFor } from '../logic/viewportLayout';
import type { GameArea } from '../logic/viewportLayout';
import { GAME_AREA_KEY, readViewport } from './viewport';

const SHEET_URLS: Readonly<Record<RudyMove, string>> = {
  idle: rudyIdleUrl,
  wave: rudyWaveUrl,
  celebrate: rudyCelebrateUrl,
  talk: rudyTalkUrl,
};

/** Vrstva proti dotykům je nad vším na stránce (domeček a kolečko mají 10). */
const TOUCH_SHIELD_Z_INDEX = '100';

/** Tlačítka stránky nad plátnem (domeček a kolečko), která okno ztmaví. */
const PAGE_BUTTON_IDS = ['home-button', 'settings-button'] as const;

function textureKey(move: RudyMove): string {
  return `rudy:${move}`;
}

function moveOfKey(key: string): RudyMove | null {
  return RUDY_MOVES.find((move) => textureKey(move) === key) ?? null;
}

function isGameArea(value: unknown): value is GameArea {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const area = value as Partial<GameArea>;
  return [area.width, area.height, area.scale, area.offsetX, area.offsetY].every(
    (each) => typeof each === 'number' && Number.isFinite(each),
  );
}

export interface RudyWindowOptions {
  /** Hloubka okna ve scéně (výchozí 1000, nad vším ve hře). */
  readonly depth?: number;
  /** Kontejner, do kterého se okno přidá (výchozí scéna), např. vrstva menu. */
  readonly layer?: Phaser.GameObjects.Container;
  /**
   * Pozadí stránky kolem plátna: během okna ztmavené jako hra, po zavření
   * `null` (výchozí). Hra sem dá `setPageBackdrop` hostitele.
   */
  readonly pageBackdrop?: (backdrop: PageBackdrop | null) => void;
  /**
   * Herní plocha plátna v CSS px (výchozí plocha hry z registru). Menu má
   * plátno přes celé okno s vlastním měřítkem.
   */
  readonly gameArea?: () => GameArea;
}

export interface RudyOpenOptions {
  /** Pohyb repliky: pozdrav nebo oslava. */
  readonly move: RudyLineMove;
  /** Délka repliky (nahrávky) v ms; bez ní je okno otevřené 3,5 s. */
  readonly lineMs?: number;
  /** Okno se zavřelo (samo, ťuknutím, zvenku), nebo se vůbec neukázalo. */
  readonly onClosed?: () => void;
}

/** Nakreslené části otevřeného okna. */
interface Drawn {
  readonly dim: Phaser.GameObjects.Graphics;
  /** Plocha přes celé plátno pod kartou: ťuknutí na plátně nedostane nic pod oknem. */
  readonly blocker: Phaser.GameObjects.Zone;
  /** Karta s pandou, střed v počátku: zhoupne se kolem středu karty. */
  readonly card: Phaser.GameObjects.Container;
  readonly panda: Phaser.GameObjects.Image;
}

/** Prst nebo myš, které jsou právě dole, a prvek stránky, na kterém začaly. */
interface PressedPointer {
  readonly pointerId: number;
  readonly target: EventTarget | null;
}

/** Zhoupnutí karty po ťuknutí v první 1 s (AC4): úhel ve stupních a délka půlkmitu. */
const CARD_WOBBLE = { angle: 3, halfSwingMs: 70, swings: 2 } as const;

/** Vrstva proti dotykům zůstane nejvýš takhle dlouho po zavření, než se zvedne prst. */
const SHIELD_LINGER_MAX_MS = 1000;

/** Dotykové a myší události, které vrstva pohltí, aby je nedostal Phaser ani stránka. */
const SWALLOWED_EVENTS = [
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'mousedown',
  'mouseup',
  'click',
  'contextmenu',
] as const;

/** Sdílené okno s pandou Rudym ve scéně. Po konci scény se samo uklidí. */
export class RudyWindow {
  private readonly scene: Phaser.Scene;
  private readonly model: RudyWindowModel = createRudyWindowModel();
  private readonly container: Phaser.GameObjects.Container;
  private readonly pageBackdrop: ((backdrop: PageBackdrop | null) => void) | undefined;
  private readonly gameArea: (() => GameArea) | undefined;
  /** Vrátí ztmaveným tlačítkům stránky původní `filter` (#170). */
  private restoreButtons: (() => void) | null = null;
  /** Pohyby, jejichž stažení loader právě vyřizuje. */
  private readonly pending = new Set<RudyMove>();
  private drawn: Drawn | null = null;
  private shield: HTMLElement | null = null;
  /** Prsty dole na vrstvě; vrstva zmizí, až se po zavření okna všechny zvednou. */
  private readonly shieldPointers = new Set<number>();
  private shieldTimer: number | undefined;
  /** Prsty a myš dole kdekoli na stránce (aby šlo přerušit rozběhnuté podržení). */
  private readonly pressed = new Map<number, PressedPointer>();
  private wobble: Phaser.Tweens.Tween | null = null;
  private onClosed: (() => void) | undefined;
  private shownKey = '';
  private shownFrame = -1;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: RudyWindowOptions = {}) {
    this.scene = scene;
    this.pageBackdrop = options.pageBackdrop;
    this.gameArea = options.gameArea;
    this.container = scene.add.container(0, 0).setDepth(options.depth ?? 1000);
    this.container.setVisible(false);
    options.layer?.add(this.container);
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFileComplete, this);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileError, this);
    scene.load.on(Phaser.Loader.Events.COMPLETE, this.onLoaderComplete, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pointerdown', this.onPagePointerDown, true);
    window.addEventListener('pointerup', this.onPagePointerUp, true);
    window.addEventListener('pointercancel', this.onPagePointerUp, true);
    this.run(this.model.use());
  }

  /** Stáhne pohyb dopředu, aby se při otevření přehrál hned (vystřídá jiný v paměti). */
  prepare(move: RudyMove): void {
    this.run(this.model.prepare(move));
  }

  /** Je stažený klid, takže se okno může ukázat? */
  isReady(): boolean {
    return this.model.isReady();
  }

  isOpen(): boolean {
    return this.model.isOpen();
  }

  /** Je pohyb stažený, takže se při otevření hned přehraje? */
  isLoaded(move: RudyMove): boolean {
    return this.model.isLoaded(move);
  }

  /**
   * Otevře okno s pohybem repliky. Vrátí `false`, když se okno neukáže
   * (klid není stažený nebo je okno už otevřené); `onClosed` se pak
   * zavolá hned, aby hra šla dál.
   */
  open(options: RudyOpenOptions): boolean {
    const request =
      options.lineMs === undefined
        ? { move: options.move }
        : { move: options.move, lineMs: options.lineMs };
    const result = this.model.open(request, this.now());
    this.run(result.commands);
    if (!result.shown) {
      options.onClosed?.();
      return false;
    }
    this.onClosed = options.onClosed;
    this.draw();
    this.addShield();
    this.cancelPagePresses();
    this.dimPageButtons();
    this.pageBackdrop?.(rudyCardPageBackdrop());
    this.render();
    return true;
  }

  /** Zavře okno zvenku (bez čekání na 1 s); zavolá `onClosed`. */
  close(): void {
    if (this.model.close()) {
      this.finishClosing();
    }
  }

  /** Okno se po otočení nebo změně velikosti nakreslí znovu podle nového okna. */
  relayout(): void {
    if (this.drawn !== null) {
      this.draw();
      this.render();
    }
  }

  /** Uklidí okno a uvolní textury; otevřené okno zavře bez `onClosed`. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.onClosed = undefined;
    if (this.model.isOpen()) {
      this.model.close();
      this.hide();
    }
    this.removeShield();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pointerdown', this.onPagePointerDown, true);
    window.removeEventListener('pointerup', this.onPagePointerUp, true);
    window.removeEventListener('pointercancel', this.onPagePointerUp, true);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.container.destroy();
    this.run(this.model.dispose());
    // Rozběhnuté stažení ještě doběhne; model pak řekne texturu uvolnit.
    if (this.pending.size === 0) {
      this.stopListening();
    }
  }

  private now(): number {
    return this.scene.game.loop.time;
  }

  private readGameArea(): GameArea {
    if (this.gameArea !== undefined) {
      return this.gameArea();
    }
    const stored: unknown = this.scene.game.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(readViewport());
  }

  /** Ztmavení, karta a panda podle dnešního okna, v herních jednotkách plochy. */
  private draw(): void {
    this.clearDrawn();
    const viewport = readViewport();
    const area = this.readGameArea();
    const layout = layoutRudyCard(viewport, area);
    const scale = area.scale > 0 ? area.scale : 1;
    const toUnits = (rect: RudyRect): RudyRect => ({
      left: (rect.left - area.offsetX) / scale,
      top: (rect.top - area.offsetY) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    });
    const style = RUDY_CARD_STYLE;
    const whole = toUnits({ left: 0, top: 0, width: viewport.width, height: viewport.height });
    const dim = this.scene.add
      .graphics()
      .fillStyle(colorNumber(style.dimColor), style.dimAlpha)
      .fillRect(whole.left, whole.top, whole.width, whole.height);
    // Ťuknutí kamkoli na plátno patří oknu (Phaser má `input.topOnly`), ne tlačítkům pod ním.
    const blocker = this.scene.add
      .zone(0, 0, area.width, area.height)
      .setOrigin(0, 0)
      .setInteractive();
    const cardRect = toUnits(layout.card);
    const center = { x: cardRect.left + cardRect.width / 2, y: cardRect.top + cardRect.height / 2 };
    const frame = this.drawCard(
      { ...cardRect, left: -cardRect.width / 2, top: -cardRect.height / 2 },
      scale,
    );
    const pandaRect = toUnits(layout.panda);
    const panda = this.scene.add
      .image(
        pandaRect.left + pandaRect.width / 2 - center.x,
        pandaRect.top + pandaRect.height / 2 - center.y,
        '__MISSING',
      )
      .setScale(pandaRect.height / RUDY_SHEET.frameHeight)
      .setVisible(false);
    const card = this.scene.add.container(center.x, center.y, [frame, panda]);
    this.container.add([dim, blocker, card]);
    this.container.setVisible(true);
    this.drawn = { dim, blocker, card, panda };
    this.shownKey = '';
    this.shownFrame = -1;
  }

  /** Stín z několika vrstev, bílý okraj a plocha karty (jako karta mapy z #145). */
  private drawCard(card: RudyRect, scale: number): Phaser.GameObjects.Graphics {
    const style = RUDY_CARD_STYLE;
    const units = (css: number): number => css / scale;
    // Zaoblení 24 px má plocha uvnitř okraje, okraj i stín jsou o svou šířku kulatější.
    const border = units(style.borderCss);
    const radius = units(style.cornerRadiusCss) + border;
    const graphics = this.scene.add.graphics();
    for (let layer = style.shadowLayers; layer >= 1; layer -= 1) {
      const spread = units(style.shadowSpreadCss * layer);
      graphics
        .fillStyle(colorNumber(style.shadowColor), style.shadowLayerAlpha)
        .fillRoundedRect(
          card.left - spread,
          card.top - spread + units(style.shadowOffsetCss),
          card.width + spread * 2,
          card.height + spread * 2,
          radius + spread,
        );
    }
    graphics
      .fillStyle(colorNumber(style.borderColor), 1)
      .fillRoundedRect(card.left, card.top, card.width, card.height, radius)
      .fillStyle(colorNumber(style.fillColor), 1)
      .fillRoundedRect(
        card.left + border,
        card.top + border,
        card.width - 2 * border,
        card.height - 2 * border,
        radius - border,
      );
    return graphics;
  }

  private clearDrawn(): void {
    if (this.drawn === null) {
      return;
    }
    this.wobble?.stop();
    this.wobble = null;
    const { dim, blocker, card } = this.drawn;
    // Karta zničí i svůj obsah (okraj a pandu).
    [dim, blocker, card].forEach((object) => object.destroy());
    this.drawn = null;
  }

  /** Průhledná vrstva přes celou stránku: dotyky pod okno neprojdou (AC4). */
  private addShield(): void {
    if (this.shield !== null) {
      return;
    }
    const shield = document.createElement('div');
    const style = shield.style;
    style.position = 'fixed';
    style.inset = '0';
    style.zIndex = TOUCH_SHIELD_Z_INDEX;
    style.touchAction = 'none';
    style.background = 'transparent';
    style.setProperty('-webkit-tap-highlight-color', 'transparent');
    style.setProperty('-webkit-user-select', 'none');
    style.userSelect = 'none';
    shield.addEventListener('pointerdown', this.onShieldPointerDown);
    shield.addEventListener('pointerup', this.onShieldPointerUp);
    shield.addEventListener('pointercancel', this.onShieldPointerUp);
    // Phaser na dotykových zařízeních čte touchstart/touchend na okně stránky
    // a vynechá je, jen když mají `defaultPrevented`; proto nepasivně.
    for (const type of SWALLOWED_EVENTS) {
      shield.addEventListener(type, this.swallow, { passive: false });
    }
    document.body.appendChild(shield);
    this.shield = shield;
  }

  /**
   * Po zavření okna zůstane vrstva, dokud se nezvednou prsty, které na ní
   * jsou (ťuknutí, které okno zavřelo, nesmí doťuknout na tlačítko pod ním),
   * nejvýš 1 s.
   */
  private releaseShield(): void {
    if (this.shield === null) {
      return;
    }
    if (this.shieldPointers.size === 0) {
      this.removeShield();
      return;
    }
    window.clearTimeout(this.shieldTimer);
    this.shieldTimer = window.setTimeout(() => this.removeShield(), SHIELD_LINGER_MAX_MS);
  }

  private removeShield(): void {
    window.clearTimeout(this.shieldTimer);
    this.shieldTimer = undefined;
    this.shieldPointers.clear();
    if (this.shield === null) {
      return;
    }
    const shield = this.shield;
    this.shield = null;
    shield.removeEventListener('pointerdown', this.onShieldPointerDown);
    shield.removeEventListener('pointerup', this.onShieldPointerUp);
    shield.removeEventListener('pointercancel', this.onShieldPointerUp);
    // Posluchače pohlcení zůstanou: dotyk začatý na vrstvě končí na ní i po odebrání.
    shield.remove();
  }

  private readonly swallow = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }
    event.stopPropagation();
  };

  private readonly onShieldPointerDown = (event: PointerEvent): void => {
    this.swallow(event);
    this.shieldPointers.add(event.pointerId);
    switch (this.model.tap(this.now())) {
      case 'closed':
        this.finishClosing();
        break;
      case 'tooEarly':
        this.wobbleCard();
        break;
      case 'none':
        break;
    }
  };

  private readonly onShieldPointerUp = (event: PointerEvent): void => {
    this.swallow(event);
    this.shieldPointers.delete(event.pointerId);
    if (!this.model.isOpen() && this.shieldPointers.size === 0) {
      this.removeShield();
    }
  };

  /** Ťuknutí v první 1 s okno nezavře, karta se jen krátce zhoupne (AC4). */
  private wobbleCard(): void {
    if (this.drawn === null || this.wobble?.isPlaying()) {
      return;
    }
    const card = this.drawn.card;
    card.setAngle(-CARD_WOBBLE.angle);
    this.wobble = this.scene.tweens.add({
      targets: card,
      angle: CARD_WOBBLE.angle,
      duration: CARD_WOBBLE.halfSwingMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: CARD_WOBBLE.swings - 1,
      onComplete: () => card.setAngle(0),
    });
  }

  private readonly onPagePointerDown = (event: PointerEvent): void => {
    this.pressed.set(event.pointerId, { pointerId: event.pointerId, target: event.target });
  };

  private readonly onPagePointerUp = (event: PointerEvent): void => {
    if (event.isTrusted) {
      this.pressed.delete(event.pointerId);
    }
  };

  /**
   * Okno se otevřelo, zatímco byl prst dole (třeba držení domečku nebo
   * kolečka): prvek pod prstem dostane `pointercancel`, takže rozběhnuté
   * podržení nedoběhne (AC4). Prohlížeč by prst dál posílal jen jemu.
   */
  private cancelPagePresses(): void {
    for (const press of this.pressed.values()) {
      if (press.target === this.shield || press.target === null) {
        continue;
      }
      press.target.dispatchEvent(
        new PointerEvent('pointercancel', { pointerId: press.pointerId, bubbles: true }),
      );
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.close();
    }
  };

  /** Okno už je v logice zavřené: schová se a hra dostane `onClosed`. */
  private finishClosing(): void {
    this.hide();
    const onClosed = this.onClosed;
    this.onClosed = undefined;
    onClosed?.();
  }

  private hide(): void {
    this.clearDrawn();
    this.container.setVisible(false);
    this.releaseShield();
    this.restorePageButtons();
    this.pageBackdrop?.(null);
  }

  /** Domeček a kolečko nad plátnem ztmavne jako hru pod kartou (#170). */
  private dimPageButtons(): void {
    this.restorePageButtons();
    this.restoreButtons = dimPageButtons(PAGE_BUTTON_IDS.map((id) => document.getElementById(id)));
  }

  private restorePageButtons(): void {
    this.restoreButtons?.();
    this.restoreButtons = null;
  }

  private onUpdate(): void {
    const result = this.model.update(this.now());
    this.run(result.commands);
    if (result.closed) {
      this.finishClosing();
      return;
    }
    this.render();
  }

  /** Ukáže snímek, který je podle logiky v tuto chvíli vidět. */
  private render(): void {
    if (this.destroyed || this.drawn === null) {
      return;
    }
    const { panda } = this.drawn;
    const frame = this.model.frame(this.now());
    if (frame === null) {
      panda.setVisible(false);
      return;
    }
    const key = textureKey(frame.move);
    if (key !== this.shownKey || frame.frame !== this.shownFrame) {
      panda.setTexture(key, frame.frame);
      this.shownKey = key;
      this.shownFrame = frame.frame;
    }
    panda.setVisible(true);
  }

  private run(commands: readonly RudyCommand[]): void {
    for (const command of commands) {
      if (command.type === 'download') {
        this.download(command.move);
      } else {
        this.release(command.move);
      }
    }
  }

  private download(move: RudyMove): void {
    const key = textureKey(move);
    if (this.scene.textures.exists(key)) {
      this.run(this.model.loaded(move));
      return;
    }
    this.pending.add(move);
    this.scene.load.spritesheet(key, SHEET_URLS[move], {
      frameWidth: RUDY_SHEET.frameWidth,
      frameHeight: RUDY_SHEET.frameHeight,
      endFrame: RUDY_SHEET.frameCount - 1,
    });
    this.scene.load.start();
  }

  private release(move: RudyMove): void {
    const key = textureKey(move);
    if (key === this.shownKey) {
      // Obrázek nesmí ukazovat uvolněnou texturu; logika už ukazuje jiný pohyb.
      this.shownKey = '';
      this.drawn?.panda.setTexture('__MISSING').setVisible(false);
    }
    // Klíče `rudy:*` patří jen tomuto oknu (ve hře je jedno), textura nikomu jinému nepatří.
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
    this.render();
  }

  private finish(move: RudyMove): void {
    this.pending.delete(move);
    if (this.scene.textures.exists(textureKey(move))) {
      this.run(this.model.loaded(move));
    } else {
      console.warn('panda Rudy: pohyb se nenačetl', move);
      this.model.failed(move);
    }
    if (this.destroyed && this.pending.size === 0) {
      this.stopListening();
    }
  }

  private onFileComplete(key: string): void {
    const move = moveOfKey(key);
    if (move !== null && this.pending.has(move)) {
      this.finish(move);
    }
  }

  private onFileError(file: Phaser.Loader.File): void {
    this.onFileComplete(file.key);
  }

  /** Soubor, který se stáhne, ale nejde dekódovat, chybu nehlásí; rozhodne textura. */
  private onLoaderComplete(): void {
    for (const move of [...this.pending]) {
      this.finish(move);
    }
  }

  private stopListening(): void {
    this.scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, this.onFileComplete, this);
    this.scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileError, this);
    this.scene.load.off(Phaser.Loader.Events.COMPLETE, this.onLoaderComplete, this);
  }
}
