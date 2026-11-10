/**
 * Ikony nástrojů Omalovánek (#106 po připomínce vlastníka): hotové obrázky
 * z Google Noto Emoji (Apache-2.0, Google Inc., balíček `@iconify-json/noto`)
 * uložené jako SVG ve složce `src/games/coloring/icons/`. Ikony zůstávají
 * v barvách autora, panel, hlavička kroku barev i úchyt kreslí pro nástroj
 * stejný soubor, jen jinak velký. Barvu nástroje ukazuje barevné kolečko
 * v rohu úchytu a od #110 i u každého nástroje v kroku nástrojů
 * (`handleColorDotFill`). Čistý TypeScript bez Phaseru.
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
 * Ikony tlačítek mimo nástroje (#126) ze stejné sady Noto Emoji: fotoaparát
 * 📷 (U+1F4F7, „camera“) v malování a kniha 📔 (U+1F4D4, „notebook with
 * decorative cover“) na výběru omalovánky.
 */
export const CAMERA_ICON_FILE = 'camera.svg';
export const BOOK_ICON_FILE = 'notebook-with-decorative-cover.svg';

/** Koš 🗑️ (U+1F5D1, „wastebasket“) na velkém obrázku z alba (#129) ze stejné sady. */
export const TRASH_ICON_FILE = 'wastebasket.svg';

/** Ikona nástroje `tool`; nezávisí na vybrané barvě ani velikosti čáry. */
export function toolIconAsset(tool: ToolId): ToolIconAsset {
  const emoji = TOOL_EMOJI[tool];
  return { emoji, file: `${emoji}.svg` };
}

/** Čím je vyplněné kolečko barvy v úchytu a u nástroje v panelu. */
export type HandleColorDotFill =
  | { readonly kind: 'color'; readonly hex: string }
  | { readonly kind: 'eraser' }
  | { readonly kind: 'rainbow'; readonly hexes: readonly string[] };

/** Odstíny duhy (#97) v pořadí, jak je maluje duhový štětec. */
const RAINBOW_HEXES: readonly string[] = RAINBOW_COLORS.map((index) => PALETTE[index]?.hex ?? '');

/**
 * Kolečko barvy nástroje `view.tool` v úchytu i v panelu: malovací nástroj
 * ve své barvě `view.color` (#110), i z vlastní sady nástroje (#116), guma bílé čárkované, duhový
 * štětec v barvách duhy. Velikost čáry kolečko nevyplňuje.
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
