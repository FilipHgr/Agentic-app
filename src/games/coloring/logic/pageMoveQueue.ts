/**
 * Fronta přesunů rozmalovaných stránek do alba (#141) pro výběr
 * omalovánky. Přesuny běží po jednom za sebou, takže souběžné volání
 * (otevření Omalovánek, dvojí podržení domečku) nic neuloží dvakrát.
 *
 * - Náhled se jen zhoupne u stránky, kterou přesun právě zpracovává
 *   (`isMoving`); omalovánku, na kterou ve frontě teprve dojde, jde otevřít.
 * - Omalovánku, ve které se právě maluje (`isOpen`), přesun přeskočí;
 *   její stránku přesune odchod z malování.
 * - Malování otevírané omalovánky počká (`pageSettled`), až ji přesuny,
 *   které běží nebo čekají, vyřídí; jinak by začalo se stránkou, kterou
 *   přesun vzápětí vyčistí.
 *
 * Čistý TypeScript bez Phaseru.
 */

import type { KeyValueStorage } from '../../../shared/storage/keyValueStorage';
import type { GameRecords } from '../../../shared/storage/profileRecords';
import type { AlbumPicture } from './album';
import { movePagesToAlbum } from './pageToAlbum';
import type { PageMove } from './pageToAlbum';
import type { PictureIdentity } from './savedPicture';

export interface PageMoveQueueOptions {
  readonly storage: KeyValueStorage | undefined;
  readonly records: GameRecords | undefined;
  /** Omalovánky sady s obrysem v pořadí sady (scéna je připravuje postupně). */
  readonly pictures: () => readonly AlbumPicture[];
  /** Maluje se právě v omalovánce (malování je vidět)? */
  readonly isOpen: (picture: PictureIdentity) => boolean;
}

export interface PageMoveQueue {
  /** Zpracovává přesun právě stránku omalovánky `picture`? */
  isMoving(picture: PictureIdentity): boolean;
  /**
   * Přesun všech stránek za předchozím přesunem; `before` doběhne před
   * ním (uložení malování při odchodu). Nikdy neskončí zamítnutým slibem.
   */
  enqueue(before: Promise<void>): Promise<readonly PageMove[]>;
  /**
   * Skončí, až stránku omalovánky `picture` vyřídí všechny přesuny, které
   * teď běží nebo čekají; bez nich hned. Nikdy neskončí zamítnutým slibem.
   */
  pageSettled(picture: PictureIdentity): Promise<void>;
}

/** Přesun ve frontě: které stránky už vyřídil a jestli skončil. */
interface MoveRun {
  readonly handled: Set<string>;
  finished: boolean;
}

/** Malování čekající na vyřízení stránky `key` přesuny `runs`. */
interface PageWaiter {
  readonly key: string;
  readonly runs: readonly MoveRun[];
  readonly resolve: () => void;
}

/** Označení omalovánky i s verzí obrysu. */
function pictureKey(picture: PictureIdentity): string {
  return `${picture.id}@${picture.version}`;
}

export function createPageMoveQueue(options: PageMoveQueueOptions): PageMoveQueue {
  /** Stránky, které přesun právě zpracovává. */
  const moving = new Set<string>();
  /** Konec posledního přesunu; další začne až po něm. */
  let lastMove: Promise<unknown> = Promise.resolve();
  /** Přesuny, které běží nebo čekají. */
  const activeRuns = new Set<MoveRun>();
  let waiters: PageWaiter[] = [];

  const isHandled = (waiter: PageWaiter): boolean =>
    waiter.runs.every((each) => each.finished || each.handled.has(waiter.key));

  /** Pustí malování, jejichž stránku už všechny přesuny vyřídily. */
  const releaseWaiters = (): void => {
    const ready = waiters.filter(isHandled);
    waiters = waiters.filter((waiter) => !isHandled(waiter));
    for (const waiter of ready) {
      waiter.resolve();
    }
  };

  const run = async (
    state: MoveRun,
    before: Promise<void>,
    previous: Promise<unknown>,
  ): Promise<readonly PageMove[]> => {
    const started = new Set<string>();
    try {
      await before;
      await previous;
      return await movePagesToAlbum({
        storage: options.storage,
        records: options.records,
        pictures: options.pictures(),
        isOpen: options.isOpen,
        onPictureStart: (picture) => {
          started.add(pictureKey(picture));
          moving.add(pictureKey(picture));
        },
        onPictureDone: (picture) => {
          started.delete(pictureKey(picture));
          moving.delete(pictureKey(picture));
          state.handled.add(pictureKey(picture));
          releaseWaiters();
        },
      });
    } catch (error) {
      console.warn('Omalovánky: přesun do alba se nepovedl', error);
      return [];
    } finally {
      for (const key of started) {
        moving.delete(key);
      }
      state.finished = true;
      activeRuns.delete(state);
      releaseWaiters();
    }
  };

  return {
    isMoving: (picture) => moving.has(pictureKey(picture)),
    enqueue: (before) => {
      const state: MoveRun = { handled: new Set(), finished: false };
      activeRuns.add(state);
      const next = run(state, before, lastMove);
      lastMove = next;
      return next;
    },
    pageSettled: (picture) =>
      new Promise<void>((resolve) => {
        const waiter: PageWaiter = { key: pictureKey(picture), runs: [...activeRuns], resolve };
        if (isHandled(waiter)) {
          resolve();
          return;
        }
        waiters.push(waiter);
      }),
  };
}
