/**
 * Ikony nástrojů Omalovánek (#106 po připomínce vlastníka): hotové obrázky
 * z Google Noto Emoji (Apache-2.0, Google Inc., balíček `@iconify-json/noto`)
 * uložené jako SVG ve složce `src/games/coloring/icons/`. Ikony zůstávají
 * v barvách autora, panel, hlavička kroku barev i pruh rychlého přepínání
 * kreslí pro nástroj stejný soubor, jen jinak velký. Barvu nástroje
 * ukazuje barevné kolečko u každého nástroje v kroku nástrojů (#110) a na
 * prvním tlačítku rychlého přepínání (#164, dřív v rohu úchytu), viz
 * `handleColorDotFill`. Úchyt má od #164 stálý symbol panelu
 * (`HANDLE_ICON_FILE`). Čistý TypeScript bez Phaseru.
 */

import { PALETTE, RAINBOW_COLORS } from './palette';
import { colorHex } from './toolColorSets';
import type { HandleView, ToolId } from './toolPanel';

/** Jména použitých emoji v sadě Noto. */
export type NotoEmojiName =
  | 'paintbrush'
  | 'eraser'
  | 'pen'
  | 'pencil'
  | 'rainbow'
  | 'star'
  | 'bubbles'
  | 'barber-pole'
  | 'sparkles'
  | 'splatter';

/** Ikona nástroje: jméno emoji a jméno souboru SVG ve složce ikon. */
export interface ToolIconAsset {
  readonly emoji: NotoEmojiName;
  readonly file: string;
}

/** Ikona každého nástroje podle schváleného výběru (obrázek `sada-1.png`). */
const TOOL_EMOJI: Readonly<Record<ToolId, NotoEmojiName>> = {
  brush: 'paintbrush',
  eraser: 'eraser',
  marker: 'pen',
  crayon: 'pencil',
  rainbow: 'rainbow',
  stamp: 'star',
  dots: 'bubbles',
  stripes: 'barber-pole',
  glitter: 'sparkles',
  spray: 'splatter',
};

/**
 * Ikony tlačítek alba a malování (#153, dřív Noto Emoji z #126, #129, #131
 * a #142): vlastní obrázky z ElevenLabs (GPT Image 2.5) ve stejném
 * plastickém stylu jako klíč, WebP s průhledností, čtverec 128 px.
 * Fotoaparát v malování uloží obrázek do alba, kniha na výběru otevře
 * album, obrázek s pastelkou na velkém obrázku z alba maluje dál, koš ho
 * z alba smaže a koště v malování vrátí stránku na začátek. Barvy podkladů
 * tlačítek jsou v `actionButtons.ts`.
 */
export const CAMERA_ICON_FILE = 'action-camera.webp';
export const BOOK_ICON_FILE = 'action-album.webp';
export const CONTINUE_ICON_FILE = 'action-continue.webp';
export const TRASH_ICON_FILE = 'action-trash.webp';
export const BROOM_ICON_FILE = 'action-broom.webp';

/**
 * Stálý symbol panelu v úchytu (#164 AC1): paleta 🎨 (U+1F3A8,
 * „artist-palette“) ze stejné sady Noto. Nemění se s nástrojem, barvou,
 * velikostí čáry ani gumou, aby se úchyt nepletl s tlačítkem nástroje.
 */
export const HANDLE_ICON_FILE = 'artist-palette.svg';

/**
 * Zámek zamčené omalovánky 🔒 (U+1F512, „locked“) a otevřený zámek 🔓
 * (U+1F513, „unlocked“) po odemčení (#140) ze stejné sady.
 */
export const LOCK_ICON_FILE = 'locked.svg';
export const UNLOCKED_ICON_FILE = 'unlocked.svg';

/**
 * Klíč ukazatele klíčů na výběru (#140) jako u cíle mapy v Počítání
 * (#139, návrh B z ElevenLabs): celý vodorovný klíč a jeho levá půlka,
 * hlava s hvězdou po spoj skládačky. Obrázky WebP s průhledností, čtverec
 * 256 px s klíčem uprostřed.
 */
export const KEY_ICON_FILE = 'key.webp';
export const KEY_HEAD_ICON_FILE = 'key-head.webp';

/** Ikona nástroje `tool`; nezávisí na vybrané barvě ani velikosti čáry. */
export function toolIconAsset(tool: ToolId): ToolIconAsset {
  const emoji = TOOL_EMOJI[tool];
  return { emoji, file: `${emoji}.svg` };
}

/** Čím je vyplněné kolečko barvy u nástroje v panelu a na prvním tlačítku rychlého přepínání. */
export type HandleColorDotFill =
  | { readonly kind: 'color'; readonly hex: string }
  | { readonly kind: 'eraser' }
  | { readonly kind: 'rainbow'; readonly hexes: readonly string[] };

/** Odstíny duhy (#97) v pořadí, jak je maluje duhový štětec. */
const RAINBOW_HEXES: readonly string[] = RAINBOW_COLORS.map((index) => PALETTE[index]?.hex ?? '');

/**
 * Kolečko barvy nástroje `view.tool` v panelu a na prvním tlačítku
 * rychlého přepínání (#164 AC4): malovací nástroj ve své barvě
 * `view.color` (#110), i z vlastní sady nástroje (#116), guma bílé
 * čárkované, duhový štětec v barvách duhy. Velikost čáry kolečko nevyplňuje.
 */
export function handleColorDotFill(view: HandleView): HandleColorDotFill {
  if (view.tool === 'eraser') {
    return { kind: 'eraser' };
  }
  if (view.tool === 'rainbow') {
    return { kind: 'rainbow', hexes: RAINBOW_HEXES };
  }
  const hex = view.color === null ? undefined : colorHex(view.color);
  if (hex === undefined) {
    // Malovací nástroj má vždy vybranou barvu, bez ní ukáže kolečko jako guma.
    return { kind: 'eraser' };
  }
  return { kind: 'color', hex };
}
