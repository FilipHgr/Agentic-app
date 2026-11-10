/** Typy k `testScriptsListing.mjs` (pomocník testů #80). */

export const REPO_ROOT: string;
export function scriptTestFiles(script: string, root?: string): string[];
export function scriptTestNames(script: string, root?: string): string[];
export function testFilesInRepo(root?: string): string[];
export function createScriptsFixture(testFiles: readonly string[]): string;
export function removeScriptsFixture(dir: string): void;
