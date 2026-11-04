/**
 * Pomůcky k testům skriptu na nahrávky průvodce (#50): napodobený server
 * ElevenLabs, výroba malých mp3 a soubory v paměti. Skutečná síť
 * se nikdy nevolá.
 */

// ---------------------------------------------------------------------------
// Výroba mp3: celé rámce MPEG Layer III s nulovým obsahem.
// ---------------------------------------------------------------------------

export type ChannelMode = 'stereo' | 'jointStereo' | 'dualChannel' | 'mono';

export interface FakeMp3Options {
  /** Velikost souboru v bajtech (poslední rámec se ořízne). */
  readonly bytes?: number;
  readonly bitrateKbps?: number;
  readonly sampleRateHz?: number;
  readonly channelMode?: ChannelMode;
  /** Bajt, kterým se vyplní obsah rámců, aby šly nahrávky od sebe poznat. */
  readonly fill?: number;
  /** Na začátek přidá značku ID3v2 o této délce obsahu. */
  readonly id3TagBytes?: number;
}

const MPEG1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MPEG1_SAMPLE_RATES = [44100, 48000, 32000];
const MPEG2_SAMPLE_RATES = [22050, 24000, 16000];
const CHANNEL_MODE_BITS: Record<ChannelMode, number> = {
  stereo: 0,
  jointStereo: 1,
  dualChannel: 2,
  mono: 3,
};

/** Čtyři bajty hlavičky rámce MPEG-1 nebo MPEG-2 Layer III bez CRC. */
export function mp3FrameHeader(
  bitrateKbps: number,
  sampleRateHz: number,
  channelMode: ChannelMode,
): Uint8Array {
  const isMpeg1 = MPEG1_SAMPLE_RATES.includes(sampleRateHz);
  const sampleRates = isMpeg1 ? MPEG1_SAMPLE_RATES : MPEG2_SAMPLE_RATES;
  const bitrates = isMpeg1 ? MPEG1_BITRATES : MPEG2_BITRATES;
  const sampleRateIndex = sampleRates.indexOf(sampleRateHz);
  const bitrateIndex = bitrates.indexOf(bitrateKbps);
  if (sampleRateIndex < 0 || bitrateIndex <= 0) {
    throw new Error(`neplatná kombinace ${bitrateKbps} kbps / ${sampleRateHz} Hz`);
  }
  // 0xFB = MPEG-1, Layer III, bez CRC; 0xF3 = MPEG-2, Layer III, bez CRC.
  const versionByte = isMpeg1 ? 0xfb : 0xf3;
  return new Uint8Array([
    0xff,
    versionByte,
    (bitrateIndex << 4) | (sampleRateIndex << 2),
    CHANNEL_MODE_BITS[channelMode] << 6,
  ]);
}

function frameLength(bitrateKbps: number, sampleRateHz: number): number {
  const isMpeg1 = MPEG1_SAMPLE_RATES.includes(sampleRateHz);
  const samplesPerFrameOver8 = isMpeg1 ? 144 : 72;
  return Math.floor((samplesPerFrameOver8 * bitrateKbps * 1000) / sampleRateHz);
}

/** Značka ID3v2.4 s délkou zapsanou po sedmi bitech (syncsafe). */
function id3Tag(contentBytes: number): Uint8Array {
  const tag = new Uint8Array(10 + contentBytes);
  tag.set([0x49, 0x44, 0x33, 4, 0, 0]);
  tag[6] = (contentBytes >> 21) & 0x7f;
  tag[7] = (contentBytes >> 14) & 0x7f;
  tag[8] = (contentBytes >> 7) & 0x7f;
  tag[9] = contentBytes & 0x7f;
  return tag;
}

/** Nahrávka mp3 jako od ElevenLabs; výchozí je mono 64 kbps, 44,1 kHz, 20 KB. */
export function fakeMp3(options: FakeMp3Options = {}): Uint8Array {
  const bitrateKbps = options.bitrateKbps ?? 64;
  const sampleRateHz = options.sampleRateHz ?? 44100;
  const header = mp3FrameHeader(bitrateKbps, sampleRateHz, options.channelMode ?? 'mono');
  const prefix = options.id3TagBytes === undefined ? new Uint8Array() : id3Tag(options.id3TagBytes);
  const total = options.bytes ?? 20_000;
  const frame = new Uint8Array(frameLength(bitrateKbps, sampleRateHz)).fill(options.fill ?? 0);
  frame.set(header);

  const result = new Uint8Array(Math.max(total, prefix.length + header.length));
  result.set(prefix);
  for (let offset = prefix.length; offset < result.length; offset += frame.length) {
    result.set(frame.subarray(0, result.length - offset), offset);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Napodobený server ElevenLabs.
// ---------------------------------------------------------------------------

export interface ServerCall {
  readonly url: URL;
  readonly text: string;
  readonly apiKey: string | null;
  readonly body: Record<string, unknown>;
}

export type FakeReply =
  | { readonly kind: 'mp3'; readonly bytes: Uint8Array }
  | { readonly kind: 'status'; readonly status: number; readonly body?: string }
  | { readonly kind: 'networkError'; readonly message?: string }
  /** Část dat dorazí, pak spojení spadne (výpadek sítě uprostřed stahování). */
  | { readonly kind: 'cutOff'; readonly bytes: Uint8Array }
  /** Část dat dorazí a pak se už nic neděje, dokud stahování nezruší signál. */
  | { readonly kind: 'stall'; readonly bytes: Uint8Array; readonly onStarted?: () => void };

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface FakeServer {
  readonly fetch: FetchLike;
  readonly calls: ServerCall[];
  /** Texty, pro které skript server volal. */
  texts(): string[];
}

function abortError(): Error {
  const error = new Error('Přerušeno');
  error.name = 'AbortError';
  return error;
}

function streamResponse(
  bytes: Uint8Array,
  end: 'error' | 'stall',
  signal: AbortSignal | null | undefined,
  onStarted?: () => void,
): Response {
  const half = bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2)));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(half);
      if (end === 'error') {
        controller.error(new TypeError('spojení přerušeno'));
        return;
      }
      signal?.addEventListener('abort', () => controller.error(abortError()));
      onStarted?.();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg' } });
}

/**
 * Server, který podle textu věty vrátí odpověď z `reply`. Chová se jako
 * skutečný `fetch`: zrušený signál stahování ukončí chybou.
 */
export function fakeServer(reply: (text: string, call: ServerCall) => FakeReply): FakeServer {
  const calls: ServerCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    if (init.signal?.aborted) {
      throw abortError();
    }
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const call: ServerCall = {
      url: new URL(url),
      text: String(body.text),
      apiKey: new Headers(init.headers).get('xi-api-key'),
      body,
    };
    calls.push(call);
    const answer = reply(call.text, call);
    switch (answer.kind) {
      case 'mp3':
        return new Response(answer.bytes.slice(), {
          status: 200,
          headers: { 'content-type': 'audio/mpeg' },
        });
      case 'status':
        return new Response(answer.body ?? '{"detail":"error"}', { status: answer.status });
      case 'networkError':
        throw new TypeError(answer.message ?? 'fetch failed');
      case 'cutOff':
        return streamResponse(answer.bytes, 'error', init.signal);
      case 'stall':
        return streamResponse(answer.bytes, 'stall', init.signal, answer.onStarted);
    }
  };
  return { fetch, calls, texts: () => calls.map((call) => call.text) };
}

/** Server, který na každou větu vrátí stejnou platnou nahrávku. */
export function alwaysMp3(bytes: Uint8Array = fakeMp3()): FakeServer {
  return fakeServer(() => ({ kind: 'mp3', bytes }));
}

// ---------------------------------------------------------------------------
// Soubory v paměti (místo skutečného disku).
// ---------------------------------------------------------------------------

/** Složka s nahrávkami, jak ji skript používá v repozitáři. */
export const OUTPUT_DIR = 'public/voice/guide';
/** Soubor s otisky nahrávek. */
export const MANIFEST_PATH = 'tools/voice/fingerprints.json';

export interface VoiceFiles {
  readFile(path: string): Promise<Uint8Array | null>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(dir: string): Promise<string[]>;
}

export interface MemoryFiles extends VoiceFiles {
  /** Všechny soubory a jejich obsah v hex, aby šlo porovnat „nic se nezměnilo“. */
  snapshot(): Record<string, string>;
  /** Názvy nahrávek mp3 ve složce s nahrávkami, seřazené. */
  recordings(): string[];
  recording(id: string): Uint8Array | undefined;
  /** Kolikrát skript něco zapsal nebo smazal. */
  readonly changeCount: () => number;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Soubory v paměti; cesty jsou spojené lomítkem (`složka/název`). */
export function memoryFiles(): MemoryFiles {
  const files = new Map<string, Uint8Array>();
  let changes = 0;
  return {
    readFile: async (path) => files.get(path)?.slice() ?? null,
    writeFile: async (path, data) => {
      changes += 1;
      files.set(path, data.slice());
    },
    deleteFile: async (path) => {
      changes += 1;
      files.delete(path);
    },
    listFiles: async (dir) =>
      [...files.keys()]
        .filter((path) => path.startsWith(`${dir}/`) && !path.slice(dir.length + 1).includes('/'))
        .map((path) => path.slice(dir.length + 1)),
    snapshot: () => Object.fromEntries([...files].map(([path, data]) => [path, toHex(data)])),
    recordings: () =>
      [...files.keys()]
        .filter((path) => path.startsWith(`${OUTPUT_DIR}/`) && path.endsWith('.mp3'))
        .map((path) => path.slice(OUTPUT_DIR.length + 1))
        .sort(),
    recording: (id) => files.get(`${OUTPUT_DIR}/${id}.mp3`),
    changeCount: () => changes,
  };
}

/** Text obsahuje písmeno s českou diakritikou (zpráva je česky). */
export function looksCzech(text: string): boolean {
  return /[áčďéěíňóřšťúůýž]/i.test(text);
}
