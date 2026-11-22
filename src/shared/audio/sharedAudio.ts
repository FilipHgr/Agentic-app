/**
 * Jeden zvukový kontext prohlížeče pro menu a hry (#67 AC6). Safari pustí
 * zvuk až po dotyku hráče; stránka tenhle kontext odemkne prvním ťuknutím,
 * takže hra spuštěná z menu (průvodce nastavením) může mluvit hned.
 *
 * Safari na iPadu a iPhonu (#196):
 * - Web Audio bere jako „okolní“ zvuk, který tichý režim ztlumí. Zvuková
 *   relace `playback` (`navigator.audioSession`, kde ho prohlížeč má) ho
 *   přepne na přehrávání, takže hraje i v tichém režimu.
 * - Po přepnutí do jiné aplikace bývá kontext `interrupted`. Znovu se
 *   rozběhne po návratu stránky do popředí, a když to prohlížeč bez dotyku
 *   nedovolí, při dalším ťuknutí.
 * - Odemknout kontext jde jen uvnitř dotyku; k tomu se přehraje krátký
 *   tichý zvuk, bez kterého starší Safari kontext někdy nepustí.
 * Posluchače dotyku jsou na okně ve fázi zachycení, takže je žádný prvek
 * stránky (vrstva Rudyho, podržení tlačítek) nemůže zastavit.
 */

import type { AudioContextLike } from './tonePlayer';

/** Jen to, co odemčení potřebuje od zvukového kontextu. */
export interface UnlockableAudioContext {
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): unknown;
  createBufferSource(): {
    buffer: unknown;
    connect(destination: unknown): unknown;
    start(when?: number): void;
  };
}

/** Zvuková relace stránky (Safari 16.4+), jinde chybí. */
export interface AudioSessionLike {
  type: string;
}

export interface AudioUnlockEnvironment<Context extends UnlockableAudioContext> {
  /** Vytvoří kontext, nebo vrátí `undefined`, když prohlížeč Web Audio nemá. Smí vyhodit výjimku. */
  readonly createContext: () => Context | undefined;
  /** Zvuková relace prohlížeče, `undefined`, když ji prohlížeč nemá. */
  readonly audioSession: () => AudioSessionLike | undefined;
}

export interface AudioUnlock<Context extends UnlockableAudioContext> {
  /** Společný kontext; vytvoří se při prvním použití, bez Web Audio `undefined`. */
  context(): Context | undefined;
  /** Rozběhne zvuk; volá se při ťuknutí hráče (Safari ho bere jako gesto). Nikdy nevyhodí výjimku. */
  unlock(): void;
  /** Stránka je zase vidět: zkusí rozběhnout zvuk i bez dotyku. Nikdy nevyhodí výjimku. */
  resumeAfterReturn(): void;
  /** Je zvuk odemčený (kontext opravdu běží)? */
  isUnlocked(): boolean;
  /** Přepne zvukovou relaci na přehrávání (hraje i v tichém režimu). Nikdy nevyhodí výjimku. */
  preparePlayback(): void;
}

/** Zvuková relace pro přehrávání: hraje i v tichém režimu iPadu a iPhonu. */
const PLAYBACK_SESSION = 'playback';

/** Vzorkovací kmitočet tichého zvuku; stačí cokoli, co prohlížeč přijme. */
const SILENT_SAMPLE_RATE = 22050;

export function createAudioUnlock<Context extends UnlockableAudioContext>(
  environment: AudioUnlockEnvironment<Context>,
): AudioUnlock<Context> {
  let context: Context | undefined;
  let contextFailed = false;

  /** Přepne relaci na přehrávání; bez relace v prohlížeči se nic nestane. */
  function choosePlaybackSession(): void {
    try {
      const session = environment.audioSession();
      if (session !== undefined && session.type !== PLAYBACK_SESSION) {
        session.type = PLAYBACK_SESSION;
      }
    } catch {
      // Prohlížeč relaci změnit nedovolil: zvuk hraje dál, jen ho ztlumí tichý režim.
    }
  }

  function getContext(): Context | undefined {
    if (context !== undefined || contextFailed) {
      return context;
    }
    // Relace se volí dřív, než kontext vznikne, aby ho Safari rovnou zařadil k přehrávání.
    choosePlaybackSession();
    try {
      context = environment.createContext();
    } catch {
      context = undefined;
    }
    if (context === undefined) {
      // Prohlížeč kontext nevytvořil: menu i hlas budou potichu.
      contextFailed = true;
    }
    return context;
  }

  function resume(audio: Context): void {
    try {
      audio.resume().catch(() => {
        // Prohlížeč zvuk nepovolil: hra jde dál potichu, zkusí se při dalším ťuknutí.
      });
    } catch {
      // Kontext rozběhnutí odmítl hned: zkusí se při dalším ťuknutí.
    }
  }

  /** Krátký tichý zvuk uvnitř dotyku; po něm Safari kontext opravdu pustí. */
  function playSilence(audio: Context): void {
    try {
      const source = audio.createBufferSource();
      source.buffer = audio.createBuffer(1, 1, SILENT_SAMPLE_RATE);
      source.connect(audio.destination);
      source.start(0);
    } catch {
      // Tichý zvuk nešel spustit: odemčení zkusí samotné rozběhnutí kontextu.
    }
  }

  function unlock(): void {
    choosePlaybackSession();
    const audio = getContext();
    if (audio === undefined || audio.state === 'running') {
      return;
    }
    resume(audio);
    playSilence(audio);
  }

  function resumeAfterReturn(): void {
    const audio = context;
    if (audio === undefined || audio.state === 'running') {
      return;
    }
    choosePlaybackSession();
    resume(audio);
  }

  return {
    context: getContext,
    unlock,
    resumeAfterReturn,
    isUnlocked: () => context?.state === 'running',
    preparePlayback: choosePlaybackSession,
  };
}

/** Prostředí, ve kterém zvuk odemyká stránka; testy si ho napodobí. */
export interface AudioUnlockPage {
  addEventListener(
    type: string,
    listener: () => void,
    options: { capture: boolean; passive: boolean },
  ): void;
}

export interface AudioUnlockDocument {
  readonly visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
}

/**
 * Události, které Safari i ostatní prohlížeče berou jako gesto hráče.
 * Safari na iOS pustí zvuk až po zvednutí prstu (`touchend`, `pointerup`).
 */
const GESTURE_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click'] as const;

/**
 * Napojí odemčení na stránku: každé ťuknutí a návrat stránky do popředí
 * (přepnutí aplikace, návrat z mezipaměti stránek) zkusí zvuk rozběhnout.
 */
export function listenForAudioUnlock(
  unlock: Pick<AudioUnlock<UnlockableAudioContext>, 'unlock' | 'resumeAfterReturn'>,
  page: AudioUnlockPage,
  pageDocument: AudioUnlockDocument,
): void {
  for (const type of GESTURE_EVENTS) {
    page.addEventListener(type, () => unlock.unlock(), { capture: true, passive: true });
  }
  page.addEventListener('pageshow', () => unlock.resumeAfterReturn(), {
    capture: true,
    passive: true,
  });
  pageDocument.addEventListener('visibilitychange', () => {
    if (pageDocument.visibilityState === 'visible') {
      unlock.resumeAfterReturn();
    }
  });
}

/** Zvuková relace prohlížeče, kde ji má (Safari 16.4+). */
function browserAudioSession(): AudioSessionLike | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }
  const withSession = navigator as Navigator & { audioSession?: AudioSessionLike };
  return withSession.audioSession;
}

function browserAudioContext(): AudioContext | undefined {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    return undefined;
  }
  return new window.AudioContext();
}

const pageAudio = createAudioUnlock<AudioContext>({
  createContext: browserAudioContext,
  audioSession: browserAudioSession,
});

let pageListening = false;

/**
 * Odemčení zvuku pro celou stránku; volá ho start stránky jednou, další
 * volání nic nepřidají. Relace přehrávání se nastaví hned, ještě před
 * prvním zvukem.
 */
export function listenForSharedAudioUnlock(): void {
  if (pageListening || typeof window === 'undefined') {
    return;
  }
  pageListening = true;
  pageAudio.preparePlayback();
  listenForAudioUnlock(pageAudio, window, document);
}

/** Společný kontext; vytvoří se při prvním použití, bez Web Audio `undefined`. */
export function sharedAudioContext(): AudioContext | undefined {
  return pageAudio.context();
}

/** Společný kontext pro přehrávač tónů (`createTonePlayer`). */
export function sharedToneContext(): AudioContextLike | undefined {
  return sharedAudioContext();
}

/** Je zvuk odemčený (kontext běží)? */
export function isSharedAudioUnlocked(): boolean {
  return pageAudio.isUnlocked();
}
