/**
 * Hlavní postavičky hry. Obrázky jsou v `public/characters/<postavička>/<nálada>.svg`
 * a generuje je `tools/characters/make_characters.py`. Další hry si odsud
 * jen vezmou seznam postaviček a cesty k obrázkům.
 */

/** Postavičky v pořadí, v jakém se ve hře střídají. */
export const CHARACTERS = ['hvezdik', 'robik', 'plaminek'] as const;

export type CharacterId = (typeof CHARACTERS)[number];

/** Nálady, pro které má každá postavička vlastní obrázek. Smutná mezi nimi záměrně není. */
export const CHARACTER_MOODS = ['klid', 'mrknuti', 'radost', 'povzbuzeni', 'oslava'] as const;

export type CharacterMood = (typeof CHARACTER_MOODS)[number];

/** Hra začíná Hvězdíkem, protože se hvězdičkou nejvíc pojí s hvězdičkami za odpovědi. */
export const FIRST_CHARACTER: CharacterId = 'hvezdik';

/** Cesta k obrázku postavičky v dané náladě, relativně ke kořeni webu. */
export function characterImagePath(character: CharacterId, mood: CharacterMood): string {
  return `characters/${character}/${mood}.svg`;
}

/** Klíč obrázku pro načtení do hry, například `hvezdik-radost`. */
export function characterImageKey(character: CharacterId, mood: CharacterMood): string {
  return `${character}-${mood}`;
}

/** Další postavička v pořadí; po poslední přijde znovu první. */
export function nextCharacter(character: CharacterId): CharacterId {
  const index = CHARACTERS.indexOf(character);
  return CHARACTERS[(index + 1) % CHARACTERS.length] ?? FIRST_CHARACTER;
}
