/**
 * Pomůcky pro testy ikon nástrojů Omalovánek (#106 v novém znění po
 * připomínce vlastníka): ikony jsou hotové obrázky z Google Noto Emoji
 * (Apache-2.0, balíček `@iconify-json/noto`) uložené jako SVG v repozitáři,
 * vybranou barvu v úchytu ukazuje barevné kolečko v rohu (místo tečky
 * velikosti čáry z #91).
 *
 * Navržené rozhraní (popis v `toolIconAssets.test.ts`):
 * - `toolIconAsset(tool)` v `src/games/coloring/logic/toolIcons.ts`: jméno
 *   emoji a soubor SVG ve složce `ICON_FOLDER`,
 * - `handleColorDotFill(view)` tamtéž: čím je kolečko barvy vyplněné,
 * - `handleColorDot(handle, size)` v `src/games/coloring/logic/coloringLayout.ts`:
 *   kruh barevné výplně kolečka v herních jednotkách,
 * - `HANDLE_COLOR_DOT_STYLE` v `src/games/coloring/logic/theme.ts`: bílý
 *   lem a šedá linka v CSS px, bílá výplň a čárkování gumy.
 */

import {
  handleColorDot,
  handleFace,
  toolSlotIcon,
} from '../../../src/games/coloring/logic/coloringLayout';
import { PALETTE, RAINBOW_COLORS } from '../../../src/games/coloring/logic/palette';
import { HANDLE_COLOR_DOT_STYLE } from '../../../src/games/coloring/logic/theme';
import { toolIconAsset } from '../../../src/games/coloring/logic/toolIcons';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { toCss } from '../../shared/viewportFixtures';
import type { Box } from '../../shared/viewportFixtures';
import { boxOfRect } from './coloringLayoutScenes';
import type { ColoringCase } from './coloringLayoutScenes';
import { TOOL_NAMES } from './lineSizeHelpers';
import licenceText from '../../../public/licence.txt?raw';

export { TOOL_NAMES };

/** Složka s SVG ikonami nástrojů v repozitáři (stahuje se s kódem hry). */
export const ICON_FOLDER = 'src/games/coloring/icons';

/** Text souboru s licencemi zdrojů třetích stran (`public/licence.txt`). */
export const LICENCE_TEXT: string = licenceText;

/** Ikona každého nástroje podle schváleného výběru (jméno emoji v sadě Noto). */
export const NOTO_EMOJI: Readonly<Record<ToolId, string>> = {
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

/** Pozadí úchytu (#96, otázka 4 původního zadání: zůstává #E5F0FF). */
export const HANDLE_BACKGROUND = '#E5F0FF';

/** Bílý lem kolečka barvy. */
export const WHITE = '#FFFFFF';

/** Nejmenší kontrast hrany kolečka vůči okolí (jako u ovládacích prvků, 3 : 1). */
export const MIN_CONTRAST = 3;

/** Nejmenší průměr barevné výplně kolečka v CSS px. */
export const MIN_DOT_CSS = 12;

/** Nejmenší šířka bílého lemu a šedé linky v CSS px (navržené, viz PROBLÉMY V ZADÁNÍ). */
export const MIN_RIM_CSS = 2;
export const MIN_LINE_CSS = 1;

/** Odstup ikony od okraje místa jako díl strany místa (AC2). */
export const MIN_MARGIN_SHARE = 0.1;

/** Odstíny duhy (#97) jako `#RRGGBB`. */
export const RAINBOW_HEXES: readonly string[] = RAINBOW_COLORS.map(
  (index) => PALETTE[index]?.hex ?? '',
);

export const TOOLS: readonly ToolId[] = PANEL_TOOLS;

/** Nástroje, které malují vybranou barvou (guma je bez barvy, duha v duze). */
export const COLOR_TOOLS: readonly ToolId[] = TOOLS.filter(
  (tool) => tool !== 'eraser' && tool !== 'rainbow',
);

/** Nejvýš tolik problémů se vypíše, aby zpráva zůstala čitelná. */
const MAX_PROBLEMS = 5;

export function limited(problems: string[]): string[] {
  return problems.length > MAX_PROBLEMS
    ? [...problems.slice(0, MAX_PROBLEMS), `… a dalších ${problems.length - MAX_PROBLEMS}`]
    : problems;
}

export function sameHex(first: string, second: string): boolean {
  return first.toUpperCase() === second.toUpperCase();
}

export function hexOf(color: number): string {
  const hex = PALETTE[color]?.hex;
  if (hex === undefined) {
    throw new Error(`barva ${color} v paletě není`);
  }
  return hex;
}

// ---------------------------------------------------------------------------
// Soubory ikon
// ---------------------------------------------------------------------------

/**
 * SVG soubory ve složce ikon, přečtené při sestavení (Vite `?raw`), podle
 * cesty od kořene repozitáře. Test tak vidí přesně soubory, které jsou
 * v repozitáři, nic nestahuje.
 */
const ICON_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../src/games/coloring/icons/*.svg', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  ).map(([path, content]) => [path.replace('../../../', ''), content]),
);

/** Cesta k SVG ikony nástroje v repozitáři (od kořene). */
export function iconPathOf(tool: ToolId): string {
  return `${ICON_FOLDER}/${toolIconAsset(tool).file}`;
}

export function iconFileExists(tool: ToolId): boolean {
  return ICON_FILES[iconPathOf(tool)] !== undefined;
}

/** Obsah SVG ikony nástroje (prázdný, když soubor chybí). */
export function iconSvgOf(tool: ToolId): string {
  return ICON_FILES[iconPathOf(tool)] ?? '';
}

/** Všechny SVG soubory ve složce ikon (cesty od kořene repozitáře). */
export function iconFolderFiles(): string[] {
  return Object.keys(ICON_FILES).sort();
}

/**
 * Odkazy z SVG mimo soubor: adresy `http(s)://` a `//…` kromě jmenných
 * prostorů (`xmlns="http://www.w3.org/2000/svg"` je jen označení, nic se
 * podle něj nestahuje). Odkazy uvnitř souboru (`url(#id)`, `href="#id"`) jsou v pořádku.
 */
export function externalReferences(svg: string): string[] {
  const withoutNamespaces = svg.replace(/\sxmlns(:[\w-]+)?\s*=\s*("[^"]*"|'[^']*')/g, '');
  return withoutNamespaces.match(/(https?:)?\/\/[^\s"')]+/g) ?? [];
}

// ---------------------------------------------------------------------------
// Rozložení (CSS px)
// ---------------------------------------------------------------------------

/** Čtverec ikony v úchytu v CSS px okna. */
export function handleIconBox(testCase: ColoringCase, size: LineSize = 'medium'): Box {
  return toCss(boxOfRect(handleFace(testCase.layout.handle, size).icon), testCase.area);
}

/** Čtverec ikony v místě nástroje `index` v panelu v CSS px okna. */
export function slotIconBox(testCase: ColoringCase, index: number): Box {
  const slot = testCase.layout.toolSlots[index];
  if (slot === undefined) {
    throw new Error(`místo nástroje ${index + 1} v rozložení chybí`);
  }
  return toCss(boxOfRect(toolSlotIcon(slot)), testCase.area);
}

/** Čtverec ikony vybraného nástroje v hlavičce kroku barev (#105) v CSS px okna. */
export function colorStepIconBox(testCase: ColoringCase): Box {
  return toCss(boxOfRect(toolSlotIcon(testCase.layout.colorStepTool)), testCase.area);
}

export function sideOfBox(box: Box): number {
  return Math.min(box.right - box.left, box.bottom - box.top);
}

/** Kolečko barvy v úchytu v CSS px okna. */
export interface DotCss {
  readonly x: number;
  readonly y: number;
  /** Průměr barevné výplně. */
  readonly fillDiameter: number;
  /** Poloměr celého kolečka i s bílým lemem a šedou linkou. */
  readonly outerRadius: number;
}

export function colorDotCss(testCase: ColoringCase, size: LineSize): DotCss {
  const dot = handleColorDot(testCase.layout.handle, size);
  const { scale, offsetX, offsetY } = testCase.area;
  const fillDiameter = dot.diameter * scale;
  return {
    x: offsetX + dot.centerX * scale,
    y: offsetY + dot.centerY * scale,
    fillDiameter,
    outerRadius: fillDiameter / 2 + HANDLE_COLOR_DOT_STYLE.rimCss + HANDLE_COLOR_DOT_STYLE.lineCss,
  };
}
