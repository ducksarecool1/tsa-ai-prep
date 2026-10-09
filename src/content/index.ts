// Bundles every content JSON file into the app at build time.
// To add or edit content, change the JSON files in this folder; see README.md.
import type { Content, PromptChallenge, SpotProblem, Unit } from '../types';
import challengesJson from './prompt-challenges.json';
import spotJson from './spot-the-problem.json';

const unitModules = import.meta.glob<{ default: unknown }>('./units/*.json', { eager: true });

const units = Object.values(unitModules)
  .map((m) => m.default as Unit)
  .sort((a, b) => a.number - b.number);

export const bundledContent: Content = {
  units,
  challenges: challengesJson as unknown as PromptChallenge[],
  spotProblems: spotJson as unknown as SpotProblem[],
};
