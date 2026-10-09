// Node-side content loader used by the validation script and the test suite.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Content, PromptChallenge, SpotProblem, Unit } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
export const CONTENT_DIR = join(here, '..', 'src', 'content');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadContentFromDisk(dir: string = CONTENT_DIR): Content {
  const unitDir = join(dir, 'units');
  const units = readdirSync(unitDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson<Unit>(join(unitDir, f)))
    .sort((a, b) => a.number - b.number);
  const challengesPath = join(dir, 'prompt-challenges.json');
  const spotPath = join(dir, 'spot-the-problem.json');
  let challenges: PromptChallenge[] = [];
  let spotProblems: SpotProblem[] = [];
  try {
    challenges = readJson<PromptChallenge[]>(challengesPath);
  } catch {
    challenges = [];
  }
  try {
    spotProblems = readJson<SpotProblem[]>(spotPath);
  } catch {
    spotProblems = [];
  }
  return { units, challenges, spotProblems };
}
