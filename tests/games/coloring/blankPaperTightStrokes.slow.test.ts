import { describe, expect, it } from 'vitest';

import { albumRecordOf, readAlbum, readAlbumRecord } from '../../../src/games/coloring/logic/album';
import { NO_COLOR } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import {
  decodePicture,
  encodePicture,
  openColoring,
  pageKeyOf,
} from '../../../src/games/coloring/logic/savedPicture';
import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { COLORING_META } from '../../../src/games/coloring/meta';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../../src/shared/storage/profileRecords';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { PAPER, paperRegions } from './blankPaperHelpers';
import { pixelDifferences } from './extendedPaletteHelpers';
import { ALL_SIZES, SIZE_NAMES, TOOL_NAMES } from './lineSizeHelpers';
import {
  RESERVED_RECORD_LIMIT,
  TEST_PALETTE_SIZE,
  colorsOf,
  encodeWithTestPalette,
  pixelsFrom,
} from './manyColorsHelpers';
import {
  DIRECTION_NAMES,
  PAINTING_TOOLS,
  inMatrixOrder,
  matrixOrders,
  paintedShare,
  tightStrokes,
} from './tightStrokesHelpers';
import type { MatrixOrder, PaintingTool, StrokeDirection } from './tightStrokesHelpers';

/**
 * Testy k #151 AC4: matice těsných tahů z #119 (vodorovné i svislé, všemi
 * 9 malovacími nástroji ve všech 4 tloušťkách a ve 4 pořadích barev) přes
 * celý papír se vejde do limitu záznamu stránky i alba a po obnovení
 * stránky je pixel po pixelu stejná.
 *
 * Vzor tahů a pořadí barev jsou z #119 (`tightStrokesHelpers.ts`), jen
 * místo tří nejhorších obrysů se kreslí na mapu oblastí papíru
 * (`blankPaperRegions()`, navržené rozhraní v `blankPaper.test.ts`).
 * - Stránka: záznam s označením papíru má nejvýš 45 000 znaků (stejná
 *   rezerva 10 % pod limitem 50 000 jako v #119) a přečte se pixel po pixelu.
 * - Album: přijímá jen barvy sad (#126), proto se do alba ukládají jen dvě
 *   pořadí 46 barev sad. Vrstva se vejde do limitu bajtů záznamu alba
 *   (`albumRecordOf` nevrátí `null`) a přečte se pixel po pixelu.
 * - Obnovení: nejhorší obrázek (nejdelší záznam ze 46 barev) uložený na
 *   stránce papíru se po návratu z menu i po obnovení stránky otevře pixel
 *   po pixelu stejně a jeho obrázek v albu se po obnovení stránky přečte
 *   pixel po pixelu stejně.
 *
 * Pomalá skupina (`test:coloring:slow`): jeden test na nástroj, tloušťku
 * a směr, každý pod 20 s.
 */

/** Nejmenší díl papíru, který vzor pokrývá (jako v #119, třpytky velké asi 0,11). */
const MIN_PAINTED_SHARE = 0.05;

/** Jeden obrázek matice na papíře. */
interface PaperMatrixPicture {
  readonly what: string;
  readonly order: MatrixOrder;
  readonly pixels: Array<number | null>;
  readonly selectedColor: number;
  readonly record: string;
}

/** Vrstva barev z pixelů (bez barvy `NO_COLOR`). */
function layerOf(pixels: ReadonlyArray<number | null>): Uint8Array {
  return Uint8Array.from(pixels, (pixel) => (pixel === null ? NO_COLOR : pixel));
}

/** Záznam stránky papíru tak, jak ho uloží hra s paletou pořadí. */
function pageRecordOfPaper(
  regions: RegionMap,
  pixels: ReadonlyArray<number | null>,
  selectedColor: number,
  order: MatrixOrder,
): string {
  return order.testPalette
    ? encodeWithTestPalette(regions, pixels, selectedColor, PAPER)
    : encodePicture({ picture: PAPER, regions, colors: colorsOf(pixels, regions), selectedColor });
}

/** Obrázky matice jednoho nástroje, tloušťky a směru na papíře, ve všech 4 pořadích. */
function paperMatrix(
  tool: PaintingTool,
  size: LineSize,
  direction: StrokeDirection,
): PaperMatrixPicture[] {
  const regions = paperRegions();
  const tight = tightStrokes(regions, tool, size, direction);
  const base = `${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}, ${DIRECTION_NAMES[direction]}, papír`;
  expect(tight.strokeCount, `${base}: počet tahů`).toBeGreaterThan(0);
  expect(paintedShare(regions, tight.places46), `${base}: vzor pokrývá papír`).toBeGreaterThan(
    MIN_PAINTED_SHARE,
  );
  return matrixOrders().map((order) => {
    const pixels = inMatrixOrder(order.testPalette ? tight.places64 : tight.places46, order);
    const selectedColor = order.colors[order.colors.length - 1] ?? 0;
    return {
      what: `${base}, ${order.name}`,
      order,
      pixels,
      selectedColor,
      record: pageRecordOfPaper(regions, pixels, selectedColor, order),
    };
  });
}

/** Záznam stránky se vejde do rezervy a přečte se pixel po pixelu i s vybranou barvou. */
function expectPageRecordFits(picture: PaperMatrixPicture): void {
  const regions = paperRegions();
  const { what, record, order } = picture;
  expect(record.length, `${what}: délka záznamu stránky`).toBeLessThanOrEqual(
    RESERVED_RECORD_LIMIT,
  );
  const decoded = decodePicture(
    record,
    PAPER,
    regions,
    order.testPalette ? TEST_PALETTE_SIZE : undefined,
  );
  expect(decoded, `${what}: záznam stránky jde přečíst`).not.toBeNull();
  if (decoded === null) {
    return;
  }
  expect(decoded.selectedColor, `${what}: vybraná barva`).toBe(picture.selectedColor);
  expect(
    pixelDifferences(pixelsFrom(decoded.colors, regions), picture.pixels, regions.width),
    `${what}: stránka pixel po pixelu`,
  ).toEqual([]);
}

/** Obrázek v barvách sad se vejde do záznamu alba a přečte se pixel po pixelu. */
function expectAlbumRecordFits(picture: PaperMatrixPicture): void {
  const regions = paperRegions();
  const { what } = picture;
  const data = albumRecordOf(PAPER, regions, layerOf(picture.pixels));
  expect(data, `${what}: vejde se do limitu záznamu alba`).not.toBeNull();
  if (data === null) {
    return;
  }
  const read = readAlbumRecord(data, [{ identity: PAPER, regions }]);
  expect(read, `${what}: záznam alba jde přečíst`).not.toBeNull();
  if (read === null) {
    return;
  }
  expect(read.picture.identity, `${what}: obrázek alba patří papíru`).toEqual(PAPER);
  expect(
    pixelDifferences(
      Array.from(read.layer, (value) => (value === NO_COLOR ? null : value)),
      picture.pixels,
      regions.width,
    ),
    `${what}: album pixel po pixelu`,
  ).toEqual([]);
}

/** Nejdelší záznam z obrázků. */
function worstOf(pictures: readonly PaperMatrixPicture[]): PaperMatrixPicture | undefined {
  let worst: PaperMatrixPicture | undefined;
  for (const picture of pictures) {
    if (worst === undefined || picture.record.length > worst.record.length) {
      worst = picture;
    }
  }
  return worst;
}

/**
 * Nejhorší obrázek na stránce papíru: hra ho otevře, dítě ťukne na jinou
 * barvu (hra papír celý znovu uloží), odejde do menu a vrátí se, pak se
 * obnoví stránka. Papír je v každém kroku pixel po pixelu stejný.
 */
function expectPageRestored(picture: PaperMatrixPicture): void {
  const regions = paperRegions();
  const { what, pixels } = picture;
  const device = new DeviceStorage();
  openProfiles(device).gameStorage(COLORING_META.id).setItem(pageKeyOf(PAPER), picture.record);
  const open = (store: ReturnType<typeof openProfiles>) =>
    openColoring({ regions, picture: PAPER, storage: store.gameStorage(COLORING_META.id) });
  const differences = (game: { colorAt(x: number, y: number): number | null }): string[] =>
    pixelDifferences(pixelsFrom(game, regions), pixels, regions.width);

  const store = openProfiles(device);
  const game = open(store);
  expect(differences(game), `${what}: po otevření papíru`).toEqual([]);
  const tapped = picture.order.colors.find((color) => color !== picture.selectedColor) ?? 0;
  game.tapColor(tapped);
  game.suspend();

  const back = open(store);
  expect(differences(back), `${what}: po návratu z menu`).toEqual([]);
  expect(back.palette().selected, `${what}: po návratu z menu je uložený nový stav`).toBe(tapped);
  back.suspend();

  const reloaded = open(openProfiles(device));
  expect(differences(reloaded), `${what}: po obnovení stránky`).toEqual([]);
  expect(reloaded.palette().selected, `${what}: po obnovení stránky vybraná barva`).toBe(tapped);
}

/** Nejhorší obrázek v albu se po obnovení stránky (nové záznamy nad stejnými daty) přečte stejně. */
async function expectAlbumRestored(picture: PaperMatrixPicture): Promise<void> {
  const regions = paperRegions();
  const { what } = picture;
  const shelf = createMemoryRecordsShelf();
  const records = () => memoryProfileRecords(shelf).forGame('p-paper', COLORING_META.id);
  const data = albumRecordOf(PAPER, regions, layerOf(picture.pixels));
  expect(data, `${what}: záznam alba`).not.toBeNull();
  if (data === null) {
    return;
  }
  expect((await records().add(data)).status, `${what}: uložení do alba`).toBe('saved');

  const album = await readAlbum(records(), [{ identity: PAPER, regions }]);
  expect(album.status, `${what}: album po obnovení stránky`).toBe('read');
  const entries = album.status === 'read' ? album.entries : [];
  expect(entries.length, `${what}: obrázek je v albu`).toBe(1);
  const [entry] = entries;
  if (entry === undefined) {
    return;
  }
  expect(
    pixelDifferences(pixelsFrom(entry.colors, regions), picture.pixels, regions.width),
    `${what}: album po obnovení stránky pixel po pixelu`,
  ).toEqual([]);
}

const DIRECTIONS: readonly StrokeDirection[] = ['horizontal', 'vertical'];

describe('#151 AC4: matice těsných tahů přes celý papír se vejde do stránky i alba', () => {
  for (const direction of DIRECTIONS) {
    for (const tool of PAINTING_TOOLS) {
      for (const size of ALL_SIZES) {
        it(`${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}, ${DIRECTION_NAMES[direction]}: papír z těsných tahů v různých barvách se uloží na stránku i do alba celý a po obnovení stránky je stejný`, async () => {
          const pictures = paperMatrix(tool, size, direction);
          for (const picture of pictures) {
            expectPageRecordFits(picture);
          }
          const gameColors = pictures.filter((picture) => !picture.order.testPalette);
          expect(gameColors.length, 'kontrola: pořadí 46 barev sad').toBe(2);
          for (const picture of gameColors) {
            expectAlbumRecordFits(picture);
          }
          const worst = worstOf(gameColors);
          expect(worst, 'kontrola: matice má obrázky').toBeDefined();
          if (worst === undefined) {
            return;
          }
          expectPageRestored(worst);
          await expectAlbumRestored(worst);
        });
      }
    }
  }
});
