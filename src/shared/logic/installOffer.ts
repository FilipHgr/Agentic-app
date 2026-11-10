/**
 * Hra sama nenabízí instalaci (#78 AC5). Chrome (např. na telefonu Samsung)
 * ohlásí událostí `beforeinstallprompt`, že by stránku mohl nainstalovat,
 * a když ji stránka nezruší, ukáže pruh „Nainstalovat aplikaci“. Dítě by
 * ho mohlo omylem ťuknout. Rodič může hru přidat na plochu sám z nabídky
 * prohlížeče.
 */

/** Událost, kterou Chrome nabízí instalaci stránky. */
export const INSTALL_OFFER_EVENT = 'beforeinstallprompt';

/**
 * Zruší každou nabídku instalace na stránce `page` (obvykle `window`).
 * Menu i hra běží na jedné stránce, stačí zavolat jednou při startu.
 */
export function blockInstallOffer(page: EventTarget): void {
  page.addEventListener(INSTALL_OFFER_EVENT, (event) => {
    event.preventDefault();
  });
}
