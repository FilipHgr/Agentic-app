/** Typy k `changedTestsRepo.mjs` (pomocník testů #79). */

export type FakeScript = 'test' | 'test:shared' | 'test:menu' | 'test:counting' | 'test:whole';

export interface ChangedTestsRun {
  /** Návratový kód kontroly, 0 je úspěch. */
  readonly status: number | null;
  /** První řádek standardního výstupu. */
  readonly firstLine: string;
  /** Celý výstup (standardní i chybový). */
  readonly output: string;
  /** Podvržené skripty, které se spustily. */
  readonly ran: readonly FakeScript[];
}

export function createRepo(failing?: readonly FakeScript[]): string;
export function writeRepoFile(dir: string, path: string, content?: string): void;
export function removeRepoFile(dir: string, path: string): void;
export function moveRepoFile(dir: string, from: string, to: string): void;
export function stageAll(dir: string): void;
export function commitAll(dir: string): void;
export function removeRepo(dir: string): void;
export function runChangedTests(dir: string): ChangedTestsRun;
