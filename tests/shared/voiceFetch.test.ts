import { describe, expect, it } from 'vitest';

import {
  isAllowedVoiceTarget,
  isAllowedVoiceType,
  isAllowedVoiceUrl,
  // @ts-expect-error -- nástroj je čistý JavaScript bez typů
} from '../../tools/voice/fetch-voice.mjs';

/**
 * Nástroj na stažení nahrávky z ElevenLabs (`tools/voice/fetch-voice.mjs`)
 * je úzká výjimka ze zákazu `curl` a `wget` stejně jako stažení obrázků
 * (rozhodnutí 2026-11-12, komentář k #138): jen HTTPS ze serveru
 * elevenlabsusercontent.com, jen mp3 (audio/mpeg) a jen do souboru .mp3.
 * Limit 5 MB hlídá stahování samo; testy síť nevolají.
 */
describe('stažení nahrávky z ElevenLabs smí jen na jeden server', () => {
  it('pustí jen HTTPS adresu serveru elevenlabsusercontent.com bez portu', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['https://elevenlabsusercontent.com/database/a/content.mp3?Expires=1', true],
      ['https://elevenlabsusercontent.com/a', true],
      ['http://elevenlabsusercontent.com/a.mp3', false],
      ['https://elevenlabsusercontent.com:8443/a.mp3', false],
      ['https://elevenlabsusercontent.com:443/a.mp3', true],
      ['https://evil.elevenlabsusercontent.com/a.mp3', false],
      ['https://elevenlabsusercontent.com.evil.example/a.mp3', false],
      ['https://elevenlabsusercontent.com@evil.example/a.mp3', false],
      ['https://api.elevenlabs.io/v1/text-to-speech/x', false],
      ['https://example.com/a.mp3', false],
      ['ftp://elevenlabsusercontent.com/a.mp3', false],
      ['file:///etc/passwd', false],
      ['nesmysl', false],
      ['', false],
    ];
    for (const [url, allowed] of cases) {
      expect(isAllowedVoiceUrl(url), url).toBe(allowed);
    }
  });

  it('uloží jen soubor s příponou .mp3', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['public/voice/en/counting/guide/summary.mp3', true],
      ['out/summary.MP3', true],
      ['out/summary.wav', false],
      ['out/summary.mp3.js', false],
      ['out/summary', false],
      ['out/mp3', false],
      ['.claude/settings.json', false],
      ['tools/voice/voice.config.json', false],
    ];
    for (const [path, allowed] of cases) {
      expect(isAllowedVoiceTarget(path), path).toBe(allowed);
    }
  });

  it('přijme jen odpověď typu mp3 (audio/mpeg), i s parametry a velkými písmeny', () => {
    const cases: readonly (readonly [string | null | undefined, boolean])[] = [
      ['audio/mpeg', true],
      ['audio/mp3', true],
      ['Audio/MPEG; charset=binary', true],
      [' audio/mpeg ', true],
      ['audio/wav', false],
      ['audio/ogg', false],
      ['application/json', false],
      ['text/html; charset=utf-8', false],
      ['image/png', false],
      ['application/octet-stream', false],
      ['', false],
      [null, false],
      [undefined, false],
    ];
    for (const [type, allowed] of cases) {
      expect(isAllowedVoiceType(type), String(type)).toBe(allowed);
    }
  });
});
