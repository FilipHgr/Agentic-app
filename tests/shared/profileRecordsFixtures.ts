import { IDBDatabase, IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { vi } from 'vitest';

import { indexedDbProfileRecords } from '../../src/shared/storage/indexedDbRecords';
import {
  createMemoryRecordsShelf,
  memoryProfileRecords,
} from '../../src/shared/storage/profileRecords';
import type {
  GameRecords,
  PersistentStorageAccess,
  ProfileRecords,
  RecordData,
  RecordsOptions,
} from '../../src/shared/storage/profileRecords';

/**
 * Pomůcky pro testy záznamů her podle profilu (#125). Záznamy jsou velká
 * data her (album Omalovánek) jen v zařízení. Jsou dvě implementace stejného
 * rozhraní `ProfileRecords`: v paměti (pro testy her) a nad IndexedDB (ve
 * hře). V testech je IndexedDB z balíčku `fake-indexeddb`, každé zařízení
 * má vlastní `new IDBFactory()`, takže se testy navzájem neovlivní.
 *
 * Jedno „zařízení“ (`RecordsDevice`) přežije obnovení stránky: každé
 * `open()` je nové načtení stránky nad stejnými uloženými daty.
 *
 * Selhání IndexedDB (plné, zakázané, zablokované úložiště) se simulují
 * obalem nad `fake-indexeddb`. Plné úložiště sahá na vnitřní
 * `_execRequestAsync` a `_abort` z `fake-indexeddb` (verze je v
 * `package.json` pevná), protože veřejné API chybu kvóty vyvolat neumí.
 */

/**
 * Jako v prohlížeči je `IDBKeyRange` globální (implementace ho smí použít).
 * Globální `indexedDB` schválně ne: úložiště dostane IndexedDB vždy zvenku.
 */
if (!('IDBKeyRange' in globalThis)) {
  Object.defineProperty(globalThis, 'IDBKeyRange', { value: IDBKeyRange, configurable: true });
}

/** Uložené zařízení se záznamy her; `open()` je nové načtení stránky. */
export interface RecordsDevice {
  readonly name: string;
  /** Nové načtení stránky nad stejnými daty. */
  open(options?: RecordsOptions): ProfileRecords;
  /** Načtení stránky, které úložiště záznamů nejde použít (data v zařízení zůstanou). */
  openUnavailable(): ProfileRecords;
  /** Všechny názvy, klíče a hodnoty v IndexedDB jako text; v paměti `undefined`. */
  dump(): Promise<string[]> | undefined;
}

/** Zařízení se záznamy jen v paměti. */
export function memoryDevice(): RecordsDevice {
  const shelf = createMemoryRecordsShelf();
  return {
    name: 'v paměti',
    open: (options) => memoryProfileRecords(shelf, options),
    openUnavailable: () => unavailableProfileRecords(),
    dump: () => undefined,
  };
}

/** Zařízení se záznamy v IndexedDB (fake-indexeddb). */
export interface IndexedDbDevice extends RecordsDevice {
  readonly factory: IDBFactory;
}

export function indexedDbDevice(): IndexedDbDevice {
  const factory = new IDBFactory();
  return {
    name: 'IndexedDB',
    factory,
    open: (options) => indexedDbProfileRecords(factory, options),
    openUnavailable: () => indexedDbProfileRecords(securityErrorFactory()),
    dump: () => dumpIndexedDb(factory),
  };
}

/** Obě implementace pro testy, které platí pro každou z nich. */
export const RECORDS_DEVICES: ReadonlyArray<readonly [string, () => RecordsDevice]> = [
  ['v paměti', memoryDevice],
  ['IndexedDB', indexedDbDevice],
];

/** Obrázky dítěte: různá data včetně bajtů obrázku. */
export const PICTURES: readonly RecordData[] = [
  { title: 'kočka', pixels: new Uint8Array([1, 2, 3, 250]), savedAt: 1, finished: true },
  { title: 'pejsek', pixels: new Uint8Array([4, 5]), savedAt: 2, finished: false },
  { title: 'auto', pixels: new Uint8Array([]), savedAt: 3, finished: true },
];

/** Obrázek s popisem `title`, aby šlo poznat, komu patří. */
export function pictureFor(title: string): RecordData {
  return { title, pixels: new Uint8Array([7, 7, 7]), savedAt: 9, finished: true };
}

/** Data uložených záznamů v pořadí; `undefined`, když číst nejde. */
export async function dataOf(records: GameRecords): Promise<RecordData[] | undefined> {
  const listed = await records.list();
  return listed.status === 'read' ? listed.records.map((record) => record.data) : undefined;
}

/** Uloží záznam a vrátí jeho označení; když se neuloží, test selže. */
export async function addSaved(records: GameRecords, data: RecordData): Promise<string> {
  const result = await records.add(data);
  if (result.status !== 'saved') {
    throw new Error(`záznam se neuložil: ${result.status}`);
  }
  return result.id;
}

/** Nechá doběhnout všechny čekající úlohy (fake-indexeddb plánuje jako další úlohy). */
export async function settle(): Promise<void> {
  for (let round = 0; round < 30; round += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

/** Úložiště záznamů, které nejde použít: každá operace „nedostupné“. */
export function unavailableProfileRecords(): ProfileRecords {
  const game: GameRecords = {
    list: () => Promise.resolve({ status: 'unavailable' }),
    add: () => Promise.resolve({ status: 'unavailable' }),
    remove: () => Promise.resolve('unavailable'),
  };
  return {
    forGame: () => game,
    removeProfile: () => Promise.resolve('unavailable'),
    removeAllExcept: () => Promise.resolve('unavailable'),
  };
}

/** Jedno volání úložiště záznamů, jak ho zaznamenal `spyOnRecords`. */
export interface RecordsCall {
  readonly operation: string;
  readonly args: readonly unknown[];
}

/**
 * Obal nad `ProfileRecords`, který si zapíše každé volání i s argumenty
 * (u operací hry i profil a hru z `forGame`).
 */
export function spyOnRecords(inner: ProfileRecords): {
  readonly records: ProfileRecords;
  readonly calls: RecordsCall[];
} {
  const calls: RecordsCall[] = [];
  const records: ProfileRecords = {
    forGame(profileId, gameId) {
      calls.push({ operation: 'forGame', args: [profileId, gameId] });
      const game = inner.forGame(profileId, gameId);
      return {
        list: () => {
          calls.push({ operation: 'list', args: [profileId, gameId] });
          return game.list();
        },
        add: (data) => {
          calls.push({ operation: 'add', args: [profileId, gameId, data] });
          return game.add(data);
        },
        remove: (id) => {
          calls.push({ operation: 'remove', args: [profileId, gameId, id] });
          return game.remove(id);
        },
      };
    },
    removeProfile(profileId) {
      calls.push({ operation: 'removeProfile', args: [profileId] });
      return inner.removeProfile(profileId);
    },
    removeAllExcept(profileIds) {
      calls.push({ operation: 'removeAllExcept', args: [[...profileIds]] });
      return inner.removeAllExcept(profileIds);
    },
  };
  return { records, calls };
}

/** Operace, které mažou záznamy. */
export const REMOVING_OPERATIONS: readonly string[] = [
  'remove',
  'removeProfile',
  'removeAllExcept',
];

/** Volání, která něco mažou. */
export function removingCalls(calls: readonly RecordsCall[]): RecordsCall[] {
  return calls.filter((call) => REMOVING_OPERATIONS.includes(call.operation));
}

/** Text hodnoty i s bajty (Uint8Array jako pole čísel). */
function asText(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner instanceof Uint8Array ? [...inner] : inner,
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('požadavek selhal'));
  });
}

/**
 * Všechno, co je v IndexedDB zařízení vidět: názvy databází, úložišť
 * a indexů, klíče i hodnoty záznamů jako text.
 */
export async function dumpIndexedDb(factory: IDBFactory): Promise<string[]> {
  const found: string[] = [];
  for (const info of await factory.databases()) {
    const name = info.name ?? '';
    found.push(name);
    const db = await requestResult(factory.open(name));
    for (const storeName of Array.from(db.objectStoreNames)) {
      found.push(storeName);
      const store = db.transaction(storeName, 'readonly').objectStore(storeName);
      found.push(...Array.from(store.indexNames));
      const keys = await requestResult(store.getAllKeys());
      const values = await requestResult(store.getAll());
      found.push(...keys.map(asText), ...values.map(asText));
    }
    db.close();
  }
  return found;
}

/** IndexedDB, kterou prohlížeč zakázal: `open` hned vyhodí SecurityError. */
export function securityErrorFactory(): IDBFactory {
  const refuse = (): never => {
    throw new DOMException('Úložiště je zakázané', 'SecurityError');
  };
  return {
    open: refuse,
    deleteDatabase: refuse,
    databases: () => Promise.reject(new DOMException('Úložiště je zakázané', 'SecurityError')),
    cmp: () => 0,
  } as unknown as IDBFactory;
}

/**
 * Požadavek na otevření, který skončí chybou (soukromý režim staršího
 * Safari: InvalidStateError, poškozené úložiště: UnknownError).
 */
class FailedOpenRequest extends EventTarget {
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onupgradeneeded: ((event: Event) => void) | null = null;
  onblocked: ((event: Event) => void) | null = null;
  readonly readyState = 'done';
  readonly source = null;
  readonly transaction = null;
  readonly error: DOMException;

  constructor(errorName: string) {
    super();
    this.error = new DOMException('Úložiště nejde otevřít', errorName);
    setTimeout(() => this.fail(), 0);
  }

  get result(): never {
    throw new DOMException('Požadavek skončil chybou', 'InvalidStateError');
  }

  private fail(): void {
    const event = new Event('error', { bubbles: true, cancelable: true });
    this.onerror?.call(this, event);
    this.dispatchEvent(event);
  }
}

/** IndexedDB, jejíž otevření vždy skončí chybou `errorName`. */
export function failingOpenFactory(errorName: string): IDBFactory {
  return {
    open: () => new FailedOpenRequest(errorName),
    deleteDatabase: () => new FailedOpenRequest(errorName),
    databases: () => Promise.reject(new DOMException('Úložiště nejde otevřít', errorName)),
    cmp: () => 0,
  } as unknown as IDBFactory;
}

/**
 * Zablokované úložiště: druhý panel se starší verzí hry drží databáze
 * otevřené a na žádost o novou verzi nereaguje. Nová stránka chce každou
 * existující databázi otevřít ve vyšší verzi, a tak čeká navždy (událost
 * `blocked`). Databáze musí v zařízení už existovat.
 */
export async function blockedByOlderPanel(real: IDBFactory): Promise<IDBFactory> {
  const versions = new Map<string, number>();
  for (const info of await real.databases()) {
    const name = info.name ?? '';
    const olderPanel = await requestResult(real.open(name));
    // Starší panel na `versionchange` nereaguje a spojení nezavře.
    olderPanel.onversionchange = null;
    versions.set(name, olderPanel.version);
  }
  if (versions.size === 0) {
    throw new Error('v zařízení není žádná databáze, kterou by šlo zablokovat');
  }
  return {
    open: (name: string, version?: number) => {
      const held = versions.get(name);
      return held === undefined ? real.open(name, version) : real.open(name, held + 1);
    },
    deleteDatabase: (name: string) => real.deleteDatabase(name),
    databases: () => real.databases(),
    cmp: (first: unknown, second: unknown) => real.cmp(first, second),
  } as unknown as IDBFactory;
}

/** Vnitřek transakce fake-indexeddb, přes který jde vyvolat chybu kvóty. */
interface FakeTransactionInternals {
  _execRequestAsync(request: { operation: () => unknown; source: unknown }): IDBRequest;
  _abort(errorName: string | null): void;
}

function internalsOf(store: IDBObjectStore): FakeTransactionInternals {
  return store.transaction as unknown as FakeTransactionInternals;
}

/** Jak se plné úložiště ohlásí: chybou požadavku, nebo zrušením celé transakce. */
export type QuotaShape = 'chyba požadavku' | 'zrušená transakce';

export const QUOTA_SHAPES: readonly QuotaShape[] = ['chyba požadavku', 'zrušená transakce'];

/**
 * Od teď každý zápis (`add`, `put`) do IndexedDB narazí na plné úložiště
 * (QuotaExceededError). Vrátí funkci, která zápisy zase povolí.
 */
export function fillQuota(shape: QuotaShape): () => void {
  const originalPut = IDBObjectStore.prototype.put;
  const originalAdd = IDBObjectStore.prototype.add;
  const quotaError = (): DOMException => new DOMException('Úložiště je plné', 'QuotaExceededError');

  function failingWrite(
    original: typeof originalPut,
  ): (this: IDBObjectStore, value: unknown, key?: IDBValidKey) => IDBRequest<IDBValidKey> {
    return function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (shape === 'chyba požadavku') {
        return internalsOf(this)._execRequestAsync({
          source: this,
          operation: () => {
            throw quotaError();
          },
        }) as IDBRequest<IDBValidKey>;
      }
      const request =
        key === undefined ? original.call(this, value) : original.call(this, value, key);
      const internals = internalsOf(this);
      // Chrome hlásí plné úložiště až při dokončení: transakce se zruší celá.
      request.addEventListener('success', () => internals._abort('QuotaExceededError'));
      return request;
    };
  }

  const put = vi
    .spyOn(IDBObjectStore.prototype, 'put')
    .mockImplementation(failingWrite(originalPut));
  const add = vi
    .spyOn(IDBObjectStore.prototype, 'add')
    .mockImplementation(failingWrite(originalAdd));
  return () => {
    put.mockRestore();
    add.mockRestore();
  };
}

/**
 * Od teď se spojení s databází „ztratí“: každá nová transakce vyhodí
 * InvalidStateError (Safari: „Connection to Indexed Database server lost“).
 */
export function loseConnection(): () => void {
  const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => {
    throw new DOMException('Spojení s úložištěm se ztratilo', 'InvalidStateError');
  });
  return () => transaction.mockRestore();
}

/** Prohlížeč s trvalým úložištěm jako `navigator.storage`, počítá žádosti. */
export function persistenceSpy(alreadyPersisted: boolean): {
  readonly access: PersistentStorageAccess;
  readonly persist: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
  readonly persisted: ReturnType<typeof vi.fn<() => Promise<boolean>>>;
} {
  const persisted = vi.fn(() => Promise.resolve(alreadyPersisted));
  const persist = vi.fn(() => Promise.resolve(true));
  return { access: { persisted, persist }, persist, persisted };
}
