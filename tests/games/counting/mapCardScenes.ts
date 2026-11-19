/**
 * Pomůcky pro testy mapy postupu v okně (#145, vybraná varianta V2): karta
 * se zaoblenými rohy a bílým okrajem nad ztmavenou hrou a celá mapa uvnitř
 * karty. Karta se počítá ve všech oknech mapy z #133 AC7 (`MAP_WINDOWS`)
 * a mapa v ní pro každou z 5 map a se značkou na každém kroku 0 až 3.
 *
 * Navržené rozhraní `src/games/counting/logic/progressMapCard.ts` (čistý
 * TypeScript bez Phaseru):
 * - `interface ProgressMapCard { rect: PictureRect; area: GameArea }`:
 *   `rect` je plocha obrázku mapy v kartě v CSS px okna (bez bílého
 *   okraje), `area` plocha mapy v kartě v herních jednotkách: šířka a výška
 *   karty, stejná míra `scale` jako hra, `offsetX`/`offsetY` levý horní roh
 *   karty v CSS px okna, bez `coveredEdges`. Tuto plochu dostanou
 *   `layoutProgressMap`, `layoutMapScenery` a `mapContentBox` místo herní
 *   plochy; pás pro kolečko a domeček v ní nevyhrazují (karta už leží mimo
 *   jejich roh),
 * - `layoutProgressMapCard(viewport: Viewport): ProgressMapCard`,
 * - `mapCardPictureCover(card: ProgressMapCard): { orientation: MapOrientation;
 *   rect: PictureRect }` obrázek prostředí přes celou kartu (`rect` v CSS px
 *   od levého horního rohu karty, smí přečnívat a ořízne se),
 * - `mapCardPageBackdrop(): PageBackdrop` okraje stránky kolem plátna
 *   během karty.
 * Vzhled karty `PROGRESS_MAP_CARD_STYLE` v `src/games/counting/logic/theme.ts`:
 * `dimAlpha` (0,4), `borderCss` (6), `borderColor` (bílá), `cornerRadiusCss`.
 */

import { MAP_STEPS, MAP_THEMES } from '../../../src/games/counting/logic/progressMap';
import type { MapThemeId } from '../../../src/games/counting/logic/progressMap';
import { layoutProgressMapCard } from '../../../src/games/counting/logic/progressMapCard';
import type { ProgressMapCard } from '../../../src/games/counting/logic/progressMapCard';
import { layoutMapScenery } from '../../../src/games/counting/logic/mapScenery';
import { layoutProgressMap } from '../../../src/games/counting/logic/progressMapLayout';
import { PROGRESS_MAP_CARD_STYLE } from '../../../src/games/counting/logic/theme';
import { gameAreaFor } from '../../../src/shared/logic/viewportLayout';
import type { GameArea } from '../../../src/shared/logic/viewportLayout';
import type { LayoutItem, LayoutScene } from '../../shared/layoutRules';
import { toCss, viewportOf } from '../../shared/viewportFixtures';
import type { Box, TestWindow } from '../../shared/viewportFixtures';
import { cornerItems } from './layoutScenes';
import { MAP_WINDOWS } from './mapLayoutScenes';
import type { PictureMapCase } from './mapPictureLayoutScenes';
import type { SceneryCase } from './mapSceneryScenes';

export { MAP_WINDOWS };

/** Karta v jednom okně: herní plocha pod ní a karta s plochou mapy. */
export interface CardWindowCase {
  readonly label: string;
  readonly window: TestWindow;
  /** Herní plocha hry pod kartou (kolečko, domeček, ztmavená hra). */
  readonly gameArea: GameArea;
  readonly card: ProgressMapCard;
}

export function cardWindowCase(window: TestWindow): CardWindowCase {
  const viewport = viewportOf(window);
  return {
    label: window.name,
    window,
    gameArea: gameAreaFor(viewport),
    card: layoutProgressMapCard(viewport),
  };
}

export function cardWindowCases(windows: readonly TestWindow[] = MAP_WINDOWS): CardWindowCase[] {
  return windows.map(cardWindowCase);
}

function rectBox(rect: { left: number; top: number; width: number; height: number }): Box {
  return {
    left: rect.left,
    right: rect.left + rect.width,
    top: rect.top,
    bottom: rect.top + rect.height,
  };
}

/** Plocha obrázku mapy v kartě (bez bílého okraje) v CSS px okna. */
export function cardBox(card: ProgressMapCard): Box {
  return rectBox(card.rect);
}

/** Karta, jak ji dítě vidí: i s bílým okrajem, v CSS px okna. */
export function drawnCardBox(card: ProgressMapCard): Box {
  const border = PROGRESS_MAP_CARD_STYLE.borderCss;
  const inner = cardBox(card);
  return {
    left: inner.left - border,
    right: inner.right + border,
    top: inner.top - border,
    bottom: inner.bottom + border,
  };
}

/** Plocha mapy v kartě přepočtená na CSS px okna (má ležet přesně na kartě). */
export function cardAreaBox(card: ProgressMapCard): Box {
  return toCss({ left: 0, right: card.area.width, top: 0, bottom: card.area.height }, card.area);
}

/** Mapa `theme` v kartě okna `window` (pro pomůcky obrazovky s obrázkem a klíče). */
export function cardPictureCase(window: TestWindow, theme: MapThemeId): PictureMapCase {
  const { card } = cardWindowCase(window);
  return {
    label: `${window.name}, karta, mapa ${theme}`,
    window,
    theme,
    area: card.area,
    layout: layoutProgressMap(card.area, theme),
  };
}

export function cardPictureCases(windows: readonly TestWindow[] = MAP_WINDOWS): PictureMapCase[] {
  return windows.flatMap((window) => MAP_THEMES.map((theme) => cardPictureCase(window, theme)));
}

/** Pohyby prostředí mapy `theme` v kartě okna `window`. */
export function cardSceneryCase(window: TestWindow, theme: MapThemeId): SceneryCase {
  const { card } = cardWindowCase(window);
  return {
    label: `${window.name}, karta, mapa ${theme}`,
    window,
    theme,
    area: card.area,
    map: layoutProgressMap(card.area, theme),
    scenery: layoutMapScenery(card.area, theme),
  };
}

export function cardSceneryCases(windows: readonly TestWindow[] = MAP_WINDOWS): SceneryCase[] {
  return windows.flatMap((window) => MAP_THEMES.map((theme) => cardSceneryCase(window, theme)));
}

/**
 * Obrazovku mapy, kterou pomůcky z #133–#139 spočítaly v ploše karty,
 * přenese do karty: volná plocha je karta (mapa z ní nesmí vyčnívat)
 * a kolečko s domečkem stojí tam, kde je hra skutečně má (v herní ploše
 * pod kartou), ne přepočtené do plochy karty.
 */
export function insideCard(scene: LayoutScene, window: TestWindow): LayoutScene {
  const { card, gameArea } = cardWindowCase(window);
  const misplacedCorners = new Set(cornerItems(window, card.area).map((item) => item.name));
  const mapItems = scene.items.filter((item) => !misplacedCorners.has(item.name));
  // Kolečko a domeček leží mimo kartu: mapa je nesmí překrýt, ale do karty se vejít nemusí.
  const corners: LayoutItem[] = cornerItems(window, gameArea).map((item) => ({
    ...item,
    reserved: true,
  }));
  const items: LayoutItem[] = [...corners, ...mapItems];
  return { ...scene, free: cardBox(card), items };
}

/** Všechny kroky 0 až 3. */
export const MAP_STEP_LIST: readonly number[] = Array.from(
  { length: MAP_STEPS + 1 },
  (_, step) => step,
);

/** Je to kolečko, domeček nebo jejich vyhrazený roh či okolí? */
export function isCornerItem(item: LayoutItem, window: TestWindow, gameArea: GameArea): boolean {
  return cornerItems(window, gameArea).some((corner) => corner.name === item.name);
}

/**
 * Kolik prvek `item` vyčnívá do zaoblených rohů karty (oříznutá místa
 * mimo čtvrtkruh o poloměru `radius`), popis pro `expect`; prázdné pole =
 * nikde. Prvek je obdélník, do rohu karty se nejvíc přiblíží svým rohem.
 */
export function roundedCornerViolations(item: LayoutItem, card: Box, radius: number): string[] {
  const corners: ReadonlyArray<readonly [string, number, number, number, number]> = [
    // jméno, roh prvku x, y, střed čtvrtkruhu x, y
    ['levý horní', item.box.left, item.box.top, card.left + radius, card.top + radius],
    ['pravý horní', item.box.right, item.box.top, card.right - radius, card.top + radius],
    ['pravý dolní', item.box.right, item.box.bottom, card.right - radius, card.bottom - radius],
    ['levý dolní', item.box.left, item.box.bottom, card.left + radius, card.bottom - radius],
  ];
  const violations: string[] = [];
  for (const [name, x, y, centerX, centerY] of corners) {
    const towardLeft = name.includes('levý');
    const towardTop = name.includes('horní');
    const inCornerX = towardLeft ? x < centerX : x > centerX;
    const inCornerY = towardTop ? y < centerY : y > centerY;
    if (!inCornerX || !inCornerY) {
      continue;
    }
    const overhang = Math.hypot(x - centerX, y - centerY) - radius;
    if (overhang > 0.01) {
      violations.push(
        `${item.name} vyčnívá do zaobleného rohu (${name}) o ${overhang.toFixed(2)} px`,
      );
    }
  }
  return violations;
}
