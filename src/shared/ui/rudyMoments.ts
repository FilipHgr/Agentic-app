/**
 * Chvíle s pandou Rudym ve scéně (#170): pozdrav a oslava v okně z #169.
 * Kód okna (`rudyWindow.ts`) i obrázky pohybů se stáhnou až při první
 * chvíli (nebo `prepare`), tedy až když je menu nebo hra vidět; startovní
 * soubor stránky je nezná.
 *
 * O tom, kdy okno ukázat, rozhoduje logika `logic/rudyMoment.ts`: okno
 * počká na stažení, nejdéle `RUDY_WAIT_MS`, pak se chvíle vynechá a hra
 * dostane `onClosed` hned (oslava čeká kratší dobu, `RUDY_CELEBRATION_WAIT_MS`).
 * Odchod stránky na pozadí čekání zruší. Chyba stažení se jen zapíše do konzole, hráč
 * nic nevidí.
 *
 * Hlas (#171): chvíle může mít nahrávku repliky (`voiceUrl`). Kdy se
 * stáhne, jak dlouho je okno otevřené a kdy hlas zazní, rozhoduje
 * `logic/rudyVoice.ts`; okno počká i na nahrávku a zavření okna hlas
 * zastaví. Bez odemčeného zvuku nebo nahrávky je okno bez hlasu.
 */

import Phaser from 'phaser';

import { createSharedRudyVoicePlayer } from '../audio/rudyVoicePlayer';
import { isSharedAudioUnlocked } from '../audio/sharedAudio';
import type { RudyLineMove, RudyMove } from '../logic/rudy';
import { createRudyMomentGate } from '../logic/rudyMoment';
import { createRudyVoice } from '../logic/rudyVoice';
import type { RudyWindow, RudyWindowOptions } from './rudyWindow';

type RudyWindowModule = typeof import('./rudyWindow');

/** Co chvíle ohlásí: okno se ukázalo, nebo se zavřelo (i když se neukázalo). */
export interface RudyMomentEvents {
  readonly onOpened?: () => void;
  readonly onClosed?: () => void;
  /** Nahrávka repliky v jazyce zvoleném v menu (#171); bez ní je okno bez hlasu. */
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
  /** Nahrávka čekající chvíle. */
  private voiceUrl: string | undefined;
  private module: RudyWindowModule | null = null;
  private loading: Promise<void> | null = null;
  private window: RudyWindow | null = null;
  /** Kdo o chvíli požádal; `momentId` odliší chvíle, aby zastavená nic neohlásila. */
  private events: RudyMomentEvents = {};
  private momentId = 0;
  /** Pohyb, který se má stáhnout dopředu, až bude okno. */
  private prepared: RudyMove | null = null;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: RudyWindowOptions = {}) {
    this.scene = scene;
    this.options = options;
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Ukáže okno s pohybem `move`, až se stáhne. Čekající chvíli nahradí
   * (ta už nic neohlásí). Když se okno nestihne stáhnout, zavolá `onClosed`.
   */
  show(move: RudyLineMove, events: RudyMomentEvents = {}): void {
    if (this.destroyed) {
      events.onClosed?.();
      return;
    }
    this.momentId += 1;
    this.events = events;
    this.voiceUrl = events.voiceUrl;
    this.voice.request(events.voiceUrl);
    this.gate.request(move, this.now());
    this.windowOrLoad()?.prepare(move);
  }

  /**
   * Stáhne pohyb dopředu (třeba oslavu po pozdravu), aby se pak přehrál
   * hned; s `voiceUrl` i nahrávku repliky.
   */
  prepare(move: RudyMove, voiceUrl?: string): void {
    this.voice.request(voiceUrl);
    this.prepared = move;
    this.windowOrLoad()?.prepare(move);
  }

  /** Čekající chvíle se neukáže a otevřené okno se zavře, nic se neohlásí. */
  stop(): void {
    this.momentId += 1;
    this.gate.cancel();
    this.events = {};
    this.voice.stop();
    this.window?.close();
  }

  /** Čekající chvíle (ještě neukázaná) se zruší a nic neohlásí; otevřené okno zůstane. */
  cancelWaiting(): void {
    if (this.gate.pending() !== null) {
      this.momentId += 1;
      this.gate.cancel();
      this.events = {};
    }
  }

  isOpen(): boolean {
    return this.window?.isOpen() ?? false;
  }

  /** Po otočení nebo změně velikosti se otevřené okno nakreslí znovu. */
  relayout(): void {
    this.window?.relayout();
  }

  /**
   * Uvolní okno i stažené pohyby z paměti (menu se schovalo za hru);
   * příští chvíle si je stáhne znovu.
   */
  unload(): void {
    this.stop();
    this.prepared = null;
    this.window?.destroy();
    this.window = null;
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
   * Stránka odešla na pozadí dřív, než se chvíle ukázala: čekání se zruší
   * a hra dostane `onClosed` hned (pozdrav se vynechá, oslava jde bez okna).
   * Otevřené okno zavře samo `RudyWindow`.
   */
  private readonly onVisibilityChange = (): void => {
    if (document.hidden && this.gate.pageHidden()) {
      this.finish(this.momentId);
    }
  };

  private now(): number {
    return this.scene.game.loop.time;
  }

  /** Okno, když už je; jinak začne stahovat jeho kód a vrátí `null`. */
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
        const waiting = this.gate.pending();
        if (waiting !== null) {
          rudyWindow?.prepare(waiting);
        }
        if (this.prepared !== null && this.prepared !== waiting) {
          rudyWindow?.prepare(this.prepared);
        }
      })
      .catch((error: unknown) => {
        // Bez okna hra jde dál: čekající chvíle se po limitu vynechá.
        console.warn('panda Rudy: okno se nestáhlo', error);
      })
      .finally(() => {
        this.loading = null;
      });
  }

  private onUpdate(): void {
    const rudyWindow = this.window;
    const waiting = this.gate.pending();
    if (waiting === null) {
      return;
    }
    const voiceUrl = this.voiceUrl;
    const step = this.gate.step(this.now(), {
      idle: rudyWindow?.isReady() ?? false,
      move: (rudyWindow?.isLoaded(waiting) ?? false) && this.voice.isSettled(voiceUrl),
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
      move: step.move,
      ...(line === null ? {} : { lineMs: line.lineMs }),
      onClosed: () => {
        // Zavření okna (samo, ťuknutím, zvenku) hlas vždy zastaví.
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

  /** Chvíle `id` skončila: ohlásí zavření, jen když ji mezitím nic nezastavilo. */
  private finish(id: number): void {
    if (id !== this.momentId) {
      return;
    }
    const events = this.events;
    this.events = {};
    events.onClosed?.();
  }
}
