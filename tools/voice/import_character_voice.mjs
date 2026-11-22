/* global console, process */
/**
 * Uloží nahrávky replik pandy Rudyho v jednom jazyce (#171) a zapíše jejich
 * otisky do oddílu `character:rudy` v tools/voice/fingerprints.json.
 * Nahrávky postavičky nejsou nahrávky průvodce: vytvoří je Claude přes
 * napojení ElevenLabs hlasem z oddílu `character:rudy` ve voice.config.json
 * (jeden hlas pro všechny jazyky), stáhne je nástrojem fetch-voice.mjs
 * a převede na mono 44,1 kHz 64 kb/s. Server ElevenLabs skript nevolá.
 *
 * Spuštění (např. pro češtinu):
 *   npm run voice:character -- cs <složka s nahrávkami>
 * Ve složce je pro každou repliku soubor `<část>-<id>.mp3`, např.
 * `counting-celebration.mp3`, `compare-celebration.mp3`. Repliky jsou
 * v textech částí pod klíčem `rudyLines` (src/games/counting/texts/<jazyk>.ts,
 * src/games/compare/texts/<jazyk>.ts, #181). Od #186 Rudy jen slaví po
 * 10 hvězdičkách, pozdravy v menu a hrách nejsou.
 *
 * Jádro je ve voiceCore.ts (TypeScript), proto ho načte Vite jako make_voice.mjs.
 */
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const CONFIG_PATH = 'tools/voice/voice.config.json';
const CHARACTER = 'rudy';

const diskFiles = {
  async readFile(path) {
    try {
      return new Uint8Array(await readFile(path));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  },
  async writeFile(path, data) {
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, path);
  },
  async deleteFile(path) {
    await rm(path, { force: true });
  },
  async listFiles(dir) {
    try {
      return await readdir(dir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  },
};

async function main() {
  const [language, sourceDir, ...rest] = process.argv.slice(2);
  if (language === undefined || sourceDir === undefined || rest.length > 0) {
    console.error('Použití: npm run voice:character -- <jazyk> <složka s nahrávkami>');
    process.exitCode = 1;
    return;
  }
  const voices = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'silent',
  });
  try {
    const core = await vite.ssrLoadModule('/tools/voice/voiceCore.ts');
    const lines = [];
    for (const place of core.CHARACTER_PLACES) {
      const dir = core.CHARACTER_TEXTS_DIRS[place];
      const textFiles = await diskFiles.listFiles(dir);
      if (!/^[a-z]+$/.test(language) || !textFiles.includes(`${language}.ts`)) {
        continue;
      }
      const texts = await vite.ssrLoadModule(`/${dir}/${language}.ts`);
      lines.push(...core.characterLinesOf(place, texts.default));
    }
    const result = await core.importCharacterVoice({
      character: CHARACTER,
      language,
      lines,
      voices,
      source: (line) => diskFiles.readFile(join(sourceDir, `${line.place}-${line.id}.mp3`)),
      files: diskFiles,
      log: (line) => console.log(line),
    });
    process.exitCode = result.ok ? 0 : 1;
  } finally {
    await vite.close();
  }
}

main().catch((error) => {
  console.error(`Skript na nahrávky postavičky skončil chybou: ${String(error)}`);
  process.exitCode = 1;
});
