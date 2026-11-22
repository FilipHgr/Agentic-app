/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

import * as voiceCore from '../../../tools/voice/voiceCore';
import claudeText from '../../../CLAUDE.md?raw';
import fingerprintsJson from '../../../tools/voice/fingerprints.json?raw';
import licenceText from '../../../public/licence.txt?raw';
import packageJson from '../../../package.json?raw';

/**
 * Testy k #187 AC5: hlas průvodce Porovnávání (otázka víc/míň, #182) je
 * pryč celý: nemá nahrávky, nástroj `voice:guide`, otisky ani krok
 * v CLAUDE.md, a oslava Rudyho „kde je víc“ nemá otisk ani zmínku
 * v licenci.
 */

/**
 * Generace nahrávek oslavy „Vždycky poznáš, kde je víc!“ (česky
 * a anglicky), které #187 AC5 odebral. V licenci byly u #181 v pořadí
 * replik v textech (pozdrav, pozdrav znovu, oslava, oslava „víc“), takže
 * „víc“ byla vždy čtvrtá generace jazyka.
 */
const REMOVED_CELEBRATION_MORE_GENERATIONS = ['44t26lD1T6WbDQDLJehe', '8xznZNviI33ToRKUdPG2'];

/** Nahrávky ve `public/voice/` podle cesty od kořene repa. */
const VOICE_FILES = Object.keys(import.meta.glob('../../../public/voice/**/*')).map((path) =>
  path.replace('../../../', ''),
);

describe('#187 AC5: hlas průvodce Porovnávání je pryč i s nástrojem', () => {
  it('hra nemá žádnou nahrávku otázky průvodce', () => {
    expect(VOICE_FILES.filter((path) => /\/compare\/guide\//.test(path))).toEqual([]);
  });

  it('nástroj `npm run voice:guide` a jeho jádro už nejsou', () => {
    const scripts = (JSON.parse(packageJson) as { scripts: Record<string, string> }).scripts;
    expect(Object.keys(scripts)).not.toContain('voice:guide');
    expect(Object.values(scripts).join(' ')).not.toContain('import_guide_voice');
    expect(Object.keys(voiceCore)).not.toContain('importGuideVoice');
    expect(Object.keys(voiceCore)).not.toContain('guideLinesOf');
  });

  it('otisky nemají oddíl průvodce Porovnávání ani odebranou oslavu Rudyho', () => {
    const fingerprints = JSON.parse(fingerprintsJson) as Record<string, unknown>;
    expect(Object.keys(fingerprints)).not.toContain('guide:compare');
    expect(fingerprintsJson).not.toContain('celebrationMore');
  });

  it('CLAUDE.md ani licence nepopisují nahrávky průvodce Porovnávání', () => {
    expect(claudeText).not.toContain('voice:guide');
    expect(claudeText).not.toContain('compare/guide');
    expect(licenceText).not.toContain('compare/guide');
  });

  it('licence neuvádí generace odebraných nahrávek oslavy „kde je víc“', () => {
    const licence = licenceText.replace(/\s+/g, ' ');
    for (const generation of REMOVED_CELEBRATION_MORE_GENERATIONS) {
      expect(licence, generation).not.toContain(generation);
    }
  });
});
