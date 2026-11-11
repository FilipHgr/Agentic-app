import { describe, expect, it } from 'vitest';

import type { PointerSample } from '../../../src/games/coloring/logic/coloring';
import type { RegionMap } from '../../../src/games/coloring/logic/regionMap';
import type {
  PictureIdentity,
  SavedColoring,
} from '../../../src/games/coloring/logic/savedPicture';
import { PANEL_OPEN_TONES } from '../../../src/games/coloring/logic/toolPanel';
import type { Tone } from '../../../src/shared/audio/tonePlayer';
import { slotOf } from './drawingToolHelpers';
import type { Point } from './outlineFixtures';
import { at } from './strokeHelpers';
import {
  PICTURE,
  RecordingStorage,
  openOn,
  paint,
  paintedPixels,
  pixelsOf,
  twoHalves,
} from './savedPictureHelpers';

/**
 * Testy chování k #130 (první ťuknutí po otevření omalovánky se neztratí
 * a nenamaluje tečku) z pohledu hráče, AC1 až AC6. AC7 je ruční kontrola
 * v prohlížeči.
 *
 * Posloupnost událostí, kterou malování dostane (zaznamenáno v Chromiu přes
 * Playwright nad skutečnou aplikací, iPad 1180 × 820, myš i dotyk; WebKit
 * v prostředí chybí):
 * - výběr dostane `pointerdown` na náhledu (myš Phaser id 0, dotyk id 1,
 *   Phaser id znovu používá), náhled se asi 0,75 s houpe, pak `scene.add`
 *   malování a výběr usne, malování je vidět asi 0,2 s potom,
 * - pustí-li dítě dřív, `pointerup` dostane výběr a malování z ťuknutí
 *   nedostane nic,
 * - drží-li déle, malování dostane `pointermove` (Phaser `isDown` true)
 *   a nakonec `pointerup` téhož id, ale nikdy `pointerdown`,
 * - myš pak posílá `pointermove` id 0 bez tlačítka,
 * - další ťuknutí jsou běžné `pointerdown`/`pointerup` téhož id
 *   a malování je dostane všechna.
 * Žádná událost se neztratí. Chyba z issue nastává při úplně prvním
 * otevření Omalovánek v profilu: panel začíná otevřený na nástrojích
 * (#96 AC2, #105 AC1), první ťuknutí na úchyt ho proto zavře (tón zavření)
 * a další ťuknutí na místo, kde byl štětec, je už dotyk na obrázku
 * a namaluje tečku.
 * Vlastník rozhodl, že panel začíná po každém otevření zavřený, i při
 * úplně prvním otevření v profilu (nahrazuje #96 AC2 a #105 AC1).
 *
 * Scéna hlásí logice dotyk podle `touchTargetAt` a viditelného kroku
 * panelu; to tu napodobuje pomocník `touchAt`. Pohyb a zvednutí scéna
 * posílá vždy (`pointerMove`, `pointerUp`), i bez předchozího dotyku.
 */

const RED = 0;
const GREEN = 3;
const BLUE = 4;

/** Ukazatel myši má v Phaseru vždy id 0, první prst id 1. */
const MOUSE = 0;
const FINGER = 1;
const SECOND_FINGER = 2;

/** Body v obrázku 300 × 200 (oblast A vlevo, oblast B vpravo). */
const LEFT_SPOT = at(60, 100);
const RIGHT_SPOT = at(240, 100);
const LEFT_PATH: readonly Point[] = [at(40, 60), at(80, 80), at(110, 120)];
const RIGHT_PATH: readonly Point[] = [at(200, 60), at(240, 100), at(270, 150)];

/**
 * Místo v obrázku, nad kterým v otevřeném panelu leží štětec (na iPadu
 * na šířku panel překrývá levou část obrázku).
 */
const UNDER_BRUSH_SLOT = at(30, 120);

/** Místo na obrazovce, na které dítě ťukne. */
type Place =
  | { readonly kind: 'picture'; readonly point: Point }
  | { readonly kind: 'handle' }
  | { readonly kind: 'undo' }
  | { readonly kind: 'camera' }
  | { readonly kind: 'recentColor'; readonly index: number }
  /** Místo štětce v panelu; při zavřeném panelu je tam obrázek. */
  | { readonly kind: 'brushSlot' };

/** Co scéna po dotyku zahraje a jestli se v obrázku něco změnilo. */
interface TouchResult {
  readonly tones: readonly Tone[];
  readonly painted: boolean;
}

function sample(id: number, point: Point): PointerSample {
  return { id, x: point.x, y: point.y, kind: id === MOUSE ? 'mouse' : 'touch' };
}

function paintAt(game: SavedColoring, id: number, point: Point): TouchResult {
  return { tones: [], painted: game.pointerDown(sample(id, point)) !== null };
}

/**
 * Dotyk (`pointerdown`) tak, jak ho scéna předá logice
 * (`ColoringScene.onPointerDown` podle `touchTargetAt`).
 */
function touchAt(game: SavedColoring, id: number, place: Place): TouchResult {
  switch (place.kind) {
    case 'picture':
      return paintAt(game, id, place.point);
    case 'brushSlot':
      if (game.panelView() !== 'tools') {
        return paintAt(game, id, UNDER_BRUSH_SLOT);
      }
      return { tones: game.tapTool(slotOf('brush')), painted: false };
    case 'handle':
      return { tones: game.tapHandle(), painted: false };
    case 'undo': {
      const result = game.tapUndo();
      return { tones: result.kind === 'ignored' ? [] : result.tones, painted: false };
    }
    case 'camera': {
      const result = game.tapCamera();
      return { tones: result.kind === 'ignored' ? [] : result.tones, painted: false };
    }
    case 'recentColor': {
      const result = game.tapRecentColor(place.index);
      return { tones: result.kind === 'ignored' ? [] : result.tones, painted: false };
    }
  }
}

/** Ťuknutí: dotyk a hned zvednutí téhož ukazatele. */
function tap(game: SavedColoring, id: number, place: Place): TouchResult {
  const result = touchAt(game, id, place);
  game.pointerUp(id);
  return result;
}

/**
 * Pohyb ukazatele po bodech (prst nebo myš s tlačítkem i bez něj; scéna
 * posílá oboje stejně). Vrátí, jestli něco zabarvil.
 */
function move(game: SavedColoring, id: number, path: readonly Point[]): boolean {
  let painted = false;
  for (const point of path) {
    painted = game.pointerMove(sample(id, point)) !== null || painted;
  }
  return painted;
}

/**
 * Profil, který Omalovánky už otevřel (panel začíná zavřený), s dvěma
 * nedávnými barvami (zelená a modrá) z dřívějška.
 */
function profileWithHistory(): RecordingStorage {
  const storage = new RecordingStorage();
  const before = openOn(storage, twoHalves());
  before.tapColor(GREEN);
  before.tapColor(BLUE);
  before.tapColor(RED);
  before.suspend();
  return storage;
}

/** Dítě ťukne na náhled a omalovánka se otevře (malování je vidět). */
function opened(
  storage: RecordingStorage,
  picture: PictureIdentity = PICTURE,
): { game: SavedColoring; regions: RegionMap } {
  const regions = twoHalves();
  return { game: openOn(storage, regions, picture), regions };
}

/** Obrázek, ve kterém je jen tah `path` jedním prstem barvou `color`. */
function onlyStroke(path: readonly Point[], color: number): Array<number | null> {
  const regions = twoHalves();
  const reference = openOn(profileWithHistory(), regions);
  reference.tapColor(color);
  paint(reference, path);
  return pixelsOf(reference, regions);
}

describe('#130 AC1: první ťuknutí na úchyt po otevření otevře panel', () => {
  it('při úplně prvním otevření Omalovánek v profilu otevře první ťuknutí na úchyt panel na nástrojích s tónem otevření', () => {
    const { game } = opened(new RecordingStorage());
    const result = tap(game, MOUSE, { kind: 'handle' });
    expect(result.tones, 'tón otevření panelu').toEqual(PANEL_OPEN_TONES);
    expect(game.panelView(), 'panel na nástrojích').toBe('tools');
  });

  it('při úplně prvním otevření prstem otevře první ťuknutí na úchyt panel na nástrojích s tónem otevření', () => {
    const { game } = opened(new RecordingStorage());
    const result = tap(game, FINGER, { kind: 'handle' });
    expect(result.tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
  });

  it('po otevření myší (tlačítko puštěné ještě na výběru) otevře první ťuknutí na úchyt panel na nástrojích s tónem', () => {
    const { game, regions } = opened(profileWithHistory());
    // Myš jede k úchytu bez tlačítka (id 0, isDown false).
    move(game, MOUSE, [LEFT_SPOT, RIGHT_SPOT]);
    const result = tap(game, MOUSE, { kind: 'handle' });
    expect(result.tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
    expect(paintedPixels(game, regions), 'v obrázku nic').toBe(0);
  });

  it('po otevření prstem, který se zvedne až v malování, otevře první ťuknutí na úchyt panel', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, FINGER, LEFT_PATH);
    game.pointerUp(FINGER);
    // Phaser dá novému dotyku znovu id 1.
    const result = tap(game, FINGER, { kind: 'handle' });
    expect(result.tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('ťuknutí na úchyt otevře panel, i když prst, který omalovánku otevřel, ještě drží', () => {
    const { game } = opened(profileWithHistory());
    move(game, FINGER, [LEFT_SPOT]);
    const result = tap(game, SECOND_FINGER, { kind: 'handle' });
    expect(result.tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
  });
});

describe('#130 AC2: ťuknutí, které omalovánku otevřelo, nic nenamaluje ani nevybere', () => {
  it('prst, který omalovánku otevřel a dál drží a pohybuje se po obrázku, nic nenamaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    expect(move(game, FINGER, LEFT_PATH)).toBe(false);
    game.pointerUp(FINGER);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('myš, která omalovánku otevřela a tlačítko drží, tažením po obrázku nic nenamaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    expect(move(game, MOUSE, RIGHT_PATH)).toBe(false);
    game.pointerUp(MOUSE);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('prst z otevírání, který se po obrázku posune a pustí nad nedávnou barvou, Zpět a fotoaparátem, nic nevybere', () => {
    const { game } = opened(profileWithHistory());
    const palette = game.palette();
    const recent = game.recentColors();
    const tool = game.selectedTool();
    move(game, FINGER, [LEFT_SPOT, at(0, 0), at(-20, 40)]);
    game.pointerUp(FINGER);
    expect(game.palette(), 'barva beze změny').toEqual(palette);
    expect(game.recentColors(), 'nedávné barvy beze změny').toEqual(recent);
    expect(game.selectedTool(), 'nástroj beze změny').toBe(tool);
    expect(game.panelView(), 'panel zůstal zavřený').toBe('closed');
    expect(game.savingToAlbum(), 'fotoaparát nic neukládá').toBe(false);
    expect(game.tapUndo().kind, 'Zpět nemá co vrátit').toBe('wobble');
  });

  it('prst z otevírání, který se pustí až v malování, při úplně prvním otevření nezavře panel', () => {
    const { game, regions } = opened(new RecordingStorage());
    const before = game.panelView();
    move(game, FINGER, LEFT_PATH);
    game.pointerUp(FINGER);
    expect(game.panelView()).toBe(before);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('když se prst z otevírání pustí až v malování, nic se nestane', () => {
    const { game, regions } = opened(profileWithHistory());
    const palette = game.palette();
    game.pointerUp(FINGER);
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.panelView()).toBe('closed');
    expect(game.palette()).toEqual(palette);
  });
});

describe('#130 AC3: pohyb myši bez stisknutého tlačítka nikdy nemaluje', () => {
  it('pohyb myši přes obrázek bez tlačítka po otevření nic nenamaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    expect(move(game, MOUSE, [...LEFT_PATH, ...RIGHT_PATH])).toBe(false);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('po ťuknutí myší do obrázku pohyb bez tlačítka už nic nepřidá', () => {
    const { game, regions } = opened(profileWithHistory());
    tap(game, MOUSE, { kind: 'picture', point: LEFT_SPOT });
    const afterDot = pixelsOf(game, regions);
    expect(move(game, MOUSE, LEFT_PATH)).toBe(false);
    expect(pixelsOf(game, regions)).toEqual(afterDot);
  });
});

describe('#130 AC4: po otevření maluje jen nový dotyk, a to jen tam, kam vede', () => {
  it('při úplně prvním otevření ťuknutí na úchyt a pak na místo štětce nenamaluje tečku', () => {
    const { game, regions } = opened(new RecordingStorage());
    tap(game, MOUSE, { kind: 'handle' });
    const result = tap(game, MOUSE, { kind: 'brushSlot' });
    expect(result.painted, 'žádná tečka').toBe(false);
    expect(paintedPixels(game, regions)).toBe(0);
    expect(game.selectedTool(), 'vybraný štětec').toBe('brush');
    expect(game.panelView(), 'panel na barvách štětce').toBe('colors');
  });

  it('nový dotyk po zvednutí prstu z otevírání (stejné id) namaluje přesně svůj tah', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, FINGER, RIGHT_PATH);
    game.pointerUp(FINGER);
    touchAt(game, FINGER, { kind: 'picture', point: LEFT_PATH[0] as Point });
    move(game, FINGER, LEFT_PATH.slice(1));
    game.pointerUp(FINGER);
    expect(pixelsOf(game, regions)).toEqual(onlyStroke(LEFT_PATH, RED));
  });

  it('nový prst maluje jen svůj tah, i když prst z otevírání ještě drží a pohybuje se', () => {
    const { game, regions } = opened(profileWithHistory());
    touchAt(game, SECOND_FINGER, { kind: 'picture', point: LEFT_PATH[0] as Point });
    for (let step = 1; step < LEFT_PATH.length; step += 1) {
      move(game, FINGER, [RIGHT_PATH[step] as Point]);
      move(game, SECOND_FINGER, [LEFT_PATH[step] as Point]);
    }
    game.pointerUp(SECOND_FINGER);
    game.pointerUp(FINGER);
    expect(pixelsOf(game, regions)).toEqual(onlyStroke(LEFT_PATH, RED));
  });

  it('nové ťuknutí myší na obrázek po otevření namaluje tečku jen tam, kam ťuklo', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, MOUSE, [RIGHT_SPOT]);
    game.pointerUp(MOUSE);
    move(game, MOUSE, [RIGHT_SPOT, LEFT_SPOT]);
    tap(game, MOUSE, { kind: 'picture', point: LEFT_SPOT });
    expect(pixelsOf(game, regions)).toEqual(onlyStroke([LEFT_SPOT], RED));
  });

  it('ťuknutí na úchyt nikdy nemaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    tap(game, FINGER, { kind: 'handle' });
    tap(game, FINGER, { kind: 'handle' });
    move(game, FINGER, LEFT_PATH);
    expect(paintedPixels(game, regions)).toBe(0);
  });
});

describe('#130 AC5: opakování a okrajové případy', () => {
  it('při druhém otevření po návratu domečkem, u jiné omalovánky, otevře první ťuknutí na úchyt panel a nic nenamaluje', () => {
    const storage = new RecordingStorage();
    const first = opened(storage);
    tap(first.game, FINGER, { kind: 'handle' });
    tap(first.game, FINGER, { kind: 'handle' });
    // Návrat domečkem: tah skončí a obrázek se uloží.
    first.game.suspend();

    const cat: PictureIdentity = { id: 'cat', version: 1 };
    const { game, regions } = opened(storage, cat);
    move(game, FINGER, LEFT_PATH);
    game.pointerUp(FINGER);
    expect(tap(game, FINGER, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('i když dítě při prvním otevření odejde bez malování, další omalovánka otevře panel prvním ťuknutím na úchyt', () => {
    const storage = new RecordingStorage();
    opened(storage).game.suspend();
    const cat: PictureIdentity = { id: 'cat', version: 1 };
    const { game } = opened(storage, cat);
    expect(tap(game, MOUSE, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
  });

  it('při druhém otevření téže omalovánky zůstane jen dřív namalovaný obrázek', () => {
    const storage = profileWithHistory();
    const first = opened(storage);
    paint(first.game, RIGHT_PATH);
    first.game.suspend();
    const painted = pixelsOf(first.game, twoHalves());

    const { game, regions } = opened(storage);
    move(game, MOUSE, LEFT_PATH);
    game.pointerUp(MOUSE);
    expect(pixelsOf(game, regions)).toEqual(painted);
    expect(tap(game, MOUSE, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
  });

  it('po rychlém dvojím ťuknutí na náhled druhé ťuknutí (zvednutí až v malování) nic nenamaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    game.pointerUp(FINGER);
    expect(paintedPixels(game, regions)).toBe(0);
    expect(tap(game, FINGER, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
  });

  it('po dvou prstech na náhledu ani jeden nic nenamaluje a první ťuknutí na úchyt panel otevře', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, FINGER, LEFT_PATH);
    move(game, SECOND_FINGER, RIGHT_PATH);
    game.pointerUp(SECOND_FINGER);
    game.pointerUp(FINGER);
    expect(paintedPixels(game, regions)).toBe(0);
    expect(tap(game, FINGER, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
  });

  it('po otevření jediné omalovánky rovnou v malování (úplně poprvé) otevře první ťuknutí na úchyt panel', () => {
    // Jediná omalovánka: malování se otevře hned po ťuknutí v menu.
    const { game, regions } = opened(new RecordingStorage());
    move(game, FINGER, LEFT_PATH);
    game.pointerUp(FINGER);
    expect(tap(game, FINGER, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
    expect(paintedPixels(game, regions)).toBe(0);
  });

  it('druhý prst, který začal malovat během otevírání, nemaluje, dokud se nezvedne; pak maluje nový dotyk', () => {
    const { game, regions } = opened(profileWithHistory());
    game.pointerUp(FINGER);
    expect(move(game, SECOND_FINGER, LEFT_PATH), 'druhý prst z otevírání').toBe(false);
    game.pointerUp(SECOND_FINGER);
    expect(paintedPixels(game, regions)).toBe(0);

    touchAt(game, SECOND_FINGER, { kind: 'picture', point: RIGHT_PATH[0] as Point });
    move(game, SECOND_FINGER, RIGHT_PATH.slice(1));
    game.pointerUp(SECOND_FINGER);
    expect(pixelsOf(game, regions)).toEqual(onlyStroke(RIGHT_PATH, RED));
  });
});

describe('#130 AC6: zaznamenaná posloupnost událostí z prohlížeče', () => {
  it('myš (id 0) při úplně prvním otevření: ťuknutí na náhled puštěné na výběru, pohyb bez tlačítka, ťuknutí na úchyt otevře panel, ťuknutí na štětec nic nenamaluje', () => {
    const { game, regions } = opened(new RecordingStorage());
    move(game, MOUSE, [RIGHT_SPOT, LEFT_SPOT]);
    expect(tap(game, MOUSE, { kind: 'handle' }).tones, 'úchyt otevře panel').toEqual(
      PANEL_OPEN_TONES,
    );
    move(game, MOUSE, [UNDER_BRUSH_SLOT]);
    tap(game, MOUSE, { kind: 'brushSlot' });
    expect(paintedPixels(game, regions), 'žádná tečka').toBe(0);
  });

  it('myš (id 0) při dalším otevření: tlačítko drží přes otevření a pohne se, puštění, pohyb bez tlačítka, ťuknutí na úchyt otevře panel a nic se nenamaluje', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, MOUSE, [at(150, 100), at(160, 110)]);
    game.pointerUp(MOUSE);
    move(game, MOUSE, [RIGHT_SPOT, LEFT_SPOT]);
    expect(tap(game, MOUSE, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
    tap(game, MOUSE, { kind: 'handle' });
    expect(paintedPixels(game, regions), 'před prvním novým tahem nic').toBe(0);
    tap(game, MOUSE, { kind: 'picture', point: LEFT_SPOT });
    expect(pixelsOf(game, regions)).toEqual(onlyStroke([LEFT_SPOT], RED));
  });

  it('dotyk (id 1 znovu použité): prst drží přes otevření, pohne se, zvedne se, nový dotyk id 1 na úchyt otevře panel, další id 1 maluje jen svůj tah', () => {
    const { game, regions } = opened(profileWithHistory());
    move(game, FINGER, [at(150, 100), at(156, 104)]);
    game.pointerUp(FINGER);
    expect(tap(game, FINGER, { kind: 'handle' }).tones).toEqual(PANEL_OPEN_TONES);
    expect(game.panelView()).toBe('tools');
    tap(game, FINGER, { kind: 'handle' });
    touchAt(game, FINGER, { kind: 'picture', point: LEFT_PATH[0] as Point });
    move(game, FINGER, LEFT_PATH.slice(1));
    game.pointerUp(FINGER);
    expect(pixelsOf(game, regions)).toEqual(onlyStroke(LEFT_PATH, RED));
  });
});
