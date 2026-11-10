import { describe, expect, it } from 'vitest';

// @ts-expect-error -- nástroj je čistý JavaScript bez typů
import { isAllowedImageUrl, isAllowedTarget } from '../../tools/design/fetch-image.mjs';

/**
 * Nástroj na stažení obrázků z ElevenLabs je úzká výjimka ze zákazu `curl`
 * a `wget` (rozhodnutí 2026-11-10). Smí stahovat jen obrázky přes HTTPS ze
 * serveru elevenlabsusercontent.com.
 */
describe('stažení obrázku z ElevenLabs smí jen na jeden server', () => {
  it('pustí jen HTTPS adresu serveru elevenlabsusercontent.com', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['https://elevenlabsusercontent.com/database/a/content.png?Expires=1', true],
      ['http://elevenlabsusercontent.com/a.png', false],
      ['https://elevenlabsusercontent.com:8443/a.png', false],
      ['https://evil.elevenlabsusercontent.com/a.png', false],
      ['https://elevenlabsusercontent.com.evil.example/a.png', false],
      ['https://example.com/a.png', false],
      ['ftp://elevenlabsusercontent.com/a.png', false],
      ['nesmysl', false],
      ['', false],
    ];
    for (const [url, allowed] of cases) {
      expect(isAllowedImageUrl(url), url).toBe(allowed);
    }
  });

  it('uloží jen soubor s příponou obrázku', () => {
    const cases: readonly (readonly [string, boolean])[] = [
      ['out/tile.png', true],
      ['out/tile.WEBP', true],
      ['out/tile.jpg', true],
      ['out/tile.jpeg', true],
      ['out/tile.js', false],
      ['out/tile', false],
      ['.claude/settings.json', false],
    ];
    for (const [path, allowed] of cases) {
      expect(isAllowedTarget(path), path).toBe(allowed);
    }
  });
});
