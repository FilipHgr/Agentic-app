import { describe, expect, it } from 'vitest';

import {
  loadPicturePreview,
  previewCellHex,
} from '../../../src/games/coloring/logic/picturePreview';
import type { PicturePreview, PreviewCell } from '../../../src/games/coloring/logic/picturePreview';
import { OUTLINE_REGION, regionAt } from '../../../src/games/coloring/logic/regionMap';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { PICTURE_STYLE } from '../../../src/games/coloring/logic/theme';
import { colorHex } from '../../../src/games/coloring/logic/toolColorSets';
import { COLORING_META } from '../../../src/games/coloring/meta';
import type { KeyValueStorage } from '../../../src/shared/storage/keyValueStorage';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import {
  CIRCLES,
  HOUSE,
  THREE_PICTURES,
  backToPicker,
  coloringStorage,
  enterPicker,
  openFromPicker,
} from './pictureChoiceHelpers';
import { RecordingStorage, openOn, paint, paintedPixels, twoHalves } from './savedPictureHelpers';
import { at } from './strokeHelpers';
import { BLUE, DEFAULT_TOOL_COLORS, GREEN } from './toolColorsHelpers';

/**
 * Testy k #124 AC3 (náhled ukazuje rozmalovaný stav) a části AC5 (náhled
 * po nepodařeném uložení). Náhled je zmenšený uložený obrázek: čte se ze
 * stejného úložiště hry jako omalovánka a každý pixel náhledu je pozadí
 * obrázku, obrys, nebo barva dítěte (`PreviewCell`). Pravidlo z AC3: každý
 * pixel náhledu má barvu některého z pixelů obrázku, které na něj připadnou,
 * nebo barvu obrysu. Pixely obrázku, které na pixel náhledu (px, py)
 * připadnou, jsou ty, které se překrývají s jeho obdélníkem po zmenšení.
 *
 * U nemalované omalovánky má plocha mimo obrys barvu pozadí obrázku
 * (doporučení reviewera k AC3), jako plocha omalovánky v malování.
 * Zaoblení, stín a to, že náhled vyplní dlaždici, jsou vidět jen ve scéně
 * (ruční kontrola).
 */

/** Velikosti náhledů: telefon na výšku (asi 171 × 128 ze schválených obrázků), malé a stejně velké. */
const PREVIEW_SIZES: ReadonlyArray<readonly [number, number]> = [
  [171, 128],
  [64, 48],
  [40, 30],
  [7, 5],
  [300, 200],
];

/** Druh pixelu obrázku: obrys, pozadí bez barvy, nebo barva. */
function sourceCell(regions: RegionMap, colors: SavedColoring | null, x: number, y: number) {
  if (regionAt(regions, x, y) === OUTLINE_REGION) {
    return { kind: 'outline' } as const;
  }
  const color = colors?.colorAt(x, y) ?? null;
  return color === null ? ({ kind: 'background' } as const) : ({ kind: 'color', color } as const);
}

/** Pixely obrázku, které připadnou na pixel náhledu (px, py). */
function sourceBlock(
  regions: RegionMap,
  preview: PicturePreview,
  px: number,
  py: number,
): Array<[number, number]> {
  const scaleX = regions.width / preview.width;
  const scaleY = regions.height / preview.height;
  const left = Math.floor(px * scaleX);
  const right = Math.max(left + 1, Math.ceil((px + 1) * scaleX));
  const top = Math.floor(py * scaleY);
  const bottom = Math.max(top + 1, Math.ceil((py + 1) * scaleY));
  const block: Array<[number, number]> = [];
  for (let y = top; y < Math.min(bottom, regions.height); y += 1) {
    for (let x = left; x < Math.min(right, regions.width); x += 1) {
      block.push([x, y]);
    }
  }
  return block;
}

function sameCell(a: PreviewCell, b: PreviewCell): boolean {
  if (a.kind === 'color' && b.kind === 'color') {
    return a.color === b.color;
  }
  return a.kind === b.kind;
}

/**
 * Porušení pravidla AC3: pixely náhledu, které nemají barvu obrysu ani
 * barvu žádného z pixelů obrázku, které na ně připadnou.
 */
function previewViolations(
  regions: RegionMap,
  colors: SavedColoring | null,
  preview: PicturePreview,
): string[] {
  const problems: string[] = [];
  for (let py = 0; py < preview.height; py += 1) {
    for (let px = 0; px < preview.width; px += 1) {
      const cell = preview.cellAt(px, py);
      if (cell.kind === 'outline') {
        continue;
      }
      const block = sourceBlock(regions, preview, px, py);
      const matches = block.some(([x, y]) => sameCell(cell, sourceCell(regions, colors, x, y)));
      if (!matches && problems.length < 5) {
        problems.push(`pixel náhledu (${px}, ${py}) má ${JSON.stringify(cell)}`);
      }
    }
  }
  return problems;
}

/** Všechny pixely náhledu. */
function cellsOf(preview: PicturePreview): PreviewCell[] {
  const cells: PreviewCell[] = [];
  for (let y = 0; y < preview.height; y += 1) {
    for (let x = 0; x < preview.width; x += 1) {
      cells.push(preview.cellAt(x, y));
    }
  }
  return cells;
}

function colorsIn(preview: PicturePreview): number[] {
  const colors = new Set<number>();
  for (const cell of cellsOf(preview)) {
    if (cell.kind === 'color') {
      colors.add(cell.color);
    }
  }
  return [...colors].sort((a, b) => a - b);
}

function kindsIn(preview: PicturePreview): string[] {
  return [...new Set(cellsOf(preview).map((cell) => cell.kind))].sort();
}

function previewOf(
  storage: KeyValueStorage | undefined,
  regions: RegionMap,
  picture: PictureIdentity = HOUSE,
  [width, height]: readonly [number, number] = [40, 30],
): PicturePreview {
  return loadPicturePreview({ storage, picture, regions, width, height });
}

/** Omalovánka `picture` rozmalovaná modře vlevo a zeleně vpravo několika tahy přes celou výšku. */
function paintedStorage(picture: PictureIdentity = HOUSE): {
  storage: RecordingStorage;
  game: SavedColoring;
} {
  const storage = new RecordingStorage();
  const game = openOn(storage, twoHalves(), picture);
  game.tapColor(BLUE);
  for (let y = 5; y < 200; y += 8) {
    paint(game, [at(5, y), at(140, y)]);
  }
  game.tapColor(GREEN);
  for (let y = 5; y < 200; y += 8) {
    paint(game, [at(160, y), at(295, y)]);
  }
  game.suspend();
  return { storage, game };
}

/**
 * Náhled jen s obrysem: žádná barva dítěte, plocha mimo obrys má barvu
 * pozadí. Jestli tenký obrys po zmenšení zůstane vidět, záleží na tom, jak
 * ho scéna kreslí (třeba obrysem přes náhled jako v prototypu), proto se
 * jeho pixely v náhledu nevyžadují (ruční kontrola).
 */
function expectOutlineOnly(preview: PicturePreview, what: string): void {
  expect(colorsIn(preview), `${what}: žádná barva`).toEqual([]);
  expect(kindsIn(preview), `${what}: pozadí a nejvýš obrys`).toContain('background');
}

describe('#124 AC3: náhled ukazuje rozmalovaný stav', () => {
  it('nemalovaná omalovánka má náhled jen s obrysem', () => {
    const regions = twoHalves();
    expectOutlineOnly(previewOf(new RecordingStorage(), regions), 'bez záznamu');
    expect(previewViolations(regions, null, previewOf(new RecordingStorage(), regions))).toEqual(
      [],
    );
  });

  it('u nemalované omalovánky má plocha mimo obrys barvu pozadí obrázku a obrys barvu obrysu', () => {
    expect(previewCellHex({ kind: 'background' })).toBe(PICTURE_STYLE.background);
    expect(previewCellHex({ kind: 'outline' })).toBe(PICTURE_STYLE.outlineColor);
  });

  it('rozmalovaná omalovánka má náhled s barvami dítěte', () => {
    const regions = twoHalves();
    const { storage } = paintedStorage();
    const preview = previewOf(storage, regions);
    expect(colorsIn(preview)).toEqual([GREEN, BLUE].sort((a, b) => a - b));
    expect(previewCellHex({ kind: 'color', color: BLUE })).toBe(colorHex(BLUE));
  });

  it('barvy jsou v náhledu na svém místě: modrá vlevo, zelená vpravo', () => {
    const regions = twoHalves();
    const { storage } = paintedStorage();
    const preview = previewOf(storage, regions);
    const leftColors = new Set<number>();
    const rightColors = new Set<number>();
    for (let y = 0; y < preview.height; y += 1) {
      for (let x = 0; x < preview.width; x += 1) {
        const cell = preview.cellAt(x, y);
        if (cell.kind === 'color') {
          (x < preview.width / 2 ? leftColors : rightColors).add(cell.color);
        }
      }
    }
    expect([...leftColors], 'vlevo').toEqual([BLUE]);
    expect([...rightColors], 'vpravo').toEqual([GREEN]);
  });

  it('každý pixel náhledu má barvu některého z pixelů obrázku, které na něj připadnou, nebo barvu obrysu', () => {
    const regions = twoHalves();
    const { storage, game } = paintedStorage();
    for (const size of PREVIEW_SIZES) {
      const preview = previewOf(storage, regions, HOUSE, size);
      expect(preview.width, `šířka ${size.join(' × ')}`).toBe(size[0]);
      expect(preview.height, `výška ${size.join(' × ')}`).toBe(size[1]);
      expect(previewViolations(regions, game, preview), `náhled ${size.join(' × ')}`).toEqual([]);
    }
  });

  it('náhled ukazuje uložený stav omalovánky, ne stav jiné omalovánky', () => {
    const regions = twoHalves();
    const { storage } = paintedStorage(CIRCLES);
    expectOutlineOnly(previewOf(storage, regions, HOUSE), 'domek');
    expect(colorsIn(previewOf(storage, regions, CIRCLES)), 'kruhy').not.toEqual([]);
  });

  // #141 mění #124 AC3: s albem jde obrázek po odchodu do alba a náhled je obrys
  // (`pageToAlbum.test.ts`). Rozmalovaný náhled po návratu zůstává jen bez alba
  // (dočasný profil, #141 AC5), jako tady: výběr nemá záznamy alba.
  it('bez alba (dočasný profil) ukazuje náhled po návratu z malování domečkem, co dítě namalovalo', () => {
    const store = openProfiles(new DeviceStorage());
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const game = openFromPicker(choice, 1, coloringStorage(store), regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    backToPicker(choice, game);

    const previews = choice
      .previews()
      .map((picture) => previewOf(coloringStorage(store), regions, picture));
    expect(colorsIn(previews[1] as PicturePreview), 'rozmalovaná omalovánka').toEqual([BLUE]);
    expectOutlineOnly(previews[0] as PicturePreview, 'nemalovaná omalovánka 1');
    expectOutlineOnly(previews[2] as PicturePreview, 'nemalovaná omalovánka 3');
  });
});

describe('#124 AC3: špatný záznam dá náhled jen s obrysem a prázdnou omalovánku', () => {
  /** Náhled jen s obrysem, hra se nezastaví a omalovánka se otevře prázdná s první barvou. */
  function expectBlank(storage: KeyValueStorage, picture: PictureIdentity, what: string): void {
    const regions = twoHalves();
    const loaded: { preview?: PicturePreview } = {};
    expect(() => {
      loaded.preview = previewOf(storage, regions, picture);
    }, `${what}: náhled hru nezastaví`).not.toThrow();
    if (loaded.preview !== undefined) {
      expectOutlineOnly(loaded.preview, what);
    }
    const game = openOn(storage, regions, picture);
    expect(paintedPixels(game, regions), `${what}: prázdná omalovánka`).toBe(0);
  }

  it('chybějící záznam', () => {
    expectBlank(new RecordingStorage(), HOUSE, 'chybějící záznam');
  });

  it('poškozený záznam (změněný znak uprostřed, useknutý)', () => {
    const changed = paintedStorage().storage;
    changed.rewriteAll((value) => {
      const middle = Math.floor(value.length / 2);
      const replacement = value[middle] === 'x' ? 'y' : 'x';
      return `${value.slice(0, middle)}${replacement}${value.slice(middle + 1)}`;
    });
    expectBlank(changed, HOUSE, 'změněný znak');

    const cut = paintedStorage().storage;
    cut.rewriteAll((value) => value.slice(0, Math.floor(value.length / 2)));
    expectBlank(cut, HOUSE, 'useknutý záznam');
  });

  it('nečitelný záznam a úložiště, které nejde číst', () => {
    for (const text of ['', 'nesmysl', '{}', 'null', 'A'.repeat(60_000)]) {
      const storage = paintedStorage().storage;
      storage.rewriteAll(() => text);
      expectBlank(storage, HOUSE, `záznam ${JSON.stringify(text.slice(0, 10))}`);
    }
    const forbidden = paintedStorage().storage;
    forbidden.failReads = true;
    expectBlank(forbidden, HOUSE, 'zakázané čtení');
  });

  it('záznam jiné omalovánky pod klíčem domku', () => {
    const circles = paintedStorage(CIRCLES).storage;
    const circlesRecord = [...circles.data.values()].find((value) => value.includes('|circles|'));
    expect(circlesRecord, 'kruhy mají uložený záznam').toBeDefined();
    const storage = new RecordingStorage();
    storage.data.set('picture.house', circlesRecord ?? '');
    expectBlank(storage, HOUSE, 'záznam kruhů pod klíčem domku');
  });

  it('záznam jiné verze omalovánky', () => {
    const { storage } = paintedStorage();
    expectBlank(storage, { id: HOUSE.id, version: HOUSE.version + 1 }, 'jiná verze domku');
  });

  it('po špatném záznamu se omalovánka otevře s první barvou', () => {
    const storage = new RecordingStorage();
    storage.data.set('picture.house', 'nesmysl');
    const game = openOn(storage, twoHalves(), HOUSE);
    expect(game.palette().selected).toBe(DEFAULT_TOOL_COLORS.brush);
  });
});

describe('#124 AC5: náhled po nepodařeném uložení', () => {
  /** Zápis klíčů Omalovánek selže (plné úložiště), ostatní klíče projdou. */
  function failColoringWrites(storage: DeviceStorage): void {
    storage.failWrite = (key) => key.includes(`.${COLORING_META.id}.`);
  }

  it('náhled na výběru do zavření stránky ukazuje stav z paměti', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    failColoringWrites(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const game = openFromPicker(choice, 0, coloringStorage(store), regions);
    game.tapColor(GREEN);
    paint(game, [at(20, 100), at(140, 100)]);
    backToPicker(choice, game);

    const preview = previewOf(coloringStorage(store), regions, HOUSE);
    expect(colorsIn(preview), 'stav z paměti').toEqual([GREEN]);
    expect(previewViolations(regions, game, preview)).toEqual([]);
  });

  it('po obnovení stránky ukazuje náhled naposledy úspěšně uložený stav', () => {
    const device = new DeviceStorage();
    const store = openProfiles(device);
    failColoringWrites(device);
    const regions = twoHalves();
    const choice = enterPicker(THREE_PICTURES);
    const game = openFromPicker(choice, 0, coloringStorage(store), regions);
    game.tapColor(GREEN);
    paint(game, [at(20, 100), at(140, 100)]);
    backToPicker(choice, game);

    expectOutlineOnly(
      previewOf(coloringStorage(openProfiles(device)), regions, HOUSE),
      'nic se neuložilo',
    );
  });
});
