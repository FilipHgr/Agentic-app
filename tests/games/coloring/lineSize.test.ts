import { describe, expect, it } from 'vitest';

import { brushWidthFor } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import { decodePicture, encodePicture } from '../../../src/games/coloring/logic/savedPicture';
import type { SavedColoring } from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_TOOLS } from '../../../src/games/coloring/logic/toolPanel';
import type { LineSize, ToolId } from '../../../src/games/coloring/logic/toolPanel';
import { PROFILE_COLORS } from '../../../src/shared/logic/profiles';
import { openProfiles } from '../../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../../shared/profileFixtures';
import { bigHalves, choose, endOf } from './drawingToolHelpers';
import {
  LEGACY_P1_RECORD,
  LEGACY_SELECTED_COLOR,
  legacyPixels,
  legacyRegions,
} from './legacyRecordFixture';
import {
  HORIZONTAL,
  SIZES,
  SIZE_NAMES,
  TOOL_NAMES,
  WIDTH_SHARE,
  chooseSize,
  emptyInMeasuredColumns,
  expectedHalf,
  fillAWithBrush,
  reachOf,
} from './lineSizeHelpers';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  enterColoring,
  openOn,
  paint,
  pixelsOf,
  startStroke,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy k #91 (tři velikosti čáry v Omalovánkách) v upraveném znění AC1,
 * AC3 a AC4 z komentáře k issue (přepínač v panelu z #96, úchyt ukazuje
 * i tečku velikosti): AC1 přepínání a úchyt, AC2 šířka W, AC3 velikost
 * pro všechny nástroje, AC4 změna velikosti a druhý prst, AC5 paměť
 * podle profilu. Rozložení přepínače, tečky v úchytu a 3 CSS px na
 * nejmenší ploše jsou v `lineSizeLayoutRules.test.ts`, limit uložení (AC6)
 * v `lineSizeRecord.test.ts`.
 *
 * Ťuknutí na přepínač (`touchTargetAt(…).kind === 'sizeToggle'`) hlásí
 * scéna jako `game.tapSizeToggle()`. Druhý prst během tahu je ťuknutí na
 * ovládání, zatímco první prst ještě nezvedl (`startStroke` bez `pointerUp`).
 *
 * Navržené rozhraní:
 * - `src/games/coloring/logic/toolPanel.ts`:
 *   - `type LineSize = 'small' | 'medium' | 'large'`,
 *   - `HandleView` dostane pole `size: LineSize` (úchyt ukazuje nástroj,
 *     barvu i velikost).
 * - `src/games/coloring/logic/coloring.ts`:
 *   - `brushWidthFor(pictureWidth: number, size: LineSize = 'medium')`
 *     šířka W pro velikost `size` (1/50, 1/30, 1/15 šířky plochy).
 * - `src/games/coloring/logic/savedPicture.ts`, nová pole `SavedColoring`:
 *   - `lineSize(): LineSize` vybraná velikost,
 *   - `tapSizeToggle(): readonly Tone[]` ťuknutí na přepínač: přepne
 *     malá → střední → velká → malá, hned uloží a vrátí tón kratší než
 *     1 s; během tahu se nepočítá a vrátí `[]`.
 * Velikost se ukládá do úložiště hry profilu (doporučeno samostatným
 * záznamem vedle obrázku, aby záznam obrázku p1 a p2 zůstal beze změny).
 */

const RED = 0;
const BLUE = 4;
const BLACK = 7;

/** Tolerance měření šířky stopy na pixely (střed pixelu je po 1 px). */
const PIXEL_TOLERANCE = 1;

function freshBigGame(storage = new RecordingStorage()): SavedColoring {
  return openOn(storage, bigHalves());
}

/**
 * Polovina šířky stopy v měřených sloupcích: barvy `color`, u gumy prázdné
 * místo. Duha (#97) maluje na prázdný obrázek vlastními barvami, proto se
 * u ní měří každý zabarvený pixel.
 */
function measuredHalf(game: SavedColoring, tool: ToolId, color: number): number {
  if (tool === 'eraser') {
    return reachOf(game, (each) => each === null);
  }
  if (tool === 'rainbow') {
    return reachOf(game, (each) => each !== null);
  }
  return reachOf(game, (each) => each === color);
}

function expectHalfWidth(measured: number, expected: number, what: string): void {
  expect(
    measured,
    `${what}: polovina šířky aspoň ${expected - PIXEL_TOLERANCE} px`,
  ).toBeGreaterThanOrEqual(expected - PIXEL_TOLERANCE);
  expect(measured, `${what}: polovina šířky nejvýš ${expected} px`).toBeLessThanOrEqual(
    expected + 0.01,
  );
}

/** Vodorovný tah nástrojem `tool` velikosti `size` na čerstvém obrázku; vrátí hru. */
function strokeWith(tool: ToolId, size: LineSize): SavedColoring {
  const game = freshBigGame();
  if (tool === 'eraser') {
    fillAWithBrush(game, BLUE);
    expect(emptyInMeasuredColumns(game), 'oblast A je před gumováním celá vybarvená').toBe(0);
  } else {
    game.tapColor(RED);
  }
  chooseSize(game, size);
  choose(game, tool);
  paint(game, HORIZONTAL);
  return game;
}

describe('#91 AC1: přepínač velikosti', () => {
  it('na začátku je vybraná střední velikost', () => {
    expect(openOn(new RecordingStorage(), twoHalves()).lineSize()).toBe('medium');
  });

  it('ťuknutí na přepínač přepne velikost dokola malá → střední → velká → malá', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    const seen: LineSize[] = [game.lineSize()];
    for (let tap = 0; tap < 7; tap += 1) {
      game.tapSizeToggle();
      seen.push(game.lineSize());
    }
    expect(seen).toEqual([
      'medium',
      'large',
      'small',
      'medium',
      'large',
      'small',
      'medium',
      'large',
    ]);
  });

  it('po každém ťuknutí na přepínač zazní tón kratší než 1 s', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    for (let tap = 1; tap <= SIZES.length; tap += 1) {
      const tones = game.tapSizeToggle();
      const what = `ťuknutí ${tap} (${SIZE_NAMES[game.lineSize()]})`;
      expect(tones.length, `${what}: nějaký tón zazní`).toBeGreaterThan(0);
      expect(endOf(tones), `${what}: délka tónu v sekundách`).toBeLessThan(1);
    }
  });

  it('úchyt ukazuje na začátku štětec v první barvě se střední velikostí', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    expect(game.handleView()).toEqual({ tool: 'brush', color: RED, size: 'medium' });
  });

  it('úchyt po každé změně nástroje, barvy nebo velikosti ukazuje aktuální nástroj, barvu i velikost', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    type Step = { readonly tool: ToolId } | { readonly color: number } | { readonly toggle: true };
    const steps: Step[] = [
      { toggle: true },
      { color: BLUE },
      { tool: 'marker' },
      { toggle: true },
      { tool: 'eraser' },
      { toggle: true },
      { color: BLACK },
      { tool: 'crayon' },
      { toggle: true },
      { toggle: true },
      { tool: 'eraser' },
      { tool: 'brush' },
      { color: RED },
    ];
    let tool: ToolId = 'brush';
    let paintingTool: ToolId = 'brush';
    let color = RED;
    let sizeIndex = SIZES.indexOf('medium');
    steps.forEach((step, index) => {
      if ('tool' in step) {
        choose(game, step.tool);
        tool = step.tool;
        if (step.tool !== 'eraser') {
          paintingTool = step.tool;
        }
      } else if ('color' in step) {
        game.tapColor(step.color);
        color = step.color;
        tool = paintingTool;
      } else {
        game.tapSizeToggle();
        sizeIndex = (sizeIndex + 1) % SIZES.length;
      }
      const size = SIZES[sizeIndex];
      expect(game.handleView(), `krok ${index + 1}: ${JSON.stringify(step)}`).toEqual({
        tool,
        color: tool === 'eraser' ? null : color,
        size,
      });
    });
  });

  it('úchyt ukazuje velikost i se zavřeným panelem', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseSize(game, 'small');
    if (game.panelOpen()) {
      game.tapHandle();
    }
    expect(game.panelOpen()).toBe(false);
    expect(game.handleView().size).toBe('small');
  });
});

describe('#91 AC2: šířka W podle velikosti', () => {
  it('W je 1/50, 1/30 nebo 1/15 šířky plochy omalovánky', () => {
    for (const width of [300, 900, 1024]) {
      for (const size of SIZES) {
        expect(brushWidthFor(width, size), `${SIZE_NAMES[size]}, plocha ${width} px`).toBeCloseTo(
          width * WIDTH_SHARE[size],
          6,
        );
      }
    }
  });

  it('bez volby velikosti je W střední, 1/30 šířky plochy', () => {
    expect(brushWidthFor(900)).toBeCloseTo(900 / 30, 6);
  });

  it('štětec maluje stopou šířky W vybrané velikosti', () => {
    for (const size of SIZES) {
      const game = strokeWith('brush', size);
      expectHalfWidth(
        measuredHalf(game, 'brush', RED),
        expectedHalf('brush', size),
        SIZE_NAMES[size],
      );
    }
  });

  it('bez ťuknutí na přepínač maluje štětec střední velikostí', () => {
    const game = freshBigGame();
    paint(game, HORIZONTAL);
    expectHalfWidth(measuredHalf(game, 'brush', RED), expectedHalf('brush', 'medium'), 'střední');
  });

  it('malá čára je tenčí než střední a střední tenčí než velká', () => {
    const halves = SIZES.map((size) => measuredHalf(strokeWith('brush', size), 'brush', RED));
    const [small, medium, large] = halves;
    expect(small, 'malá < střední').toBeLessThan(medium ?? 0);
    expect(medium, 'střední < velká').toBeLessThan(large ?? 0);
  });
});

describe('#91 AC3: velikost platí pro všechny nástroje naráz', () => {
  it('štětec, fix, pastelka i guma mají v každé velikosti svou šířku v násobcích W', () => {
    // Razítkový fix (#98) nedělá souvislou čáru, ale hvězdičky s ostrými
    // cípy; jeho velikost hvězdiček a rozestup v každé velikosti hlídá
    // `stampStrokes.test.ts` (#98 AC5). Puntíkový fix (#101) barví jen
    // puntíky, takže okraj stopy nemusí mít zabarvený pixel; šířku jeho
    // stopy v každé velikosti hlídá `dotsStrokes.test.ts` (#101 AC5).
    // Proužkový fix (#102) barví jen proužky, šířku jeho stopy hlídá
    // `stripesStrokes.test.ts` (#102 AC5).
    const continuous = PANEL_TOOLS.filter(
      (each) => each !== 'stamp' && each !== 'dots' && each !== 'stripes',
    );
    for (const tool of continuous) {
      for (const size of SIZES) {
        const game = strokeWith(tool, size);
        const what = `${TOOL_NAMES[tool]}, ${SIZE_NAMES[size]}`;
        const color = tool === 'eraser' ? BLUE : RED;
        expectHalfWidth(measuredHalf(game, tool, color), expectedHalf(tool, size), what);
      }
    }
  });

  it('jedna volba velikosti platí pro každý nástroj, na který dítě přepne', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseSize(game, 'large');
    for (const tool of [...PANEL_TOOLS, ...PANEL_TOOLS]) {
      choose(game, tool);
      expect(game.lineSize(), TOOL_NAMES[tool]).toBe('large');
    }
    game.tapColor(BLUE);
    expect(game.lineSize(), 'po výběru barvy').toBe('large');
  });

  it('volba velikosti nezmění vybraný nástroj ani barvu', () => {
    for (const tool of PANEL_TOOLS) {
      const game = openOn(new RecordingStorage(), twoHalves());
      game.tapColor(BLUE);
      choose(game, tool);
      for (let tap = 0; tap < SIZES.length; tap += 1) {
        game.tapSizeToggle();
        expect(game.selectedTool(), `${TOOL_NAMES[tool]}, ťuknutí ${tap + 1}`).toBe(tool);
        expect(game.palette().selected, `${TOOL_NAMES[tool]}, ťuknutí ${tap + 1}`).toBe(BLUE);
      }
    }
  });
});

describe('#91 AC4: změna velikosti', () => {
  it('změna velikosti na obrázku nic nezmění', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    game.tapColor(BLUE);
    paint(game, [at(20, 100), at(140, 100)]);
    const before = pixelsOf(game, regions);

    for (let tap = 0; tap < 4; tap += 1) {
      game.tapSizeToggle();
      expect(pixelsOf(game, regions), `ťuknutí ${tap + 1}`).toEqual(before);
    }
  });

  it('změna velikosti se do Zpět nepočítá: Zpět vrátí poslední tah a velikost zůstane', () => {
    const regions = twoHalves();
    const game = openOn(new RecordingStorage(), regions);
    const empty = pixelsOf(game, regions);
    paint(game, [at(20, 100), at(140, 100)]);
    chooseSize(game, 'small');

    expect(game.tapUndo().kind, 'Zpět vrátí tah').toBe('undone');
    expect(pixelsOf(game, regions), 'obrázek před tahem').toEqual(empty);
    expect(game.lineSize(), 'velikost zůstala').toBe('small');
    expect(game.tapUndo().kind, 'víc není co vracet').toBe('wobble');
  });

  it('bez tahu Zpět po změně velikosti jen zhoupne a velikost zůstane', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseSize(game, 'large');
    expect(game.tapUndo().kind).toBe('wobble');
    expect(game.lineSize()).toBe('large');
  });

  it('Zpět vrátí tah velkou čárou pixel po pixelu, i po přepnutí na jinou velikost', () => {
    const regions = bigHalves();
    const game = openOn(new RecordingStorage(), regions);
    paint(game, [at(100, 100), at(300, 400)]);
    const before = pixelsOf(game, regions);
    chooseSize(game, 'large');
    game.tapColor(BLUE);
    paint(game, [at(50, 300), at(400, 300)]);
    chooseSize(game, 'small');

    expect(game.tapUndo().kind).toBe('undone');
    expect(pixelsOf(game, regions)).toEqual(before);
  });

  it('ťuknutí druhým prstem na přepínač během tahu se nepočítá a tah pokračuje stejnou velikostí', () => {
    const game = freshBigGame();
    startStroke(game, [at(60, 300), at(200, 300)]);

    expect(game.tapSizeToggle(), 'během tahu žádný tón').toEqual([]);
    expect(game.lineSize(), 'velikost se nezměnila').toBe('medium');

    game.pointerMove({ id: 1, x: 390, y: 300, kind: 'touch' });
    game.pointerUp(1);
    expectHalfWidth(measuredHalf(game, 'brush', RED), expectedHalf('brush', 'medium'), 'tah');
  });

  it('ťuknutí druhým prstem na úchyt během tahu nezmění panel ani to, co úchyt ukazuje', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    chooseSize(game, 'small');
    startStroke(game, [at(20, 40), at(60, 40)]);
    const panelBefore = game.panelOpen();
    const viewBefore = game.handleView();

    expect(game.tapHandle(), 'během tahu žádný tón').toEqual([]);
    expect(game.tapSizeToggle(), 'přepínač během tahu').toEqual([]);
    expect(game.panelOpen(), 'panel').toBe(panelBefore);
    expect(game.handleView(), 'úchyt').toEqual(viewBefore);
    game.pointerUp(1);
  });

  it('po skončení tahu přepínač zase přepíná', () => {
    const game = openOn(new RecordingStorage(), twoHalves());
    startStroke(game, [at(20, 40), at(60, 40)]);
    game.tapSizeToggle();
    game.pointerUp(1);

    const tones = game.tapSizeToggle();

    expect(game.lineSize()).toBe('large');
    expect(tones.length).toBeGreaterThan(0);
  });
});

/** Klíče, jejichž hodnotu hra změnila mezi `before` a teď. */
function changedKeys(storage: RecordingStorage, before: ReadonlyMap<string, string>): string[] {
  return storage.keys().filter((key) => storage.data.get(key) !== before.get(key));
}

function copyOf(storage: RecordingStorage): RecordingStorage {
  const copy = new RecordingStorage();
  for (const [key, value] of storage.data) {
    copy.data.set(key, value);
  }
  return copy;
}

/**
 * Úložiště s modrým obrázkem a uloženou velkou velikostí. Vrátí i klíče,
 * které hra zapsala jen kvůli změně velikosti (test nezná jejich tvar).
 */
function storageWithLargeSize(regions: RegionMap): {
  storage: RecordingStorage;
  sizeKeys: string[];
  picture: Array<number | null>;
} {
  const storage = new RecordingStorage();
  const game = openOn(storage, regions);
  game.tapColor(BLUE);
  paint(game, [at(20, 100), at(140, 100)]);
  const picture = pixelsOf(game, regions);
  game.suspend();
  const before = new Map(storage.data);

  const again = openOn(storage, regions);
  chooseSize(again, 'large');
  again.suspend();
  return { storage, sizeKeys: changedKeys(storage, before), picture };
}

describe('#91 AC5: velikost se pamatuje podle profilu jako barva', () => {
  it('po návratu z menu je vybraná velikost, kterou dítě nechalo', () => {
    for (const size of SIZES) {
      const storage = new RecordingStorage();
      const game = openOn(storage, twoHalves());
      chooseSize(game, size);
      game.suspend();

      const again = openOn(storage, twoHalves());
      expect(again.lineSize(), SIZE_NAMES[size]).toBe(size);
      expect(again.handleView().size, `${SIZE_NAMES[size]}: úchyt`).toBe(size);
    }
  });

  it('ťuknutí na přepínač velikost uloží hned, bez tahu a bez odchodu ze hry', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    chooseSize(game, 'small');

    expect(openOn(storage, twoHalves()).lineSize()).toBe('small');
  });

  it('po obnovení stránky je vybraná naposledy zvolená velikost a nová velikost platí pro tah', () => {
    const storage = new DeviceStorage();
    const regions = bigHalves();
    const game = enterColoring(openProfiles(storage), regions);
    chooseSize(game, 'large');
    game.suspend();

    const again = enterColoring(openProfiles(storage), regions);
    expect(again.lineSize()).toBe('large');
    paint(again, HORIZONTAL);
    expectHalfWidth(measuredHalf(again, 'brush', RED), expectedHalf('brush', 'large'), 'tah');
  });

  it('jiný profil začíná se střední velikostí a jeho volba nezmění velikost prvního profilu', () => {
    const storage = new DeviceStorage();
    const store = openProfiles(storage);
    const regions = twoHalves();
    const first = store.activeProfile();
    const second = store.createProfile({ nickname: 'BETA', color: PROFILE_COLORS[1] });

    const firstGame = enterColoring(store, regions);
    chooseSize(firstGame, 'small');
    firstGame.suspend();

    store.selectProfile(second.id);
    const secondGame = enterColoring(store, regions);
    expect(secondGame.lineSize(), 'nový profil').toBe('medium');
    chooseSize(secondGame, 'large');
    secondGame.suspend();

    const reloaded = openProfiles(storage);
    reloaded.selectProfile(first.id);
    expect(enterColoring(reloaded, regions).lineSize(), 'první profil').toBe('small');
    reloaded.selectProfile(second.id);
    expect(enterColoring(reloaded, regions).lineSize(), 'druhý profil').toBe('large');
  });

  it('velikost se pamatuje i u gumy, nástroj se po návratu nepamatuje', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    choose(game, 'eraser');
    chooseSize(game, 'large');
    game.suspend();

    const again = openOn(storage, twoHalves());
    expect(again.lineSize()).toBe('large');
    expect(again.selectedTool()).toBe('brush');
  });

  it('bez záznamu velikosti (první otevření) je střední', () => {
    expect(openOn(new RecordingStorage(), twoHalves()).lineSize()).toBe('medium');
  });

  it('smazaný záznam velikosti znamená střední', () => {
    const regions = twoHalves();
    const { storage, sizeKeys } = storageWithLargeSize(regions);
    expect(sizeKeys.length, 'změna velikosti se zapsala').toBeGreaterThan(0);
    for (const key of sizeKeys) {
      storage.data.delete(key);
    }
    expect(openOn(storage, regions).lineSize()).toBe('medium');
  });

  it('nesmyslný záznam velikosti znamená střední a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage, sizeKeys } = storageWithLargeSize(regions);
    expect(sizeKeys.length, 'změna velikosti se zapsala').toBeGreaterThan(0);
    const nonsense = [
      '',
      'nesmysl',
      'null',
      '{}',
      '42',
      '-1',
      'LARGE',
      ' large',
      '"large"',
      'huge',
    ];
    for (const text of nonsense) {
      const broken = copyOf(storage);
      for (const key of sizeKeys) {
        broken.data.set(key, text);
      }
      let size: LineSize | undefined;
      expect(
        () => {
          size = openOn(broken, regions).lineSize();
        },
        `záznam ${JSON.stringify(text)}: hra se nezastaví`,
      ).not.toThrow();
      expect(size, `záznam ${JSON.stringify(text)}`).toBe('medium');
    }
  });

  it('nečitelné úložiště znamená střední velikost a hra se nezastaví', () => {
    const regions = twoHalves();
    const { storage } = storageWithLargeSize(regions);
    storage.failReads = true;
    let size: LineSize | undefined;
    expect(() => {
      size = openOn(storage, regions).lineSize();
    }).not.toThrow();
    expect(size).toBe('medium');
  });

  it('při plném úložišti jde velikost přepínat dál bez chyby', () => {
    const storage = new RecordingStorage();
    const game = openOn(storage, twoHalves());
    storage.failWrites = true;

    expect(() => chooseSize(game, 'small')).not.toThrow();
    expect(game.lineSize()).toBe('small');
  });

  it('obrázek a barva zůstanou po návratu stejné, i když se mezitím měnila velikost', () => {
    const regions = twoHalves();
    const { storage, picture } = storageWithLargeSize(regions);

    const again = openOn(storage, regions);
    expect(pixelsOf(again, regions), 'obrázek').toEqual(picture);
    expect(again.palette().selected, 'barva').toBe(BLUE);
    expect(again.lineSize(), 'velikost').toBe('large');
  });

  it('obrázek uložený po změně velikosti jde dál přečíst jako obrázek omalovánky', () => {
    const regions = twoHalves();
    const { storage, picture } = storageWithLargeSize(regions);

    const readable = [...storage.data.values()]
      .map((record) => decodePicture(record, PICTURE, regions))
      .filter((decoded) => decoded !== null);
    expect(readable.length, 'v úložišti je čitelný záznam obrázku').toBe(1);
    const [decoded] = readable;
    expect(decoded === undefined ? [] : pixelsOf(decoded.colors, regions)).toEqual(picture);
  });
});

describe('#91 AC5 a #92: obrázky uložené před tímto úkolem', () => {
  /** Úložiště, ve kterém je pod klíčem obrázku jen starý záznam `record`. */
  function storageWithOldRecord(regions: RegionMap, record: string): RecordingStorage {
    const storage = new RecordingStorage();
    const game = openOn(storage, regions);
    game.tapColor(BLUE);
    game.suspend();
    storage.rewriteAll((value) => (value.startsWith('p') ? record : value));
    return storage;
  }

  it('starý záznam p1 se otevře beze změny pixel po pixelu se střední velikostí', () => {
    const regions = legacyRegions();
    const storage = storageWithOldRecord(regions, LEGACY_P1_RECORD);

    const game = openOn(storage, regions);

    expect(pixelsOf(game, regions), 'starý obrázek').toEqual(legacyPixels());
    expect(game.palette().selected, 'vybraná barva').toBe(LEGACY_SELECTED_COLOR);
    expect(game.lineSize(), 'velikost').toBe('medium');
  });

  it('záznam p2 bez velikosti se otevře beze změny se střední velikostí', () => {
    const regions = twoHalves();
    const painter = openOn(new RecordingStorage(), regions);
    painter.tapColor(BLACK);
    paint(painter, [at(20, 100), at(140, 100)]);
    paint(painter, [at(170, 30), at(290, 170)]);
    const record = encodePicture({
      picture: PICTURE,
      regions,
      colors: painter,
      selectedColor: BLACK,
    });
    const storage = storageWithOldRecord(regions, record);

    const game = openOn(storage, regions);

    expect(pixelsOf(game, regions), 'obrázek').toEqual(pixelsOf(painter, regions));
    expect(game.palette().selected, 'vybraná barva').toBe(BLACK);
    expect(game.lineSize(), 'velikost').toBe('medium');
  });

  it('ve starém obrázku jde po změně velikosti malovat dál a po návratu je obrázek i velikost', () => {
    const regions = legacyRegions();
    const storage = storageWithOldRecord(regions, LEGACY_P1_RECORD);
    const game = openOn(storage, regions);
    chooseSize(game, 'small');
    paint(game, [at(30, 75), at(50, 75)]);
    game.suspend();

    const again = openOn(storage, regions);
    expect(pixelsOf(again, regions)).toEqual(pixelsOf(game, regions));
    expect(again.lineSize()).toBe('small');
  });
});
