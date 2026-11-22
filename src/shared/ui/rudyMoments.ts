/**
 * Rudy s oslavou po 10. hvězdičce ve scéně (#170 AC3, od #186 jediná
 * chvíle s Rudym, přímo na obrazovce bez okna). Kód Rudyho
 * (`rudyWindow.ts`) i obrázky pohybů se stáhnou až při první oslavě (nebo
 * `prepare`), tedy až když je hra vidět; startovní soubor stránky je nezná.
 *
 * O tom, kdy Rudyho ukázat, rozhoduje logika `logic/rudyMoment.ts`: Rudy
 * počká na stažení nejdéle `RUDY_CELEBRATION_WAIT_MS`, pak se vynechá
 * a hra dostane `onClosed` hned (#186 AC4). Odchod stránky na pozadí
 * čekání zruší. Chyba stažení se jen zapíše do konzole, hráč nic nevidí.
 *
 * Hlas (#171): oslava může mít nahrávku repliky (`voiceUrl`). Kdy se
 * stáhne, jak dlouho je Rudy vidět a kdy hlas zazní, rozhoduje
 * `logic/rudyVoice.ts`; Rudy počká i na nahrávku a jeho odchod hlas
 * zastaví. Bez odemčeného zvuku nebo nahrávky je Rudy bez hlasu.
 */

import Phaser from 'phaser';

import { createSharedRudyVoicePlayer } from '../audio/rudyVoicePlayer';
import { isSharedAudioUnlocked } from '../audio/sharedAudio';
import { createRudyMomentGate } from '../logic/rudyMoment';
import { createRudyVoice } from '../logic/rudyVoice';
import type { RudyWindow, RudyWindowOptions } from './rudyWindow';

type RudyWindowModule = typeof import('./rudyWindow');

/** Co chvíle ohlásí: Rudy se ukázal, nebo odešel (i když se neukázal). */
export interface RudyMomentEvents {
  readonly onOpened?: () => void;
  readonly onClosed?: () => void;
  /** Nahrávka repliky v jazyce zvoleném v menu (#171); bez ní je Rudy bez hlasu. */
  readonly voiceUrl?: string;
}

export class RudyMoments {
  private readonly scene: Phaser.Scene;
  private readonly options: RudyWindowOptions;
  private readonly gate = createRudyMomentGate();
  private readonly voice = createRudyVoice({
    player: createSharedRudyVoicePlayer(),
    isUnlocked: isSharedAudioUnlocked,
  });
  /** Nahrávka čekající oslavy. */
  private voiceUrl: string | undefined;
  private module: RudyWindowModule | null = null;
  private loading: Promise<void> | null = null;
  private window: RudyWindow | null = null;
  /** Kdo o oslavu požádal; `momentId` odliší chvíle, aby zastavená nic neohlásila. */
  private events: RudyMomentEvents = {};
  private momentId = 0;
  /** Oslava se má stáhnout dopředu, až bude kód Rudyho. */
  private prepared = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: RudyWindowOptions = {}) {
    this.scene = scene;
    this.options = options;
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Ukáže Rudyho s oslavou, až se stáhne. Čekající chvíli nahradí (ta už
   * nic neohlásí). Když se Rudy nestihne stáhnout, zavolá `onClosed`.
   */
  celebrate(events: RudyMomentEvents = {}): void {
    if (this.destroyed) {
      events.onClosed?.();
      return;
    }
    this.momentId += 1;
    this.events = events;
    this.voiceUrl = events.voiceUrl;
    this.voice.request(events.voiceUrl);
    this.gate.request(this.now());
    this.windowOrLoad()?.prepare('celebrate');
  }

  /** Stáhne oslavu dopředu, aby se po 10. hvězdičce přehrála hned; s `voiceUrl` i repliku. */
  prepare(voiceUrl?: string): void {
    this.voice.request(voiceUrl);
    this.prepared = true;
    this.windowOrLoad()?.prepare('celebrate');
  }

  /** Čekající oslava se neukáže a Rudy, který je vidět, odejde; nic se neohlásí. */
  stop(): void {
    this.momentId += 1;
    this.gate.cancel();
    this.events = {};
    this.voice.stop();
    this.window?.close();
  }

  isOpen(): boolean {
    return this.window?.isOpen() ?? false;
  }

  /** Po otočení nebo změně velikosti se Rudy postaví podle nového okna. */
  relayout(): void {
    this.window?.relayout();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.momentId += 1;
    this.gate.cancel();
    this.events = {};
    this.voice.stop();
    this.window?.destroy();
    this.window = null;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Stránka odešla na pozadí dřív, než se Rudy ukázal: čekání se zruší
   * a hra dostane `onClosed` hned (oslava jde bez Rudyho). Rudyho, který
   * je vidět, pošle pryč samo `RudyWindow`.
   */
  private readonly onVisibilityChange = (): void => {
    if (document.hidden && this.gate.pageHidden()) {
      this.finish(this.momentId);
    }
  };

  private now(): number {
    return this.scene.game.loop.time;
  }

  /** Rudy, když už je; jinak začne stahovat jeho kód a vrátí `null`. */
  private windowOrLoad(): RudyWindow | null {
    if (this.window !== null) {
      return this.window;
    }
    if (this.module !== null) {
      this.window = new this.module.RudyWindow(this.scene, this.options);
      return this.window;
    }
    this.loadModule();
    return null;
  }

  private loadModule(): void {
    if (this.loading !== null) {
      return;
    }
    this.loading = import('./rudyWindow')
      .then((module) => {
        this.module = module;
        if (this.destroyed) {
          return;
        }
        const rudyWindow = this.windowOrLoad();
        if (this.gate.pending() || this.prepared) {
          rudyWindow?.prepare('celebrate');
        }
      })
      .catch((error: unknown) => {
        // Bez Rudyho hra jde dál: čekající oslava se po limitu vynechá.
        console.warn('panda Rudy: kód se nestáhl', error);
      })
      .finally(() => {
        this.loading = null;
      });
  }

  private onUpdate(): void {
    if (!this.gate.pending()) {
      return;
    }
    const rudyWindow = this.window;
    const voiceUrl = this.voiceUrl;
    const step = this.gate.step(this.now(), {
      idle: rudyWindow?.isReady() ?? false,
      move: (rudyWindow?.isLoaded('celebrate') ?? false) && this.voice.isSettled(voiceUrl),
    });
    const id = this.momentId;
    if (step.kind === 'giveUp') {
      this.finish(id);
      return;
    }
    if (step.kind !== 'open' || rudyWindow === null) {
      return;
    }
    const onOpened = this.events.onOpened;
    const line = this.voice.lineFor(voiceUrl);
    const shown = rudyWindow.open({
      ...(line === null ? {} : { lineMs: line.lineMs }),
      onClosed: () => {
        // Odchod Rudyho (sám, ťuknutím, zvenku) hlas vždy zastaví.
        this.voice.stop();
        this.finish(id);
      },
    });
    if (!shown || id !== this.momentId) {
      return;
    }
    if (line !== null) {
      this.voice.play(line);
    }
    onOpened?.();
  }

  /** Chvíle `id` skončila: ohlásí odchod, jen když ji mezitím nic nezastavilo. */
  private finish(id: number): void {
    if (id !== this.momentId) {
      return;
    }
    const events = this.events;
    this.events = {};
    events.onClosed?.();
  }
}
