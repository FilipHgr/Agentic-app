/**
 * Ztmavení tlačítek stránky nad plátnem (domeček a kolečko nastavení)
 * během okna s Rudym (#170), bez Phaseru a bez DOM typů: stačí prvek se
 * stylem `filter`. Tlačítka jsou ztmavená stejně jako hra pod kartou
 * a po zavření okna dostanou zpátky svůj původní `filter`.
 */

import { RUDY_CARD_STYLE } from './rudyCard';

/** Prvek, kterému jde nastavit CSS `filter` (tlačítko stránky). */
export interface DimmableElement {
  readonly style: { filter: string };
}

/** Ztmavení jako ztmavení hry pod kartou (40 % černé). */
export const PAGE_BUTTON_DIM_FILTER = `brightness(${1 - RUDY_CARD_STYLE.dimAlpha})`;

/**
 * Ztmaví prvky (chybějící `null` přeskočí) a vrátí funkci, která jim vrátí
 * původní `filter`. Vrácení podruhé už nic nezmění.
 */
export function dimPageButtons(elements: readonly (DimmableElement | null)[]): () => void {
  const dimmed = elements
    .filter((element): element is DimmableElement => element !== null)
    .map((element) => ({ element, filter: element.style.filter }));
  for (const { element } of dimmed) {
    element.style.filter = PAGE_BUTTON_DIM_FILTER;
  }
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    for (const { element, filter } of dimmed) {
      element.style.filter = filter;
    }
  };
}
