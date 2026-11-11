import { describe, expect, it } from 'vitest';

import {
  MAP_PICTURE_SIZE,
  mapOrientationOf,
  mapPictureCover,
  mapPictureUrl,
} from '../../../src/games/counting/logic/mapPictures';
import type { MapOrientation } from '../../../src/games/counting/logic/mapPictures';
import { MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import { viewportOf } from '../../shared/viewportFixtures';
import { MAP_WINDOWS } from './mapLayoutScenes';

/**
 * Testy k #134 AC1: každá z 5 map má vlastní obrázek pro šířku i pro výšku
 * a obrázek zakryje celé okno (ne jen herní plochu, kontrola #133) se
 * zachovaným poměrem stran, bez prázdného pruhu. Pravidla v cyklu přes
 * všechna okna mapy z #133 (`MAP_WINDOWS`) a 5 map, popis případu je ve
 * zprávě `expect`.
 *
 * Navržené rozhraní `src/games/counting/logic/mapPictures.ts` (čistý
 * TypeScript, obrázky jen jako adresy z importu `../maps/*.webp`):
 * - `type MapOrientation = 'landscape' | 'portrait'`,
 *   `MAP_ORIENTATIONS: readonly MapOrientation[]`,
 * - `MAP_PICTURE_SIZE: Readonly<Record<MapOrientation, GameSize>>`
 *   rozměr obrázku v px (1200 × 800, 800 × 1200),
 * - `mapOrientationOf(window: GameSize): MapOrientation` který obrázek
 *   se k oknu hodí (okno širší než vyšší dostane obrázek na šířku),
 * - `mapPictureUrl(theme: MapThemeId, orientation: MapOrientation): string`
 *   adresa obrázku `<mapa>-<orientace>.webp` ze stejné stránky,
 * - `mapPictureCover(window: GameSize, picture: GameSize): PictureRect`
 *   kam obrázek v okně nakreslit v CSS px okna (`left`, `top`, `width`,
 *   `height`; může přesahovat okno), aby zakryl celé okno včetně výřezu
 *   a lišty a zachoval poměr stran (jako CSS `object-fit: cover`),
 * - `MAP_GOAL_SYMBOLS: Readonly<Record<MapThemeId, MapGoalSymbol>>`,
 *   `MapGoalSymbol { emoji; notoName; file; url }` symbol cíle (AC2), `file`
 *   jméno souboru `goal-<mapa>.svg`, `url` adresa z importu.
 *
 * Ručně se kontroluje: jak obrázek vypadá a co se z něj na kterém
 * zařízení ořízne (AC1).
 */

/** Tolerance na zaokrouhlení v CSS px. */
const TOLERANCE = 0.01;

interface WindowSize {
  readonly width: number;
  readonly height: number;
}

function windowSizeOf(window: WindowSize): WindowSize {
  return { width: window.width, height: window.height };
}

describe('#134 AC1: ke každému oknu se vybere obrázek ve správné orientaci', () => {
  it('okno na šířku dostane obrázek na šířku a okno na výšku obrázek na výšku', () => {
    for (const window of MAP_WINDOWS) {
      const expected: MapOrientation = window.width > window.height ? 'landscape' : 'portrait';
      expect(mapOrientationOf(windowSizeOf(window)), window.name).toBe(expected);
    }
  });

  it('obrázek má stejnou orientaci jako cesta na mapě (vlnovka zleva doprava, nebo zdola nahoru)', () => {
    for (const window of MAP_WINDOWS) {
      const area = gameAreaFor(viewportOf(window));
      const pathOrientation: MapOrientation = area.width > area.height ? 'landscape' : 'portrait';
      expect(mapOrientationOf(windowSizeOf(window)), window.name).toBe(pathOrientation);
    }
  });

  it('každá z 5 map má jiný obrázek na šířku a jiný na výšku', () => {
    const urls = MAP_THEMES.flatMap((theme) => [
      mapPictureUrl(theme, 'landscape'),
      mapPictureUrl(theme, 'portrait'),
    ]);
    expect(urls.every((url) => url !== '')).toBe(true);
    expect(new Set(urls).size).toBe(MAP_THEMES.length * 2);
  });

  it('obrázek na šířku je širší než vyšší a obrázek na výšku vyšší než širší', () => {
    expect(MAP_PICTURE_SIZE.landscape.width).toBeGreaterThan(MAP_PICTURE_SIZE.landscape.height);
    expect(MAP_PICTURE_SIZE.portrait.height).toBeGreaterThan(MAP_PICTURE_SIZE.portrait.width);
  });
});

describe('#134 AC1: obrázek zakryje celé okno bez prázdného pruhu a zachová poměr stran', () => {
  interface CoverCase {
    readonly label: string;
    readonly window: WindowSize;
    readonly picture: WindowSize;
  }

  function coverCases(): CoverCase[] {
    return MAP_WINDOWS.flatMap((window) =>
      MAP_THEMES.map((theme) => {
        const orientation = mapOrientationOf(windowSizeOf(window));
        return {
          label: `${window.name}, mapa ${theme}, obrázek ${orientation}`,
          window: windowSizeOf(window),
          picture: MAP_PICTURE_SIZE[orientation],
        };
      }),
    );
  }

  it('obrázek zakryje celé okno včetně výřezu a lišty, ne jen herní plochu', () => {
    for (const { label, window, picture } of coverCases()) {
      const rect = mapPictureCover(window, picture);
      expect(rect.left, `${label}: levý okraj`).toBeLessThanOrEqual(TOLERANCE);
      expect(rect.top, `${label}: horní okraj`).toBeLessThanOrEqual(TOLERANCE);
      expect(rect.left + rect.width, `${label}: pravý okraj`).toBeGreaterThanOrEqual(
        window.width - TOLERANCE,
      );
      expect(rect.top + rect.height, `${label}: spodní okraj`).toBeGreaterThanOrEqual(
        window.height - TOLERANCE,
      );
    }
  });

  it('obrázek si v každém okně zachová poměr stran (nic se nenatáhne)', () => {
    for (const { label, window, picture } of coverCases()) {
      const rect = mapPictureCover(window, picture);
      expect(rect.width / rect.height, label).toBeCloseTo(picture.width / picture.height, 6);
    }
  });

  it('obrázek se nezvětší víc, než je potřeba: přesně na šířku, nebo přesně na výšku okna', () => {
    for (const { label, window, picture } of coverCases()) {
      const rect = mapPictureCover(window, picture);
      const fitsWidth = Math.abs(rect.width - window.width) <= TOLERANCE;
      const fitsHeight = Math.abs(rect.height - window.height) <= TOLERANCE;
      expect(fitsWidth || fitsHeight, `${label}: ${rect.width} × ${rect.height}`).toBe(true);
    }
  });

  it('obrázek s jiným poměrem než okno se ořízne a pořád zakryje celé okno', () => {
    const window = { width: 1000, height: 300 };
    const rect = mapPictureCover(window, MAP_PICTURE_SIZE.landscape);
    expect(rect.width).toBeCloseTo(1000, 6);
    expect(rect.height).toBeCloseTo(1000 / 1.5, 6);
    expect(rect.top).toBeLessThanOrEqual(0);
    expect(rect.top + rect.height).toBeGreaterThanOrEqual(300);
  });

  it('nesmyslné okno (0 × 0) nedá žádné NaN ani nekonečno, hra nevidí chybu', () => {
    for (const window of [
      { width: 0, height: 0 },
      { width: Number.NaN, height: 600 },
    ]) {
      const rect = mapPictureCover(window, MAP_PICTURE_SIZE.landscape);
      for (const value of [rect.left, rect.top, rect.width, rect.height]) {
        expect(Number.isFinite(value), JSON.stringify(window)).toBe(true);
      }
    }
  });
});
