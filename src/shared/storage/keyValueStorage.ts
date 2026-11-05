/**
 * Úložiště v zařízení (localStorage), společné pro všechny hry. Prohlížeč
 * ho může zakázat (soukromý režim, vypnuté ukládání), pak hra jede dál
 * a hráč nevidí chybu.
 */

/** Část úložiště prohlížeče, kterou potřebujeme; v testech jde podvrhnout. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Úložiště prohlížeče, nebo `undefined`, když ho prohlížeč nepovolí. */
export function browserStorage(): KeyValueStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Safari v soukromém režimu může už přístup k localStorage odmítnout.
    return undefined;
  }
}
