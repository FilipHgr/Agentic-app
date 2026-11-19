import { describe, expect, it } from 'vitest';

import { PREVIEW_TAP_TONES } from '../../../src/games/coloring/logic/pictureChoice';
import { COLORING_PICTURES } from '../../../src/games/coloring/logic/pictureSet';
import { HOME_WOBBLE_TONES } from '../../../src/shared/logic/homeButton';
import {
  LONG_SWIPE,
  PICKER_PAGE_SIZE,
  START,
  SWIPE_MIN,
  THIRTEEN_PICTURES,
  TWENTY_FIVE_PICTURES,
  enterPagedPicker,
  expectedIds,
  openedId,
  paintAndReturn,
  recordingStorage,
  shownIds,
  swipe,
  testLocks,
  testPictures,
  turnByArrow,
  turnToPage,
} from './pickerPagesHelpers';

/**
 * Testy k #150 AC1 (stránky po 12), AC2 (paměť stránky), AC3 (testovací
 * sada s 13 a 25 omalovánkami) a AC4 (dotyky). Ovládání je stejné jako
 * v albu s listováním (#149 AC1, AC5): šipky ◀ ▶, tah aspoň 48 px
 * vodorovně a víc než svisle, na krajních stránkách zhoupnutí s tónem
 * domečku, při jediné stránce šipky nejsou.
 *
 * Navržené rozšíření `PictureChoice` v `pictureChoice.ts` (jako album z #149):
 * - `pickerPage(): number` stránka výběru, která je vidět (0 je 1. stránka);
 *   během otevírání a malování stránka, na kterou se výběr vrátí,
 * - `pagePreviews(): readonly PictureIdentity[]` omalovánky stránky, která
 *   je vidět, v pořadí sady (nejvýš 12); `previews()` dál vrací celou sadu,
 * - `tapPreview(place)` místo náhledu na stránce, která je vidět (0–11),
 *   `PreviewTap.index` je toto místo,
 * - `tapPickerArrow(direction: AlbumDirection): AlbumTurn` šipka ◀ ▶,
 * - `pickerPointerDown(pointerId, point: AlbumPoint, place: number | null)`
 *   a `pickerPointerUp(pointerId, point): PickerPointerResult`, kde
 *   `PickerPointerResult = AlbumTurn | PreviewTap` (tah nalistuje, ťuknutí
 *   na náhled se chová jako `tapPreview`),
 * - `pickerPageShown(): void` scéna ukázala nalistovanou stránku.
 *
 * Tón listování zadání neurčuje (album: tón náhledu), testy ho nehlídají.
 */

describe('#150 AC1: výběr ukazuje omalovánky po 12 ve stálém pořadí sady', () => {
  it('testovací sady mají 13 a 25 omalovánek a do hry nepřibyl žádný obrázek (AC3)', () => {
    expect(THIRTEEN_PICTURES.length).toBe(13);
    expect(TWENTY_FIVE_PICTURES.length).toBe(25);
    // #151 AC1: ve hře je papír a 11 omalovánek.
    // Upraveno k #152 AC1: do hry přibylo 5 omalovánek, papír a 16 omalovánek.
    expect(COLORING_PICTURES.length, 'papír a omalovánky ve hře').toBe(17);
  });

  it('výběr se otevře na 1. stránce s 1. až 12. omalovánkou', () => {
    for (const pictures of [THIRTEEN_PICTURES, TWENTY_FIVE_PICTURES]) {
      const choice = enterPagedPicker(pictures);

      expect(choice.pickerPage(), `${pictures.length} omalovánek`).toBe(0);
      expect(shownIds(choice), `${pictures.length} omalovánek`).toEqual(expectedIds(pictures, 0));
    }
  });

  it('na 2. stránce je 13. až 24. omalovánka a na 3. stránce 25.', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    turnByArrow(choice, 'next');
    expect(shownIds(choice), '2. stránka').toEqual(expectedIds(TWENTY_FIVE_PICTURES, 1));
    expect(shownIds(choice).length).toBe(PICKER_PAGE_SIZE);

    turnByArrow(choice, 'next');
    expect(shownIds(choice), '3. stránka').toEqual(['page-25']);
  });

  it('při 13 omalovánkách je na 2. stránce jen 13. omalovánka', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);

    turnByArrow(choice, 'next');

    expect(shownIds(choice)).toEqual(['page-13']);
  });

  it('ťuknutí na místo na 2. stránce otevře omalovánku z té stránky', () => {
    for (const place of [0, 4, 11]) {
      const again = enterPagedPicker(TWENTY_FIVE_PICTURES);
      turnToPage(again, 1);
      const tap = again.tapPreview(place);
      expect(tap.kind === 'open' ? tap.picture.id : null, `místo ${place + 1}`).toBe(
        TWENTY_FIVE_PICTURES[PICKER_PAGE_SIZE + place]?.id,
      );
    }
  });

  it('prázdné místo na poslední neúplné stránce nic neotevře a dítě zůstane na výběru', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    turnToPage(choice, 2);

    for (const place of [1, 11, 12]) {
      expect(choice.tapPreview(place).kind, `místo ${place + 1}`).toBe('ignored');
    }
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('šipka ◀ vrátí předchozí stránku', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    turnToPage(choice, 2);

    turnByArrow(choice, 'previous');

    expect(choice.pickerPage()).toBe(1);
    expect(shownIds(choice)).toEqual(expectedIds(TWENTY_FIVE_PICTURES, 1));
  });

  it('tah doleva ukáže další stránku a tah doprava předchozí', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    expect(swipe(choice, -LONG_SWIPE, 0)).toMatchObject({
      kind: 'turned',
      page: 1,
      direction: 'next',
    });
    choice.pickerPageShown();
    expect(choice.pickerPage(), 'po tahu doleva 2. stránka').toBe(1);

    expect(swipe(choice, LONG_SWIPE, 0)).toMatchObject({
      kind: 'turned',
      page: 0,
      direction: 'previous',
    });
    choice.pickerPageShown();
    expect(choice.pickerPage(), 'po tahu doprava zase 1. stránka').toBe(0);
  });
});

describe('#150 AC1: tah je jako v albu posun aspoň 48 px vodorovně a víc než svisle', () => {
  it('posun přesně o 48 px vodorovně je tah a nalistuje', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);

    expect(swipe(choice, -SWIPE_MIN, 0).kind).toBe('turned');
  });

  it('posun o 47 px vodorovně je ťuknutí: nenalistuje, na náhledu otevře omalovánku', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);

    const result = swipe(choice, -(SWIPE_MIN - 1), 0, { place: 2 });

    expect(openedId(result), 'ťuknutí na 3. náhled').toBe('page-03');
    expect(choice.screen()).toEqual({ kind: 'opening', picture: THIRTEEN_PICTURES[2] });
  });

  it('posun stejně nebo víc svisle než vodorovně není tah a nenalistuje', () => {
    for (const [dx, dy] of [
      [-100, 100],
      [-60, 61],
      [-60, -200],
      [0, -300],
    ] as const) {
      const choice = enterPagedPicker(THIRTEEN_PICTURES);
      expect(swipe(choice, dx, dy).kind, `posun ${dx}, ${dy}`).not.toBe('turned');
      expect(choice.pickerPage(), `posun ${dx}, ${dy}`).toBe(0);
    }
  });

  it('šikmý tah víc vodorovně než svisle nalistuje', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);

    expect(swipe(choice, -80, 79).kind).toBe('turned');
  });

  it('ťuknutí mimo náhledy nic neotevře a nenalistuje', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);

    expect(swipe(choice, 3, 2, { place: null }).kind).toBe('ignored');
    expect(choice.pickerPage()).toBe(0);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });
});

describe('#150 AC1: na krajních stránkách se nic nenalistuje', () => {
  it('šipka ◀ na 1. stránce se zhoupne s tónem domečku a stránka zůstane', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    expect(choice.tapPickerArrow('previous')).toEqual({
      kind: 'edge',
      wobble: 'arrow',
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.pickerPage()).toBe(0);
  });

  it('šipka ▶ na poslední stránce se zhoupne s tónem domečku a stránka zůstane', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    turnToPage(choice, 2);

    expect(choice.tapPickerArrow('next')).toEqual({
      kind: 'edge',
      wobble: 'arrow',
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.pickerPage()).toBe(2);
  });

  it('tah doprava na 1. stránce nic nenalistuje a náhledy se zhoupnou s tónem domečku', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    expect(swipe(choice, LONG_SWIPE, 0)).toEqual({
      kind: 'edge',
      wobble: 'previews',
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.pickerPage()).toBe(0);
  });

  it('tah doleva na poslední stránce nic nenalistuje a náhledy se zhoupnou s tónem domečku', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);
    turnToPage(choice, 1);

    expect(swipe(choice, -LONG_SWIPE, 0)).toEqual({
      kind: 'edge',
      wobble: 'previews',
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.pickerPage()).toBe(1);
  });

  it('po zhoupnutí na kraji jde dál listovat a ťukat na náhledy', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.tapPickerArrow('previous');
    swipe(choice, LONG_SWIPE, 0);

    turnByArrow(choice, 'next');

    const tap = choice.tapPreview(0);
    expect(tap.kind === 'open' ? tap.picture.id : null).toBe('page-13');
  });
});

describe('#150 AC1: při 12 a méně omalovánkách se nelistuje a výběr je jako dnes', () => {
  it('při 12 a méně omalovánkách šipky nic nedělají', () => {
    for (const count of [2, 11, 12]) {
      const choice = enterPagedPicker(testPictures(count));
      expect(choice.tapPickerArrow('next').kind, `${count} omalovánek, ▶`).toBe('ignored');
      expect(choice.tapPickerArrow('previous').kind, `${count} omalovánek, ◀`).toBe('ignored');
      expect(choice.pickerPage(), `${count} omalovánek`).toBe(0);
    }
  });

  it('při 12 a méně omalovánkách tah nic nenalistuje a náhledy se zhoupnou s tónem domečku jako v albu', () => {
    for (const count of [2, 11, 12]) {
      for (const dx of [-LONG_SWIPE, LONG_SWIPE]) {
        const choice = enterPagedPicker(testPictures(count));
        expect(swipe(choice, dx, 0), `${count} omalovánek, tah o ${dx} px`).toEqual({
          kind: 'edge',
          wobble: 'previews',
          tones: HOME_WOBBLE_TONES,
        });
        expect(choice.pickerPage()).toBe(0);
      }
    }
  });

  // Od #151 AC1 má dnešní sada papír a 11 omalovánek, pořád jen jednu stránku.
  // Upraveno k #152 AC1: s 5 novými omalovánkami má sada 17 náhledů na 2 stránkách.
  it('dnešní sada s papírem a 16 omalovánkami je na 2 stránkách ve stejném pořadí: 12 a 5 nových', () => {
    const choice = enterPagedPicker(COLORING_PICTURES);

    expect(choice.pagePreviews(), '1. stránka').toEqual(COLORING_PICTURES.slice(0, 12));
    expect(choice.previews()).toEqual(COLORING_PICTURES);
    turnToPage(choice, 1);
    expect(choice.pagePreviews(), '2. stránka').toEqual(COLORING_PICTURES.slice(12));
    expect(shownIds(choice), '2. stránka').toEqual([
      'dinosaur',
      'rocket',
      'tractor',
      'castle',
      'owl',
    ]);
  });

  // Upraveno k #151 AC1: sada zaplní všech 12 míst (místo 1 papír), místo za
  // stránkou nic neotevře. Prázdné 12. místo s 11 omalovánkami hlídá test výše (2, 11, 12).
  // Upraveno k #152 AC1: 1. stránka je plná, na 2. stránce otevřou místa 1–5
  // nové omalovánky a místa 6–12 nic.
  it('s dnešní sadou otevře ťuknutí na místa 1 až 12 omalovánku sady na tom místě a místo za stránkou nic', () => {
    COLORING_PICTURES.slice(0, PICKER_PAGE_SIZE).forEach((picture, place) => {
      const choice = enterPagedPicker(COLORING_PICTURES);
      expect(choice.tapPreview(place), `místo ${place + 1}`).toEqual({
        kind: 'open',
        index: place,
        picture,
        tones: PREVIEW_TAP_TONES,
      });
    });
    expect(enterPagedPicker(COLORING_PICTURES).tapPreview(12)).toEqual({ kind: 'ignored' });
    COLORING_PICTURES.slice(PICKER_PAGE_SIZE).forEach((picture, place) => {
      const choice = enterPagedPicker(COLORING_PICTURES);
      turnToPage(choice, 1);
      expect(choice.tapPreview(place), `2. stránka, místo ${place + 1}`).toEqual({
        kind: 'open',
        index: place,
        picture,
        tones: PREVIEW_TAP_TONES,
      });
    });
    const second = enterPagedPicker(COLORING_PICTURES);
    turnToPage(second, 1);
    expect(second.tapPreview(5), '2. stránka, místo 6').toEqual({ kind: 'ignored' });
    expect(
      enterPagedPicker(testPictures(11)).tapPreview(11),
      '12. místo s 11 omalovánkami',
    ).toEqual({ kind: 'ignored' });
  });

  it('s jedinou omalovánkou se výběr přeskočí jako dnes a nelistuje se', () => {
    const choice = enterPagedPicker(testPictures(1));

    expect(choice.screen().kind).toBe('opening');
    expect(choice.pagePreviews()).toEqual([]);
    expect(choice.tapPickerArrow('next').kind).toBe('ignored');
  });
});

describe('#150 AC2: po návratu z malování je výběr na stránce, ze které dítě odešlo', () => {
  it('po malování omalovánky z 2. stránky je výběr zase na 2. stránce', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    turnToPage(choice, 1);

    expect(paintAndReturn(choice, 3), 'otevřela se 16. omalovánka').toBe('page-16');

    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(choice.pickerPage()).toBe(1);
    expect(shownIds(choice)).toEqual(expectedIds(TWENTY_FIVE_PICTURES, 1));
  });

  it('po malování z poslední neúplné stránky je výběr zase na ní', () => {
    const choice = enterPagedPicker(THIRTEEN_PICTURES);
    turnToPage(choice, 1);

    paintAndReturn(choice, 0);

    expect(choice.pickerPage()).toBe(1);
    expect(shownIds(choice)).toEqual(['page-13']);
  });

  it('stránka platí i po několika malováních za sebou', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    turnToPage(choice, 2);
    paintAndReturn(choice, 0);
    turnByArrow(choice, 'previous');

    paintAndReturn(choice, 11);

    expect(choice.pickerPage()).toBe(1);
  });

  it('po malování omalovánky odemčené klíčem na 2. stránce je výběr zase na 2. stránce', () => {
    const locks = testLocks(['page-14'], 1);
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { locks });
    turnToPage(choice, 1);

    expect(paintAndReturn(choice, 1), 'klíč odemkne a otevře 14. omalovánku').toBe('page-14');
    expect(locks.spentKeys()).toBe(1);

    expect(choice.pickerPage()).toBe(1);
  });

  it('stránka se nikam neukládá: listování ani návrat z malování nic nezapíše do zařízení', () => {
    const storage = recordingStorage();
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { storage });
    turnToPage(choice, 2);
    paintAndReturn(choice, 0);

    expect(storage.writes()).toBe(0);
  });
});

describe('#150 AC2: jinak se výběr otevře na 1. stránce', () => {
  it('po novém otevření Omalovánek z menu je výběr na 1. stránce, i když dítě odešlo z jiné', () => {
    const storage = recordingStorage();
    const first = enterPagedPicker(TWENTY_FIVE_PICTURES, { storage });
    turnToPage(first, 2);
    paintAndReturn(first, 0);
    expect(first.holdHome(), 'domeček z výběru vede do menu').toBe('toMenu');

    const again = enterPagedPicker(TWENTY_FIVE_PICTURES, { storage });

    expect(again.pickerPage()).toBe(0);
    expect(shownIds(again)).toEqual(expectedIds(TWENTY_FIVE_PICTURES, 0));
  });
});

describe('#150 AC4: dotyky na výběru', () => {
  it('tah začatý na náhledu nalistuje a neotevře malování', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    const result = swipe(choice, -LONG_SWIPE, 0, { place: 5 });

    expect(result.kind).toBe('turned');
    choice.pickerPageShown();
    expect(choice.screen(), 'malování se neotevírá').toEqual({ kind: 'picker' });
    expect(choice.pickerPage()).toBe(1);
  });

  it('tah doprava začatý na náhledu na 1. stránce zhoupne náhledy a neotevře malování', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);

    expect(swipe(choice, LONG_SWIPE, 0, { place: 0 }).kind).toBe('edge');
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('tah dvěma prsty naráz nalistuje jen o jednu stránku', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, 2);
    choice.pickerPointerDown(2, { x: START.x, y: START.y + 100 }, 6);

    const first = choice.pickerPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y });
    const second = choice.pickerPointerUp(2, { x: START.x - LONG_SWIPE, y: START.y + 100 });
    choice.pickerPageShown();

    expect([first.kind, second.kind].filter((kind) => kind === 'turned').length).toBe(1);
    expect(choice.pickerPage(), 'výběr je na 2. stránce, ne na 3.').toBe(1);
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('tah dvěma prsty nalistuje jen o jednu stránku, i když se stránka ukáže dřív, než se zvedne druhý prst', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    choice.pickerPointerDown(1, START, null);
    choice.pickerPointerDown(2, { x: START.x, y: START.y + 100 }, null);

    choice.pickerPointerUp(1, { x: START.x - LONG_SWIPE, y: START.y });
    choice.pickerPageShown();
    const second = choice.pickerPointerUp(2, { x: START.x - LONG_SWIPE, y: START.y + 100 });

    expect(second.kind, 'druhý prst nenalistuje').not.toBe('turned');
    expect(choice.pickerPage(), 'výběr je na 2. stránce, ne na 3.').toBe(1);
  });

  it('během listování ťuknutí na náhled nic neotevře', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    expect(choice.tapPickerArrow('next').kind).toBe('turned');

    expect(swipe(choice, 0, 0, { place: 0 }).kind, 'ťuknutí prstem').toBe('ignored');
    expect(choice.tapPreview(0).kind, 'ťuknutí na místo náhledu').toBe('ignored');
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('během listování další šipka ani tah nenalistuje', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    expect(choice.tapPickerArrow('next').kind).toBe('turned');

    expect(choice.tapPickerArrow('next').kind, 'šipka ▶').toBe('ignored');
    expect(swipe(choice, -LONG_SWIPE, 0).kind, 'tah doleva').toBe('ignored');
    choice.pickerPageShown();
    expect(choice.pickerPage()).toBe(1);
  });

  it('ťuknutí začaté během listování nic neotevře ani po dolistování', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    expect(choice.tapPickerArrow('next').kind).toBe('turned');
    choice.pickerPointerDown(1, START, 0);
    choice.pickerPageShown();

    const result = choice.pickerPointerUp(1, START);

    expect(result.kind, 'prst se dotkl během listování').toBe('ignored');
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(choice.pickerPage()).toBe(1);
  });

  it('po dolistování otevře ťuknutí na náhled omalovánku nové stránky', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    swipe(choice, -LONG_SWIPE, 0);
    choice.pickerPageShown();

    expect(openedId(swipe(choice, 0, 0, { place: 0 }))).toBe('page-13');
  });

  it('během otevírání malování šipka ani tah nenalistuje', () => {
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES);
    expect(choice.tapPreview(0).kind).toBe('open');

    expect(choice.tapPickerArrow('next').kind).toBe('ignored');
    expect(swipe(choice, -LONG_SWIPE, 0).kind).toBe('ignored');
    expect(choice.pickerPage()).toBe(0);
  });

  it('zamčená omalovánka na 2. stránce bez klíče se zhoupne s tónem domečku jako v #140 a nic se nezmění', () => {
    const locks = testLocks(['page-13', 'page-20'], 0);
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { locks });
    turnToPage(choice, 1);

    expect(choice.tapPreview(7)).toEqual({ kind: 'locked', index: 7, tones: HOME_WOBBLE_TONES });
    expect(choice.screen()).toEqual({ kind: 'picker' });
    expect(choice.pickerPage()).toBe(1);
    expect(locks.isLocked({ id: 'page-20', version: 1 })).toBe(true);
  });

  it('ťuknutí prstem na zamčenou omalovánku bez klíče ji zhoupne stejně jako ťuknutí na náhled', () => {
    const locks = testLocks(['page-13'], 0);
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { locks });
    turnToPage(choice, 1);

    expect(swipe(choice, 2, 1, { place: 0 })).toEqual({
      kind: 'locked',
      index: 0,
      tones: HOME_WOBBLE_TONES,
    });
    expect(choice.screen()).toEqual({ kind: 'picker' });
  });

  it('tah začatý na zamčené omalovánce nalistuje a neutratí klíč', () => {
    const locks = testLocks(['page-01'], 1);
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { locks });

    expect(swipe(choice, -LONG_SWIPE, 0, { place: 0 }).kind).toBe('turned');
    expect(locks.spentKeys()).toBe(0);
    expect(locks.isLocked({ id: 'page-01', version: 1 })).toBe(true);
  });

  it('zamčená omalovánka na 2. stránce s klíčem se odemkne a otevře právě ta', () => {
    const locks = testLocks(['page-20'], 1);
    const choice = enterPagedPicker(TWENTY_FIVE_PICTURES, { locks });
    turnToPage(choice, 1);

    expect(choice.tapPreview(7)).toMatchObject({
      kind: 'unlocked',
      index: 7,
      picture: { id: 'page-20', version: 1 },
    });
    expect(locks.spentKeys()).toBe(1);
  });
});
