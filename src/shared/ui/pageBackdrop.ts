/**
 * Pozadí stránky kolem plátna hry (#134): barva a obrázek přes celé okno
 * (CSS `cover`, na střed), nebo výchozí pozadí z `index.html`. Obrázek je
 * vždy ze stejné stránky (adresa souboru přibaleného ke hře).
 */

import type { PageBackdrop } from '../logic/gameHost';

/** Adresa obrázku jako řetězec CSS v uvozovkách, aby nešla rozbít. */
function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

/** Nastaví pozadí stránky; `null` vrátí výchozí ze stylu stránky. */
export function applyPageBackdrop(backdrop: PageBackdrop | null): void {
  const style = document.body.style;
  if (backdrop === null) {
    style.removeProperty('background-color');
    style.removeProperty('background-image');
    style.removeProperty('background-size');
    style.removeProperty('background-position');
    style.removeProperty('background-repeat');
    return;
  }
  style.backgroundColor = backdrop.color;
  if (backdrop.imageUrl === undefined) {
    style.removeProperty('background-image');
    return;
  }
  style.backgroundImage = cssUrl(backdrop.imageUrl);
  style.backgroundSize = 'cover';
  style.backgroundPosition = 'center';
  style.backgroundRepeat = 'no-repeat';
}
