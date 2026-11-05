import { describe, expect, it } from 'vitest';

import { createMenu } from '../../src/menu/logic/menu';
import type { MenuFeedback } from '../../src/menu/logic/menu';
import { menuLayoutFor } from '../../src/menu/logic/menuLayout';
import type { MenuLayout } from '../../src/menu/logic/menuLayout';
import { chooseLayoutMode } from '../../src/shared/logic/viewportLayout';
import { PROFILE_COLORS } from '../../src/shared/logic/profiles';
import type { Profile } from '../../src/shared/logic/profiles';
import { openProfiles } from '../../src/shared/storage/profileStorage';
import { DeviceStorage } from '../shared/profileFixtures';
import {
  IPAD_WINDOWS,
  NO_NOTCH,
  PHONE_PORTRAIT_EDGE_WINDOWS,
  PHONE_PORTRAIT_WINDOWS,
  PHONE_WINDOWS,
  freeAreaOf,
  gapBetween,
  heightOf,
  isInside,
  overlaps,
  viewportOf,
  widthOf,
} from '../shared/viewportFixtures';
import type { Box, TestWindow } from '../shared/viewportFixtures';
import {
  FakeDownload,
  FakeGame,
  TEST_CATEGORIES,
  TEST_GAMES,
  TEST_TEXTS_CS,
  translatorOf,
} from './menuFixtures';

/**
 * Testy k #71 AC5: kolečko aktivního profilu vlevo nahoře v menu podle
 * obrázku B. Kolečko je v barvě profilu s prvním písmenem přezdívky
 * a vedle něj je přezdívka; na telefonu na výšku je jen kolečko. Profil
 * bez přezdívky má v kolečku bílou hvězdičku ★ (symbol v kódu) a vedle nic.
 *
 * Navržené rozhraní:
 * - `createMenu({ …, profile: () => Profile })` dostane aktivní profil
 *   (bez něj výchozí profil), `menu.profileBadge()` vrátí
 *   `{ color, symbol, nickname }` (`nickname` je `null` bez přezdívky),
 *   `menu.tapProfile()` dá jen odezvu `wobble` s cílem `{ kind: 'profile' }`,
 * - `menuLayoutFor(okno, { …, profileNickname })` vrátí navíc
 *   `profileBadge: { circle, label, symbolFontSize, labelFontSize }`;
 *   `label` je `null` bez přezdívky a na telefonu na výšku.
 *
 * Šířka textu se odhaduje jako v #65: znaky × 0,6 × velikost písma,
 * s okrajem 8 px z obou stran. Vzhled proti obrázku se kontroluje ručně.
 */

const MIN_TAP = 64;
const MIN_GAP = 8;
const EDGE_MARGIN = 4;
const CHARACTER_WIDTH_RATIO = 0.6;
const TEXT_PADDING = 8;
const ROUNDING = 1e-6;
const MIN_CONTRAST = 3;

/** 12 nejširších písmen, nejdelší přezdívka, kterou mřížka písmen dovolí. */
const WIDEST_NICKNAME = 'WWWWWWWWWWWW';
const STAR = '★';

const APPROVED_PALETTE = [
  '#E8590C',
  '#2F9E44',
  '#1C7ED6',
  '#AE3EC9',
  '#E03131',
  '#0C8599',
  '#D6336C',
  '#5F3DC4',
];

const SCALED_IPAD: TestWindow = {
  name: 'zmenšené zobrazení 820×1180',
  width: 820,
  height: 1180,
  safeArea: NO_NOTCH,
};

const MENU_WINDOWS: readonly TestWindow[] = [
  ...IPAD_WINDOWS,
  SCALED_IPAD,
  ...PHONE_WINDOWS,
  ...PHONE_PORTRAIT_WINDOWS,
  ...PHONE_PORTRAIT_EDGE_WINDOWS,
];

function isPhonePortrait(window: TestWindow): boolean {
  return chooseLayoutMode(viewportOf(window)) === 'phonePortrait';
}

function layoutWith(window: TestWindow, profileNickname: string | null): MenuLayout {
  return menuLayoutFor(viewportOf(window), {
    categoryTitles: ['Vše', 'Sčítání a odčítání'],
    tileCount: 1,
    languageNames: ['Čeština'],
    profileNickname,
  });
}

function textWidth(text: string, fontSize: number): number {
  return [...text].length * CHARACTER_WIDTH_RATIO * fontSize;
}

function insetBox(outer: Box, margin: number): Box {
  return {
    left: outer.left + margin,
    right: outer.right - margin,
    top: outer.top + margin,
    bottom: outer.bottom - margin,
  };
}

/** Relativní jas barvy `#RRGGBB` podle WCAG 2. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

function contrastWithWhite(hex: string): number {
  return (1 + 0.05) / (luminance(hex) + 0.05);
}

interface ProfileMenu {
  readonly menu: ReturnType<typeof createMenu>;
  readonly feedback: MenuFeedback[];
  readonly download: FakeDownload;
  readonly game: FakeGame;
}

function menuWithProfile(profile: () => Profile): ProfileMenu {
  const download = new FakeDownload();
  const game = new FakeGame();
  const feedback: MenuFeedback[] = [];
  const menu = createMenu({
    games: TEST_GAMES.map((entry) => ({ ...entry, load: download.load })),
    categories: TEST_CATEGORIES,
    translate: translatorOf(TEST_TEXTS_CS),
    start: game.start,
    feedback: (event) => feedback.push(event),
    profile,
  });
  return { menu, feedback, download, game };
}

describe('#71 AC5: kolečko profilu ukáže aktivní profil', () => {
  it('kolečko má barvu profilu, první písmeno přezdívky a vedle je přezdívka', () => {
    const profile: Profile = { id: 'p1', nickname: 'ŽOFKA', color: PROFILE_COLORS[2] };

    expect(menuWithProfile(() => profile).menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[2],
      symbol: 'Ž',
      nickname: 'ŽOFKA',
    });
  });

  it('profil bez přezdívky má v kolečku hvězdičku a vedle kolečka nic', () => {
    const profile: Profile = { id: 'p1', color: PROFILE_COLORS[0] };

    expect(menuWithProfile(() => profile).menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[0],
      symbol: STAR,
      nickname: null,
    });
  });

  it('na novém zařízení je v kolečku hvězdička v první barvě palety', () => {
    const store = openProfiles(new DeviceStorage());

    expect(menuWithProfile(() => store.activeProfile()).menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[0],
      symbol: STAR,
      nickname: null,
    });
  });

  it('po výběru jiného profilu ukáže kolečko nový aktivní profil', () => {
    const store = openProfiles(new DeviceStorage());
    const second = store.createProfile({ nickname: 'WWWWWWWWWWWW', color: PROFILE_COLORS[7] });
    const { menu } = menuWithProfile(() => store.activeProfile());

    store.selectProfile(second.id);

    expect(menu.profileBadge()).toEqual({
      color: PROFILE_COLORS[7],
      symbol: 'W',
      nickname: WIDEST_NICKNAME,
    });
  });
});

describe('#71 AC5: ťuknutí na profil dá zatím jen odezvu', () => {
  it('ťuknutí na profil profil zhoupne a nic neotevře ani nespustí', () => {
    const test = menuWithProfile(() => ({ id: 'p1', color: PROFILE_COLORS[0] }));

    test.menu.tapProfile();

    expect(test.feedback).toEqual([{ kind: 'wobble', target: { kind: 'profile' } }]);
    expect(test.menu.runningGame()).toBeNull();
    expect(test.menu.isLanguageMenuOpen()).toBe(false);
    expect(test.download.count).toBe(0);
    expect(test.game.started).toEqual([]);
  });

  it('každé další ťuknutí dá znovu odezvu', () => {
    const test = menuWithProfile(() => ({ id: 'p1', nickname: 'ANA', color: PROFILE_COLORS[1] }));

    test.menu.tapProfile();
    test.menu.tapProfile();

    expect(test.feedback.map((event) => event.kind)).toEqual(['wobble', 'wobble']);
  });
});

describe('#71 AC5: bílé písmeno je dobře vidět na každé barvě palety', () => {
  it('paleta má 8 schválených barev v pořadí, první je barva výchozího profilu', () => {
    expect([...PROFILE_COLORS]).toEqual(APPROVED_PALETTE);
  });

  it('bílá má proti každé barvě palety kontrast aspoň 3 : 1', () => {
    for (const color of PROFILE_COLORS) {
      expect(contrastWithWhite(color), color).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
});

describe('#71 AC5: kolečko profilu v rozložení menu podle obrázku B', () => {
  for (const window of MENU_WINDOWS) {
    describe(window.name, () => {
      it('kolečko je vlevo nahoře v místě pro profil a má aspoň 64 × 64 px', () => {
        const layout = layoutWith(window, WIDEST_NICKNAME);
        const { circle } = layout.profileBadge;

        expect(widthOf(circle)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        expect(heightOf(circle)).toBeGreaterThanOrEqual(MIN_TAP - ROUNDING);
        expect(isInside(circle, layout.profileSlot)).toBe(true);
        expect(circle.left).toBeCloseTo(layout.profileSlot.left, 5);
        expect(circle.top).toBeCloseTo(layout.profileSlot.top, 5);
      });

      it('písmeno nebo hvězdička se vejde do kolečka', () => {
        const { circle, symbolFontSize } = layoutWith(window, WIDEST_NICKNAME).profileBadge;

        expect(textWidth('W', symbolFontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
          widthOf(circle) + ROUNDING,
        );
        expect(symbolFontSize + 2 * TEXT_PADDING).toBeLessThanOrEqual(heightOf(circle) + ROUNDING);
      });

      it('profil bez přezdívky nemá vedle kolečka nic', () => {
        expect(layoutWith(window, null).profileBadge.label).toBeNull();
      });

      if (isPhonePortrait(window)) {
        it('na telefonu na výšku je jen kolečko bez přezdívky', () => {
          expect(layoutWith(window, WIDEST_NICKNAME).profileBadge.label).toBeNull();
        });
      } else {
        it('přezdívka „WWWWWWWWWWWW“ se vejde vedle kolečka', () => {
          const layout = layoutWith(window, WIDEST_NICKNAME);
          const { circle, label, labelFontSize } = layout.profileBadge;

          expect(label).not.toBeNull();
          if (label === null) {
            return;
          }
          expect(label.left).toBeGreaterThanOrEqual(circle.right - ROUNDING);
          expect(isInside(label, layout.profileSlot)).toBe(true);
          expect(textWidth(WIDEST_NICKNAME, labelFontSize) + 2 * TEXT_PADDING).toBeLessThanOrEqual(
            widthOf(label) + ROUNDING,
          );
          expect(labelFontSize + 2 * TEXT_PADDING).toBeLessThanOrEqual(heightOf(label) + ROUNDING);
        });

        it('přezdívka nezasáhne do místa pro jazyk ani do zbytku menu', () => {
          const layout = layoutWith(window, WIDEST_NICKNAME);
          const { label } = layout.profileBadge;
          if (label === null) {
            throw new Error('přezdívka chybí');
          }

          expect(overlaps(label, layout.languageSlot)).toBe(false);
          expect(gapBetween(label, layout.languageSlot)).toBeGreaterThanOrEqual(MIN_GAP - ROUNDING);
          for (const other of [
            ...layout.placeholders,
            ...layout.categories.map((category) => category.hit),
            ...layout.tiles,
          ]) {
            expect(overlaps(label, other)).toBe(false);
          }
          expect(isInside(label, insetBox(freeAreaOf(window), EDGE_MARGIN))).toBe(true);
        });
      }

      it('s přezdívkou se ostatní části menu neposunou', () => {
        const without = layoutWith(window, null);
        const withNickname = layoutWith(window, WIDEST_NICKNAME);

        expect(withNickname.profileSlot).toEqual(without.profileSlot);
        expect(withNickname.languageSlot).toEqual(without.languageSlot);
        expect(withNickname.placeholders).toEqual(without.placeholders);
        expect(withNickname.categories).toEqual(without.categories);
        expect(withNickname.tiles).toEqual(without.tiles);
      });
    });
  }
});
