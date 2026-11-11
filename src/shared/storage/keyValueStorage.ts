/**
 * Úložiště v zařízení (localStorage), společné pro všechny hry. Prohlížeč
 * ho může zakázat (soukromý režim, vypnuté ukládání), pak hra jede dál
 * a hráč nevidí chybu.
 */

/** Část úložiště prohlížeče, kterou potřebujeme; v testech jde podvrhnout. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /**
   * Zápis s výsledkem (#131): `true`, jen když je hodnota opravdu uložená
   * v zařízení. Nepovedený zápis nic nezmění, ani v paměti, a nevyhodí
   * výjimku. Úložiště hry profilu ho má, jiná úložiště nemusí
   * (`setItemChecked` pak použije `setItem`).
   */
  trySetItem?(key: string, value: string): boolean;
}

/**
 * Zapíše hodnotu a vrátí, jestli se opravdu uložila (#131). Úložiště
 * s `trySetItem` se zeptá přímo, jinak je výjimka ze `setItem` (plné nebo
 * zakázané úložiště) „neuložilo se“. Výjimku nikdy nevyhodí.
 */
export function setItemChecked(storage: KeyValueStorage, key: string, value: string): boolean {
  try {
    // `typeof`: u `localStorage` by vlastnost mohla být i uložený záznam.
    if (typeof storage.trySetItem === 'function') {
      return storage.trySetItem(key, value);
    }
    storage.setItem(key, value);
    return true;
  } catch {
    // Plné nebo zakázané úložiště: volající ví, že se nic neuložilo.
    return false;
  }
}

/**
 * Úložiště prohlížeče, nebo `undefined`, když ho prohlížeč nepovolí. Celé
 * `Storage`, protože profily (#73) v něm umí i mazat a procházet klíče.
 */
export function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    // Safari v soukromém režimu může už přístup k localStorage odmítnout.
    return undefined;
  }
}
