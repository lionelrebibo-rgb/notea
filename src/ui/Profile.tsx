import { useRef, useState } from 'react';
import { BADGES, exportBackup, importBackup, minutesOn, setParentPin, streak, today, updateProfile, updateSettings, useProfile, useRoot, deleteProfile, createProfile } from '../store/store';
import { supportsMidi } from '../input/midi';
import { COURSES, lessonStars } from '../content/curriculum';
import { LIBRARY } from '../content/songs';
import { midiNameWithOctave } from '../music/theory';
import { Header, Stars, fmtMinutes, go } from './common';
import { Toggle } from './Player';

export function ProfileScreen() {
  const p = useProfile()!;
  const total = p.sessions.reduce((a, s) => a + s.seconds, 0) / 60;
  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 14 }}>
        <Header
          title="Mon profil"
          right={
            <button className="icon-btn" onClick={() => go('settings')} aria-label="Réglages">
              ⚙️
            </button>
          }
        />
        <div className="card row">
          <div className="avatar" style={{ background: 'var(--accent)' }}>
            {p.avatar}
          </div>
          <div className="grow">
            <div className="title-l">{p.name}</div>
            <div className="muted small">
              ⚡ {p.xp} XP · 🔥 {streak(p)} jour(s) · ⏱️ {fmtMinutes(total)} de piano
            </div>
          </div>
        </div>

        <div className="section-title" style={{ margin: '8px 0 0' }}>
          Mes badges
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {Object.entries(BADGES).map(([id, b]) => {
            const got = !!p.badges[id];
            return (
              <div key={id} className="card col" style={{ alignItems: 'center', textAlign: 'center', opacity: got ? 1 : 0.4, gap: 4 }}>
                <div style={{ fontSize: 34, filter: got ? undefined : 'grayscale(1)' }}>{b.icon}</div>
                <b className="small">{b.title}</b>
                <div className="muted small">{b.desc}</div>
              </div>
            );
          })}
        </div>

        <div className="row wrap">
          <button className="btn" onClick={() => go('settings')}>
            ⚙️ Réglages et connexion du piano
          </button>
          <button className="btn" onClick={() => go('parent')}>
            👨‍👩‍👧 Espace parents
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ parents */

function PinPad({ title, onDone }: { title: string; onDone: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const press = (d: string) => {
    const n = (pin + d).slice(0, 4);
    setPin(n);
    if (n.length === 4) {
      setTimeout(() => {
        onDone(n);
        setPin('');
      }, 120);
    }
  };
  return (
    <div className="col" style={{ alignItems: 'center' }}>
      <b>{title}</b>
      <div className="pin-dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      <div className="pin-pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d ? (
            <button key={i} onClick={() => (d === '⌫' ? setPin(pin.slice(0, -1)) : press(d))}>
              {d}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}

export function ParentScreen() {
  const root = useRoot();
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState(false);
  const [first, setFirst] = useState<string | null>(null);

  if (!ok) {
    return (
      <div className="screen">
        <div className="screen-inner col" style={{ gap: 20 }}>
          <Header title="Espace parents" onBack={() => go('profile')} />
          {root.parentPin ? (
            <>
              <PinPad
                title="Code parent"
                onDone={(pin) => {
                  if (pin === root.parentPin) setOk(true);
                  else setErr(true);
                }}
              />
              {err && <div className="center" style={{ color: 'var(--bad)' }}>Code incorrect</div>}
            </>
          ) : first === null ? (
            <PinPad title="Choisis un code parent à 4 chiffres" onDone={(pin) => setFirst(pin)} />
          ) : (
            <PinPad
              title="Confirme le code"
              onDone={(pin) => {
                if (pin === first) {
                  setParentPin(pin);
                  setOk(true);
                } else {
                  setFirst(null);
                  setErr(true);
                }
              }}
            />
          )}
          {err && !root.parentPin && <div className="center" style={{ color: 'var(--bad)' }}>Les codes ne correspondent pas, recommence.</div>}
        </div>
      </div>
    );
  }
  return <ParentDashboard />;
}

function ParentDashboard() {
  const p = useProfile()!;
  const root = useRoot();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const days: { date: string; label: string; min: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = today(d);
    days.push({ date, label: d.toLocaleDateString('fr-FR', { weekday: 'narrow' }), min: minutesOn(p, date) });
  }
  const maxMin = Math.max(p.dailyGoalMin, ...days.map((d) => d.min));
  const week = days.slice(7).reduce((a, d) => a + d.min, 0);
  const daysPlayed = days.slice(7).filter((d) => d.min >= 1).length;
  const total = p.sessions.reduce((a, s) => a + s.seconds, 0) / 60;
  const lessonsDone = COURSES.flatMap((c) => c.lessons).filter((l) => lessonStars(l, p.lessonSteps).complete).length;
  const lessonsTotal = COURSES.flatMap((c) => c.lessons).length;

  const tricky = Object.entries(p.missed)
    .map(([m, n]) => ({ m: +m, n, rate: n / (n + (p.hits[+m] || 0)) }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);

  const songRows = Object.entries(p.songs)
    .map(([id, r]) => ({ id, r, s: LIBRARY.find((x) => x.id === id) ?? root.imported.find((x) => x.id === id) }))
    .filter((x) => x.s)
    .sort((a, b) => b.r.last - a.r.last);

  const recent = [...p.sessions].reverse().slice(0, 12);

  function download() {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `notea-sauvegarde-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 14 }}>
        <Header title={`Suivi de ${p.name}`} onBack={() => go('profile')} />

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          <div className="card center">
            <div className="title-l">{fmtMinutes(week)}</div>
            <div className="muted small">cette semaine</div>
          </div>
          <div className="card center">
            <div className="title-l">{daysPlayed}/7</div>
            <div className="muted small">jours de pratique</div>
          </div>
          <div className="card center">
            <div className="title-l">🔥 {streak(p)}</div>
            <div className="muted small">jours de suite</div>
          </div>
          <div className="card center">
            <div className="title-l">
              {lessonsDone}/{lessonsTotal}
            </div>
            <div className="muted small">leçons terminées</div>
          </div>
          <div className="card center">
            <div className="title-l">{fmtMinutes(total)}</div>
            <div className="muted small">au total</div>
          </div>
        </div>

        <div className="card col">
          <b>Minutes de pratique (14 derniers jours)</b>
          <div className="bars">
            {days.map((d) => (
              <div key={d.date} title={`${d.date} : ${Math.round(d.min)} min`}>
                <span className="lbl">{d.min >= 1 ? Math.round(d.min) : ''}</span>
                <div className="bar" style={{ height: `${(d.min / maxMin) * 90}%`, opacity: d.min >= p.dailyGoalMin ? 1 : 0.6 }} />
                <span className="lbl">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="muted small">Objectif quotidien : {p.dailyGoalMin} min (barres pleines = objectif atteint)</div>
        </div>

        <div className="card col">
          <b>Progression dans les parcours</b>
          {COURSES.map((c) => {
            const done = c.lessons.filter((l) => lessonStars(l, p.lessonSteps).complete).length;
            return (
              <div key={c.id} className="col" style={{ gap: 4 }}>
                <div className="row small">
                  <span className="grow">
                    {c.emoji} {c.title}
                  </span>
                  <span className="muted">
                    {done}/{c.lessons.length}
                  </span>
                </div>
                <div className="progress">
                  <div style={{ width: `${(done / c.lessons.length) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {tricky.length > 0 && (
          <div className="card col">
            <b>Notes qui posent problème</b>
            <div className="muted small">Ces notes sont souvent manquées ; elles reviennent automatiquement dans l’entraînement du jour.</div>
            <div className="row wrap">
              {tricky.map((t) => (
                <span key={t.m} className="chip">
                  {midiNameWithOctave(t.m, p.settings.noteNames)} · {Math.round(t.rate * 100)} % d’erreurs
                </span>
              ))}
            </div>
          </div>
        )}

        {songRows.length > 0 && (
          <div className="card">
            <b>Morceaux</b>
            <table className="table">
              <thead>
                <tr>
                  <th>Morceau</th>
                  <th>Meilleur</th>
                  <th>Joué</th>
                </tr>
              </thead>
              <tbody>
                {songRows.map(({ id, r, s }) => (
                  <tr key={id}>
                    <td>{s!.title}</td>
                    <td>
                      <Stars n={r.stars} size={13} /> {Math.round(r.accuracy * 100)} %
                    </td>
                    <td>{r.plays}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {recent.length > 0 && (
          <div className="card">
            <b>Dernières activités</b>
            <table className="table">
              <tbody>
                {recent.map((s, i) => (
                  <tr key={i}>
                    <td className="muted small">{new Date(s.ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{s.title}</td>
                    <td>{s.stars !== undefined ? <Stars n={s.stars} size={12} /> : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card col">
          <b>Réglages parents</b>
          <div className="field">
            <label>Objectif quotidien : {p.dailyGoalMin} min</label>
            <input type="range" min={5} max={60} step={5} value={p.dailyGoalMin} onChange={(e) => updateProfile((q) => ({ ...q, dailyGoalMin: +e.target.value }))} />
          </div>
          <Toggle
            label="Débloquer toutes les leçons"
            hint="Utile si le professeur fait travailler un morceau plus avancé."
            value={!!p.unlockAll}
            onChange={(v) => updateProfile((q) => ({ ...q, unlockAll: v }))}
          />
          <div className="row wrap">
            <button className="btn small" onClick={download}>
              💾 Sauvegarder la progression
            </button>
            <button className="btn small" onClick={() => fileRef.current?.click()}>
              📂 Restaurer une sauvegarde
            </button>
            <button
              className="btn small"
              onClick={() => {
                if (confirm('Changer le code parent ?')) setParentPin(null);
                go('profile');
              }}
            >
              🔑 Changer le code
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                importBackup(await f.text());
                setMsg('Sauvegarde restaurée ✔');
              } catch (er: any) {
                setMsg(String(er?.message || er));
              }
            }}
          />
          {msg && <div className="small">{msg}</div>}
          <div className="muted small">
            La progression est enregistrée uniquement sur cet appareil. Pour passer du téléphone à l’iPad, sauvegarde ici puis restaure le fichier sur l’autre appareil.
          </div>
          {Object.keys(root.profiles).length > 1 && (
            <button
              className="btn small"
              style={{ alignSelf: 'flex-start', color: 'var(--bad)' }}
              onClick={() => confirm(`Supprimer définitivement le profil de ${p.name} ?`) && deleteProfile(p.id)}
            >
              Supprimer ce profil
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ onboarding */

const AVATARS = ['🦄', '🐱', '🐼', '🦊', '🐸', '🐧', '🦋', '🌸', '⭐', '🎧', '🚀', '🐬', '🦁', '🐨', '🍓', '🌈'];

export function Onboarding({ onDone }: { onDone?: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦄');
  const [level, setLevel] = useState(1);
  const [goal, setGoal] = useState(15);

  const finish = () => {
    createProfile(name.trim() || 'Pianiste', avatar, level, goal);
    // iPad / Safari: no Web MIDI, listen with the microphone instead
    if (!supportsMidi()) updateSettings({ input: 'mic' });
    onDone?.();
    go('home');
  };

  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 18, maxWidth: 520 }}>
        {step === 0 && (
          <div className="info-step">
            <div className="info-emoji">🎹</div>
            <h1 className="title-xl">Bienvenue dans Notéa</h1>
            <div className="info-text muted">
              Apprends le piano à ton rythme : l’appli écoute ce que tu joues sur ton vrai piano et t’aide note après note.
            </div>
            <button className="btn primary" onClick={() => setStep(1)}>
              Commencer
            </button>
          </div>
        )}
        {step === 1 && (
          <>
            <h1 className="title-xl">Comment tu t’appelles ?</h1>
            <input className="text-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" maxLength={20} />
            <b>Choisis ton avatar</b>
            <div className="avatar-pick">
              {AVATARS.map((a) => (
                <button key={a} className={a === avatar ? 'on' : ''} onClick={() => setAvatar(a)}>
                  {a}
                </button>
              ))}
            </div>
            <button className="btn primary" disabled={!name.trim()} onClick={() => setStep(2)}>
              Suivant
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="title-xl">Où en es-tu au piano ?</h1>
            {[
              [1, '🐣 Je débute', 'Je commence tout juste'],
              [2, '🎵 Je connais Do Ré Mi', 'Je sais jouer quelques notes avec la main droite'],
              [3, '📖 Je lis un peu les notes', 'Je lis la clé de sol et je connais noires et blanches'],
              [5, '🙌 Je joue à deux mains', 'Je joue déjà des petits morceaux à deux mains'],
            ].map(([v, t, d]) => (
              <button key={v} className={`choice ${level === v ? 'on' : ''}`} onClick={() => setLevel(v as number)}>
                <b>{t}</b>
                <div className="muted small">{d}</div>
              </button>
            ))}
            <button className="btn primary" onClick={() => setStep(3)}>
              Suivant
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="title-xl">Ton objectif chaque jour</h1>
            {[
              [10, '10 minutes', 'Tranquille'],
              [15, '15 minutes', 'Régulier'],
              [20, '20 minutes', 'Motivé'],
              [30, '30 minutes', 'À fond !'],
            ].map(([v, t, d]) => (
              <button key={v} className={`choice ${goal === v ? 'on' : ''}`} onClick={() => setGoal(v as number)}>
                <b>{t}</b> <span className="muted">· {d}</span>
              </button>
            ))}
            <button className="btn primary" onClick={() => setStep(4)}>
              Suivant
            </button>
          </>
        )}
        {step === 4 && (
          <div className="info-step">
            <div className="info-emoji">🔌</div>
            <h1 className="title-xl">Branche ton piano</h1>
            <div className="info-text">
              Relie le <b>Clavinova</b> (prise <b>USB TO HOST</b>) au téléphone avec un câble <b>USB-B vers USB-C</b>. Quand Chrome demande l’accès aux appareils MIDI, réponds <b>Autoriser</b>.
            </div>
            <div className="muted small">Sur iPad, l’appli utilisera le micro. Tu peux changer ça plus tard dans les réglages.</div>
            <button className="btn primary" onClick={finish}>
              C’est parti ! 🎉
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NewProfile() {
  return <Onboarding />;
}
