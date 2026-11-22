/**
 * Jádro skriptu, kterým vlastník u sebe vytvoří nahrávky průvodce přes
 * ElevenLabs (#50). Bez Node API: síť, soubory a výpis dostane zvenku, takže
 * se testuje s napodobeným serverem a nikdy nevolá skutečnou síť.
 *
 * Skript je po jazycích (#66): `npm run voice -- <jazyk>` vytvoří nahrávky
 * Počítání jen zvoleného jazyka, jeho hlasem, do `public/voice/<jazyk>/counting/guide/`.
 * Otisky jsou ve `fingerprints.json` v oddílu každého jazyka zvlášť.
 *
 * Hlas postavičky (#171, panda Rudy) je samostatný oddíl `character:<jméno>`
 * ve `voice.config.json` i ve `fingerprints.json`, jeden pro všechny jazyky.
 * Nahrávky postavičky nejsou nahrávky průvodce: vytvoří je Claude přes
 * napojení ElevenLabs a uloží je `importCharacterVoice` (`npm run
 * voice:character`), viz konec souboru.
 *
 * Postup: stáhne nahrávky změněných vět, zkontroluje je a celkovou velikost,
 * a teprve když je vše v pořádku, zapíše nové nahrávky, smaže staré a uloží
 * otisky. Přerušení nebo chyba klíče tak nikdy nenechá rozpracovaný stav.
 */

import { readMp3DurationMs, readMp3FrameInfo } from './mp3Header';

export const API_KEY_ENV = 'ELEVENLABS_API_KEY';

/** Soubor s otisky nahrávek všech jazyků, každý jazyk ve vlastním oddílu. */
export const MANIFEST_PATH = 'tools/voice/fingerprints.json';
/** Nastavení hlasů, každý jazyk ve vlastním oddílu. */
export const CONFIG_PATH = 'tools/voice/voice.config.json';
/** Složka s texty Počítání, soubor jazyka se jmenuje podle kódu (`cs.ts`). */
export const TEXTS_DIR = 'src/games/counting/texts';
const RUN_COMMAND = 'npm run voice -- <jazyk>';
/** Kód jazyka: jen malá písmena, přesně jako název souboru textů. */
const LANGUAGE_FILE = /^([a-z]+)\.ts$/;

/**
 * Formát, který si skript od serveru vyžádá: mp3, 44,1 kHz, 64 kbps.
 * Mono se v API vyžádat nedá (ElevenLabs posílá mono), hlídá ho kontrola hlavičky.
 */
const OUTPUT_FORMAT = 'mp3_44100_64';
const MAX_BITRATE_KBPS = 64;
const MAX_RECORDING_BYTES = 150 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const HTTP_UNAUTHORIZED = 401;

export interface VoiceSentence {
  readonly id: string;
  readonly text: string;
}

/** Nastavení hlasu; není tajné, je v repozitáři (`voice.config.json`). */
export interface VoiceConfig {
  readonly voiceId: string;
  readonly modelId: string;
  readonly voiceSettings: Readonly<Record<string, number | boolean>>;
}

export interface VoiceFiles {
  /** Obsah souboru, nebo `null`, když neexistuje. */
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  /** Názvy souborů přímo ve složce. */
  listFiles(dir: string): Promise<string[]>;
}

interface VoiceRunEnvironment {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly files: VoiceFiles;
  readonly log: (line: string) => void;
  readonly signal?: AbortSignal;
}

export interface MakeVoiceOptions extends VoiceRunEnvironment {
  /** Kód jazyka; určí složku nahrávek a oddíl otisků. */
  readonly language: string;
  readonly sentences: readonly VoiceSentence[];
  readonly config: VoiceConfig;
}

/** Spuštění `npm run voice -- <jazyk>`. */
export interface RunVoiceOptions extends VoiceRunEnvironment {
  /** Argumenty příkazové řádky za `--`. */
  readonly args: readonly string[];
  /** Názvy souborů ve složce textů Počítání. */
  readonly textFiles: readonly string[];
  /** Obsah `voice.config.json`, ještě nezkontrolovaný. */
  readonly voices: unknown;
  /** Věty průvodce z textů Počítání v daném jazyce. */
  readonly loadSentences: (language: string) => Promise<readonly VoiceSentence[]>;
}

export interface MakeVoiceResult {
  readonly ok: boolean;
  readonly created: string[];
  readonly skipped: string[];
  readonly deleted: string[];
  readonly failed: string[];
}

/** Otisky nahrávek podle id věty. */
type Manifest = Record<string, string>;

/** Celý soubor otisků: oddíl otisků podle kódu jazyka. */
type ManifestFile = Record<string, unknown>;

interface Download {
  readonly id: string;
  readonly bytes: Uint8Array;
  readonly fingerprint: string;
}

type DownloadOutcome =
  | { readonly kind: 'ok'; readonly bytes: Uint8Array }
  | { readonly kind: 'failed'; readonly reason: string }
  | { readonly kind: 'keyRejected' }
  | { readonly kind: 'aborted' };

/** Složka nahrávek průvodce Počítání v daném jazyce. */
export function voiceDir(language: string): string {
  // Druhá pojistka: do cesty smí jen kód jazyka z malých písmen.
  if (!/^[a-z]+$/.test(language)) {
    throw new Error(`Neplatný kód jazyka pro složku nahrávek: ${language}`);
  }
  return `public/voice/${language}/counting/guide`;
}

/**
 * Zkontroluje zvolený jazyk a vytvoří jeho nahrávky. Při chybném spuštění
 * vypíše jednu zprávu s příkazem, nic nezmění a server nevolá.
 */
export async function runVoiceCommand(options: RunVoiceOptions): Promise<MakeVoiceResult> {
  const choice = chooseVoiceLanguage(options.args, options.textFiles, options.voices);
  if (choice.kind === 'wrong') {
    return stopped(options, choice.message);
  }
  try {
    await removeLeftoverTemporaryFiles(options.files, voiceDir(choice.language));
    const sentences = await options.loadSentences(choice.language);
    return await makeVoice({
      ...options,
      language: choice.language,
      sentences,
      config: choice.config,
    });
  } catch (error) {
    const key = (options.env[API_KEY_ENV] ?? '').trim();
    return stopped(
      options,
      hideKey(`Skript skončil chybou: ${String(error)}. Nic jsem nezměnil.`, key),
    );
  }
}

type LanguageChoice =
  | { readonly kind: 'ok'; readonly language: string; readonly config: VoiceConfig }
  | { readonly kind: 'wrong'; readonly message: string };

function chooseVoiceLanguage(
  args: readonly string[],
  textFiles: readonly string[],
  voices: unknown,
): LanguageChoice {
  const withTexts = textLanguages(textFiles);
  const runnable = withTexts.filter((language) => voiceOf(voices, language) !== null);
  const wrong = (reason: string): LanguageChoice => ({
    kind: 'wrong',
    message: wrongRunMessage(reason, runnable),
  });

  if (args.length === 0) {
    return wrong('Chybí jazyk.');
  }
  if (args.length > 1) {
    return wrong('Zadej jen jeden jazyk.');
  }
  const language = args[0] ?? '';
  if (!withTexts.includes(language)) {
    return wrong(
      `Jazyk „${language}“ nemá soubor textů Počítání v ${TEXTS_DIR} ` +
        '(kód je malými písmeny přesně jako název souboru, třeba cs).',
    );
  }
  const config = voiceOf(voices, language);
  if (config === null) {
    return wrong(`Jazyk ${language} nemá nastavený hlas v ${CONFIG_PATH}.`);
  }
  return { kind: 'ok', language, config };
}

function wrongRunMessage(reason: string, runnable: readonly string[]): string {
  const languages = runnable.length > 0 ? runnable.join(', ') : 'zatím žádné';
  return (
    `${reason} Nic jsem nezměnil. Spusť skript s jedním jazykem: ${RUN_COMMAND}. ` +
    `Jazyky, pro které jde skript spustit: ${languages}`
  );
}

/** Kódy jazyků podle souborů textů (`cs.ts` → `cs`), seřazené. */
function textLanguages(textFiles: readonly string[]): string[] {
  return textFiles
    .map((name) => LANGUAGE_FILE.exec(name)?.[1])
    .filter((language): language is string => language !== undefined)
    .sort();
}

/** Hlas jazyka z `voice.config.json`, nebo `null`, když chybí nebo je neúplný. */
function voiceOf(voices: unknown, language: string): VoiceConfig | null {
  if (!isRecord(voices) || !Object.hasOwn(voices, language)) {
    return null;
  }
  const voice = voices[language];
  if (
    !isRecord(voice) ||
    typeof voice.voiceId !== 'string' ||
    voice.voiceId.trim() === '' ||
    typeof voice.modelId !== 'string' ||
    voice.modelId.trim() === '' ||
    !isRecord(voice.voiceSettings)
  ) {
    return null;
  }
  return voice as unknown as VoiceConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Dočasné soubory po tvrdém ukončení by build přibalil do hry, proto pryč. */
async function removeLeftoverTemporaryFiles(files: VoiceFiles, dir: string): Promise<void> {
  for (const name of await files.listFiles(dir)) {
    if (name.endsWith('.tmp')) {
      await files.deleteFile(`${dir}/${name}`);
    }
  }
}

/** Vytvoří nahrávky vět, které se od minula změnily. Nikdy nevyhodí výjimku. */
export async function makeVoice(options: MakeVoiceOptions): Promise<MakeVoiceResult> {
  const key = (options.env[API_KEY_ENV] ?? '').trim();
  if (key === '') {
    return stopped(
      options,
      `Chybí klíč k ElevenLabs v proměnné prostředí ${API_KEY_ENV}. Nic jsem nezměnil.`,
    );
  }
  if (options.config.voiceId.trim() === '') {
    return stopped(options, 'Není zvolené ID hlasu ve voice.config.json. Nic jsem nezměnil.');
  }
  try {
    return await run(options, key);
  } catch (error) {
    return stopped(
      options,
      hideKey(`Skript skončil chybou: ${String(error)}. Nic jsem nezměnil.`, key),
    );
  }
}

async function run(options: MakeVoiceOptions, key: string): Promise<MakeVoiceResult> {
  const { files, language, sentences } = options;
  const outputDir = voiceDir(language);
  if (options.signal?.aborted) {
    return stopped(options, 'Přerušeno. Nic jsem nezměnil.');
  }
  const manifestFile = await readManifestFile(files);
  const manifest = languageManifest(manifestFile, language);
  const manifestBefore = JSON.stringify(manifest);
  const skipped: string[] = [];
  const failed: string[] = [];
  const downloads: Download[] = [];

  for (const sentence of sentences) {
    const fingerprint = await fingerprintOf(sentence.text, options.config);
    const recordingExists = (await files.readFile(recordingPath(outputDir, sentence.id))) !== null;
    if (manifest[sentence.id] === fingerprint && recordingExists) {
      skipped.push(sentence.id);
      continue;
    }
    const outcome = await download(options, key, sentence);
    if (outcome.kind === 'keyRejected') {
      return stopped(options, 'Server ElevenLabs klíč odmítl. Zkontroluj ho. Nic jsem nezměnil.');
    }
    if (outcome.kind === 'aborted') {
      return stopped(options, 'Přerušeno. Nic jsem nezměnil.');
    }
    if (outcome.kind === 'failed') {
      failed.push(sentence.id);
      options.log(hideKey(`Věta ${sentence.id} se nepovedla: ${outcome.reason}.`, key));
      continue;
    }
    downloads.push({ id: sentence.id, bytes: outcome.bytes, fingerprint });
  }

  const wanted = new Set(sentences.map((sentence) => sentence.id));
  const obsolete = (await files.listFiles(outputDir))
    .filter((name) => name.endsWith('.mp3'))
    .map((name) => name.slice(0, -'.mp3'.length))
    .filter((id) => !wanted.has(id));

  const total = await totalBytesAfterRun(options, outputDir, downloads);
  if (total > MAX_TOTAL_BYTES) {
    return stopped(
      options,
      `Nahrávky jazyka ${language} by dohromady měly ${megabytes(total)} MB, víc než 1 MB. ` +
        'Nic jsem neuložil ani nesmazal, stažené nahrávky jsem zahodil.',
    );
  }

  for (const recording of downloads) {
    await files.writeFile(recordingPath(outputDir, recording.id), recording.bytes);
    manifest[recording.id] = recording.fingerprint;
  }
  for (const id of obsolete) {
    await files.deleteFile(recordingPath(outputDir, id));
    options.log(`Smazána nahrávka věty ${id}, která už ve scénáři není.`);
  }
  for (const id of Object.keys(manifest)) {
    if (!wanted.has(id)) {
      delete manifest[id];
    }
  }
  if (JSON.stringify(manifest) !== manifestBefore) {
    const updated = { ...manifestFile, [language]: sortedManifest(manifest) };
    await files.writeFile(MANIFEST_PATH, encodeManifestFile(updated));
  }

  const created = downloads.map((recording) => recording.id);
  options.log(
    `Hotovo: vytvořeno ${created.length}, přeskočeno ${skipped.length}, ` +
      `smazáno ${obsolete.length}, selhalo ${failed.length}.`,
  );
  options.log(
    `Nezapomeň do public/licence.txt doplnit hlas jazyka ${language}: ` +
      `odkud je (ElevenLabs), ID hlasu ${options.config.voiceId} a model ${options.config.modelId}.`,
  );
  return { ok: failed.length === 0, created, skipped, deleted: obsolete, failed };
}

/** Stáhne nahrávku jedné věty a zkontroluje, že je malá a mono. */
async function download(
  options: MakeVoiceOptions,
  key: string,
  sentence: VoiceSentence,
): Promise<DownloadOutcome> {
  const url = `${API_URL}/${encodeURIComponent(options.config.voiceId)}?output_format=${OUTPUT_FORMAT}`;
  let bytes: Uint8Array;
  try {
    const response = await options.fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: sentence.text,
        model_id: options.config.modelId,
        voice_settings: options.config.voiceSettings,
      }),
      signal: options.signal,
    });
    if (response.status === HTTP_UNAUTHORIZED) {
      return { kind: 'keyRejected' };
    }
    if (!response.ok) {
      return { kind: 'failed', reason: `server vrátil chybu ${response.status}` };
    }
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    // Chybu sítě nevypisujeme celou, mohla by obsahovat klíč.
    return options.signal?.aborted
      ? { kind: 'aborted' }
      : { kind: 'failed', reason: 'spojení se serverem se přerušilo' };
  }
  return checkRecording(bytes);
}

function checkRecording(bytes: Uint8Array): DownloadOutcome {
  if (bytes.length > MAX_RECORDING_BYTES) {
    return { kind: 'failed', reason: `nahrávka má ${bytes.length} B, víc než 150 KB` };
  }
  const info = readMp3FrameInfo(bytes);
  if (info === null) {
    return { kind: 'failed', reason: 'server neposlal platnou mp3' };
  }
  if (info.channels !== 1) {
    return { kind: 'failed', reason: 'nahrávka není mono' };
  }
  if (info.bitrateKbps > MAX_BITRATE_KBPS) {
    return { kind: 'failed', reason: `nahrávka má ${info.bitrateKbps} kbps, víc než 64` };
  }
  return { kind: 'ok', bytes };
}

/** Velikost všech nahrávek, které by po běhu zůstaly: nové místo starých, smazané ne. */
async function totalBytesAfterRun(
  options: MakeVoiceOptions,
  outputDir: string,
  downloads: readonly Download[],
): Promise<number> {
  let total = 0;
  for (const sentence of options.sentences) {
    const fresh = downloads.find((recording) => recording.id === sentence.id);
    const kept = fresh ? null : await options.files.readFile(recordingPath(outputDir, sentence.id));
    total += fresh?.bytes.length ?? kept?.length ?? 0;
  }
  return total;
}

/** Otisk textu a všeho, co ovlivní zvuk nahrávky. */
async function fingerprintOf(text: string, config: VoiceConfig): Promise<string> {
  const settings = Object.entries(config.voiceSettings).sort(([a], [b]) => a.localeCompare(b));
  const input = JSON.stringify([text, config.voiceId, config.modelId, settings, OUTPUT_FORMAT]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Celý soubor otisků; oddíly ostatních jazyků se jen přenesou beze změny. */
async function readManifestFile(files: VoiceFiles): Promise<ManifestFile> {
  const raw = await files.readFile(MANIFEST_PATH);
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    return isRecord(parsed) ? { ...parsed } : {};
  } catch {
    // Poškozené otisky: věty se vytvoří znovu, nic horšího se nestane.
    return {};
  }
}

function languageManifest(manifestFile: ManifestFile, language: string): Manifest {
  const section = Object.hasOwn(manifestFile, language) ? manifestFile[language] : undefined;
  return isManifest(section) ? { ...section } : {};
}

function isManifest(value: unknown): value is Manifest {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');
}

function encodeManifestFile(manifestFile: ManifestFile): Uint8Array {
  const sorted = Object.fromEntries(
    Object.entries(manifestFile).sort(([a], [b]) => a.localeCompare(b)),
  );
  return new TextEncoder().encode(`${JSON.stringify(sorted, null, 2)}\n`);
}

function sortedManifest(manifest: Manifest): Manifest {
  return Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
}

function recordingPath(outputDir: string, id: string): string {
  return `${outputDir}/${id}.mp3`;
}

function megabytes(bytes: number): string {
  return (bytes / MAX_TOTAL_BYTES).toFixed(2).replace('.', ',');
}

/** Klíč se nikdy nevypíše, ani když ho server nebo chyba zopakuje. */
function hideKey(text: string, key: string): string {
  return key === '' ? text : text.split(key).join('***');
}

function stopped(options: Pick<VoiceRunEnvironment, 'log'>, message: string): MakeVoiceResult {
  options.log(message);
  return { ok: false, created: [], skipped: [], deleted: [], failed: [] };
}

// ---------------------------------------------------------------------------
// Hlas postavičky (#171)
// ---------------------------------------------------------------------------

/** Postavičky s vlastním hlasem. Hlas postavičky je jeden pro všechny jazyky. */
export const VOICE_CHARACTERS = ['rudy'] as const;

export type VoiceCharacter = (typeof VOICE_CHARACTERS)[number];

/** Části stránky, ve kterých postavička mluví; každá má repliky ve svých textech. */
export const CHARACTER_PLACES = ['counting', 'menu', 'coloring', 'compare'] as const;

export type CharacterPlace = (typeof CHARACTER_PLACES)[number];

/** Složka textů každé části; repliky postavičky jsou v textech pod klíčem `rudyLines`. */
export const CHARACTER_TEXTS_DIRS: Readonly<Record<CharacterPlace, string>> = {
  counting: 'src/games/counting/texts',
  menu: 'src/menu/texts',
  coloring: 'src/games/coloring/texts',
  compare: 'src/games/compare/texts',
};

/** Nejdelší replika postavičky v ms (okno s postavičkou je krátké). */
export const MAX_CHARACTER_LINE_MS = 4000;

const CHARACTER_RUN_COMMAND = 'npm run voice:character -- <jazyk> <složka s nahrávkami>';

/** Replika postavičky: kde zazní, id (klíč v textech) a text. */
export interface CharacterLine {
  readonly place: CharacterPlace;
  readonly id: string;
  readonly text: string;
}

/**
 * Oddíl hlasu postavičky ve `voice.config.json` i ve `fingerprints.json`.
 * Dvojtečka zaručí, že se nikdy nesplete s kódem jazyka (jen malá písmena).
 */
export function characterSection(character: VoiceCharacter): string {
  return `character:${character}`;
}

/** Hlas postavičky z `voice.config.json`, nebo `null`, když chybí nebo je neúplný. */
export function characterVoiceOf(voices: unknown, character: VoiceCharacter): VoiceConfig | null {
  return voiceOf(voices, characterSection(character));
}

/** Repliky postavičky z textů jedné části (`rudyLines`), seřazené podle id. */
export function characterLinesOf(place: CharacterPlace, texts: unknown): CharacterLine[] {
  const lines = isRecord(texts) ? texts.rudyLines : undefined;
  if (!isRecord(lines)) {
    return [];
  }
  return Object.entries(lines)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([id, text]) => ({ place, id, text }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Nahrávka repliky: `public/voice/<jazyk>/<část>/<postavička>-<id>.mp3`. */
export function characterRecordingPath(
  character: VoiceCharacter,
  language: string,
  line: Pick<CharacterLine, 'place' | 'id'>,
): string {
  if (!/^[a-z]+$/.test(language) || !/^[a-zA-Z]+$/.test(line.id)) {
    throw new Error(`Neplatný jazyk nebo id repliky: ${language}, ${line.id}`);
  }
  return `public/voice/${language}/${line.place}/${character}-${line.id}.mp3`;
}

/** Klíč otisku repliky v oddílu jazyka: `<část>/<id>`. */
export function characterFingerprintKey(line: Pick<CharacterLine, 'place' | 'id'>): string {
  return `${line.place}/${line.id}`;
}

/** Otisk repliky postavičky, spočítaný stejně jako otisk věty průvodce. */
export function voiceFingerprint(text: string, config: VoiceConfig): Promise<string> {
  return fingerprintOf(text, config);
}

export interface ImportCharacterVoiceOptions {
  readonly character: VoiceCharacter;
  readonly language: string;
  readonly lines: readonly CharacterLine[];
  /** Obsah `voice.config.json`, ještě nezkontrolovaný. */
  readonly voices: unknown;
  /** Převedená nahrávka repliky (mono, 64 kb/s), nebo `null`, když chybí. */
  readonly source: (line: CharacterLine) => Promise<Uint8Array | null>;
  readonly files: VoiceFiles;
  readonly log: (line: string) => void;
}

/**
 * Uloží nahrávky replik postavičky v jednom jazyce, které vytvořil Claude
 * přes napojení ElevenLabs hlasem postavičky (#171), a zapíše jejich otisky
 * do oddílu postavičky. Nejdřív zkontroluje všechny (mono, nejvýš 64 kb/s,
 * 150 KB a 4 s); s jedinou chybou nic nezmění. Nikdy nevyhodí výjimku.
 */
export async function importCharacterVoice(
  options: ImportCharacterVoiceOptions,
): Promise<MakeVoiceResult> {
  const { character, language, lines, files } = options;
  const config = characterVoiceOf(options.voices, character);
  if (config === null) {
    return stopped(
      options,
      `Postavička ${character} nemá hlas v oddílu ${characterSection(character)} ` +
        `v ${CONFIG_PATH}. Nic jsem nezměnil.`,
    );
  }
  if (!/^[a-z]+$/.test(language) || lines.length === 0) {
    return stopped(
      options,
      `Jazyk „${language}“ nemá repliky postavičky v textech. Nic jsem nezměnil. ` +
        `Spusť: ${CHARACTER_RUN_COMMAND}`,
    );
  }
  try {
    const checked: { readonly line: CharacterLine; readonly recording: Download }[] = [];
    for (const line of lines) {
      const problem = await checkCharacterSource(options, line);
      if (typeof problem === 'string') {
        return stopped(
          options,
          `Replika ${characterFingerprintKey(line)} (${language}): ${problem}. Nic jsem nezměnil.`,
        );
      }
      const fingerprint = await fingerprintOf(line.text, config);
      checked.push({
        line,
        recording: { id: characterFingerprintKey(line), bytes: problem, fingerprint },
      });
    }
    const manifestFile = await readManifestFile(files);
    const manifest: Manifest = {};
    for (const { line, recording } of checked) {
      await files.writeFile(characterRecordingPath(character, language, line), recording.bytes);
      manifest[recording.id] = recording.fingerprint;
    }
    const section = { ...characterManifestSection(manifestFile, character), [language]: manifest };
    const sortedSection = Object.fromEntries(
      Object.entries(section)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, sortedManifest(value)]),
    );
    await files.writeFile(
      MANIFEST_PATH,
      encodeManifestFile({ ...manifestFile, [characterSection(character)]: sortedSection }),
    );
    const created = checked.map(({ recording }) => recording.id);
    options.log(`Hotovo: uloženo ${created.length} replik postavičky ${character} (${language}).`);
    return { ok: true, created, skipped: [], deleted: [], failed: [] };
  } catch (error) {
    return stopped(options, `Nahrávky postavičky skončily chybou: ${String(error)}.`);
  }
}

/** Převedená nahrávka repliky, nebo důvod, proč ji nejde použít. */
async function checkCharacterSource(
  options: ImportCharacterVoiceOptions,
  line: CharacterLine,
): Promise<Uint8Array | string> {
  const bytes = await options.source(line);
  if (bytes === null) {
    return 'nahrávka chybí';
  }
  const checked = checkRecording(bytes);
  if (checked.kind !== 'ok') {
    return checked.kind === 'failed' ? checked.reason : 'nahrávku nejde použít';
  }
  const durationMs = readMp3DurationMs(bytes);
  if (durationMs === null || durationMs > MAX_CHARACTER_LINE_MS) {
    return `nahrávka je delší než ${MAX_CHARACTER_LINE_MS / 1000} s`;
  }
  return bytes;
}

/** Oddíl otisků postavičky podle jazyka; poškozený oddíl je prázdný. */
function characterManifestSection(
  manifestFile: ManifestFile,
  character: VoiceCharacter,
): Record<string, Manifest> {
  const key = characterSection(character);
  const section = Object.hasOwn(manifestFile, key) ? manifestFile[key] : undefined;
  if (!isRecord(section)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(section).filter((entry): entry is [string, Manifest] => isManifest(entry[1])),
  );
}
