import { useEffect } from 'react';
import { useRoute } from './router';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { LessonPage, UnitsPage } from './pages/Units';
import { LearnPage } from './pages/Learn';
import { FlashcardsPage } from './pages/Flashcards';
import { PracticeTestPage } from './pages/PracticeTest';
import { ChallengePage, PromptLabPage } from './pages/PromptLab';
import { SpotProblemPage } from './pages/SpotProblem';
import { GlossaryPage } from './pages/Glossary';
import { SettingsPage } from './pages/Settings';
import { AdvisorPage } from './pages/Advisor';
import { AchievementsPage } from './pages/Achievements';

const TITLES: Record<string, string> = {
  '': 'Dashboard',
  units: 'Units',
  learn: 'Learn',
  flashcards: 'Flashcards',
  test: 'Practice Test',
  'prompt-lab': 'Prompt Lab',
  spot: 'Spot the Problem',
  glossary: 'Glossary',
  settings: 'Settings',
  advisor: 'Advisor',
  achievements: 'Achievements',
};

export function App() {
  const { segments, params } = useRoute();
  const [section = '', id] = segments;
  const navSection = section === 'spot' ? 'prompt-lab' : section;

  useEffect(() => {
    const title = TITLES[section];
    document.title = title ? `${title} · AI Prep` : 'AI Prep';
  }, [section]);

  let page: JSX.Element;
  switch (section) {
    case '':
      page = <Dashboard />;
      break;
    case 'units':
      page = id ? <LessonPage key={id} unitId={id} /> : <UnitsPage />;
      break;
    case 'learn':
      page = <LearnPage key={params.get('start') ?? params.get('unit') ?? 'learn'} params={params} />;
      break;
    case 'flashcards':
      page = <FlashcardsPage key={params.get('unit') ?? 'all'} params={params} />;
      break;
    case 'test':
      page = <PracticeTestPage key={params.get('unit') ?? 'all'} params={params} />;
      break;
    case 'prompt-lab':
      page = id ? <ChallengePage key={id} challengeId={id} /> : <PromptLabPage />;
      break;
    case 'spot':
      page = <SpotProblemPage />;
      break;
    case 'glossary':
      page = <GlossaryPage />;
      break;
    case 'settings':
      page = <SettingsPage />;
      break;
    case 'advisor':
      page = <AdvisorPage />;
      break;
    case 'achievements':
      page = <AchievementsPage />;
      break;
    default:
      page = (
        <div className="card">
          <h1>Page not found</h1>
          <p className="mt-2">
            <a href="#/">Go to the dashboard</a>
          </p>
        </div>
      );
  }

  return <Layout current={navSection}>{page}</Layout>;
}
