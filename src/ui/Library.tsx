import { useRef, useState } from 'react';
import { LIBRARY, findSong } from '../content/songs';
import { importFile } from '../import/importers';
import type { HandSel } from '../music/types';
import { keyName } from '../music/theory';
import { addImported, recordActivity, recordSongResult, removeImported, useProfile, useRoot } from '../store/store';
import { Header, Stars, go } from './common';
import { Player } from './Player';

const LEVELS = ['Tous', '★', '★★', '★★★', '★★★★'];

export function Library() {
  const p = useProfile()!;
  const root = useRoot();
  const [level, setLevel] = useState(0);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = LIBRARY.filter((s) => (level === 0 || s.level === level) && (!q || (s.title + ' ' + s.composer).toLowerCase().includes(q.toLowerCase())));

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    try {
      const s = await importFile(f);
      addImported(s);
      go(`song/${s.id}`);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  return (
    <div className="screen">
      <div className="screen-inner">
        <Header title="Morceaux" />
        <input className="text-input" placeholder="🔍 Chercher un morceau…" value={q} onChange={(e) => setQ(e.target.value)} style={{ fontSize: 16 }} />
        <div className="row wrap" style={{ margin: '12px 0' }}>
          {LEVELS.map((l, i) => (
            <button key={i} className={`chip ${level === i ? 'on' : ''}`} onClick={() => setLevel(i)}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid">
          {list.map((s) => {
            const r = p.songs[s.id];
            return (
              <button key={s.id} className="card col" style={{ textAlign: 'left', gap: 6 }} onClick={() => go(`song/${s.id}`)}>
                <div className="row">
                  <b className="grow">{s.title}</b>
                  <span className="badge-level">{'★'.repeat(s.level)}</span>
                </div>
                <div className="muted small">{s.composer}</div>
                <div className="row small">
                  <span className="grow muted">{s.notes.some((n) => n.hand === 'L') ? '🙌 2 mains possibles' : '✋ Main droite'}</span>
                  {r ? <Stars n={r.stars} size={14} /> : <span className="muted">Nouveau</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="section-title">Mes partitions importées</div>
        <div className="card col">
          <div className="muted small">
            Importe un fichier <b>MIDI</b> (.mid) ou <b>MusicXML</b> (.musicxml, .mxl) : par exemple un morceau donné par ton professeur, ou exporté depuis MuseScore.
          </div>
          <input ref={fileRef} type="file" accept=".mid,.midi,.xml,.musicxml,.mxl,audio/midi,audio/x-midi" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => fileRef.current?.click()}>
            📂 Importer une partition
          </button>
          {err && <div style={{ color: 'var(--bad)' }}>{err}</div>}
          {root.imported.length > 0 && (
            <div className="col">
              {root.imported.map((s) => (
                <div key={s.id} className="row">
                  <button className="grow choice" onClick={() => go(`song/${s.id}`)}>
                    🎼 {s.title} <span className="muted small">· {s.notes.length} notes</span>
                  </button>
                  <button className="icon-btn" aria-label="Supprimer" onClick={() => confirm(`Supprimer « ${s.title} » ?`) && removeImported(s.id)}>
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SongScreen({ id }: { id: string }) {
  const p = useProfile()!;
  const root = useRoot();
  const song = findSong(id, root.imported);
  const twoHands = !!song && song.notes.some((n) => n.hand === 'L') && song.notes.some((n) => n.hand === 'R');
  const [hands, setHands] = useState<HandSel>(twoHands && song!.level >= 3 ? 'both' : song?.notes.some((n) => n.hand === 'R') ? 'R' : 'L');
  const [mode, setMode] = useState<'wait' | 'rhythm'>('wait');
  const [tempo, setTempo] = useState(song && song.level >= 3 ? 0.8 : 1);
  const [playing, setPlaying] = useState(false);
  if (!song) return <div className="screen">Morceau introuvable.</div>;
  const r = p.songs[song.id];

  if (playing) {
    return (
      <Player
        song={song}
        config={{ hands, mode, tempo, hints: 'auto' }}
        onExit={() => setPlaying(false)}
        onDone={(res) => {
          recordSongResult(song.id, res.stars, res.accuracy);
          recordActivity(
            { kind: 'song', ref: song.id, title: song.title, seconds: res.seconds, accuracy: res.accuracy, stars: res.stars },
            res.stats,
            { twoHands: hands === 'both' },
          );
        }}
      />
    );
  }

  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 14 }}>
        <Header title={song.title} onBack={() => go('songs')} />
        <div className="card col">
          <div className="row">
            <div className="grow">
              <div className="muted">{song.composer}</div>
              <div className="muted small">
                {keyName(song.key)} · {song.timeSig[0]}/{song.timeSig[1]} · {song.bpm} à la noire · niveau {'★'.repeat(song.level)}
              </div>
            </div>
            {r && (
              <div className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                <Stars n={r.stars} size={20} />
                <span className="muted small">
                  meilleur : {Math.round(r.accuracy * 100)} % · joué {r.plays}×
                </span>
              </div>
            )}
          </div>
          {song.description && <div className="muted small">{song.description}</div>}
        </div>

        <div className="card col">
          <b>Comment veux-tu jouer ?</b>
          {twoHands && (
            <div className="seg" style={{ alignSelf: 'flex-start' }}>
              <button className={hands === 'R' ? 'on' : ''} onClick={() => setHands('R')}>
                ✋ Main droite
              </button>
              <button className={hands === 'L' ? 'on' : ''} onClick={() => setHands('L')}>
                🫲 Main gauche
              </button>
              <button className={hands === 'both' ? 'on' : ''} onClick={() => setHands('both')}>
                🙌 2 mains
              </button>
            </div>
          )}
          <button className={`choice ${mode === 'wait' ? 'on' : ''}`} onClick={() => setMode('wait')}>
            <b>⏳ Attends-moi</b>
            <div className="muted small">Le morceau s’arrête sur chaque note jusqu’à ce que tu la joues. Idéal pour apprendre.</div>
          </button>
          <button className={`choice ${mode === 'rhythm' ? 'on' : ''}`} onClick={() => setMode('rhythm')}>
            <b>🥁 En rythme</b>
            <div className="muted small">Le morceau avance au tempo, avec le métronome. On vérifie aussi ton rythme.</div>
          </button>
          <div className="field">
            <label>Vitesse : {Math.round(tempo * 100)} %</label>
            <input type="range" min={30} max={130} step={5} value={Math.round(tempo * 100)} onChange={(e) => setTempo(+e.target.value / 100)} />
          </div>
          <button className="btn primary block" onClick={() => setPlaying(true)}>
            ▶ Jouer
          </button>
        </div>
      </div>
    </div>
  );
}
