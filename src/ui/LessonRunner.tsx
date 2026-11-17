import { useMemo, useRef, useState } from 'react';
import type { Step } from '../content/curriculum';
import { stepSong } from '../content/curriculum';
import { LIBRARY } from '../content/songs';
import { Player } from './Player';
import { MiniKeyboard, Stars } from './common';
import { BADGES, recordActivity, recordLessonStep, recordSongResult } from '../store/store';
import type { SessionResult } from '../engine/session';
import { fanfare } from '../audio/synth';

interface Props {
  title: string;
  steps: Step[];
  kind: 'lesson' | 'workout';
  lessonId?: string;
  onExit: () => void;
  onFinished?: () => void;
}

export function LessonRunner({ title, steps, kind, lessonId, onExit, onFinished }: Props) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const results = useRef<Record<number, number>>({});
  const badges = useRef<string[]>([]);
  const step = steps[idx];
  const playIdx = useMemo(() => steps.map((s, i) => (s.kind === 'play' ? i : -1)).filter((i) => i >= 0), [steps]);
  const song = useMemo(() => (step && step.kind === 'play' ? stepSong(step) : null), [step]);

  function next() {
    if (idx + 1 >= steps.length) {
      setDone(true);
      const st = Object.values(results.current);
      const avg = st.length ? st.reduce((a, b) => a + b, 0) / st.length : 0;
      fanfare(Math.round(avg));
      onFinished?.();
    } else setIdx(idx + 1);
  }

  function onResult(r: SessionResult) {
    if (step.kind !== 'play' || !song) return;
    results.current[idx] = Math.max(results.current[idx] ?? 0, r.stars);
    if (kind === 'lesson' && lessonId) recordLessonStep(lessonId, idx, r.stars);
    const base = step.song();
    const isLibrary = LIBRARY.some((s) => s.id === base.id);
    if (isLibrary && !step.bars) recordSongResult(base.id, r.stars, r.accuracy);
    const earned = recordActivity(
      { kind, ref: lessonId ?? 'workout', title: `${title} – ${step.title}`, seconds: r.seconds, accuracy: r.accuracy, stars: r.stars },
      r.stats,
      { twoHands: step.hands === 'both' && isLibrary },
    );
    badges.current.push(...earned);
  }

  if (done) {
    const st = playIdx.map((i) => results.current[i] ?? 0);
    const avg = st.length ? Math.round(st.reduce((a, b) => a + b, 0) / st.length) : 0;
    return (
      <div className="screen">
        <div className="screen-inner info-step">
          <div className="info-emoji">{avg >= 3 ? '🏆' : avg >= 2 ? '🎉' : '👏'}</div>
          <h1 className="title-xl">{kind === 'workout' ? 'Entraînement terminé !' : 'Leçon terminée !'}</h1>
          <div className="big-stars">
            {[1, 2, 3].map((i) => (
              <span key={i} className={i <= avg ? 'star-on' : 'star-off'}>
                ★
              </span>
            ))}
          </div>
          {badges.current.length > 0 && (
            <div className="card col" style={{ width: '100%' }}>
              <b>Nouveaux badges !</b>
              {[...new Set(badges.current)].map((b) => (
                <div key={b} className="row">
                  <span style={{ fontSize: 28 }}>{BADGES[b]?.icon}</span>
                  <div>
                    <div style={{ fontWeight: 800 }}>{BADGES[b]?.title}</div>
                    <div className="muted small">{BADGES[b]?.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn primary" onClick={onExit}>
            Continuer
          </button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const stepNo = (
    <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
      {steps.map((s, i) => (
        <span
          key={i}
          style={{
            width: i === idx ? 22 : 10,
            height: 10,
            borderRadius: 999,
            background: i < idx ? 'var(--ok)' : i === idx ? 'var(--accent)' : 'rgba(255,255,255,0.18)',
            transition: 'width .2s',
          }}
        />
      ))}
    </div>
  );

  if (step.kind === 'info') {
    return (
      <div className="screen">
        <div className="screen-inner">
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="icon-btn" onClick={onExit} aria-label="Quitter">
              ✕
            </button>
            <div className="grow">{stepNo}</div>
            <div style={{ width: 40 }} />
          </div>
          <div className="info-step">
            {step.emoji && <div className="info-emoji">{step.emoji}</div>}
            <h1 className="title-xl">{step.title}</h1>
            <div className="info-text">{step.text}</div>
            {step.keys && <MiniKeyboard lo={step.keys.some((k) => k < 55) ? 41 : 53} hi={step.keys.some((k) => k > 74) ? 84 : 76} highlight={step.keys} />}
            <button className="btn primary" onClick={next} style={{ minWidth: 200 }}>
              J’ai compris →
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stars = results.current[idx];
  return (
    <Player
      key={idx}
      song={song!}
      subtitle={`${step.title} · étape ${playIdx.indexOf(idx) + 1}/${playIdx.length}${stars ? ' · ' + '★'.repeat(stars) : ''}`}
      config={{
        hands: step.hands,
        mode: step.mode,
        tempo: step.tempo ?? 1,
        hints: step.hints ?? 'auto',
        names: step.names,
        anyKey: step.anyKey,
        metronome: step.metronome,
        locked: true,
      }}
      onExit={onExit}
      onDone={onResult}
      onNext={next}
      nextLabel={idx + 1 >= steps.length ? 'Terminer' : 'Étape suivante'}
    />
  );
}

export { Stars };
