/**
 * Skript kontroly `npm run test:changed` (#79). Zjistí z gitu, čím se
 * pracovní kopie liší od posledního commitu (připravené i nepřipravené
 * změny, nesledované soubory bez ignorovaných, smazané soubory a u
 * přejmenování obě cesty), vypíše první řádek s tím, co pouští, a spustí
 * skripty z plánu. Když některý selže, doběhnou i ostatní a kontrola skončí
 * neúspěchem.
 *
 * Spouští ho přímo `node` (odstranění typů je v Node 22.18+ zapnuté), proto
 * tu smí být jen typy, které jde vymazat, a import má příponu `.ts`. Projekt
 * nemá typy Node, `tsc` proto kontroluje jen čistou logiku v `changedTests.ts`.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

import { pathsFromGitStatus, planChangedTests } from './changedTests.ts';

function changedPaths(): string[] {
  const result = spawnSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git status selhal: ${result.stderr || String(result.error)}`);
  }
  return pathsFromGitStatus(result.stdout);
}

function packageScripts(): Record<string, string> {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  return packageJson.scripts ?? {};
}

/** Spustí `npm run <skript>` s výstupem rovnou do konzole; vrací, jestli prošel. */
function runScript(script: string): boolean {
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit' });
  if (result.error !== undefined) {
    console.error(`npm run ${script} nešlo spustit: ${result.error.message}`);
  }
  return result.status === 0;
}

function main(): number {
  const plan = planChangedTests(changedPaths(), packageScripts());
  console.log(plan.headline);
  const failedScripts: string[] = [];
  for (const script of plan.scripts) {
    if (!runScript(script)) {
      failedScripts.push(script);
    }
  }
  if (failedScripts.length > 0) {
    console.error(`Neprošlo: ${failedScripts.join(', ')}`);
    return 1;
  }
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
