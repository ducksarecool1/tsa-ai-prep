import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { shuffle } from '../lib/random';
import { AnswerInput, type AnswerResult } from '../components/AnswerInput';
import { Feedback } from '../components/Feedback';
import { ProgressBar } from '../components/ProgressBar';
import { TutorMessage } from '../components/Chat';
import { XpPill } from '../components/GameWidgets';
import { XP } from '../lib/gamification';
import { playSound } from '../lib/sound';

export function SpotProblemPage() {
  const { content, recordSpot, knownTerms, awardXp } = useApp();
  const [round, setRound] = useState(0);
  const order = useMemo(() => shuffle(content.spotProblems), [content.spotProblems, round]);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [score, setScore] = useState(0);
  const item = order[index];
  const options = useMemo(() => (item ? shuffle(item.options) : []), [item]);

  if (!item) {
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center">
        <h1>All done!</h1>
        <p>
          You spotted {score} of {order.length} problems.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setRound((r) => r + 1);
              setIndex(0);
              setScore(0);
              setResult(null);
            }}
          >
            Play again
          </button>
          <a href="#/prompt-lab" className="btn-secondary">
            Back to Prompt Lab
          </a>
        </div>
      </div>
    );
  }

  const answer = (r: AnswerResult) => {
    setResult(r);
    if (r.correct) {
      setScore((s) => s + 1);
      awardXp(XP.spot);
    }
    playSound(r.correct ? 'correct' : 'wrong');
    recordSpot(item.id, r.correct);
    if (index + 1 >= order.length) setTimeout(() => playSound('complete'), 700);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <a href="#/prompt-lab" className="text-ink-soft hover:text-ink">
            ← Prompt Lab
          </a>
          <span className="text-ink-soft">
            Round {index + 1} of {order.length} · Score {score}
          </span>
        </div>
        <ProgressBar className="h-1.5" value={index / order.length} label={`Round ${index + 1} of ${order.length}`} />
      </div>
      <TutorMessage>
        <span className="chip">Spot the problem</span>
        <h1 className="text-xl">{item.title}</h1>
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">The prompt</p>
          <pre className="prose-block">{item.prompt}</pre>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">The AI's output</p>
          <pre className="prose-block">{item.output}</pre>
        </div>
        <h2 className="pt-1 text-base">What went wrong?</h2>
        <AnswerInput
          key={item.id + round}
          presentation={{ format: 'choice', prompt: 'What went wrong?', options, answer: item.answer }}
          locked={result !== null}
          onAnswer={answer}
          knownTerms={knownTerms}
        />
      </TutorMessage>
      {result && (
        <TutorMessage>
          <Feedback correct={result.correct} displayAnswer={item.answer} explanation={item.explanation}>
            {result.correct && (
              <span className="flex w-full">
                <XpPill amount={XP.spot} />
              </span>
            )}
            <button
              type="button"
              className="btn-primary"
              autoFocus
              onClick={() => {
                setResult(null);
                setIndex((i) => i + 1);
              }}
            >
              {index + 1 < order.length ? 'Next' : 'See results'}
            </button>
          </Feedback>
        </TutorMessage>
      )}
    </div>
  );
}
