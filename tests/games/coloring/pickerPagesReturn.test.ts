import { afterEach, describe, expect, it, vi } from 'vitest';

import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import { albumPicturesOf, fillAlbum } from './albumHelpers';
import {
  CIRCLES,
  HOUSE,
  STAR,
  SwapDevice,
  EMA,
  albumOn,
  choiceOn,
  openBigPicture,
  settleOn,
  showPainting,
  tapContinue,
} from './continuePaintingHelpers';
import type { SwapPage } from './continuePaintingHelpers';
import { PICKER_PAGE_SIZE, testPictures, turnByArrow } from './pickerPagesHelpers';
import { twoHalves } from './savedPictureHelpers';

/**
 * Test k #150, upřesnění 1: po návratu z alba domečkem i po Malovat dál
 * z alba (#131) se výběr otevře na stránce, na které dítě bylo, stejně
 * jako po malování (AC2).
 *
 * Testovací sada má 15 omalovánek (AC3): 12 zkušebních na 1. stránce
 * a domek, kruhy a hvězdu na 2. stránce. Album má obrázky domku, aby šlo
 * z velkého obrázku malovat dál.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Omalovánky testovací sady: domek, kruhy a hvězda až na 2. stránce. */
const PAGED_PICTURES = [...testPictures(PICKER_PAGE_SIZE), HOUSE, CIRCLES, STAR];

/** Album domku se 2 obrázky; dítě otevře Omalovánky a nalistuje 2. stránku výběru. */
async function onSecondPickerPage(): Promise<SwapPage> {
  vi.useRealTimers();
  const device = new SwapDevice();
  await fillAlbum(device.records(EMA), 2, HOUSE, PAGED_PICTURES);
  vi.useFakeTimers();
  device.nextLoad();
  const page = choiceOn(device, { pictures: albumPicturesOf(PAGED_PICTURES, twoHalves()) });
  await settleOn(page);
  turnByArrow(page.choice, 'next');
  expect(page.choice.pickerPage(), 'předpoklad: 2. stránka výběru').toBe(1);
  return page;
}

describe('#150 upřesnění 1: z alba se výběr vrátí na stránku, na které dítě bylo', () => {
  it('po návratu z alba domečkem je výběr zase na 2. stránce', async () => {
    const page = await onSecondPickerPage();
    expect(page.choice.tapBook(await albumOn(page)).kind, 'kniha otevře album').toBe('open');

    expect(page.choice.holdHome(), 'domeček z alba vede na výběr').toBe('toPicker');

    expect(page.choice.screen()).toEqual({ kind: 'picker' });
    expect(page.choice.pickerPage()).toBe(1);
    expect(page.choice.pagePreviews()).toEqual([HOUSE, CIRCLES, STAR]);
  });

  it('po návratu z velkého obrázku do alba a pak domečkem na výběr je výběr zase na 2. stránce', async () => {
    const page = await onSecondPickerPage();
    await openBigPicture(page, 0);

    expect(page.choice.holdHome(), 'z velkého obrázku do alba').toBe('toAlbum');
    expect(page.choice.holdHome(), 'z alba na výběr').toBe('toPicker');

    expect(page.choice.pickerPage()).toBe(1);
  });

  it('po Malovat dál z alba a návratu z malování je výběr zase na 2. stránce', async () => {
    const page = await onSecondPickerPage();
    await openBigPicture(page, 0);
    expect(await tapContinue(page), 'štětec otevře malování domku').toEqual({
      kind: 'opened',
      picture: HOUSE,
    });
    await showPainting(page, HOUSE);
    vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);

    expect(page.choice.holdHome(), 'domeček v malování vede na výběr').toBe('toPicker');

    expect(page.choice.screen()).toEqual({ kind: 'picker' });
    expect(page.choice.pickerPage()).toBe(1);
    expect(page.choice.pagePreviews()).toEqual([HOUSE, CIRCLES, STAR]);
  });

  it('po novém otevření Omalovánek z menu po albu je výběr na 1. stránce', async () => {
    const page = await onSecondPickerPage();
    page.choice.tapBook(await albumOn(page));
    page.choice.holdHome();
    expect(page.choice.holdHome(), 'domeček z výběru vede do menu').toBe('toMenu');

    const again = choiceOn(page.device, {
      pictures: albumPicturesOf(PAGED_PICTURES, twoHalves()),
    });

    expect(again.choice.pickerPage()).toBe(0);
  });
});
