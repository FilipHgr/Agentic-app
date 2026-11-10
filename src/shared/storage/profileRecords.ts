/**
 * Záznamy her podle profilu (#125): velká data her (album Omalovánek), která
 * se do `localStorage` nevejdou. Patří vždy jednomu profilu a jedné hře,
 * ukládají se jen v zařízení a s profilem se smažou. Profil je v nich jen
 * vnitřním označením, nikdy s přezdívkou.
 *
 * Tady jsou typy a verze v paměti (pro testy her). Ve hře se záznamy
 * ukládají do IndexedDB (`indexedDbRecords.ts`), obě verze mají stejné
 * chování. Žádná operace nevyhodí výjimku ani neskončí zamítnutým slibem:
 * plné úložiště skončí `'full'`, úložiště, které nejde použít, `'unavailable'`.
 *
 * Trvalé úložiště (AC5): po prvním úspěšném zápisu od načtení stránky se
 * jednou požádá prohlížeč, aby data webu nemazal sám. Když je stránka už
 * má, nežádá se. Odmítnutí, chybějící podpora i chyba se jen přejdou.
 */

/** Data jednoho záznamu; jen hodnoty, které jde uložit (text, čísla, bajty obrázku). */
export type RecordData = Readonly<Record<string, unknown>>;

/** Uložený záznam: označení, kterým ho jde smazat, a jeho data. */
export interface StoredRecord {
  readonly id: string;
  readonly data: RecordData;
}

/** Výsledek zápisu nebo smazání. */
export type RecordsWriteStatus = 'saved' | 'full' | 'unavailable';

/** Výsledek čtení: záznamy v pořadí uložení, nebo „nedostupné“. */
export type RecordsList =
  | { readonly status: 'read'; readonly records: StoredRecord[] }
  | { readonly status: 'unavailable' };

/** Výsledek uložení: označení nového záznamu, nebo proč se neuložil. */
export type RecordsAdd =
  | { readonly status: 'saved'; readonly id: string }
  | { readonly status: 'full' }
  | { readonly status: 'unavailable' };

/** Záznamy jedné hry v jednom profilu; tohle úzké rozhraní dostane hra. */
export interface GameRecords {
  /** Všechny záznamy v pořadí, v jakém je hra ukládala. */
  list(): Promise<RecordsList>;
  /** Uloží nový záznam na konec. Nezdařený zápis nic dřív uloženého nezmění. */
  add(data: RecordData): Promise<RecordsAdd>;
  /** Smaže záznam `id`; neexistující záznam je `'saved'`. */
  remove(id: string): Promise<RecordsWriteStatus>;
}

/** Úložiště záznamů všech profilů v zařízení; používá ho jen správa profilů. */
export interface ProfileRecords {
  /** Záznamy hry `gameId` v profilu `profileId`. */
  forGame(profileId: string, gameId: string): GameRecords;
  /** Smaže záznamy profilu ve všech hrách. */
  removeProfile(profileId: string): Promise<RecordsWriteStatus>;
  /** Úklid zbytků: smaže záznamy všech profilů kromě vyjmenovaných. */
  removeAllExcept(profileIds: readonly string[]): Promise<RecordsWriteStatus>;
}

/** Část `navigator.storage`, přes kterou se žádá o trvalé úložiště. */
export interface PersistentStorageAccess {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

export interface RecordsOptions {
  /** Trvalé úložiště prohlížeče; bez něj se o ně nežádá. */
  readonly persistentStorage?: PersistentStorageAccess | undefined;
}

/** Záznamy, které nejde použít: každá operace skončí „nedostupné“. */
export const UNAVAILABLE_GAME_RECORDS: GameRecords = {
  list: () => Promise.resolve({ status: 'unavailable' }),
  add: () => Promise.resolve({ status: 'unavailable' }),
  remove: () => Promise.resolve('unavailable'),
};

/**
 * Žádost o trvalé úložiště po prvním úspěšném zápisu. Vrátí funkci, kterou
 * úložiště zavolá po každém úspěšném zápisu; požádá se jen poprvé.
 */
export function persistenceRequester(access: PersistentStorageAccess | undefined): () => void {
  let requested = false;
  return () => {
    if (requested) {
      return;
    }
    requested = true;
    void requestPersistence(access);
  };
}

async function requestPersistence(access: PersistentStorageAccess | undefined): Promise<void> {
  if (access === undefined) {
    return;
  }
  try {
    const alreadyPersisted = access.persisted === undefined ? false : await access.persisted();
    if (!alreadyPersisted && access.persist !== undefined) {
      await access.persist();
    }
  } catch {
    // Odmítnutí ani chyba prohlížeče hře nevadí, data jen nejsou trvalá.
    return;
  }
}

/** Záznam v paměti i s vlastníkem. */
interface ShelfRecord {
  readonly id: string;
  readonly profileId: string;
  readonly gameId: string;
  readonly data: RecordData;
}

/** Data záznamů v paměti, která přežijí „obnovení stránky“ (nové `memoryProfileRecords`). */
export interface MemoryRecordsShelf {
  readonly records: ShelfRecord[];
  nextId: number;
}

export function createMemoryRecordsShelf(): MemoryRecordsShelf {
  return { records: [], nextId: 1 };
}

/** Kopie dat, aby uložený záznam nezměnila hra, která svá data mění dál. */
function copyOf(data: RecordData): RecordData | undefined {
  try {
    return structuredClone(data);
  } catch {
    // Data, která nejde uložit (třeba funkce), se neuloží.
    return undefined;
  }
}

/** Záznamy v paměti nad `shelf`, jedno volání je jedno načtení stránky. */
export function memoryProfileRecords(
  shelf: MemoryRecordsShelf,
  options: RecordsOptions = {},
): ProfileRecords {
  const afterSaved = persistenceRequester(options.persistentStorage);

  function forGame(profileId: string, gameId: string): GameRecords {
    const owns = (record: ShelfRecord): boolean =>
      record.profileId === profileId && record.gameId === gameId;
    return {
      list: () =>
        Promise.resolve({
          status: 'read',
          records: shelf.records
            .filter(owns)
            .map((record) => ({ id: record.id, data: copyOf(record.data) ?? {} })),
        }),
      add: (data) => {
        const copy = copyOf(data);
        if (copy === undefined) {
          return Promise.resolve({ status: 'unavailable' });
        }
        const id = String(shelf.nextId);
        shelf.nextId += 1;
        shelf.records.push({ id, profileId, gameId, data: copy });
        afterSaved();
        return Promise.resolve({ status: 'saved', id });
      },
      remove: (id) => {
        removeWhere(shelf, (record) => owns(record) && record.id === id);
        return Promise.resolve('saved');
      },
    };
  }

  return {
    forGame,
    removeProfile: (profileId) => {
      removeWhere(shelf, (record) => record.profileId === profileId);
      return Promise.resolve('saved');
    },
    removeAllExcept: (profileIds) => {
      removeWhere(shelf, (record) => !profileIds.includes(record.profileId));
      return Promise.resolve('saved');
    },
  };
}

function removeWhere(shelf: MemoryRecordsShelf, matches: (record: ShelfRecord) => boolean): void {
  const kept = shelf.records.filter((record) => !matches(record));
  shelf.records.splice(0, shelf.records.length, ...kept);
}
