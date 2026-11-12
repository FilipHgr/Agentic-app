import { describe, expect, it } from 'vitest';

import { createVoicePlayer } from '../../../src/games/counting/audio/voicePlayer';
import type { VoiceAudioContextLike } from '../../../src/games/counting/audio/voicePlayer';
import { GUIDE_SCRIPT } from '../../../src/games/counting/logic/guideScript';
import { guideVoiceUrl } from '../../../src/games/counting/logic/guideVoice';
import { currentLanguage, selectLanguage } from '../../../src/shared/texts/languages';

/**
 * Testy k #70 AC3 a #138 AC3: hra spuštěná po výběru jazyka v menu dostane
 * zvolený jazyk a průvodce stahuje nahrávky jen zvoleného jazyka. Běží se
 * skutečným seznamem jazyků (čeština a angličtina) a skutečnou volbou
 * jazyka ze sdílené části; v testu není `window`, takže volba platí jen
 * v paměti tohoto souboru (jako stránka bez úložiště).
 */

const IDS = GUIDE_SCRIPT.map((line) => line.id);

function silentContext(): VoiceAudioContextLike {
  return {
    currentTime: 0,
    destination: { connect: () => undefined } as unknown as VoiceAudioContextLike['destination'],
    state: 'running',
    resume: () => Promise.resolve(),
    decodeAudioData: () => Promise.resolve({ duration: 1 }),
    createBufferSource: () => {
      throw new Error('v testu se nic nehraje');
    },
  };
}

/** Přehrávač průvodce bez zadaného jazyka; vrátí adresy, které stáhl. */
async function downloadedUrls(): Promise<string[]> {
  const urls: string[] = [];
  const player = createVoicePlayer({
    fetch: (url) => {
      urls.push(url);
      return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
    },
    createContext: silentContext,
    events: { onLoaded: () => undefined, onLoadFailed: () => undefined },
  });
  for (const id of IDS) {
    player.load(id);
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  return urls;
}

describe('#70 AC3: hra dostane zvolený jazyk', () => {
  it('před výběrem je jazyk hry čeština a průvodce stahuje české nahrávky', async () => {
    expect(currentLanguage()).toBe('cs');
    const urls = await downloadedUrls();
    expect(urls).toHaveLength(IDS.length);
    expect(urls.every((url) => url.startsWith('voice/cs/counting/'))).toBe(true);
  });

  it('po výběru angličtiny v menu je jazyk hry angličtina', () => {
    expect(selectLanguage('en')).toBe(true);
    expect(currentLanguage()).toBe('en');
  });

  it('adresa nahrávky bez zadaného jazyka vede do složky zvoleného jazyka', () => {
    for (const id of IDS) {
      expect(guideVoiceUrl(id)).toBe(`voice/en/counting/guide/${id}.mp3`);
    }
  });

  it('průvodce stahuje nahrávky jen zvoleného jazyka', async () => {
    const urls = await downloadedUrls();
    expect(urls).toHaveLength(IDS.length);
    expect(urls.every((url) => url.startsWith('voice/en/counting/guide/'))).toBe(true);
  });

  it('po návratu na češtinu stahuje průvodce zase české nahrávky', async () => {
    expect(selectLanguage('cs')).toBe(true);
    const urls = await downloadedUrls();
    expect(urls.every((url) => url.startsWith('voice/cs/counting/guide/'))).toBe(true);
  });
});
