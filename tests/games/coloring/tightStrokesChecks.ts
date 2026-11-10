import { expect } from 'vitest';

import type { LineSize } from '../../../src/games/coloring/logic/toolPanel';
import { RESERVED_RECORD_LIMIT } from './manyColorsHelpers';
import {
  colorCountOf,
  matrixPictures,
  readBack,
  restoreAfterMenuAndReload,
  worstOf,
} from './tightStrokesHelpers';
import type { MatrixPicture, PaintingTool, StrokeDirection } from './tightStrokesHelpers';

/**
 * Kontroly matice těsných tahů (#119 AC1 a AC2), společné pro pomalé
 * soubory vodorovných a svislých tahů. Jako `rotationChecks.ts` v Počítání
 * používá `expect` z Vitestu, aby selhání ukázalo přesný obrázek matice.
 */

/** Nejmenší díl pixelů mimo obrys, který vzor pokrývá (třpytky velké mají asi 0,11). */
const MIN_PAINTED_SHARE = 0.05;

/**
 * Duha na mřížce projde v buňce jen dva úseky barev (buňka je asi 130 px,
 * úsek 2 W stř asi 68 px), víc barev se u ní hlídat nedá.
 */
const MIN_RAINBOW_COLORS = 2;

/** Vzor opravdu střídá barvy tahů a pokrývá obrázek; jinak by test měřil skoro prázdný obrázek. */
function expectRealPattern(picture: MatrixPicture, tool: PaintingTool): void {
  const { what } = picture;
  expect(picture.strokeCount, `${what}: počet tahů`).toBeGreaterThan(0);
  expect(picture.paintedShare, `${what}: vzor pokrývá obrázek`).toBeGreaterThan(MIN_PAINTED_SHARE);
  const minColors =
    tool === 'rainbow'
      ? MIN_RAINBOW_COLORS
      : Math.min(picture.strokeCount, picture.order.colors.length);
  expect(colorCountOf(picture.pixels), `${what}: každý tah má svou barvu`).toBeGreaterThanOrEqual(
    minColors,
  );
}

/** Záznam má nejvýš 45 000 znaků a přečte se pixel po pixelu i s vybranou barvou. */
function expectWithinReserve(picture: MatrixPicture): void {
  const { what } = picture;
  expect(picture.record.length, `${what}: délka záznamu`).toBeLessThanOrEqual(
    RESERVED_RECORD_LIMIT,
  );
  const read = readBack(picture);
  expect(read.selectedColor, `${what}: vybraná barva`).toBe(picture.selectedColor);
  expect(read.differences, `${what}: stejný obrázek pixel po pixelu`).toEqual([]);
}

/** Nejhorší obrázek se ve hře obnoví po návratu z menu i po obnovení stránky. */
function expectWorstRestored(pictures: readonly MatrixPicture[]): void {
  const worst = worstOf(pictures);
  expect(worst, 'kontrola: matice má obrázky').toBeDefined();
  if (worst === undefined) {
    return;
  }
  const what = `nejhorší obrázek (${worst.what})`;
  const steps = restoreAfterMenuAndReload(worst);
  expect(steps.afterOpen, `${what}: po otevření hry`).toEqual([]);
  expect(steps.afterMenu, `${what}: po návratu z menu`).toEqual([]);
  expect(steps.menuSelected, `${what}: po návratu z menu je uložený nový stav`).toBe(steps.tapped);
  expect(steps.afterReload, `${what}: po obnovení stránky`).toEqual([]);
  expect(steps.reloadSelected, `${what}: po obnovení stránky vybraná barva`).toBe(steps.tapped);
}

/**
 * Celá matice jednoho nástroje, tloušťky a směru: každý záznam nejvýš
 * 45 000 znaků a přečte se pixel po pixelu, nejhorší obrázek se ve hře
 * obnoví po návratu z menu i po obnovení stránky.
 */
export function expectTightStrokesFit(
  tool: PaintingTool,
  size: LineSize,
  direction: StrokeDirection,
): void {
  const pictures = matrixPictures(tool, size, direction);
  for (const picture of pictures) {
    expectRealPattern(picture, tool);
    expectWithinReserve(picture);
  }
  expectWorstRestored(pictures);
}
