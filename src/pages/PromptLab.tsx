import { useState } from 'react';
import { useApp } from '../state/AppContext';
import type { Difficulty, PromptChallenge } from '../types';
import { aiEnabled } from '../lib/ai';
import { AnswerInput, type AnswerResult } from '../components/AnswerInput';
import { StudentMessage, TutorMessage } from '../components/Chat';
import { ChallengeBrief, PromptReviewView } from '../components/PromptPractice';
import { Icon } from '../components/Icon';

const DIFFICULTY_LABEL: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

export function PromptLabPage() {
  const { content, progress, settings } = useApp();
  const solved = content.challenges.filter((c) => (progress.prompts[c.id]?.bestScore ?? 0) >= 80).length;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="pt-4 text-center sm:pt-8">
        <h1 className="font-display text-3xl font-normal sm:text-4xl">Prompt Lab</h1>
        <p className="mt-3 text-ink-soft">
          Write prompts for real situations. {aiEnabled(settings.ai) ? 'The AI coach runs each prompt and reviews it.' : 'Each prompt is checked against a checklist.'}{' '}
          {solved} of {content.challenges.length} passed so far.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href="#/learn?unit=u7" className="btn-primary">
            Practice in Learn mode
            <Icon name="arrowRight" className="h-4 w-4" />
          </a>
          <a href="#/spot" className="btn-secondary">
            Play Spot the Problem
          </a>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {content.challenges.map((c, i) => {
          const best = progress.prompts[c.id]?.bestScore;
          return (
            <a
              key={c.id}
              href={`#/prompt-lab/${c.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-ink/25 hover:bg-raised hover:no-underline"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">
                  {i + 1}. {c.title}
                </span>
                <span className="chip shrink-0">{DIFFICULTY_LABEL[c.difficulty]}</span>
              </div>
              <span className="line-clamp-2 text-sm text-ink-soft">{c.scenario}</span>
              <span className="text-xs text-ink-soft">{best !== undefined ? `Best score: ${best}` : 'Not attempted yet'}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function ChallengePage({ challengeId }: { challengeId: string }) {
  const { content, recordPrompt, progress, knownTerms } = useApp();
  const index = content.challenges.findIndex((c) => c.id === challengeId);
  const challenge: PromptChallenge | undefined = content.challenges[index];
  const [attempts, setAttempts] = useState<AnswerResult[]>([]);
  const [composerKey, setComposerKey] = useState(0);

  if (!challenge) {
    return (
      <div className="card">
        <h1>Challenge not found</h1>
        <p className="mt-2">
          <a href="#/prompt-lab">Back to the Prompt Lab</a>
        </p>
      </div>
    );
  }
  const next = content.challenges[index + 1];
  const best = progress.prompts[challenge.id]?.bestScore;
  const last = attempts[attempts.length - 1];
  // The composer is open until an attempt is reviewed, then again after "Revise and try again".
  const composerOpen = attempts.length === composerKey;

  const onAnswer = (r: AnswerResult) => {
    setAttempts((a) => [...a, r]);
    if (r.review) recordPrompt(challenge.id, r.review.score);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="mb-6 flex items-center justify-between gap-2">
        <a href="#/prompt-lab" className="text-sm text-ink-soft hover:text-ink">
          ← Prompt Lab
        </a>
        <span className="flex gap-2">
          <span className="chip">{DIFFICULTY_LABEL[challenge.difficulty]}</span>
          {best !== undefined && <span className="chip">Best: {best}</span>}
        </span>
      </div>
      <div className="flex-1 space-y-6 pb-6">
        <TutorMessage>
          <h1 className="text-xl">{challenge.title}</h1>
          <ChallengeBrief challenge={challenge} />
        </TutorMessage>
        {attempts.map((a, i) => (
          <div key={i} className="space-y-6">
            <StudentMessage>{a.response}</StudentMessage>
            <TutorMessage>{a.review && <PromptReviewView review={a.review} strongExample={challenge.strongExample} />}</TutorMessage>
          </div>
        ))}
        {last && !composerOpen && (
          <div className="flex flex-wrap gap-2 pl-10 sm:pl-11">
            <button type="button" className="btn-secondary" onClick={() => setComposerKey((k) => k + 1)}>
              Revise and try again
            </button>
            {next && (
              <a href={`#/prompt-lab/${next.id}`} className="btn-primary">
                Next challenge
                <Icon name="arrowRight" className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </div>
      {composerOpen && (
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-canvas via-canvas to-canvas/0 pb-4 pt-6">
          <AnswerInput
            key={composerKey}
            presentation={{ format: 'prompt', prompt: challenge.scenario, challenge }}
            locked={false}
            onAnswer={onAnswer}
            knownTerms={knownTerms}
          />
        </div>
      )}
    </div>
  );
}
