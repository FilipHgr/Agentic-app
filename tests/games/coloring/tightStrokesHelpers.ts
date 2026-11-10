/**
 * Pomůcky pro testy #119: obrázek z těsných tahů (vodorovných i svislých)
 * se vejde do limitu uložení.
 *
 * Vzor „těsné tahy“ podle AC1 (schválený výklad v komentáři k #119):
 * - Vodorovné tahy jdou přes celou šířku obrázku, svislé přes celou výšku.
 *   Kde je v řádku (sloupci) obrys, začne v každém souvislém úseku mimo
 *   obrys nový tah, protože tah se ořízne do oblasti, kde začal.
 * - Středy sousedních řádků (sloupců) jsou od sebe přesně o šířku stopy
 *   nástroje v dané tloušťce, stopy se dotýkají a nepřekrývají. První
 *   řádek má střed o polovinu šířky stopy od horního okraje (první sloupec
 *   od levého).
 * - Tahy se počítají po řádcích shora a v řádku zleva, u svislých po
 *   sloupcích zleva a ve sloupci shora. Barva n-tého tahu je n-tá barva
 *   pořadí, dokola.
 * - Duha maluje svých 6 barev; jako místo v řadě se bere barva duhy, takže
 *   ji pořadí barev jen přemapuje (stejné pravidlo jako
 *   `verticalStrokePlaces` v `manyColorsHelpers.ts`).
 *
 * Šířky jsou schválně opsané ze zadání (`lineSizeHelpers.ts`,
 * `thinnestHelpers.ts`), ne konstanty z kódu: W tloušťky je díl šířky
 * plochy (nejtenčí 1/100, malá 1/50, střední 1/30, velká 1/15), stopa je
 * násobek W (štětec a duha 1, fix 0,6, pastelka 0,5, razítkový fix 1,5,
 * puntíkový a proužkový fix 1, třpytky 1,5, sprej 2). U nejtenčí malují
 * puntíkový a proužkový fix a třpytky šířkou W malé (#118 AC2).
 *
 * Čísla tahů se nevejdou do vrstvy barev (je jich až tisíce), obrázek se
 * proto nakreslí dvakrát: jednou s barvou tahu podle čísla tahu dokola
 * přes 46 míst (pro pořadí 46 barev sad) a jednou dokola přes 64 míst (pro
 * zkušební paletu 64 barev). Místo v řadě se pak převede na barvu pořadí.
 * Tvar obou obrázků je stejný, barva tvar stopy nemění.
 */

import { createColoring } from '../../../src/games/coloring/logic/coloring';
import type { Coloring } from '../../../src/games/coloring/logic/coloring';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { COLORING_META } from '../../../src/games/coloring/meta';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { pixelDifferences, usedColors, worstCaseOutlines } from './extendedPaletteHelpers';
import { SIZE_NAMES, TOOL_FACTOR, TOOL_NAMES, WIDTH_SHARE } from './lineSizeHelpers';
import {
  ASCENDING_ORDER,
  FAR_ORDER,
  PICTURE_KEY,
  TEST_PALETTE_SIZE,
  colorsOf,
  decodeWithTestPalette,
  encodeWithTestPalette,
  enterWithTestPalette,
  pixelsFrom,
} from './manyColorsHelpers';
import { PICTURE, RecordingStorage, enterColoring, openOn, twoHalves } from './savedPictureHelpers';
import { tinyStrokeWidth } from './thinnestHelpers';
import { ALL_COLOR_COUNT, allSetColors } from './toolColorSetsHelpers';

/** Všech 9 malovacích nástrojů bez gumy (AC1, doporučení reviewera). */
export const PAINTING_TOOLS = [
  'brush',
  'marker',
  'crayon',
  'rainbow',
  'stamp',
  'dots',
  'stripes',
  'glitter',
  'spray',
] as const satisfies readonly ToolId[];

export type PaintingTool = (typeof PAINTING_TOOLS)[number];

/** Směr těsných tahů. */
export type StrokeDirection = 'horizontal' | 'vertical';

export const DIRECTION_NAMES: Readonly<Record<StrokeDirection, string>> = {
  horizontal: 'vodorovné tahy',
  vertical: 'svislé tahy',
};

/** Krok dráhy prstu mezi dvěma údaji o dotyku v px (jako v dnešních testech limitu). */
const MOVE_STEP = 16;

/**
 * Šířka W, kterou nástroj `tool` maluje tloušťkou `size` na ploše široké
 * `pictureWidth` (opsáno ze zadání #91 AC2 a #118 AC2).
 */
export function strokeW(tool: ToolId, size: LineSize, pictureWidth: number): number {
  return size === 'tiny' ? tinyStrokeWidth(tool, pictureWidth) : pictureWidth * WIDTH_SHARE[size];
}

/** Šířka stopy nástroje `tool` tloušťkou `size`: násobek W ze zadání (AC1). */
export function traceWidth(tool: ToolId, size: LineSize, pictureWidth: number): number {
  return TOOL_FACTOR[tool] * strokeW(tool, size, pictureWidth);
}

function isFree(regions: RegionMap, x: number, y: number): boolean {
  const region = regionAt(regions, x, y);
  return region !== null && region !== OUTLINE_REGION;
}

/**
 * Souvislé úseky mimo obrys na čáře `line` (řádek u vodorovných, sloupec
 * u svislých tahů) jako [první, poslední] pixel podél čáry.
 */
function freeRuns(
  regions: RegionMap,
  direction: StrokeDirection,
  line: number,
): Array<[number, number]> {
  const length = direction === 'horizontal' ? regions.width : regions.height;
  const free = (along: number): boolean =>
    direction === 'horizontal' ? isFree(regions, along, line) : isFree(regions, line, along);
  const runs: Array<[number, number]> = [];
  let start: number | null = null;
  for (let along = 0; along < length; along += 1) {
    if (free(along)) {
      start ??= along;
    } else if (start !== null) {
      runs.push([start, along - 1]);
      start = null;
    }
  }
  if (start !== null) {
    runs.push([start, length - 1]);
  }
  return runs;
}

/** Jeden tah od `from` do `to` podél čáry se středem `center` (px). */
function drawStroke(
  coloring: Coloring,
  options: {
    readonly id: number;
    readonly direction: StrokeDirection;
    readonly center: number;
    readonly from: number;
    readonly to: number;
    readonly color: number;
  },
  tool: ToolId,
  width: number,
): void {
  const { id, direction, center, from, to, color } = options;
  const point = (along: number): { id: number; x: number; y: number; kind: 'touch' } =>
    direction === 'horizontal'
      ? { id, x: along, y: center, kind: 'touch' }
      : { id, x: center, y: along, kind: 'touch' };
  coloring.pointerDown(point(from), color, tool, width);
  for (let along = from + MOVE_STEP; along < to; along += MOVE_STEP) {
    coloring.pointerMove(point(along));
  }
  coloring.pointerMove(point(to));
  coloring.pointerUp(id);
}

/** Obrázek těsných tahů jednoho nástroje, tloušťky a směru na jednom obrysu. */
export interface TightPicture {
  /** Kolik tahů obrázek má. */
  readonly strokeCount: number;
  /** Místa v řadě dokola přes 46 míst (barvy sad), `null` bez barvy. */
  readonly places46: Array<number | null>;
  /** Místa v řadě dokola přes 64 míst (zkušební paleta), `null` bez barvy. */
  readonly places64: Array<number | null>;
}

/**
 * Nakreslí těsné tahy nástrojem `tool` tloušťkou `size` ve směru
 * `direction`. Barva tahu je jeho číslo dokola přes `cycle` míst, duha
 * maluje svými barvami.
 */
function drawTight(
  regions: RegionMap,
  tool: ToolId,
  size: LineSize,
  direction: StrokeDirection,
  cycle: number,
): { strokeCount: number; places: Array<number | null> } {
  const coloring = createColoring(regions);
  const width = strokeW(tool, size, regions.width);
  const spacing = traceWidth(tool, size, regions.width);
  const across = direction === 'horizontal' ? regions.height : regions.width;
  let strokeNumber = 0;
  for (let center = spacing / 2; center < across; center += spacing) {
    for (const [first, last] of freeRuns(regions, direction, Math.floor(center))) {
      drawStroke(
        coloring,
        {
          id: strokeNumber + 1,
          direction,
          center,
          from: first + 0.5,
          to: last + 0.5,
          color: strokeNumber % cycle,
        },
        tool,
        width,
      );
      strokeNumber += 1;
    }
  }
  return { strokeCount: strokeNumber, places: pixelsFrom(coloring, regions) };
}

/** Těsné tahy podle AC1 (vodorovné) a AC2 (svislé) v místech řady. */
export function tightStrokes(
  regions: RegionMap,
  tool: PaintingTool,
  size: LineSize,
  direction: StrokeDirection,
): TightPicture {
  const first = drawTight(regions, tool, size, direction, ALL_COLOR_COUNT);
  if (tool === 'rainbow') {
    // Duha barvu tahu nepoužije, oba obrázky by byly stejné.
    return { strokeCount: first.strokeCount, places46: first.places, places64: first.places };
  }
  const second = drawTight(regions, tool, size, direction, TEST_PALETTE_SIZE);
  return { strokeCount: first.strokeCount, places46: first.places, places64: second.places };
}

/** Pořadí barev pro matici: název, paleta a barva podle místa v řadě. */
export interface MatrixOrder {
  readonly name: string;
  /** Zkušební paleta 64 barev (#115), jinak dnešní hra se 46 barvami sad (#116). */
  readonly testPalette: boolean;
  readonly colors: readonly number[];
}

let cachedOrders: MatrixOrder[] | undefined;

/**
 * Čtyři pořadí barev z AC1: 46 barev sad po sloupcích tabulky a střídáním
 * vzdálených barev (jako #116 AC6), zkušební paleta 64 barev vzestupně
 * a střídáním vzdálených (jako #115 AC2). Čísla barev sad testy neznají,
 * berou je z kroků barev nástrojů.
 */
export function matrixOrders(): MatrixOrder[] {
  if (cachedOrders !== undefined) {
    return cachedOrders;
  }
  const byColumns = allSetColors(openOn(new RecordingStorage(), twoHalves()));
  const far = byColumns.map((_, place) =>
    place % 2 === 0
      ? (byColumns[place / 2] ?? 0)
      : (byColumns[byColumns.length - 1 - (place - 1) / 2] ?? 0),
  );
  const palette64 = (colorOf: (place: number) => number): number[] =>
    Array.from({ length: TEST_PALETTE_SIZE }, (_, place) => colorOf(place));
  cachedOrders = [
    { name: '46 barev po sloupcích tabulky', testPalette: false, colors: byColumns },
    { name: '46 barev, střídání vzdálených', testPalette: false, colors: far },
    {
      name: '64 barev, pořadí 0, 1, 2, …',
      testPalette: true,
      colors: palette64(ASCENDING_ORDER.colorOf),
    },
    {
      name: '64 barev, pořadí 0, 63, 1, 62, …',
      testPalette: true,
      colors: palette64(FAR_ORDER.colorOf),
    },
  ];
  return cachedOrders;
}

/** Místa v řadě převedená na barvy pořadí `order` dokola. */
export function inMatrixOrder(
  places: ReadonlyArray<number | null>,
  order: MatrixOrder,
): Array<number | null> {
  return places.map((place) =>
    place === null ? null : (order.colors[place % order.colors.length] ?? null),
  );
}

/** Zakóduje obrázek tak, jak ho uloží hra s paletou pořadí. */
export function encodeInOrder(
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
  selectedColor: number,
  order: MatrixOrder,
): string {
  return order.testPalette
    ? encodeWithTestPalette(regions, pixels, selectedColor)
    : encodePicture({
        picture: PICTURE,
        regions,
        colors: colorsOf(pixels, regions),
        selectedColor,
      });
}

/** Přečte záznam s paletou pořadí. */
export function decodeInOrder(
  record: string,
  regions: RegionMap,
  order: MatrixOrder,
): ReturnType<typeof decodePicture> {
  return order.testPalette
    ? decodeWithTestPalette(record, regions)
    : decodePicture(record, PICTURE, regions);
}

/** Jeden obrázek matice: co to je, obrys, pixely, pořadí a jeho záznam. */
export interface MatrixPicture {
  readonly what: string;
  readonly regions: RegionMap;
  readonly pixels: Array<number | null>;
  readonly order: MatrixOrder;
  readonly selectedColor: number;
  readonly record: string;
  /** Kolik tahů obrázek má. */
  readonly strokeCount: number;
  /** Jaký díl pixelů mimo obrys má barvu. */
  readonly paintedShare: number;
}

/** Jaký díl pixelů mimo obrys má barvu. */
export function paintedShare(regions: RegionMap, pixels: ReadonlyArray<number | null>): number {
  let free = 0;
  let painted = 0;
  pixels.forEach((pixel, index) => {
    if (isFree(regions, index % regions.width, Math.floor(index / regions.width))) {
      free += 1;
      painted += pixel === null ? 0 : 1;
    }
  });
  return painted / free;
}

/**
 * Všechny obrázky matice jednoho nástroje, tloušťky a směru: tři nejhorší
 * obrysy a čtyři pořadí barev, každý se záznamem. Vybraná barva je
 * poslední barva pořadí, aby i hlavička nesla nejdelší hodnotu.
 */
export function matrixPictures(
  tool: PaintingTool,
  size: LineSize,
  direction: StrokeDirection,
): MatrixPicture[] {
  const pictures: MatrixPicture[] = [];
  for (const { name, regions } of worstCaseOutlines()) {
    const tight = tightStrokes(regions, tool, size, direction);
    const share = paintedShare(regions, tight.places46);
    for (const order of matrixOrders()) {
      const pixels = inMatrixOrder(order.testPalette ? tight.places64 : tight.places46, order);
      const selectedColor = order.colors[order.colors.length - 1] ?? 0;
      pictures.push({
        what: `${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}, ${DIRECTION_NAMES[direction]}, ${name}, ${order.name}`,
        regions,
        pixels,
        order,
        selectedColor,
        record: encodeInOrder(regions, pixels, selectedColor, order),
        strokeCount: tight.strokeCount,
        paintedShare: share,
      });
    }
  }
  return pictures;
}

/** Co se přečetlo ze záznamu obrázku: vybraná barva a rozdíly pixelů proti obrázku. */
export interface ReadBack {
  /** Vybraná barva ze záznamu; `null`, když záznam nejde přečíst. */
  readonly selectedColor: number | null;
  /** Rozdíly pixel po pixelu (`pixelDifferences`), prázdné u stejného obrázku. */
  readonly differences: string[];
}

/** Přečte záznam obrázku matice a porovná ho s nakresleným obrázkem. */
export function readBack(picture: MatrixPicture): ReadBack {
  const { regions, pixels, order, record } = picture;
  const decoded = decodeInOrder(record, regions, order);
  if (decoded === null) {
    return { selectedColor: null, differences: ['záznam nejde přečíst'] };
  }
  return {
    selectedColor: decoded.selectedColor,
    differences: pixelDifferences(pixelsFrom(decoded.colors, regions), pixels, regions.width),
  };
}

/** Nejhorší obrázek (nejdelší záznam) ze seznamu. */
export function worstOf(pictures: readonly MatrixPicture[]): MatrixPicture | undefined {
  let worst: MatrixPicture | undefined;
  for (const picture of pictures) {
    if (worst === undefined || picture.record.length > worst.record.length) {
      worst = picture;
    }
  }
  return worst;
}

/** Co dítě vidělo po otevření, po návratu z menu a po obnovení stránky. */
export interface RestoreSteps {
  /** Barva, na kterou dítě ťuklo, aby hra obrázek celý znovu uložila. */
  readonly tapped: number;
  readonly afterOpen: string[];
  readonly afterMenu: string[];
  readonly menuSelected: number;
  readonly afterReload: string[];
  readonly reloadSelected: number;
}

/**
 * Obrázek matice v úložišti zařízení: hra ho otevře, dítě ťukne na jinou
 * barvu pořadí (hra obrázek celý znovu uloží), odejde domečkem do menu
 * a vrátí se, pak se obnoví stránka. Vrátí rozdíly pixelů proti obrázku
 * v každém kroku a vybranou barvu po návratu a po obnovení: ťuknutá barva
 * znamená, že hra uložila nový záznam a neotevřel se starší stav.
 */
export function restoreAfterMenuAndReload(picture: MatrixPicture): RestoreSteps {
  const { regions, pixels, order, selectedColor } = picture;
  const enter = order.testPalette ? enterWithTestPalette : enterColoring;
  const device = new DeviceStorage();
  openProfiles(device).gameStorage(COLORING_META.id).setItem(PICTURE_KEY, picture.record);
  const differencesIn = (game: { colorAt(x: number, y: number): number | null }): string[] =>
    pixelDifferences(pixelsFrom(game, regions), pixels, regions.width);

  const store = openProfiles(device);
  const game = enter(store, regions);
  const afterOpen = differencesIn(game);
  const tapped = order.colors.find((color) => color !== selectedColor) ?? 0;
  game.tapColor(tapped);
  game.suspend();

  const back = enter(store, regions);
  const afterMenu = differencesIn(back);
  const menuSelected = back.palette().selected;
  back.suspend();

  const reloaded = enter(openProfiles(device), regions);
  return {
    tapped,
    afterOpen,
    afterMenu,
    menuSelected,
    afterReload: differencesIn(reloaded),
    reloadSelected: reloaded.palette().selected,
  };
}

/** Kolik různých barev obrázek má. */
export function colorCountOf(pixels: ReadonlyArray<number | null>): number {
  return usedColors(pixels).length;
}
