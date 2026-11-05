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
 * - Úprava a smazání profilu (#73): profil je smazaný, až když je uložený
 *   nový seznam; pak se aktivním stane první zbývající profil a smažou se
 *   data jeho her. Poslední profil smazat nejde, seznam nikdy nezůstane
 *   prázdný (`[]` by znovu přeneslo dnešní data). Co se smazat nepodařilo,
 *   uklidí další načtení stránky, ale jen při platném seznamu a jen pod
 *   předponou dat profilů; staré záznamy z doby před profily nikdy.
 *   Úklid smaže i data profilu, který žil jen v paměti, protože se jeho
 *   seznam neuložil.
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
  /** Založí profil; aktivní profil se nezmění. */
  createProfile(profile: NewProfile): Profile;
  /** Aktivní bude profil s označením `id`; neznámé označení nic nezmění. */
  selectProfile(id: string): void;
  /**
   * Nová přezdívka (bez ní profil bez přezdívky) a barva profilu `id`;
   * označení a data her zůstanou. Neznámé označení nic nezmění. Co se
   * nepodaří uložit, platí do zavření stránky.
   */
  updateProfile(id: string, profile: NewProfile): void;
  /**
   * Smaže profil `id` i s daty jeho her; aktivní bude první zbývající
   * profil. `false` (a beze změny), když je to poslední nebo neznámý
   * profil, profil je dočasný nebo se nový seznam nepodařilo uložit.
   */
  deleteProfile(id: string): boolean;
  /** Úložiště hry `gameId` pro profil, který je teď aktivní. */
  gameStorage(gameId: string): KeyValueStorage;
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
    // Nečitelné úložiště: nic se nesmaže, úklid se zkusí při dalším načtení.
    return undefined;
  }
}

/** Smaže záznam; `false`, když to nejde (záznam zůstane a uklidí ho další načtení). */
function remove(storage: ProfileDeviceStorage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    // Data smazaného profilu nikdo nečte; úklid je zkusí znovu příště.
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
 * Úklid po smazání, které se nepovedlo celé: smaže data profilů, které
 * v platném seznamu nejsou. Sahá jen na klíče `agentic-app.profile.…`.
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

/** Nové vnitřní označení z malých písmen a číslic, jiné než ta v `taken`. */
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

function storeOf(state: StoreState): ProfileStore {
  function activeProfile(): Profile {
    const active = state.profiles.find((profile) => profile.id === state.activeId);
    // Seznam má vždy aspoň jeden profil.
    return active ?? (state.profiles[0] as Profile);
  }

  return {
    profiles: () => [...state.profiles],
    activeProfile,

    createProfile(profile: NewProfile): Profile {
      const created = makeProfile(newProfileId(state.profiles), profile.color, profile.nickname);
      state.profiles.push(created);
      if (state.canSaveList) {
        // Neuložený seznam platí aspoň do zavření stránky.
        write(state.storage, PROFILE_LIST_KEY, serializeList(state.profiles));
      }
      return created;
    },

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

    updateProfile(id: string, profile: NewProfile): void {
      const index = state.profiles.findIndex((existing) => existing.id === id);
      if (index < 0) {
        return;
      }
      state.profiles[index] = makeProfile(id, profile.color, profile.nickname);
      if (state.canSaveList) {
        // Neuložená úprava platí aspoň do zavření stránky.
        write(state.storage, PROFILE_LIST_KEY, serializeList(state.profiles));
      }
    },

    deleteProfile(id: string): boolean {
      return deleteFrom(state, id);
    },

    gameStorage: (gameId) => gameStorageOf(state, activeProfile().id, gameId),
  };
}

/** Smazání profilu (viz `ProfileStore.deleteProfile`). */
function deleteFrom(state: StoreState, id: string): boolean {
  const storage = state.storage;
  const remaining = state.profiles.filter((profile) => profile.id !== id);
  const first = remaining[0];
  const isKnown = remaining.length < state.profiles.length;
  if (storage === undefined || !state.canSaveList || !isKnown || first === undefined) {
    // Dočasný, neznámý nebo poslední profil: nic se nemaže.
    return false;
  }
  if (!write(storage, PROFILE_LIST_KEY, serializeList(remaining))) {
    // Bez uloženého seznamu profil smazaný není a nic se nezmění.
    return false;
  }
  state.profiles.splice(0, state.profiles.length, ...remaining);
  state.activeId = first.id;
  // Neuložený výběr nevadí: smazaný profil po načtení aktivní nebude.
  write(storage, ACTIVE_PROFILE_KEY, first.id);
  const prefix = profileDataPrefix(id);
  for (const key of [...state.memory.keys()]) {
    if (key.startsWith(prefix)) {
      state.memory.delete(key);
    }
  }
  removeProfileData(storage, id);
  return true;
}

/** Dočasný výchozí profil jen v paměti; úložiště se jen čte (staré záznamy). */
function temporaryStore(storage: ProfileDeviceStorage | undefined): ProfileStore {
  return storeOf({
    storage,
    profiles: [makeProfile(TEMPORARY_PROFILE_ID, DEFAULT_PROFILE_COLOR)],
    activeId: TEMPORARY_PROFILE_ID,
    temporary: true,
    canSaveList: false,
    memory: new Map(),
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
function storeWithDefaultProfile(storage: ProfileDeviceStorage): ProfileStore {
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
  });
}

/** Otevře profily zařízení; `undefined` = prohlížeč úložiště nepovolil. */
export function openProfiles(storage: ProfileDeviceStorage | undefined): ProfileStore {
  const savedList = read(storage, PROFILE_LIST_KEY);
  if (storage === undefined || savedList === undefined) {
    return temporaryStore(storage);
  }
  const list = parseList(savedList.value);
  switch (list.kind) {
    case 'corrupt':
      return temporaryStore(storage);
    case 'none':
      return storeWithDefaultProfile(storage);
    case 'profiles': {
      const savedActive = read(storage, ACTIVE_PROFILE_KEY)?.value;
      const active = list.profiles.find((profile) => profile.id === savedActive);
      removeDataOfMissingProfiles(storage, list.profiles);
      return storeOf({
        storage,
        profiles: list.profiles,
        activeId: (active ?? list.profiles[0] ?? { id: DEFAULT_PROFILE_ID }).id,
        temporary: false,
        canSaveList: true,
        memory: new Map(),
      });
    }
  }
}
