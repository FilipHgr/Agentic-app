/**
 * Profily dětí v úložišti zařízení (#71). Jedno volání `openProfiles` je
 * jedno načtení stránky. Hra dostane úložiště aktivního profilu
 * (`gameStorage`), které klíče hry uloží s předponou vnitřního označení
 * profilu a hry, nikdy s přezdívkou.
 *
 * - Vždy existuje aspoň jeden profil. Bez seznamu profilů (i seznam `[]`)
 *   vznikne výchozí profil: první barva palety, bez přezdívky.
 * - Přenos dnešních dat: při vzniku výchozího profilu se staré záznamy
 *   Počítání (z doby před profily) zkopírují do jeho úložiště. Nejdřív se
 *   zapíšou data profilu, pak seznam. Přenos je hotový, až když je seznam
 *   uložený; do té doby proběhne znovu při dalším načtení stránky. Staré
 *   záznamy se nikdy nemažou ani nepřepisují.
 * - Poškozený nebo nečitelný seznam: nic se nezapíše a hra běží
 *   s dočasným výchozím profilem v paměti. Ten čte staré záznamy Počítání,
 *   zapisuje jen do paměti.
 * - Co se nepodaří uložit, platí v paměti do zavření stránky (sdílené pro
 *   stejný profil a hru). Žádná výjimka z úložiště neunikne.
 * - Dva panely (#75): stránka může být otevřená ve dvou panelech nad
 *   stejným úložištěm. Založení, úprava i smazání proto vždy znovu načte
 *   uložený seznam, provede změnu v něm a zapíše výsledek, aby nezmizel
 *   profil, který mezitím založil jiný panel. Panel pak vidí i změny
 *   z jiného panelu; když tím přijde o aktivní profil (smazal ho jiný
 *   panel), aktivní bude první profil. Úprava profilu, který v uloženém
 *   seznamu není (smazal ho jiný panel), nic neuloží.
 * - Neuložené změny panelu (#73 AC4): založený nebo upravený profil, jehož
 *   seznam se nad čitelným seznamem nepodařilo zapsat (plné úložiště),
 *   panel drží zvlášť a přenese ho do znovu načteného seznamu při každé
 *   další změně profilů, dokud se zápis nepovede. Do zavření stránky tak
 *   o něj nepřijde.
 * - Když uložený seznam mezitím nejde přečíst, je poškozený nebo chybí
 *   (rodič smazal data webu), platí založení a úprava jen v paměti do
 *   zavření stránky a nikdy se nezapíšou, ani až bude seznam zase čitelný
 *   (#75 AC7, otázka 1). Smazání se neprovede.
 * - Úprava a smazání profilu (#73): profil je smazaný, až když je uložený
 *   nový seznam; pak se aktivním stane první zbývající profil a smažou se
 *   data jeho her. Poslední profil v uloženém seznamu smazat nejde, seznam
 *   nikdy nezůstane prázdný (`[]` by znovu přeneslo dnešní data).
 * - Úklid (#75 AC5, AC6): načtení stránky ani spuštění hry nic nemaže.
 *   Zbytky dat profilů, které v uloženém seznamu nejsou (smazání, které se
 *   nepovedlo celé), se smažou jen po úspěšném smazání jiného profilu,
 *   a jen pod předponou dat profilů; staré záznamy z doby před profily
 *   nikdy. Data profilů, které panel drží jen v paměti, úklid nesmaže.
 * - Záznamy her (#125, album Omalovánek): velká data her v úložišti
 *   záznamů (`ProfileRecords`, ve hře IndexedDB) podle vnitřního označení
 *   profilu, nikdy s přezdívkou. Hra dostane `gameRecords(gameId)` jen pro
 *   aktivní profil. Dočasný profil a stránka bez úložiště záznamů dostanou
 *   u každé operace „nedostupné“. Po úspěšném smazání profilu se jeho
 *   záznamy smažou asynchronně (`whenRecordsCleaned`) a pak se uklidí
 *   zbytky jako u dat her: seznam se znovu načte těsně před úklidem,
 *   profily panelu zůstanou a s nečitelným seznamem se neuklízí nic.
 * - Přijaté riziko: `localStorage` nemá transakce. Mezi čtením seznamu
 *   a úklidem po smazání zůstává malé okno; profil, který jiný panel
 *   založí přesně v tu chvíli, může přijít o svá první data.
 */

import {
  DEFAULT_PROFILE_COLOR,
  DEFAULT_PROFILE_ID,
  isProfileId,
  makeProfile,
  parseProfile,
} from '../logic/profiles';
import type { Profile, ProfileColor } from '../logic/profiles';
import type { KeyValueStorage } from './keyValueStorage';
import { UNAVAILABLE_GAME_RECORDS } from './profileRecords';
import type { GameRecords, ProfileRecords } from './profileRecords';

/** Seznam profilů (JSON pole profilů). */
export const PROFILE_LIST_KEY = 'agentic-app.profiles';

/** Vnitřní označení aktivního profilu. */
export const ACTIVE_PROFILE_KEY = 'agentic-app.activeProfile';

/** Předpona dat profilu: `agentic-app.profile.<profil>.<hra>.<klíč hry>`. */
const PROFILE_DATA_PREFIX = 'agentic-app.profile.';

/** Dočasný profil při poškozeném seznamu; v úložišti nemá nic. */
const TEMPORARY_PROFILE_ID = 'temporary';

/**
 * Dnešní data z doby před profily. Byla jen jedna hra, Počítání, a klíče
 * hry zůstávají stejné, jen dostanou předponu profilu. Sdílená část nesmí
 * importovat z her, proto je tu označení hry a klíče napsané přímo.
 */
const LEGACY_GAME_ID = 'counting';
const LEGACY_KEYS: readonly string[] = ['agentic-app.settings', 'agentic-app.progress'];

/**
 * Úložiště zařízení pro profily: navíc ke čtení a zápisu umí jako
 * `localStorage` mazat a projít klíče (#73), aby šla smazat data profilu.
 */
export interface ProfileDeviceStorage extends KeyValueStorage {
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface NewProfile {
  readonly nickname?: string;
  readonly color: ProfileColor;
}

export interface ProfileStore {
  /** Všechny profily v pořadí založení. */
  profiles(): Profile[];
  activeProfile(): Profile;
  /** Založí profil na konec uloženého seznamu; aktivní profil se nezmění. */
  createProfile(profile: NewProfile): Profile;
  /** Aktivní bude profil s označením `id`; neznámé označení nic nezmění. */
  selectProfile(id: string): void;
  /**
   * Nová přezdívka (bez ní profil bez přezdívky) a barva profilu `id`;
   * označení a data her zůstanou. Profil, který v uloženém seznamu není,
   * se neuloží. Co se nepodaří uložit, platí do zavření stránky.
   */
  updateProfile(id: string, profile: NewProfile): void;
  /**
   * Smaže profil `id` i s daty jeho her; aktivní bude první zbývající
   * profil. `false` (a beze změny), když je to poslední nebo neznámý
   * profil v uloženém seznamu, profil je dočasný, uložený seznam nejde
   * přečíst, je poškozený nebo chybí, nebo se nový seznam nepodařilo uložit.
   */
  deleteProfile(id: string): boolean;
  /** Úložiště hry `gameId` pro profil, který je teď aktivní. */
  gameStorage(gameId: string): KeyValueStorage;
  /**
   * Záznamy hry `gameId` (#125) pro profil, který je teď aktivní; zůstanou
   * mu, i když se potom vybere jiný. Bez úložiště záznamů a v dočasném
   * profilu skončí každá operace „nedostupné“.
   */
  gameRecords(gameId: string): GameRecords;
  /** Počká, až doběhne mazání záznamů po smazání profilů (#125). */
  whenRecordsCleaned(): Promise<void>;
}

/** Výsledek čtení: hodnota (i `null` bez záznamu), nebo `undefined`, když číst nejde. */
type ReadResult = { readonly value: string | null } | undefined;

function read(storage: ProfileDeviceStorage | undefined, key: string): ReadResult {
  if (storage === undefined) {
    return undefined;
  }
  try {
    return { value: storage.getItem(key) };
  } catch {
    // Zakázané úložiště: stejné jako úložiště, které není.
    return undefined;
  }
}

/** Zapíše záznam; `false`, když to nejde (plné nebo zakázané úložiště). */
function write(storage: ProfileDeviceStorage | undefined, key: string, value: string): boolean {
  if (storage === undefined) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Volající data podrží v paměti.
    return false;
  }
}

function dataKey(profileId: string, gameId: string, key: string): string {
  return `${profileDataPrefix(profileId)}${gameId}.${key}`;
}

/** Předpona všech dat jednoho profilu, i s tečkou: „p“ nesmí zasáhnout „p1“. */
function profileDataPrefix(profileId: string): string {
  return `${PROFILE_DATA_PREFIX}${profileId}.`;
}

/** Všechny klíče úložiště; `undefined`, když je projít nejde. */
function allKeys(storage: ProfileDeviceStorage): string[] | undefined {
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  } catch {
    // Nečitelné úložiště: nic se nesmaže, úklid se zkusí po dalším smazání.
    return undefined;
  }
}

/** Smaže záznam; `false`, když to nejde (záznam zůstane a uklidí ho další smazání). */
function remove(storage: ProfileDeviceStorage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    // Data smazaného profilu nikdo nečte; úklid je zkusí znovu po dalším smazání.
    return false;
  }
}

/** Smaže data her profilu `profileId` (jen klíče s jeho přesnou předponou). */
function removeProfileData(storage: ProfileDeviceStorage, profileId: string): void {
  const prefix = profileDataPrefix(profileId);
  for (const key of allKeys(storage) ?? []) {
    if (key.startsWith(prefix)) {
      remove(storage, key);
    }
  }
}

/** Označení profilu z klíče jeho dat, `null` u jiných klíčů. */
function profileIdOfDataKey(key: string): string | null {
  if (!key.startsWith(PROFILE_DATA_PREFIX)) {
    return null;
  }
  const rest = key.slice(PROFILE_DATA_PREFIX.length);
  const end = rest.indexOf('.');
  return end > 0 ? rest.slice(0, end) : null;
}

/**
 * Úklid zbytků po smazání, které se nepovedlo celé: smaže data profilů,
 * které v platném seznamu nejsou. Sahá jen na klíče `agentic-app.profile.…`.
 */
function removeDataOfMissingProfiles(
  storage: ProfileDeviceStorage,
  profiles: readonly Profile[],
): void {
  for (const key of allKeys(storage) ?? []) {
    const id = profileIdOfDataKey(key);
    if (id !== null && !profiles.some((profile) => profile.id === id)) {
      remove(storage, key);
    }
  }
}

/** Co je uložené pod seznamem profilů. */
type SavedList =
  | { readonly kind: 'none' }
  | { readonly kind: 'profiles'; readonly profiles: Profile[] }
  | { readonly kind: 'corrupt' };

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Nečitelný JSON je poškozený seznam.
    return undefined;
  }
}

/** Seznam profilů ze zápisu: chybějící a `[]` je „žádný“, cokoli neplatného poškozený. */
function parseList(saved: string | null): SavedList {
  if (saved === null) {
    return { kind: 'none' };
  }
  const value = parseJson(saved);
  if (!Array.isArray(value)) {
    return { kind: 'corrupt' };
  }
  if (value.length === 0) {
    return { kind: 'none' };
  }
  const profiles: Profile[] = [];
  for (const entry of value) {
    const profile = parseProfile(entry);
    if (profile === null || profiles.some((other) => other.id === profile.id)) {
      return { kind: 'corrupt' };
    }
    profiles.push(profile);
  }
  return { kind: 'profiles', profiles };
}

function serializeList(profiles: readonly Profile[]): string {
  return JSON.stringify(
    profiles.map((profile) => makeProfile(profile.id, profile.color, profile.nickname)),
  );
}

/**
 * Nové vnitřní označení z malých písmen a číslic, jiné než ta v `taken`.
 * Volající předá profily v paměti i v právě uloženém seznamu.
 */
function newProfileId(taken: readonly Profile[]): string {
  let id: string;
  do {
    id = `p${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
  } while (taken.some((profile) => profile.id === id));
  return id;
}

interface StoreState {
  readonly storage: ProfileDeviceStorage | undefined;
  readonly profiles: Profile[];
  activeId: string;
  /** Dočasný profil (poškozený nebo nečitelný seznam): do úložiště se nezapisuje nic. */
  readonly temporary: boolean;
  /** Seznam jde ukládat: data přeneseného profilu jsou uložená. */
  readonly canSaveList: boolean;
  /** Co se nepodařilo uložit (nebo se ukládat nesmí), podle celého klíče. */
  readonly memory: Map<string, string>;
  /** Změny nad čitelným seznamem, které se nepodařilo zapsat; zapíšou se příště. */
  readonly unsaved: Map<string, UnsavedProfile>;
  /** Změny bez čitelného seznamu: platí jen v paměti, nikdy se nezapíšou. */
  readonly memoryOnly: Map<string, UnsavedProfile>;
  /** Úložiště záznamů her (#125); dočasný profil ho nemá. */
  readonly records: ProfileRecords | undefined;
  /** Mazání záznamů po smazání profilů, jedno po druhém. */
  recordsCleaning: Promise<void>;
}

/** Neuložená změna panelu: nový profil, nebo úprava profilu ze seznamu. */
interface UnsavedProfile {
  readonly kind: 'created' | 'updated';
  readonly profile: Profile;
}

/** Úložiště jen v paměti (hra s neplatným označením); s úložištěm zařízení nic nesdílí. */
function memoryOnlyStorage(): KeyValueStorage {
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
  };
}

/** Úložiště hry jednoho profilu nad stavem profilů; nikdy nevyhodí výjimku. */
function gameStorageOf(state: StoreState, profileId: string, gameId: string): KeyValueStorage {
  if (!isProfileId(gameId)) {
    // Neplatné označení hry by v klíči úložiště mohlo splynout s jiným klíčem.
    return memoryOnlyStorage();
  }
  const readsLegacy =
    state.temporary && profileId === TEMPORARY_PROFILE_ID && gameId === LEGACY_GAME_ID;
  return {
    getItem(key: string): string | null {
      const fullKey = dataKey(profileId, gameId, key);
      const remembered = state.memory.get(fullKey);
      if (remembered !== undefined) {
        return remembered;
      }
      if (state.temporary) {
        // Dočasný profil vidí jen staré záznamy, data profilů ne.
        return readsLegacy && LEGACY_KEYS.includes(key)
          ? (read(state.storage, key)?.value ?? null)
          : null;
      }
      return read(state.storage, fullKey)?.value ?? null;
    },
    setItem(key: string, value: string): void {
      const fullKey = dataKey(profileId, gameId, key);
      if (!state.temporary && write(state.storage, fullKey, value)) {
        state.memory.delete(fullKey);
      } else {
        state.memory.set(fullKey, value);
      }
    },
  };
}

/**
 * Právě uložený seznam profilů; `undefined`, když ho panel ukládat nesmí
 * nebo když seznam nejde přečíst, je poškozený nebo chybí (#75).
 */
function savedProfiles(state: StoreState): Profile[] | undefined {
  if (!state.canSaveList) {
    return undefined;
  }
  const saved = read(state.storage, PROFILE_LIST_KEY);
  if (saved === undefined) {
    return undefined;
  }
  const list = parseList(saved.value);
  return list.kind === 'profiles' ? list.profiles : undefined;
}

/**
 * Seznam `base` s neuloženými změnami panelu: úprava nahradí profil se
 * stejným označením, nový profil přibude na konec. Úprava profilu, který
 * v `base` není (smazal ho jiný panel), se zahodí.
 */
function withUnsaved(
  base: readonly Profile[],
  unsaved: ReadonlyMap<string, UnsavedProfile>,
): Profile[] {
  const profiles = [...base];
  for (const change of unsaved.values()) {
    const index = profiles.findIndex((profile) => profile.id === change.profile.id);
    if (index >= 0) {
      profiles[index] = change.profile;
    } else if (change.kind === 'created') {
      profiles.push(change.profile);
    }
  }
  return profiles;
}

/**
 * Panel převezme seznam profilů (po vlastní změně i se změnami z jiného
 * panelu). Když v něm aktivní profil není, aktivní bude první profil.
 */
function adoptProfiles(state: StoreState, profiles: readonly Profile[]): void {
  state.profiles.splice(0, state.profiles.length, ...profiles);
  const first = state.profiles[0];
  if (first === undefined || state.profiles.some((profile) => profile.id === state.activeId)) {
    return;
  }
  state.activeId = first.id;
  if (!state.temporary) {
    // Neuložený výběr nevadí: po načtení se aktivní profil vybere znovu.
    write(state.storage, ACTIVE_PROFILE_KEY, first.id);
  }
}

/**
 * Zapíše neuložené změny panelu do znovu načteného seznamu `saved`. Když
 * seznam nejde přečíst nebo zapsat, změny zůstanou neuložené a přenesou se
 * při další změně profilů. Panel převezme zapsaný seznam se změnami jen
 * v paměti, které se nezapisují nikdy.
 */
function saveChanges(state: StoreState, saved: readonly Profile[] | undefined): void {
  const profiles = withUnsaved(saved ?? state.profiles, state.unsaved);
  if (saved !== undefined && write(state.storage, PROFILE_LIST_KEY, serializeList(profiles))) {
    state.unsaved.clear();
  }
  adoptProfiles(state, withUnsaved(profiles, state.memoryOnly));
}

function storeOf(state: StoreState): ProfileStore {
  function activeProfile(): Profile {
    const active = state.profiles.find((profile) => profile.id === state.activeId);
    // Seznam má vždy aspoň jeden profil.
    return active ?? (state.profiles[0] as Profile);
  }

  return {
    profiles: () => [...state.profiles],
    activeProfile,
    createProfile: (profile) => createIn(state, profile),

    selectProfile(id: string): void {
      if (!state.profiles.some((profile) => profile.id === id)) {
        return;
      }
      state.activeId = id;
      if (!state.temporary) {
        // Neuložený výběr platí aspoň do zavření stránky.
        write(state.storage, ACTIVE_PROFILE_KEY, id);
      }
    },

    updateProfile: (id, profile) => {
      updateIn(state, id, profile);
    },
    deleteProfile: (id) => deleteFrom(state, id),
    gameStorage: (gameId) => gameStorageOf(state, activeProfile().id, gameId),
    gameRecords: (gameId) =>
      state.records === undefined
        ? UNAVAILABLE_GAME_RECORDS
        : state.records.forGame(activeProfile().id, gameId),
    whenRecordsCleaned: () => state.recordsCleaning,
  };
}

/** Založení profilu (viz `ProfileStore.createProfile`). */
function createIn(state: StoreState, profile: NewProfile): Profile {
  const saved = savedProfiles(state);
  const taken = [...state.profiles, ...(saved ?? [])];
  const created = makeProfile(newProfileId(taken), profile.color, profile.nickname);
  if (!state.canSaveList) {
    // Panel seznam ukládat nesmí: profil platí jen do zavření stránky.
    state.profiles.push(created);
    return created;
  }
  // Bez čitelného seznamu profil platí jen v paměti a nezapíše se nikdy.
  const changes = saved === undefined ? state.memoryOnly : state.unsaved;
  changes.set(created.id, { kind: 'created', profile: created });
  saveChanges(state, saved);
  return created;
}

/** Úprava profilu (viz `ProfileStore.updateProfile`). */
function updateIn(state: StoreState, id: string, profile: NewProfile): void {
  const updated = makeProfile(id, profile.color, profile.nickname);
  if (!state.canSaveList) {
    // Panel seznam ukládat nesmí: úprava platí jen do zavření stránky.
    const index = state.profiles.findIndex((existing) => existing.id === id);
    if (index >= 0) {
      state.profiles[index] = updated;
    }
    return;
  }
  const saved = savedProfiles(state);
  const changes = changesFor(state, id, saved);
  if (changes !== undefined) {
    // Nový profil zůstane novým, aby se při zápisu přidal na konec.
    const kind = changes.get(id)?.kind ?? 'updated';
    changes.set(id, { kind, profile: updated });
  }
  if (changes === state.unsaved) {
    // Starší úprava jen v paměti by v panelu překryla tu, která se zapíše.
    state.memoryOnly.delete(id);
  }
  // Profil smazaný v jiném panelu se neuloží; panel převezme uložený seznam.
  saveChanges(state, saved);
}

/**
 * Kam patří úprava profilu `id`: bez čitelného seznamu a u profilu
 * založeného jen v paměti mezi změny jen v paměti, u profilu ze seznamu
 * nebo s neuloženou změnou mezi změny k zápisu. `undefined`, když profil
 * neexistuje (smazal ho jiný panel).
 */
function changesFor(
  state: StoreState,
  id: string,
  saved: readonly Profile[] | undefined,
): Map<string, UnsavedProfile> | undefined {
  if (saved === undefined) {
    return state.profiles.some((profile) => profile.id === id) ? state.memoryOnly : undefined;
  }
  if (state.unsaved.has(id) || saved.some((profile) => profile.id === id)) {
    return state.unsaved;
  }
  return state.memoryOnly.get(id)?.kind === 'created' ? state.memoryOnly : undefined;
}

/** Smazání profilu (viz `ProfileStore.deleteProfile`). */
function deleteFrom(state: StoreState, id: string): boolean {
  const storage = state.storage;
  const saved = savedProfiles(state);
  if (storage === undefined || saved === undefined) {
    // Dočasný profil, nebo uložený seznam nejde přečíst, je poškozený či chybí.
    return false;
  }
  const profiles = withUnsaved(saved, state.unsaved);
  const remaining = profiles.filter((profile) => profile.id !== id);
  const first = remaining[0];
  if (remaining.length === profiles.length || first === undefined) {
    // Profil v seznamu není (smazal ho jiný panel), nebo je poslední.
    return false;
  }
  if (!write(storage, PROFILE_LIST_KEY, serializeList(remaining))) {
    // Bez uloženého seznamu profil smazaný není a nic se nezmění.
    return false;
  }
  state.unsaved.clear();
  state.activeId = first.id;
  adoptProfiles(state, withUnsaved(remaining, state.memoryOnly));
  // Neuložený výběr nevadí: smazaný profil po načtení aktivní nebude.
  write(storage, ACTIVE_PROFILE_KEY, first.id);
  forgetProfileMemory(state, id);
  removeProfileData(storage, id);
  removeLeftovers(state, storage);
  removeRecordsLater(state, id);
  return true;
}

/**
 * Po úspěšném smazání profilu (#125 AC3, AC4) smaže jeho záznamy her a pak
 * zbytky záznamů profilů mimo seznam. Seznam se načte až těsně před
 * úklidem, aby o záznamy nepřišel profil, který mezitím založil jiný panel;
 * profily panelu (i ty jen v paměti) zůstanou. Když seznam přečíst nejde,
 * je poškozený nebo chybí, neuklízí se. Smazání profilu na výsledku
 * nezávisí: záznamy, které se nesmažou, už žádný profil neuvidí.
 */
function removeRecordsLater(state: StoreState, profileId: string): void {
  const records = state.records;
  if (records === undefined) {
    return;
  }
  const step = async (): Promise<void> => {
    await records.removeProfile(profileId);
    const saved = savedProfiles(state);
    if (saved !== undefined) {
      const kept = [...saved, ...state.profiles].map((profile) => profile.id);
      await records.removeAllExcept([...new Set(kept)]);
    }
  };
  // Úložiště záznamů slib nezamítá; kdyby předchozí krok přesto skončil
  // zamítnutím, další mazání se pustí stejně a fronta se nezasekne.
  state.recordsCleaning = state.recordsCleaning.then(step, step);
}

/** Zapomene neuložená data her profilu `profileId`. */
function forgetProfileMemory(state: StoreState, profileId: string): void {
  const prefix = profileDataPrefix(profileId);
  for (const key of [...state.memory.keys()]) {
    if (key.startsWith(prefix)) {
      state.memory.delete(key);
    }
  }
}

/**
 * Úklid po úspěšném smazání (#75 AC6): data profilů mimo uložený seznam.
 * Seznam se načte znovu těsně před úklidem, aby nepřišel o data profil,
 * který mezitím založil jiný panel; profily panelu (i ty jen v paměti)
 * zůstanou také. Když seznam přečíst nejde, neuklízí se.
 */
function removeLeftovers(state: StoreState, storage: ProfileDeviceStorage): void {
  const saved = savedProfiles(state);
  if (saved !== undefined) {
    removeDataOfMissingProfiles(storage, [...saved, ...state.profiles]);
  }
}

/** Dočasný výchozí profil jen v paměti; úložiště se jen čte (staré záznamy). */
function temporaryStore(storage: ProfileDeviceStorage | undefined): ProfileStore {
  // Dočasný profil nemá záznamy her: hra u každé operace dostane „nedostupné“.
  return storeOf({
    storage,
    profiles: [makeProfile(TEMPORARY_PROFILE_ID, DEFAULT_PROFILE_COLOR)],
    activeId: TEMPORARY_PROFILE_ID,
    temporary: true,
    canSaveList: false,
    memory: new Map(),
    unsaved: new Map(),
    memoryOnly: new Map(),
    records: undefined,
    recordsCleaning: Promise.resolve(),
  });
}

/**
 * Zkopíruje staré záznamy Počítání do výchozího profilu. Záznam, který
 * profil už má (z nedokončeného přenosu nebo hraní po něm), zůstane.
 * Co se nepodaří zapsat, zůstane v paměti. Když starý záznam nebo cíl nejde
 * přečíst, nekopíruje se nic a přenos se zopakuje příště, aby se nepřepsalo
 * něco, co nebylo vidět. Vrátí `true`, když je všechno uložené.
 */
function copyLegacyData(storage: ProfileDeviceStorage, memory: Map<string, string>): boolean {
  let allSaved = true;
  for (const key of LEGACY_KEYS) {
    const legacy = read(storage, key);
    const target = dataKey(DEFAULT_PROFILE_ID, LEGACY_GAME_ID, key);
    const existing = read(storage, target);
    if (legacy === undefined || existing === undefined) {
      allSaved = false;
      continue;
    }
    if (legacy.value === null || existing.value !== null) {
      continue;
    }
    if (!write(storage, target, legacy.value)) {
      memory.set(target, legacy.value);
      allSaved = false;
    }
  }
  return allSaved;
}

/** Bez profilů vznikne výchozí profil s dnešními daty; seznam se uloží až po datech. */
function storeWithDefaultProfile(
  storage: ProfileDeviceStorage,
  records: ProfileRecords | undefined,
): ProfileStore {
  const memory = new Map<string, string>();
  const profiles = [makeProfile(DEFAULT_PROFILE_ID, DEFAULT_PROFILE_COLOR)];
  const dataSaved = copyLegacyData(storage, memory);
  if (dataSaved) {
    // Když se seznam neuloží, přenos proběhne znovu při dalším načtení.
    write(storage, PROFILE_LIST_KEY, serializeList(profiles));
  }
  return storeOf({
    storage,
    profiles,
    activeId: DEFAULT_PROFILE_ID,
    temporary: false,
    canSaveList: dataSaved,
    memory,
    unsaved: new Map(),
    memoryOnly: new Map(),
    records,
    recordsCleaning: Promise.resolve(),
  });
}

/**
 * Otevře profily zařízení; `undefined` = prohlížeč úložiště nepovolil.
 * `records` je úložiště záznamů her (#125); načtení stránky v něm nic nemaže.
 */
export function openProfiles(
  storage: ProfileDeviceStorage | undefined,
  records?: ProfileRecords,
): ProfileStore {
  const savedList = read(storage, PROFILE_LIST_KEY);
  if (storage === undefined || savedList === undefined) {
    return temporaryStore(storage);
  }
  const list = parseList(savedList.value);
  switch (list.kind) {
    case 'corrupt':
      return temporaryStore(storage);
    case 'none':
      return storeWithDefaultProfile(storage, records);
    case 'profiles': {
      const savedActive = read(storage, ACTIVE_PROFILE_KEY)?.value;
      const active = list.profiles.find((profile) => profile.id === savedActive);
      return storeOf({
        storage,
        profiles: list.profiles,
        activeId: (active ?? list.profiles[0] ?? { id: DEFAULT_PROFILE_ID }).id,
        temporary: false,
        canSaveList: true,
        memory: new Map(),
        unsaved: new Map(),
        memoryOnly: new Map(),
        records,
        recordsCleaning: Promise.resolve(),
      });
    }
  }
}
