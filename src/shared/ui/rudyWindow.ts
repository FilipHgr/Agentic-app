/// <reference types="vite/client" />
/**
 * Phaser Rudy přímo na obrazovce (#186, dřív okno z #169): bez karty,
 * okraje a ztmavení. Panda s průhledným pozadím přiskočí zdola na střed
 * obrazovky přes hru, slaví a mluví a pak odskočí dolů. O všem rozhoduje
 * logika: průběh a paměť `logic/rudyWindow.ts`, místo a skoky
 * `logic/rudyStage.ts`. Tady se jen kreslí, stahuje a ťuká.
 *
 * Dokud je Rudy vidět, nereaguje nic pod ním: přes celou stránku leží
 * průhledná vrstva, která chytá všechny dotyky (i nad domečkem a kolečkem
 * nastavení, které jsou prvky stránky nad plátnem), takže se pod ní
 * nezačne ani podržení. Ťuknutí do vrstvy předá logice (po 1 s pošle
 * Rudyho pryč, dřív se Rudy jen zhoupne). Odskok dolů už dotyky nebere.
 *
 * Archy pohybů se stahují Phaser loaderem až při použití. Chyba stažení
 * se jen zapíše do konzole, hráč nic nevidí a hra jde dál. Odchod stránky
 * na pozadí pošle Rudyho pryč.
 */

import Phaser from 'phaser';

import rudyCelebrateUrl from '../mascot/rudy-celebrate.webp';
import rudyIdleUrl from '../mascot/rudy-idle.webp';
import rudyTalkUrl from '../mascot/rudy-talk.webp';

import { RUDY_MOVES, RUDY_SHEET } from '../logic/rudy';
import type { RudyMove } from '../logic/rudy';
import { isRudyHopDone, layoutRudyStage, rudyHopTop } from '../logic/rudyStage';
import type { RudyHopPhase, RudyStageLayout } from '../logic/rudyStage';
import { createRudyWindowModel } from '../logic/rudyWindow';
import type { RudyCommand, RudyWindowModel } from '../logic/rudyWindow';
import { gameAreaFor } from '../logic/viewportLayout';
import type { GameArea } from '../logic/viewportLayout';
import { GAME_AREA_KEY, readViewport } from './viewport';

const SHEET_URLS: Readonly<Record<RudyMove, string>> = {
  idle: rudyIdleUrl,
  celebrate: rudyCelebrateUrl,
  talk: rudyTalkUrl,
};

/** Vrstva proti dotykům je nad vším na stránce (domeček a kolečko mají 10). */
const TOUCH_SHIELD_Z_INDEX = '100';

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
  /** Hloubka Rudyho ve scéně (výchozí 1000, nad vším ve hře). */
  readonly depth?: number;
}

export interface RudyOpenOptions {
  /** Délka repliky (nahrávky) v ms; bez ní je Rudy vidět 3,5 s. */
  readonly lineMs?: number;
  /** Rudy odešel (sám, ťuknutím, zvenku), nebo se vůbec neukázal. */
  readonly onClosed?: () => void;
}

/** Nakreslený Rudy. */
interface Drawn {
  /**
   * Plocha přes celé plátno, dokud je Rudy na místě: ťuknutí na plátně
   * nedostane nic pod ním. Při odskoku už není.
   */
  blocker: Phaser.GameObjects.Zone | null;
  /** Panda se středem v počátku: zhoupne se kolem svého středu. */
  readonly holder: Phaser.GameObjects.Container;
  readonly panda: Phaser.GameObjects.Image;
  /** Kde Rudy stojí a odkud skáče, v CSS px okna. */
  layout: RudyStageLayout;
  /** Herní plocha, podle které se CSS px převádí na jednotky plátna. */
  area: GameArea;
}

/** Skok, který právě běží: přískok zdola, nebo odskok dolů, a kdy začal. */
interface Hop {
  readonly phase: RudyHopPhase;
  readonly startedAt: number;
}

/** Prst nebo myš, které jsou právě dole, a prvek stránky, na kterém začaly. */
interface PressedPointer {
  readonly pointerId: number;
  readonly target: EventTarget | null;
}

/** Zhoupnutí Rudyho po ťuknutí v první 1 s (AC4): úhel ve stupních a délka půlkmitu. */
const PANDA_WOBBLE = { angle: 3, halfSwingMs: 70, swings: 2 } as const;

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

/** Sdílený Rudy na obrazovce ve scéně. Po konci scény se sám uklidí. */
export class RudyWindow {
  private readonly scene: Phaser.Scene;
  private readonly model: RudyWindowModel = createRudyWindowModel();
  private readonly container: Phaser.GameObjects.Container;
  /** Pohyby, jejichž stažení loader právě vyřizuje. */
  private readonly pending = new Set<RudyMove>();
  private drawn: Drawn | null = null;
  private hop: Hop | null = null;
  private shield: HTMLElement | null = null;
  /** Prsty dole na vrstvě; vrstva zmizí, až se po odchodu Rudyho všechny zvednou. */
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
    this.container = scene.add.container(0, 0).setDepth(options.depth ?? 1000);
    this.container.setVisible(false);
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

  /** Stáhne pohyb dopředu, aby se při ukázání přehrál hned (vystřídá jiný v paměti). */
  prepare(move: RudyMove): void {
    this.run(this.model.prepare(move));
  }

  /** Je stažený klid, takže se Rudy může ukázat? */
  isReady(): boolean {
    return this.model.isReady();
  }

  isOpen(): boolean {
    return this.model.isOpen();
  }

  /** Je pohyb stažený, takže se při ukázání hned přehraje? */
  isLoaded(move: RudyMove): boolean {
    return this.model.isLoaded(move);
  }

  /**
   * Rudy přiskočí s oslavou. Vrátí `false`, když se neukáže (klid není
   * stažený nebo už je vidět); `onClosed` se pak zavolá hned, aby hra
   * šla dál.
   */
  open(options: RudyOpenOptions): boolean {
    const request = options.lineMs === undefined ? {} : { lineMs: options.lineMs };
    const result = this.model.open(request, this.now());
    this.run(result.commands);
    if (!result.shown) {
      options.onClosed?.();
      return false;
    }
    this.onClosed = options.onClosed;
    this.draw();
    this.hop = { phase: 'in', startedAt: this.now() };
    this.addShield();
    this.cancelPagePresses();
    this.render();
    this.placeForHop();
    return true;
  }

  /** Pošle Rudyho pryč zvenku (bez čekání na 1 s); zavolá `onClosed`. */
  close(): void {
    if (this.model.close()) {
      this.finishClosing();
    }
  }

  /** Po otočení nebo změně velikosti se Rudy postaví podle nového okna. */
  relayout(): void {
    if (this.drawn !== null) {
      this.drawn.area = this.readGameArea();
      this.drawn.layout = layoutRudyStage(readViewport(), this.drawn.area);
      this.scaleToLayout(this.drawn);
      this.placeForHop();
    }
  }

  /** Uklidí Rudyho a uvolní textury; Rudy, který je vidět, odejde bez `onClosed`. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.onClosed = undefined;
    if (this.model.isOpen()) {
      this.model.close();
    }
    this.hideNow();
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
    const stored: unknown = this.scene.game.registry.get(GAME_AREA_KEY);
    return isGameArea(stored) ? stored : gameAreaFor(readViewport());
  }

  /** Rudy podle dnešního okna; bez karty, okraje a ztmavení (#186). */
  private draw(): void {
    this.clearDrawn();
    const area = this.readGameArea();
    const layout = layoutRudyStage(readViewport(), area);
    // Ťuknutí kamkoli na plátno patří Rudymu (Phaser má `input.topOnly`), ne tlačítkům pod ním.
    const blocker = this.scene.add
      .zone(0, 0, area.width, area.height)
      .setOrigin(0, 0)
      .setInteractive();
    const panda = this.scene.add.image(0, 0, '__MISSING').setVisible(false);
    const holder = this.scene.add.container(0, 0, [panda]);
    this.container.add([blocker, holder]);
    this.container.setVisible(true);
    const drawn: Drawn = { blocker, holder, panda, layout, area };
    this.scaleToLayout(drawn);
    this.drawn = drawn;
    this.shownKey = '';
    this.shownFrame = -1;
  }

  /** Velikost pandy a vodorovné místo podle rozložení, v herních jednotkách plochy. */
  private scaleToLayout(drawn: Drawn): void {
    const { area, layout } = drawn;
    const scale = area.scale > 0 ? area.scale : 1;
    drawn.panda.setScale(layout.panda.height / scale / RUDY_SHEET.frameHeight);
    drawn.holder.x = (layout.panda.left + layout.panda.width / 2 - area.offsetX) / scale;
    drawn.blocker?.setSize(area.width, area.height);
  }

  /** Svislé místo pandy podle běžícího skoku; po odskoku se Rudy schová. */
  private placeForHop(): void {
    const drawn = this.drawn;
    const hop = this.hop;
    if (drawn === null || hop === null) {
      return;
    }
    const elapsed = this.now() - hop.startedAt;
    if (hop.phase === 'out' && isRudyHopDone('out', elapsed)) {
      this.hideNow();
      return;
    }
    const { area, layout } = drawn;
    const scale = area.scale > 0 ? area.scale : 1;
    const top = rudyHopTop(layout, hop.phase, elapsed);
    drawn.holder.y = (top + layout.panda.height / 2 - area.offsetY) / scale;
  }

  private clearDrawn(): void {
    if (this.drawn === null) {
      return;
    }
    this.wobble?.stop();
    this.wobble = null;
    const { blocker, holder } = this.drawn;
    // Kontejner zničí i pandu.
    blocker?.destroy();
    holder.destroy();
    this.drawn = null;
  }

  /** Průhledná vrstva přes celou stránku: dotyky pod Rudyho neprojdou (AC4). */
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
   * Po odchodu Rudyho zůstane vrstva, dokud se nezvednou prsty, které na ní
   * jsou (ťuknutí, které ho poslalo pryč, nesmí doťuknout na tlačítko pod ním),
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
        this.wobblePanda();
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

  /** Ťuknutí v první 1 s Rudyho nepošle pryč, Rudy se jen krátce zhoupne (AC4). */
  private wobblePanda(): void {
    if (this.drawn === null || this.wobble?.isPlaying()) {
      return;
    }
    const holder = this.drawn.holder;
    holder.setAngle(-PANDA_WOBBLE.angle);
    this.wobble = this.scene.tweens.add({
      targets: holder,
      angle: PANDA_WOBBLE.angle,
      duration: PANDA_WOBBLE.halfSwingMs,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: PANDA_WOBBLE.swings - 1,
      onComplete: () => holder.setAngle(0),
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
   * Rudy se ukázal, zatímco byl prst dole (třeba držení domečku nebo
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

  /**
   * Rudy už v logice odešel: odskočí dolů a hra hned dostane `onClosed`
   * (#186 AC3: v Počítání pak karta mapy, v Porovnávání konfety). Odskok
   * dotyky nebere, hra pod ním už reaguje.
   */
  private finishClosing(): void {
    this.startHopOut();
    this.releaseShield();
    const onClosed = this.onClosed;
    this.onClosed = undefined;
    onClosed?.();
  }

  private startHopOut(): void {
    if (this.drawn === null) {
      return;
    }
    this.drawn.blocker?.destroy();
    this.drawn.blocker = null;
    this.wobble?.stop();
    this.wobble = null;
    this.drawn.holder.setAngle(0);
    this.hop = { phase: 'out', startedAt: this.now() };
    this.placeForHop();
  }

  /** Rudy zmizí hned, bez odskoku (konec scény, nebo po odskoku). */
  private hideNow(): void {
    this.hop = null;
    this.clearDrawn();
    this.container.setVisible(false);
  }

  private onUpdate(): void {
    const result = this.model.update(this.now());
    this.run(result.commands);
    if (result.closed) {
      this.finishClosing();
      return;
    }
    this.render();
    this.placeForHop();
  }

  /** Ukáže snímek, který je podle logiky v tuto chvíli vidět. */
  private render(): void {
    if (this.destroyed || this.drawn === null) {
      return;
    }
    const { panda } = this.drawn;
    const frame = this.model.frame(this.now());
    if (frame === null) {
      // Při odskoku zůstane poslední snímek, jinak Rudy není vidět.
      panda.setVisible(this.hop?.phase === 'out' && this.shownKey !== '');
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
