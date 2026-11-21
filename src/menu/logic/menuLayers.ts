/**
 * Vrstvy scény menu v pořadí kreslení, aby šlo bez prohlížeče ověřit, co
 * leží nad čím. Čistý TypeScript bez Phaseru.
 *
 * Každá vrstva má vlastní kameru a kamery kreslí v tomto pořadí, pozdější
 * vrstva leží nad dřívější. První vrstvu kreslí hlavní kamera scény.
 *
 * - `bar` lišta (profil, jazyk, tlačítko výběru kategorie),
 * - `mascot` panda (#168), pod nabídkou jazyků i seznamem kategorií (AC5),
 * - `categories` a `tiles` posouvané kategorie a mřížka her (#69),
 * - `languagePanel` a `languageList` karta a seznam nabídky jazyků (#70),
 * - `pickerPanel` a `pickerList` karta a seznam kategorií (#95).
 */

export const MENU_LAYERS = [
  'bar',
  'mascot',
  'categories',
  'tiles',
  'languagePanel',
  'languageList',
  'pickerPanel',
  'pickerList',
] as const;

export type MenuLayerName = (typeof MENU_LAYERS)[number];
