import { describe, expect, it } from 'vitest';

// @ts-expect-error -- nástroj je čistý JavaScript bez typů
import { isAllowedVideoUrl, isAllowedTarget } from '../../tools/design/fetch-video.mjs';

/**
 * Nástroj na stažení videí z ElevenLabs je úzká výjimka ze zákazu `curl`
 * a `wget` (rozhodnutí 2026-11-21). Smí stahovat jen mp4 přes HTTPS ze
 * serveru elevenlabsusercontent.com.
 */
describe('stažení videa z ElevenLabs smí jen na jeden server', () => {
  it('pustí jen HTTPS adresu serveru elevenlabsusercontent.com', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['https://elevenlabsusercontent.com/database/a/content.mp4?Expires=1', true],
      ['http://elevenlabsusercontent.com/a.mp4', false],
      ['https://elevenlabsusercontent.com:8443/a.mp4', false],
      ['https://evil.elevenlabsusercontent.com/a.mp4', false],
      ['https://elevenlabsusercontent.com.evil.example/a.mp4', false],
      ['https://example.com/a.mp4', false],
      ['ftp://elevenlabsusercontent.com/a.mp4', false],
      ['nesmysl', false],
      ['', false],
    ];
    for (const [url, allowed] of cases) {
      expect(isAllowedVideoUrl(url), url).toBe(allowed);
    }
  });

  it('uloží jen soubor s příponou mp4', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['out/panda.mp4', true],
      ['out/panda.MP4', true],
      ['out/panda.png', false],
      ['out/panda.js', false],
      ['out/panda', false],
      ['.claude/settings.json', false],
    ];
    for (const [path, allowed] of cases) {
      expect(isAllowedTarget(path), path).toBe(allowed);
    }
  });
});
