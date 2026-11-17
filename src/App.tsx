import { useMemo } from 'react';
import { useProfile } from './store/store';
import { go, useRoute } from './ui/common';
import { Home, CourseScreen } from './ui/Home';
import { Library, SongScreen } from './ui/Library';
import { LessonRunner } from './ui/LessonRunner';
import { findLesson } from './content/curriculum';
import { buildWorkout } from './content/workout';
import { ProfileScreen, ParentScreen, Onboarding, NewProfile } from './ui/Profile';
import { SettingsScreen } from './ui/Settings';

const TABS = [
  { id: 'home', icon: '🏠', label: 'Accueil' },
  { id: 'songs', icon: '🎵', label: 'Morceaux' },
  { id: 'workout', icon: '💪', label: 'Entraînement' },
  { id: 'profile', icon: '🙂', label: 'Profil' },
];

export default function App() {
  const profile = useProfile();
  const route = useRoute();
  const [page, arg] = route;

  if (!profile) return <div className="app"><Onboarding /></div>;

  let content: React.ReactNode;
  let fullscreen = false;
  switch (page) {
    case 'course':
      content = <CourseScreen id={arg} />;
      break;
    case 'lesson': {
      const found = findLesson(arg);
      if (!found) {
        content = <Home />;
        break;
      }
      fullscreen = true;
      content = (
        <LessonRunner
          key={arg}
          title={found.lesson.title}
          steps={found.lesson.steps}
          kind="lesson"
          lessonId={found.lesson.id}
          onExit={() => go(`course/${found.course.id}`)}
        />
      );
      break;
    }
    case 'workout':
      fullscreen = true;
      content = <Workout />;
      break;
    case 'songs':
      content = <Library />;
      break;
    case 'song':
      content = <SongScreen key={arg} id={arg} />;
      break;
    case 'profile':
      content = <ProfileScreen />;
      break;
    case 'parent':
      content = <ParentScreen />;
      break;
    case 'settings':
      content = <SettingsScreen />;
      break;
    case 'new-profile':
      fullscreen = true;
      content = <NewProfile />;
      break;
    default:
      content = <Home />;
  }

  const activeTab = page === 'course' ? 'home' : page === 'song' ? 'songs' : page === 'parent' || page === 'settings' ? 'profile' : page;

  return (
    <div className="app">
      {content}
      {!fullscreen && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
              <span className="ico">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

function Workout() {
  const p = useProfile()!;
  // build once per visit so the steps don't change while playing
  const steps = useMemo(() => buildWorkout(p), []); // eslint-disable-line react-hooks/exhaustive-deps
  return <LessonRunner title="Entraînement du jour" steps={steps} kind="workout" onExit={() => go('home')} />;
}
