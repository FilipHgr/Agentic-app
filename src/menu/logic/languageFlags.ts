/**
 * Vlajky jazyků v nabídce jazyků (#138): ploché vlajky ze sady Noto Emoji
 * (složka `third_party/region-flags`, převzaté z balíčku `@svgmoji/noto`)
 * uložené jako SVG ve složce `src/menu/flags/`, původ v `public/licence.txt`.
 * Systémové emoji vlajek se nepoužijí, na Windows by byla jen písmena.
 * Čistý TypeScript bez Phaseru.
 */

import type { Language } from '../../shared/texts/languages';

/** Vlajka jazyka: jméno emoji v sadě Noto a jméno souboru SVG ve složce vlajek. */
export interface LanguageFlag {
  readonly emoji: string;
  readonly file: string;
}

/** Jméno vlajky každého jazyka: čeština 🇨🇿, angličtina 🇬🇧 (britská podle #137). */
const FLAG_EMOJI: Readonly<Record<Language, string>> = {
  cs: 'flag-czechia',
  en: 'flag-united-kingdom',
};

export function languageFlag(language: Language): LanguageFlag {
  const emoji = FLAG_EMOJI[language];
  return { emoji, file: `${emoji}.svg` };
}

/** Vlajka jazyka podle kódu, nebo `null` pro jazyk bez vlajky (umělý jazyk v testech). */
export function languageFlagOf(code: string): LanguageFlag | null {
  return Object.hasOwn(FLAG_EMOJI, code) ? languageFlag(code as Language) : null;
}

/**
 * Vlajka v rámečku: viditelný obdélník (posun od levého horního rohu
 * rámečku, šířka a výška) a šířka, ve které se kreslí celá kresba vlajky.
 * Je-li kresba širší než viditelný obdélník, kraje se oříznou.
 */
export interface FlagFit {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly drawnWidth: number;
}

/**
 * Vlajka s poměrem stran `aspectRatio` (šířka / výška) vyplní celou výšku
 * rámečku `frameWidth` × `frameHeight`, aby byly všechny vlajky stejně
 * vysoké. Užší vlajka se vycentruje vodorovně, širší (britská 2 : 1
 * v rámečku 3 : 2) se zúží na šířku rámečku oříznutím krajů.
 */
export function fitFlag(frameWidth: number, frameHeight: number, aspectRatio: number): FlagFit {
  const ratio = aspectRatio > 0 && Number.isFinite(aspectRatio) ? aspectRatio : 1;
  const drawnWidth = frameHeight * ratio;
  const width = Math.min(frameWidth, drawnWidth);
  return {
    left: (frameWidth - width) / 2,
    top: 0,
    width,
    height: frameHeight,
    drawnWidth,
  };
}

/** Poměr stran SVG podle atributu `viewBox` kořene, nebo `null`, když chybí či je neplatný. */
export function svgAspectRatio(svg: string): number | null {
  const rootTag = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const viewBox = /\sviewBox\s*=\s*["']([^"']*)["']/.exec(rootTag)?.[1];
  if (viewBox === undefined) {
    return null;
  }
  const numbers = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const width = numbers[2];
  const height = numbers[3];
  if (numbers.length !== 4 || width === undefined || height === undefined) {
    return null;
  }
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? width / height
    : null;
}
