/**
 * Pomůcky pro testy k #129 (velký obrázek z alba a smazání podržením koše).
 *
 * Výběr (`startPictureChoice`) dostane navíc záznamy aktivního profilu
 * (`records`), aby mohl smazat obrázek z alba, a posluchače odezvy koše
 * (`onTrash`). Koš je podržení 1 s jako „Smazat“ u profilu (#108):
 * `PictureChoice.trashButton` je `HoldButton` ze sdílené logiky
 * (`createHoldButton`), testy ho drží s falešnými časovači Vitestu a výběr
 * měří čas přes `() => Date.now()` (falešné časovače posouvají i hodiny).
 *
 * Jedno „otevření velkého obrázku“ je ťuknutí na knihu s přečteným albem,
 * ťuknutí na náhled v albu a hlášení scény, že je velký obrázek vidět
 * (`bigPictureShown`). Podržení domečku se počítá až od té chvíle
 * (#129 AC5, jako #124 AC5), proto `showBigPicture` hodiny posune o celé
 * podržení domečku.
 *
 * Navržené rozhraní viz výstup testů #129 (`pictureChoice.ts`, `album.ts`,
 * `pickerLayout.ts`).
 */

import { expect, vi } from 'vitest';

import { startPictureChoice } from '../../../src/games/coloring/logic/pictureChoice';
import type {
  PictureChoice,
  TrashFeedback,
  TrashResult,
} from '../../../src/games/coloring/logic/pictureChoice';
import type { AlbumContents } from '../../../src/games/coloring/logic/album';
import type { PictureIdentity } from '../../../src/games/coloring/logic/savedPicture';
import { HOLD_TO_GO_HOME_MS } from '../../../src/shared/logic/homeButton';
import type { GameRecords } from '../../../src/shared/storage/profileRecords';
import { THREE_PICTURES, albumOf } from './albumHelpers';

/** Jak dlouho se drží koš, aby smazal obrázek (#129 AC3). */
export const TRASH_HOLD_MS = 1000;

/** Výběr s albem aktivního profilu a odezvou koše. */
export interface BigPictureTest {
  readonly choice: PictureChoice;
  readonly records: GameRecords;
  /** Všechna odezva koše od spuštění výběru. */
  readonly feedback: TrashFeedback[];
}

/** Dítě ťukne v menu na Omalovánky: výběr se záznamy `records`. */
export function enterWithRecords(
  records: GameRecords,
  pictures: readonly PictureIdentity[] = THREE_PICTURES,
): BigPictureTest {
  const feedback: TrashFeedback[] = [];
  const choice = startPictureChoice(pictures, {
    now: () => Date.now(),
    records,
    onTrash: (event) => {
      feedback.push(event);
    },
  });
  return { choice, records, feedback };
}

/** Dítě ťukne na knihu s albem, jak ho scéna přečetla. Selže, když se album neotevřelo. */
export async function openAlbum(test: BigPictureTest): Promise<AlbumContents> {
  const album = await albumOf(test.records);
  const tap = test.choice.tapBook(album);
  expect(tap.kind, 'kniha otevře album').toBe('open');
  return album;
}

/**
 * Dítě v albu ťukne na náhled `index`, scéna ukáže velký obrázek a hodiny
 * se posunou o celé podržení domečku. Selže, když se velký obrázek neotevřel.
 */
export function showBigPicture(test: BigPictureTest, index: number): void {
  const tap = test.choice.tapAlbumPreview(index);
  expect(tap.kind, `náhled ${index + 1} otevře velký obrázek`).toBe('open');
  test.choice.bigPictureShown();
  vi.advanceTimersByTime(HOLD_TO_GO_HOME_MS);
}

/** Odezva koše od pořadí `from` dál. */
export function feedbackAfter(test: BigPictureTest, from: number): TrashFeedback[] {
  return test.feedback.slice(from);
}

/** Zhoupnutí koše v odezvě od `from` dál. */
export function trashWobbles(test: BigPictureTest, from: number): TrashFeedback[] {
  return feedbackAfter(test, from).filter((event) => event.kind === 'trashWobble');
}

/** Začátky mazání v odezvě od `from` dál. */
export function deletions(
  test: BigPictureTest,
  from: number,
): Array<Extract<TrashFeedback, { kind: 'deleting' }>> {
  return feedbackAfter(test, from).filter(
    (event): event is Extract<TrashFeedback, { kind: 'deleting' }> => event.kind === 'deleting',
  );
}

/**
 * Dítě drží koš prstem `pointerId` celou 1 s. Vrátí konec mazání. Selže,
 * když se mazání nezačalo.
 */
export function holdTrash(test: BigPictureTest, pointerId = 1): Promise<TrashResult> {
  const from = test.feedback.length;
  test.choice.trashButton.press(pointerId);
  vi.advanceTimersByTime(TRASH_HOLD_MS);
  const started = deletions(test, from);
  expect(started.length, 'podržení koše 1 s začne mazat právě jednou').toBe(1);
  const [deleting] = started;
  if (deleting === undefined) {
    throw new Error('koš nezačal mazat');
  }
  test.choice.trashButton.release(pointerId);
  return deleting.done;
}

/** Označení obrázků, které album ukazuje, od nejnovějšího. */
export async function shownIds(records: GameRecords): Promise<string[]> {
  const album = await albumOf(records);
  return album.status === 'read' ? album.entries.map((entry) => entry.recordId) : [];
}
