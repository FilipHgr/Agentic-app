/**
 * Čtení hlavičky prvního rámce mp3 (#50 AC5): skript podle ní pozná, jestli
 * nahrávka od serveru je mono a jaký má datový tok. Jen MPEG Layer III.
 */

export interface Mp3FrameInfo {
  readonly channels: 1 | 2;
  readonly bitrateKbps: number;
  readonly sampleRateHz: number;
}

/** Datové toky Layer III v kbps podle indexu 1–14 (0 a 15 jsou neplatné). */
const MPEG1_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** Vzorkovací frekvence podle verze MPEG (bity 3–4 druhého bajtu). */
const SAMPLE_RATES: Record<number, readonly number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

const MPEG1 = 3;
const LAYER_3 = 1;
const MONO_CHANNEL_MODE = 3;
const ID3_HEADER_BYTES = 10;

/** Informace z prvního rámce, nebo `null`, když data nejsou platné mp3. */
export function readMp3FrameInfo(bytes: Uint8Array): Mp3FrameInfo | null {
  const start = firstFrameOffset(bytes);
  if (bytes.length < start + 4) {
    return null;
  }
  const byteAt = (index: number): number => bytes[start + index] ?? 0;
  const second = byteAt(1);
  const third = byteAt(2);
  if (byteAt(0) !== 0xff || (second & 0xe0) !== 0xe0) {
    return null;
  }
  const version = (second >> 3) & 3;
  const layer = (second >> 1) & 3;
  const bitrateIndex = third >> 4;
  const sampleRateIndex = (third >> 2) & 3;
  const sampleRates = SAMPLE_RATES[version];
  if (layer !== LAYER_3 || sampleRates === undefined) {
    return null;
  }
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
    return null;
  }
  const bitrates = version === MPEG1 ? MPEG1_BITRATES : MPEG2_BITRATES;
  return {
    channels: byteAt(3) >> 6 === MONO_CHANNEL_MODE ? 1 : 2,
    bitrateKbps: bitrates[bitrateIndex] ?? 0,
    sampleRateHz: sampleRates[sampleRateIndex] ?? 0,
  };
}

/** Přeskočí značku ID3v2 na začátku souboru (velikost je „synchsafe“ po 7 bitech). */
function firstFrameOffset(bytes: Uint8Array): number {
  const hasId3 =
    bytes.length >= ID3_HEADER_BYTES && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  if (!hasId3) {
    return 0;
  }
  const size = [6, 7, 8, 9].reduce(
    (total, index) => (total << 7) | ((bytes[index] ?? 0) & 0x7f),
    0,
  );
  return ID3_HEADER_BYTES + size;
}
