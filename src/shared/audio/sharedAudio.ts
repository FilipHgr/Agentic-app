/**
 * Jeden zvukový kontext prohlížeče pro menu a hry (#67 AC6). Safari pustí
 * zvuk až po dotyku hráče; menu tenhle kontext odemkne prvním ťuknutím,
 * takže hra spuštěná z menu (průvodce nastavením) může mluvit hned.
 */

import type { AudioContextLike } from './tonePlayer';

let sharedContext: AudioContext | undefined;
let contextFailed = false;

/** Společný kontext; vytvoří se při prvním použití, bez Web Audio `undefined`. */
export function sharedAudioContext(): AudioContext | undefined {
  if (sharedContext !== undefined || contextFailed) {
    return sharedContext;
  }
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') {
    contextFailed = true;
    return undefined;
  }
  try {
    sharedContext = new window.AudioContext();
  } catch {
    // Prohlížeč kontext nevytvořil: menu i hlas budou potichu.
    contextFailed = true;
  }
  return sharedContext;
}

/** Společný kontext pro přehrávač tónů (`createTonePlayer`). */
export function sharedToneContext(): AudioContextLike | undefined {
  return sharedAudioContext();
}

/** Zapne zvuk; volá se při ťuknutí hráče (Safari ho bere jako gesto). */
export function unlockSharedAudio(): void {
  const audio = sharedAudioContext();
  if (audio === undefined || audio.state === 'running') {
    return;
  }
  audio.resume().catch(() => {
    // Prohlížeč zvuk nepovolil: hra jde dál potichu, zkusí se při dalším ťuknutí.
  });
}

/** Je zvuk odemčený (kontext běží)? */
export function isSharedAudioUnlocked(): boolean {
  return sharedContext?.state === 'running';
}
