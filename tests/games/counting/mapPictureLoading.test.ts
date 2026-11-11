import { describe, expect, it } from 'vitest';

import { createMapPictureLoading } from '../../../src/games/counting/logic/mapPictureLoading';
import type {
  LoadMapPicture,
  MapPictureId,
} from '../../../src/games/counting/logic/mapPictureLoading';
import { MAP_THEMES } from '../../../src/games/counting/logic/progressMap';

/**
 * Testy k #134 AC4 a otevřené otázce 4: obrázek mapy se stahuje na pozadí
 * během hraní, jen obrázek mapy, na které dítě je, v aktuální orientaci.
 * Když v okamžiku ukázání mapy stažený není (ještě se stahuje, nebo selhal),
 * mapa má zástupný vzhled (barva pozadí z #133 AC6, symbol cíle, cesta,
 * místa a značka) a obrázek se během zobrazení nevymění; ukáže se až při
 * dalším ukázání. Po výpadku se obrázek zkusí stáhnout znovu, nejpozději
 * před dalším ukázáním mapy. Dítě nikdy nevidí chybu.
 *
 * Stahování je podvržené: každé zavolání vrátí slib, který test sám splní
 * nebo odmítne (jako u rozpoznávání psaní, #58), nic se nestahuje a nečasuje.
 *
 * Navržené rozhraní `src/games/counting/logic/mapPictureLoading.ts`:
 * - `interface MapPictureId { theme: MapThemeId; orientation: MapOrientation }`,
 * - `type MapPictureStatus = 'notStarted' | 'loading' | 'ready' | 'failed'`,
 * - `type MapLook = 'picture' | 'placeholder'`,
 * - `type LoadMapPicture = (picture: MapPictureId) => Promise<void>` stáhne
 *   obrázek (ve hře Phaser loader s `mapPictureUrl`, v testu podvržené),
 * - `createMapPictureLoading(load): MapPictureLoading` s metodami
 *   - `status(picture)` stav stažení obrázku,
 *   - `prepare(picture)` hraje se mapa `picture.theme` v orientaci okna:
 *     začne stahovat, když obrázek není stažený a nestahuje se (i po výpadku),
 *   - `mapShown(picture): MapLook` mapa se ukázala: vzhled pro toto ukázání
 *     (obrázek jen když je už stažený); nestažený obrázek začne stahovat,
 *   - `orientationChanged(picture): MapLook` zařízení se otočilo během
 *     zobrazení: vzhled pro novou orientaci (obrázek jen když je stažený),
 *   - `mapHidden()` mapa zmizela,
 *   - `shownLook(): MapLook | null` vzhled ukázané mapy, `null` bez mapy.
 */

const ISLAND_LANDSCAPE: MapPictureId = { theme: 'island', orientation: 'landscape' };
const ISLAND_PORTRAIT: MapPictureId = { theme: 'island', orientation: 'portrait' };
const FOREST_LANDSCAPE: MapPictureId = { theme: 'forest', orientation: 'landscape' };

interface PendingLoad {
  readonly picture: MapPictureId;
  readonly succeed: () => void;
  readonly fail: () => void;
}

interface FakePictureLoader {
  readonly load: LoadMapPicture;
  /** Všechna zahájená stahování v pořadí. */
  readonly started: () => readonly PendingLoad[];
  /** Poslední zahájené stahování obrázku `picture`. */
  readonly latest: (picture: MapPictureId) => PendingLoad;
}

function samePicture(first: MapPictureId, second: MapPictureId): boolean {
  return first.theme === second.theme && first.orientation === second.orientation;
}

function fakeLoader(): FakePictureLoader {
  const pending: PendingLoad[] = [];
  const load: LoadMapPicture = (picture) =>
    new Promise<void>((resolve, reject) => {
      pending.push({
        picture: { ...picture },
        succeed: () => resolve(),
        fail: () => reject(new TypeError('Failed to fetch')),
      });
    });
  return {
    load,
    started: () => pending,
    latest: (picture) => {
      const found = pending.filter((entry) => samePicture(entry.picture, picture)).pop();
      if (!found) {
        throw new Error(`obrázek ${picture.theme}-${picture.orientation} se nestahoval`);
      }
      return found;
    },
  };
}

function startsOf(loader: FakePictureLoader, picture: MapPictureId): number {
  return loader.started().filter((entry) => samePicture(entry.picture, picture)).length;
}

/** Nechá doběhnout splněné nebo odmítnuté sliby stahování. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('#134 otázka 4: stahuje se jen obrázek mapy, na které dítě je, v aktuální orientaci', () => {
  it('během hraní se stáhne obrázek aktuální mapy v orientaci okna a žádný jiný', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    expect(loader.started().map((entry) => entry.picture)).toEqual([ISLAND_LANDSCAPE]);
  });

  it('obrázek, který se už stahuje, se při dalším příkladu nestahuje podruhé', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    for (let problem = 0; problem < 5; problem += 1) {
      loading.prepare(ISLAND_LANDSCAPE);
    }
    expect(startsOf(loader, ISLAND_LANDSCAPE)).toBe(1);
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('loading');
  });

  it('stažený obrázek se znovu nestahuje, ani když se mapa ukáže', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    loading.prepare(ISLAND_LANDSCAPE);
    loading.mapShown(ISLAND_LANDSCAPE);
    expect(startsOf(loader, ISLAND_LANDSCAPE)).toBe(1);
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('ready');
  });

  it('po dokončení mapy se stahuje až obrázek další mapy, nikdy všech 10 najednou', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loading.prepare(FOREST_LANDSCAPE);
    expect(loader.started().map((entry) => entry.picture)).toEqual([
      ISLAND_LANDSCAPE,
      FOREST_LANDSCAPE,
    ]);
    expect(loader.started().length).toBeLessThan(MAP_THEMES.length * 2);
  });

  it('obrázek, který se nikdy nepřipravil ani neukázal, se nestahuje', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    expect(loading.status(ISLAND_PORTRAIT)).toBe('notStarted');
    expect(loading.status(FOREST_LANDSCAPE)).toBe('notStarted');
  });
});

describe('#134 AC4: když obrázek ještě není stažený, mapa má zástupný vzhled a obrázek se nevymění', () => {
  it('stažený obrázek se ukáže hned s mapou', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('picture');
    expect(loading.shownLook()).toBe('picture');
  });

  it('obrázek, který se ještě stahuje, dá zástupný vzhled', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('placeholder');
    expect(loading.shownLook()).toBe('placeholder');
  });

  it('obrázek, který se stáhne během zobrazení mapy, se uprostřed zobrazení nevymění', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loading.mapShown(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('ready');
    expect(loading.shownLook(), 'během zobrazení zůstane zástupný vzhled').toBe('placeholder');
  });

  it('obrázek stažený během zobrazení se ukáže při dalším ukázání mapy', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loading.mapShown(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    loading.mapHidden();
    expect(loading.shownLook()).toBeNull();
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('picture');
  });

  it('mapa, která se ukáže dřív, než se začalo stahovat, má zástupný vzhled a obrázek se začne stahovat', () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('placeholder');
    expect(startsOf(loader, ISLAND_LANDSCAPE)).toBe(1);
  });
});

describe('#134 AC4: výpadek sítě dítě nepozná a obrázek se zkusí stáhnout znovu', () => {
  it('po výpadku má mapa zástupný vzhled a nic nespadne', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).fail();
    await settle();
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('failed');
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('placeholder');
  });

  it('stahování, které spadne hned při spuštění, dá zástupný vzhled bez chyby', () => {
    const loading = createMapPictureLoading(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(() => loading.prepare(ISLAND_LANDSCAPE)).not.toThrow();
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('failed');
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('placeholder');
  });

  it('po výpadku se obrázek zkusí stáhnout znovu během dalšího hraní', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).fail();
    await settle();
    loading.prepare(ISLAND_LANDSCAPE);
    expect(startsOf(loader, ISLAND_LANDSCAPE)).toBe(2);
    expect(loading.status(ISLAND_LANDSCAPE)).toBe('loading');
  });

  it('po výpadku během zobrazení se nový pokus začne nejpozději s dalším ukázáním mapy', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.mapShown(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).fail();
    await settle();
    loading.mapHidden();
    // Hra mezitím obrázek nepřipravila (třeba hned další mapa): pokus začne s ukázáním.
    loading.mapShown(ISLAND_LANDSCAPE);
    expect(startsOf(loader, ISLAND_LANDSCAPE)).toBe(2);
  });

  it('když nový pokus uspěje, ukáže se obrázek při dalším ukázání mapy', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).fail();
    await settle();
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('picture');
  });
});

describe('#134 AC4: otočení zařízení během zobrazení mapy', () => {
  it('po otočení s nestaženým obrázkem druhé orientace má mapa zástupný vzhled', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('picture');
    expect(loading.orientationChanged(ISLAND_PORTRAIT)).toBe('placeholder');
    expect(loading.shownLook()).toBe('placeholder');
  });

  it('otočení začne stahovat obrázek druhé orientace, ale během zobrazení ho nevymění', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.mapShown(ISLAND_LANDSCAPE);
    loading.orientationChanged(ISLAND_PORTRAIT);
    expect(startsOf(loader, ISLAND_PORTRAIT)).toBe(1);
    loader.latest(ISLAND_PORTRAIT).succeed();
    await settle();
    expect(loading.shownLook()).toBe('placeholder');
    loading.mapHidden();
    expect(loading.mapShown(ISLAND_PORTRAIT)).toBe('picture');
  });

  it('po otočení s už staženým obrázkem druhé orientace se ukáže obrázek', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    loading.prepare(ISLAND_PORTRAIT);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    loader.latest(ISLAND_PORTRAIT).succeed();
    await settle();
    loading.mapShown(ISLAND_LANDSCAPE);
    expect(loading.orientationChanged(ISLAND_PORTRAIT)).toBe('picture');
  });

  it('otočení tam a zpět během zobrazení nevymění vzhled, který už dítě v té orientaci vidělo', async () => {
    const loader = fakeLoader();
    const loading = createMapPictureLoading(loader.load);
    loading.prepare(ISLAND_LANDSCAPE);
    expect(loading.mapShown(ISLAND_LANDSCAPE)).toBe('placeholder');
    loading.orientationChanged(ISLAND_PORTRAIT);
    loader.latest(ISLAND_LANDSCAPE).succeed();
    await settle();
    expect(loading.orientationChanged(ISLAND_LANDSCAPE)).toBe('placeholder');
  });
});
