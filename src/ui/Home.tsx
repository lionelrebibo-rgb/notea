import { COURSES, LESSON_ORDER, findLesson, lessonStars, unlockedSet } from '../content/curriculum';
import { minutesOn, streak, today, useProfile } from '../store/store';
import { Ring, Stars, go } from './common';
import { ConnectionPill } from './Settings';

export function Home() {
  const p = useProfile()!;
  const unlocked = unlockedSet(p.lessonSteps, p.startLevel, !!p.unlockAll);
  const nextId = LESSON_ORDER.find((id) => unlocked.has(id) && !lessonStars(findLesson(id)!.lesson, p.lessonSteps).complete) ?? LESSON_ORDER[0];
  const next = findLesson(nextId)!;
  const mins = minutesOn(p, today());
  const st = streak(p);
  const totalStars = Object.values(p.lessonSteps).flat().reduce((a, b) => a + (b || 0), 0);

  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 14 }}>
        <div className="hero col">
          <div className="row">
            <div className="avatar">{p.avatar}</div>
            <div className="grow">
              <div className="title-l">Salut {p.name} !</div>
              <div style={{ opacity: 0.85, fontWeight: 700 }}>{greeting(st, mins, p.dailyGoalMin)}</div>
            </div>
            <ConnectionPill />
          </div>
          <div className="row wrap">
            <Ring value={mins / p.dailyGoalMin} size={62}>
              {Math.floor(mins)}′
            </Ring>
            <div className="stat">
              <b>🔥 {st}</b>
              <span>{st > 1 ? 'jours de suite' : 'jour de suite'}</span>
            </div>
            <div className="stat">
              <b>⭐ {totalStars}</b>
              <span>étoiles</span>
            </div>
            <div className="stat">
              <b>⚡ {p.xp}</b>
              <span>XP</span>
            </div>
          </div>
        </div>

        <div className="grid">
          <button className="card col" style={{ textAlign: 'left', background: next.course.color }} onClick={() => go(`lesson/${next.lesson.id}`)}>
            <div className="small" style={{ fontWeight: 800, opacity: 0.85 }}>
              CONTINUER · {next.course.title}
            </div>
            <div className="row">
              <span style={{ fontSize: 40 }}>{next.lesson.emoji}</span>
              <div className="grow">
                <div className="title-l">{next.lesson.title}</div>
                <div style={{ opacity: 0.85 }}>{next.lesson.steps.length} étapes</div>
              </div>
              <span className="btn small" style={{ background: 'rgba(0,0,0,0.2)' }}>
                ▶
              </span>
            </div>
          </button>
          <button className="card col" style={{ textAlign: 'left' }} onClick={() => go('workout')}>
            <div className="small muted" style={{ fontWeight: 800 }}>
              ENTRAÎNEMENT DU JOUR
            </div>
            <div className="row">
              <span style={{ fontSize: 40 }}>💪</span>
              <div className="grow">
                <div className="title-l">5 minutes</div>
                <div className="muted">Échauffement, lecture, rythme et révision</div>
              </div>
            </div>
          </button>
        </div>

        <div className="section-title">Les parcours</div>
        <div className="col">
          {COURSES.map((c) => {
            const done = c.lessons.filter((l) => lessonStars(l, p.lessonSteps).complete).length;
            const open = c.lessons.some((l) => unlocked.has(l.id));
            const stars = c.lessons.reduce((a, l) => a + lessonStars(l, p.lessonSteps).stars, 0);
            return (
              <button key={c.id} className={`course-card ${open ? '' : 'locked'}`} onClick={() => open && go(`course/${c.id}`)}>
                <div className="emoji" style={{ background: c.color }}>
                  {open ? c.emoji : '🔒'}
                </div>
                <div className="grow col" style={{ gap: 6 }}>
                  <div className="row">
                    <b className="grow">{c.title}</b>
                    <Stars n={Math.round(stars / Math.max(1, c.lessons.length))} size={14} />
                  </div>
                  <div className="muted small">{c.subtitle}</div>
                  <div className="progress">
                    <div style={{ width: `${(done / c.lessons.length) * 100}%` }} />
                  </div>
                  <div className="muted small">
                    {done}/{c.lessons.length} leçons
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function greeting(st: number, mins: number, goal: number) {
  if (mins >= goal) return 'Objectif du jour atteint, bravo ! 🎯';
  if (mins > 0) return `Encore ${Math.ceil(goal - mins)} min pour ton objectif du jour`;
  if (st > 0) return `Continue ta série de ${st} jour${st > 1 ? 's' : ''} !`;
  return 'On fait un peu de piano ?';
}

export function CourseScreen({ id }: { id: string }) {
  const p = useProfile()!;
  const c = COURSES.find((x) => x.id === id);
  if (!c) return null;
  const unlocked = unlockedSet(p.lessonSteps, p.startLevel, !!p.unlockAll);
  const firstOpenIncomplete = c.lessons.find((l) => unlocked.has(l.id) && !lessonStars(l, p.lessonSteps).complete)?.id;
  return (
    <div className="screen">
      <div className="screen-inner">
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="icon-btn" onClick={() => go('home')} aria-label="Retour">
            ←
          </button>
          <div className="grow">
            <h1 className="title-l">
              {c.emoji} {c.title}
            </h1>
            <div className="muted small">{c.subtitle}</div>
          </div>
        </div>
        <div className="path">
          {c.lessons.map((l, i) => {
            const s = lessonStars(l, p.lessonSteps);
            const open = unlocked.has(l.id);
            const offset = [0, 60, 0, -60][i % 4];
            return (
              <button
                key={l.id}
                className={`node ${open ? '' : 'locked'} ${l.id === firstOpenIncomplete ? 'current' : ''}`}
                style={{ transform: `translateX(${offset}px)` }}
                onClick={() => open && go(`lesson/${l.id}`)}
              >
                <div className="bubble" style={{ background: s.complete ? c.color : undefined }}>
                  {open ? l.emoji : '🔒'}
                </div>
                <div className="name">{l.title}</div>
                {s.complete ? <Stars n={s.stars} size={14} /> : <span className="muted small">{open ? 'À faire' : 'Verrouillée'}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
