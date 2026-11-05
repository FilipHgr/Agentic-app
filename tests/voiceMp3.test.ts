import { describe, expect, it } from 'vitest';

import { readMp3FrameInfo } from '../tools/voice/mp3Header';
import { fakeMp3, mp3FrameHeader } from './voiceFakes';

/**
 * Testy k #50 AC5: skript pozná z hlavičky prvního rámce MPEG, jestli je
 * nahrávka mono a jaký má datový tok. Odmítnutí nahrávky při běhu skriptu
 * je ve `voiceScript.test.ts`.
 */

describe('hlavička mp3 podle prvního rámce MPEG (#50 AC5)', () => {
  it('mono 64 kbps při 44,1 kHz pozná jako mono 64 kbps', () => {
    expect(readMp3FrameInfo(fakeMp3({ bitrateKbps: 64, sampleRateHz: 44100 }))).toEqual({
      channels: 1,
      bitrateKbps: 64,
      sampleRateHz: 44100,
    });
  });

  it('mono 32 kbps při 22,05 kHz (MPEG-2) pozná jako mono 32 kbps', () => {
    expect(readMp3FrameInfo(fakeMp3({ bitrateKbps: 32, sampleRateHz: 22050 }))).toEqual({
      channels: 1,
      bitrateKbps: 32,
      sampleRateHz: 22050,
    });
  });

  it('u MPEG-2 čte datový tok z tabulky MPEG-2, ne MPEG-1', () => {
    // Index 8 znamená u MPEG-2 64 kbps, u MPEG-1 112 kbps.
    expect(readMp3FrameInfo(fakeMp3({ bitrateKbps: 64, sampleRateHz: 24000 }))?.bitrateKbps).toBe(
      64,
    );
    expect(readMp3FrameInfo(fakeMp3({ bitrateKbps: 128, sampleRateHz: 48000 }))?.bitrateKbps).toBe(
      128,
    );
  });

  for (const channelMode of ['stereo', 'jointStereo', 'dualChannel'] as const) {
    it(`nahrávku ${channelMode} pozná jako dvoukanálovou`, () => {
      expect(readMp3FrameInfo(fakeMp3({ channelMode }))?.channels).toBe(2);
    });
  }

  it('pozná vyšší datový tok, třeba 128 kbps', () => {
    expect(readMp3FrameInfo(fakeMp3({ bitrateKbps: 128 }))?.bitrateKbps).toBe(128);
  });

  it('přeskočí značku ID3v2 na začátku a čte až první rámec', () => {
    const info = readMp3FrameInfo(fakeMp3({ id3TagBytes: 300, bitrateKbps: 48 }));
    expect(info).toEqual({ channels: 1, bitrateKbps: 48, sampleRateHz: 44100 });
  });

  it('prázdný soubor není mp3', () => {
    expect(readMp3FrameInfo(new Uint8Array())).toBeNull();
  });

  it('soubor kratší než hlavička rámce není mp3', () => {
    expect(readMp3FrameInfo(mp3FrameHeader(64, 44100, 'mono').subarray(0, 3))).toBeNull();
  });

  it('chybová odpověď serveru v JSON není mp3', () => {
    const json = new TextEncoder().encode('{"detail":{"status":"quota_exceeded"}}');
    expect(readMp3FrameInfo(json)).toBeNull();
  });

  it('hlavička s neplatným datovým tokem (index 15) není mp3', () => {
    const bytes = fakeMp3();
    bytes[2] = (15 << 4) | ((bytes[2] ?? 0) & 0x0f);
    expect(readMp3FrameInfo(bytes)).toBeNull();
  });

  it('hlavička s volným datovým tokem (index 0) se nedá ověřit, takže není přijatá', () => {
    const bytes = fakeMp3();
    bytes[2] = (bytes[2] ?? 0) & 0x0f;
    expect(readMp3FrameInfo(bytes)).toBeNull();
  });

  it('hlavička s neplatnou vzorkovací frekvencí (index 3) není mp3', () => {
    const bytes = fakeMp3();
    bytes[2] = ((bytes[2] ?? 0) & 0xf3) | (3 << 2);
    expect(readMp3FrameInfo(bytes)).toBeNull();
  });
});
