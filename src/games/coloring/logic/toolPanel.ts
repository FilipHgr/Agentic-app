/**
 * Panel nástrojů Omalovánek (#96): co ukazuje úchyt, tóny úchytu a záznam
 * o prvním otevření hry v profilu. Při úplně prvním otevření je panel
 * otevřený, aby dítě vidělo, co v něm je, jindy začíná zavřený. Záznam se
 * zapíše při prvním ukládání (tah, barva, Zpět) nebo nejpozději při
 * odchodu a schování stránky, ne hned při otevření: pouhé otevření hry do
 * úložiště nic nezapíše (#92 AC1). Kdo panel nezavře, uvidí ho příště
 * zavřený. Chybějící, nesmyslný nebo nečitelný záznam znamená první otevření.
 * Čistý TypeScript bez Phaseru.
 */

import type { Tone } from '../../../shared/audio/tonePlayer';
import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';

/** Nástroje Omalovánek; další přidají navazující úkoly (guma od #90). */
export type ToolId = 'brush';

/** Co ukazuje úchyt (#96 AC5): vybraný nástroj ve vybrané barvě (`null` bez barvy). */
export interface HandleView {
  readonly tool: ToolId;
  readonly color: number | null;
}

/** Krátký stoupající tón při otevření panelu, dozní za 0,2 s. */
export const PANEL_OPEN_TONES: readonly Tone[] = [
  { frequencyHz: 523.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.12 },
  { frequencyHz: 659.25, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.12 },
];

/** Krátký klesající tón při zavření panelu, dozní za 0,2 s. */
export const PANEL_CLOSE_TONES: readonly Tone[] = [
  { frequencyHz: 659.25, startSeconds: 0, durationSeconds: 0.08, volume: 0.1 },
  { frequencyHz: 523.25, startSeconds: 0.08, durationSeconds: 0.12, volume: 0.1 },
];

/** Klíč záznamu o prvním otevření v úložišti hry profilu. */
const PANEL_SEEN_KEY = 'toolPanel.seen';

/** Jediná platná hodnota záznamu; cokoli jiného je první otevření. */
const PANEL_SEEN_VALUE = '1';

/** Otevřel už profil Omalovánky? Selhání čtení je jako první otevření. */
export function wasOpenedBefore(storage: KeyValueStorage): boolean {
  try {
    return storage.getItem(PANEL_SEEN_KEY) === PANEL_SEEN_VALUE;
  } catch (error) {
    console.warn('Omalovánky: záznam o prvním otevření nejde přečíst', error);
    return false;
  }
}

/** Zapíše, že profil Omalovánky otevřel. Chyba úložiště hru nezastaví. */
export function rememberOpened(storage: KeyValueStorage): void {
  try {
    storage.setItem(PANEL_SEEN_KEY, PANEL_SEEN_VALUE);
  } catch (error) {
    console.warn('Omalovánky: záznam o prvním otevření nejde uložit', error);
  }
}
