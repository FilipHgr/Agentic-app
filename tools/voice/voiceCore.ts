/**
 * Jádro skriptu, kterým vlastník u sebe vytvoří nahrávky průvodce přes
 * ElevenLabs (#50). Bez Node API: síť, soubory a výpis dostane zvenku, takže
 * se testuje s napodobeným serverem a nikdy nevolá skutečnou síť.
 *
 * Postup: stáhne nahrávky změněných vět, zkontroluje je a celkovou velikost,
 * a teprve když je vše v pořádku, zapíše nové nahrávky, smaže staré a uloží
 * otisky. Přerušení nebo chyba klíče tak nikdy nenechá rozpracovaný stav.
 */

import { readMp3FrameInfo } from './mp3Header';

export const API_KEY_ENV = 'ELEVENLABS_API_KEY';

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

export interface MakeVoiceOptions {
  readonly sentences: readonly VoiceSentence[];
  readonly config: VoiceConfig;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fetch: (url: string, init: RequestInit) => Promise<Response>;
  readonly files: VoiceFiles;
  readonly outputDir: string;
  readonly manifestPath: string;
  readonly log: (line: string) => void;
  readonly signal?: AbortSignal;
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
  const { files, outputDir, sentences } = options;
  if (options.signal?.aborted) {
    return stopped(options, 'Přerušeno. Nic jsem nezměnil.');
  }
  const manifest = await readManifest(files, options.manifestPath);
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

  const total = await totalBytesAfterRun(options, downloads);
  if (total > MAX_TOTAL_BYTES) {
    return stopped(
      options,
      `Nahrávky by dohromady měly ${megabytes(total)} MB, víc než 1 MB. ` +
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
    await files.writeFile(options.manifestPath, encodeManifest(manifest));
  }

  const created = downloads.map((recording) => recording.id);
  options.log(
    `Hotovo: vytvořeno ${created.length}, přeskočeno ${skipped.length}, ` +
      `smazáno ${obsolete.length}, selhalo ${failed.length}.`,
  );
  options.log('Nezapomeň do public/licence.txt doplnit, odkud je hlas (ElevenLabs, jméno hlasu).');
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
  downloads: readonly Download[],
): Promise<number> {
  let total = 0;
  for (const sentence of options.sentences) {
    const fresh = downloads.find((recording) => recording.id === sentence.id);
    const kept = fresh
      ? null
      : await options.files.readFile(recordingPath(options.outputDir, sentence.id));
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

async function readManifest(files: VoiceFiles, path: string): Promise<Manifest> {
  const raw = await files.readFile(path);
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(raw));
    return isManifest(parsed) ? { ...parsed } : {};
  } catch {
    // Poškozené otisky: věty se vytvoří znovu, nic horšího se nestane.
    return {};
  }
}

function isManifest(value: unknown): value is Manifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function encodeManifest(manifest: Manifest): Uint8Array {
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  );
  return new TextEncoder().encode(`${JSON.stringify(sorted, null, 2)}\n`);
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

function stopped(options: MakeVoiceOptions, message: string): MakeVoiceResult {
  options.log(message);
  return { ok: false, created: [], skipped: [], deleted: [], failed: [] };
}
