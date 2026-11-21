/// <reference types="vite/client" />
/**
 * Phaser pohled sdílené pandy (#166). Jen vykresluje snímky, o všem
 * ostatním rozhoduje logika `logic/mascot.ts`: kdy se pohyb stáhne, kdy se
 * jeho textura uvolní a který snímek je právě vidět. Pro 60 fps se v každém
 * snímku hry jen přepne snímek textury, nic se nepřekresluje.
 *
 * Archy pohybů se stahují Phaser loaderem až při použití pandy (vytvoření
 * pohledu stáhne klid, další pohyby `prepare` nebo `play`), ne při startu
 * stránky. Import obrázků dává jen adresy, nic nestahuje. Chyba stažení se
 * jen zapíše do konzole, hráč nic nevidí a hra jde dál.
 *
 * Panda dotyky nepřijímá, dokud o to hra nepožádá (`setTapHandler`).
 */

import Phaser from 'phaser';

import celebrateUrl from '../mascot/celebrate.webp';
import encourageUrl from '../mascot/encourage.webp';
import idleUrl from '../mascot/idle.webp';
import joyUrl from '../mascot/joy.webp';
import thinkUrl from '../mascot/think.webp';
import waveUrl from '../mascot/wave.webp';

import {
  MASCOT_FRAME_COUNT,
  MASCOT_FRAME_SIZE,
  createMascotModel,
  placeMascot,
} from '../logic/mascot';
import type { MascotArea, MascotCommand, MascotModel, MascotMove } from '../logic/mascot';

const SHEET_URLS: Readonly<Record<MascotMove, string>> = {
  idle: idleUrl,
  wave: waveUrl,
  joy: joyUrl,
  encourage: encourageUrl,
  think: thinkUrl,
  celebrate: celebrateUrl,
};

function textureKey(move: MascotMove): string {
  return `mascot:${move}`;
}

function moveOfKey(key: string): MascotMove | null {
  const move = (Object.keys(SHEET_URLS) as MascotMove[]).find((each) => textureKey(each) === key);
  return move ?? null;
}

export interface MascotOptions {
  /** Hloubka obrázku ve scéně (výchozí 0). */
  readonly depth?: number;
}

/** Sdílená panda ve scéně. Po konci scény se sama uklidí. */
export class Mascot {
  private readonly scene: Phaser.Scene;
  private readonly model: MascotModel = createMascotModel();
  private readonly image: Phaser.GameObjects.Image;
  /** Pohyby, jejichž stažení loader právě vyřizuje. */
  private readonly pending = new Set<MascotMove>();
  private shownKey = '';
  private shownFrame = -1;
  private scale = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: MascotOptions = {}) {
    this.scene = scene;
    this.image = scene.add.image(0, 0, '__MISSING');
    this.image
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(options.depth ?? 0);
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, this.onFileComplete, this);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, this.onFileError, this);
    scene.load.on(Phaser.Loader.Events.COMPLETE, this.onLoaderComplete, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.run(this.model.use());
  }

  /** Postaví pandu do obdélníku (body plátna): co největší, nohy dole uprostřed. */
  place(area: MascotArea): void {
    const placement = placeMascot(area);
    this.scale = placement.scale;
    this.image.setPosition(placement.x, placement.y).setScale(placement.scale);
    this.render();
  }

  /** Stáhne pohyb dopředu, aby se při `play` přehrál hned. */
  prepare(move: MascotMove): void {
    this.run(this.model.prepare(move));
  }

  /** Přehraje pohyb od 1. snímku; nenačtený pohyb nechá pandu v klidu. */
  play(move: MascotMove): void {
    this.run(this.model.play(move, this.now()));
    this.render();
  }

  /** Ťuknutí na pandu; `null` dotyky zase vypne (výchozí stav). */
  setTapHandler(onTap: (() => void) | null): void {
    this.image.off(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN);
    if (onTap === null) {
      this.image.disableInteractive();
      return;
    }
    this.image.setInteractive();
    this.image.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, onTap);
  }

  /** Uklidí pandu a uvolní její textury. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.image.destroy();
    this.run(this.model.dispose());
    // Rozběhnuté stažení ještě doběhne; model pak řekne texturu uvolnit.
    if (this.pending.size === 0) {
      this.stopListening();
    }
  }

  private now(): number {
    return this.scene.game.loop.time;
  }

  private onUpdate(): void {
    const commands = this.model.update(this.now());
    this.render();
    this.run(commands);
  }

  /** Ukáže snímek, který je podle logiky v tuto chvíli vidět. */
  private render(): void {
    if (this.destroyed) {
      return;
    }
    const frame = this.model.frame(this.now());
    if (frame === null || this.scale <= 0) {
      this.image.setVisible(false);
      return;
    }
    const key = textureKey(frame.move);
    if (key !== this.shownKey || frame.frame !== this.shownFrame) {
      this.image.setTexture(key, frame.frame);
      this.shownKey = key;
      this.shownFrame = frame.frame;
    }
    this.image.setVisible(true);
  }

  private run(commands: readonly MascotCommand[]): void {
    for (const command of commands) {
      if (command.type === 'download') {
        this.download(command.move);
      } else {
        this.release(command.move);
      }
    }
  }

  private download(move: MascotMove): void {
    const key = textureKey(move);
    if (this.scene.textures.exists(key)) {
      this.run(this.model.loaded(move));
      return;
    }
    this.pending.add(move);
    this.scene.load.spritesheet(key, SHEET_URLS[move], {
      frameWidth: MASCOT_FRAME_SIZE.width,
      frameHeight: MASCOT_FRAME_SIZE.height,
      endFrame: MASCOT_FRAME_COUNT - 1,
    });
    this.scene.load.start();
  }

  private release(move: MascotMove): void {
    const key = textureKey(move);
    if (key === this.shownKey) {
      // Obrázek nesmí ukazovat uvolněnou texturu; logika už hraje jiný pohyb.
      this.shownKey = '';
      this.render();
    }
    if (this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
  }

  private finish(move: MascotMove): void {
    this.pending.delete(move);
    if (this.scene.textures.exists(textureKey(move))) {
      this.run(this.model.loaded(move));
    } else {
      console.warn('panda: pohyb se nenačetl', move);
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
