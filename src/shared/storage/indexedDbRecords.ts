/**
 * Záznamy her podle profilu nad IndexedDB (#125), verze pro stránku. Stejné
 * chování jako verze v paměti (`profileRecords.ts`).
 *
 * - Jedna databáze s jedním úložištěm záznamů. Záznam má vlastníka
 *   (vnitřní označení profilu a hry) a data hry. Klíč čísluje IndexedDB
 *   sama, a tak jsou záznamy v pořadí uložení. Názvy databáze ani úložiště
 *   přezdívku neobsahují.
 * - Vlastník je v indexu jako dvojice `[profil, hra]`, ne jako spojený
 *   text, takže podobná označení („p1“ a „p12“) nikdy nesplynou.
 * - Nic nevyhodí výjimku ani nezamítne slib. Plné úložiště (kvóta) skončí
 *   `'full'`, ostatní chyby `'unavailable'`. Zápis běží v transakci, takže
 *   nezdařený zápis nic dřív uloženého nezmění.
 * - Zablokované otevření (druhý panel drží databázi ve starší verzi)
 *   skončí do `OPEN_TIMEOUT_MS` výsledkem `'unavailable'`. Další operace to
 *   zkusí znovu. Když druhý panel chce novější verzi, tahle stránka své
 *   spojení zavře, aby ho neblokovala.
 */

import { UNAVAILABLE_GAME_RECORDS, persistenceRequester } from './profileRecords';
import type {
  GameRecords,
  ProfileRecords,
  RecordData,
  RecordsOptions,
  RecordsWriteStatus,
  StoredRecord,
} from './profileRecords';

const DATABASE_NAME = 'agentic-app-records';
const DATABASE_VERSION = 1;
const RECORDS_STORE = 'records';
const OWNER_INDEX = 'owner';

/** Jak dlouho čekat na otevření databáze (AC2: zablokované do 2 s). */
const OPEN_TIMEOUT_MS = 1500;

/** Uložená hodnota záznamu. */
interface SavedRecord {
  readonly profileId: string;
  readonly gameId: string;
  readonly data: RecordData;
}

function isSavedRecord(value: unknown): value is SavedRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Partial<SavedRecord>;
  return (
    typeof record.profileId === 'string' &&
    typeof record.gameId === 'string' &&
    typeof record.data === 'object' &&
    record.data !== null
  );
}

/** Výsledek transakce: hodnota po dokončení, nebo proč se nedokončila. */
type TransactionResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly status: 'full' | 'unavailable' };

const UNAVAILABLE: TransactionResult<never> = { ok: false, status: 'unavailable' };

function statusOfError(error: unknown): 'full' | 'unavailable' {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
    ? 'full'
    : 'unavailable';
}

/** IndexedDB prohlížeče, nebo `undefined`, když ji prohlížeč nemá nebo zakázal. */
export function browserIndexedDb(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB ?? undefined;
  } catch {
    // Safari se zakázanými daty webu může přístup k IndexedDB odmítnout.
    return undefined;
  }
}

/** Založí úložiště záznamů v nové databázi. */
function createStores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(RECORDS_STORE)) {
    const store = database.createObjectStore(RECORDS_STORE, { autoIncrement: true });
    store.createIndex(OWNER_INDEX, ['profileId', 'gameId']);
  }
}

/**
 * Otevře databázi; `undefined`, když to nejde (zakázané úložiště, soukromý
 * režim, chyba) nebo se do `OPEN_TIMEOUT_MS` neotevře (zablokování).
 */
function openDatabase(factory: IDBFactory): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (database: IDBDatabase | undefined): void => {
      if (settled) {
        // Pozdě otevřená databáze (po vypršení času) se hned zavře.
        database?.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(database);
    };
    const timer = setTimeout(() => finish(undefined), OPEN_TIMEOUT_MS);
    try {
      const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        try {
          createStores(request.result);
        } catch {
          // Nezaložené úložiště: otevření skončí chybou a operace „nedostupné“.
          request.transaction?.abort();
        }
      };
      request.onsuccess = () => finish(request.result);
      request.onerror = (event) => {
        // Chyba je ošetřená tady, prohlížeč ji nemá hlásit dál.
        event.preventDefault();
        finish(undefined);
      };
    } catch {
      // Zakázané úložiště: `open` hned vyhodí SecurityError.
      finish(undefined);
    }
  });
}

/**
 * Spustí transakci nad úložištěm záznamů. `work` zadá požadavky a vrátí,
 * jak po dokončení přečíst výsledek. Nic nevyhodí, chyba je výsledek.
 */
function runTransaction<T>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => () => T,
): Promise<TransactionResult<T>> {
  return new Promise((resolve) => {
    let firstError: unknown;
    try {
      const transaction = database.transaction(RECORDS_STORE, mode);
      const result = work(transaction.objectStore(RECORDS_STORE));
      transaction.onerror = (event) => {
        // Chyba požadavku zruší celou transakci; zapamatuje se, proč.
        firstError ??= (event.target as IDBRequest | null)?.error;
      };
      transaction.oncomplete = () => {
        try {
          resolve({ ok: true, value: result() });
        } catch {
          // Výsledek nejde přečíst: stejné jako nedostupné úložiště.
          resolve(UNAVAILABLE);
        }
      };
      transaction.onabort = () => {
        resolve({ ok: false, status: statusOfError(transaction.error ?? firstError) });
      };
    } catch (error) {
      // Ztracené spojení nebo neplatná data: transakce vůbec nezačala.
      resolve({ ok: false, status: statusOfError(error) });
    }
  });
}

/** Rozsah indexu pro všechny hry jednoho profilu: `[profil]` až `[profil, []]`. */
function profileRange(profileId: string): IDBKeyRange {
  // Pole je v IndexedDB větší než každý text, takže `[]` uzavře všechny hry profilu.
  return IDBKeyRange.bound([profileId], [profileId, []]);
}

/** Projde kurzor a pro každý záznam zavolá `visit`. */
function eachCursor<Cursor extends IDBCursor>(
  request: IDBRequest<Cursor | null>,
  visit: (cursor: Cursor) => void,
): void {
  request.onsuccess = () => {
    const cursor = request.result;
    if (cursor !== null) {
      visit(cursor);
      cursor.continue();
    }
  };
}

/** Označení záznamu z jeho textu; `undefined` u textu, který klíčem být nemůže. */
function keyOf(id: string): number | undefined {
  const key = Number(id);
  return /^\d+$/.test(id) && Number.isSafeInteger(key) ? key : undefined;
}

/** Úložiště záznamů nad IndexedDB `factory`; bez ní je vše „nedostupné“. */
export function indexedDbProfileRecords(
  factory: IDBFactory | undefined,
  options: RecordsOptions = {},
): ProfileRecords {
  const afterSaved = persistenceRequester(options.persistentStorage);
  let opening: Promise<IDBDatabase | undefined> | undefined;

  /** Otevřená databáze sdílená všemi operacemi; po chybě se otevře znovu. */
  function database(): Promise<IDBDatabase | undefined> {
    if (factory === undefined) {
      return Promise.resolve(undefined);
    }
    if (opening === undefined) {
      const current = openDatabase(factory).then((opened) => {
        if (opened === undefined) {
          opening = undefined;
        } else {
          const forget = (): void => {
            if (opening === current) {
              opening = undefined;
            }
          };
          opened.onversionchange = () => {
            // Novější verze v jiném panelu: spojení se uvolní, příště se otevře znovu.
            opened.close();
            forget();
          };
          opened.onclose = forget;
        }
        return opened;
      });
      opening = current;
    }
    return opening;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => () => T,
  ): Promise<TransactionResult<T>> {
    const opened = await database();
    return opened === undefined ? UNAVAILABLE : runTransaction(opened, mode, work);
  }

  async function write(work: (store: IDBObjectStore) => void): Promise<RecordsWriteStatus> {
    const result = await run('readwrite', (store) => {
      work(store);
      return () => undefined;
    });
    return result.ok ? 'saved' : result.status;
  }

  function forGame(profileId: string, gameId: string): GameRecords {
    if (factory === undefined) {
      return UNAVAILABLE_GAME_RECORDS;
    }
    const owns = (value: unknown): boolean =>
      isSavedRecord(value) && value.profileId === profileId && value.gameId === gameId;
    return {
      async list() {
        const result = await run('readonly', (store) => {
          const records: StoredRecord[] = [];
          const range = IDBKeyRange.only([profileId, gameId]);
          eachCursor(store.index(OWNER_INDEX).openCursor(range), (cursor) => {
            if (isSavedRecord(cursor.value)) {
              records.push({ id: String(cursor.primaryKey), data: cursor.value.data });
            }
          });
          return () => records;
        });
        return result.ok ? { status: 'read', records: result.value } : { status: 'unavailable' };
      },

      async add(data) {
        const saved: SavedRecord = { profileId, gameId, data };
        const result = await run('readwrite', (store) => {
          const request = store.add(saved);
          return () => String(request.result);
        });
        if (!result.ok) {
          return { status: result.status };
        }
        afterSaved();
        return { status: 'saved', id: result.value };
      },

      remove(id) {
        const key = keyOf(id);
        return write((store) => {
          if (key === undefined) {
            // Takový záznam nikdy nevznikl: není co mazat, jen se ověří úložiště.
            return;
          }
          const request = store.get(key);
          request.onsuccess = () => {
            if (owns(request.result)) {
              store.delete(key);
            }
          };
        });
      },
    };
  }

  return {
    forGame,
    removeProfile: (profileId) =>
      write((store) => {
        const index = store.index(OWNER_INDEX);
        // Kurzor jen nad klíči: obsah záznamů (obrázky) se do paměti nenačítá.
        eachCursor(index.openKeyCursor(profileRange(profileId)), (cursor) =>
          store.delete(cursor.primaryKey),
        );
      }),
    removeAllExcept: (profileIds) =>
      write((store) => {
        eachCursor(store.openCursor(), (cursor) => {
          const value: unknown = cursor.value;
          if (!isSavedRecord(value) || !profileIds.includes(value.profileId)) {
            cursor.delete();
          }
        });
      }),
  };
}
