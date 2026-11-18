import { useEffect, useMemo, useRef, useState } from 'react';
import type { HandSel, Song } from '../music/types';
import { PlaySession, type PlayMode, type SessionResult } from '../engine/session';
import { StaffRenderer } from '../render/staff';
import { drawFalling } from '../render/falling';
import { drawKeyboard, keyAt, makeLayout, rangeFor, type KeyLayout } from '../render/keyboard';
import { held, onNoteOff, onNoteOn, emitNoteOff, emitNoteOn } from '../input/hub';
import { connectBluetooth, connectMidi, hasMidiOut, midiAllOff, midiOutNote, midiState, onMidiState, supportsBluetooth, type MidiStatus } from '../input/midi';
import { micError, startMic, stopMic } from '../input/mic';
import * as synth from '../audio/synth';
import { useProfile, updateSettings } from '../store/store';
import { barCount, barStart, midiName } from '../music/theory';

export interface PlayerConfig {
  hands: HandSel;
  mode: 'wait' | 'rhythm';
  tempo: number;
  hints: 'always' | 'auto' | 'never';
  names?: boolean;
  anyKey?: boolean;
  metronome?: boolean;
  /** lesson mode: hands / mode can't be changed */
  locked?: boolean;
}

interface Props {
  song: Song;
  config: PlayerConfig;
  subtitle?: string;
  onExit: () => void;
  onDone?: (r: SessionResult) => void;
  /** label of the "continue" button on the result screen */
  nextLabel?: string;
  onNext?: () => void;
}

const HINT_DELAY = { always: 0, auto: 1600, never: 1e9 };

export function Player({ song, config, subtitle, onExit, onDone, nextLabel, onNext }: Props) {
  const profile = useProfile()!;
  const settings = profile.settings;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [hands, setHands] = useState<HandSel>(config.hands);
  const [mode, setMode] = useState<'wait' | 'rhythm'>(config.mode);
  const [tempo, setTempo] = useState(config.tempo);
  const [metronome, setMetronome] = useState(config.metronome ?? config.mode === 'rhythm');
  const [loop, setLoop] = useState<{ from: number; to: number } | null>(null);
  const [view, setView] = useState(settings.view);
  const [names, setNames] = useState(config.names ?? settings.showNoteNames);
  const [phase, setPhase] = useState<'ready' | 'playing' | 'paused' | 'done' | 'demo'>('ready');
  const [result, setResult] = useState<SessionResult | null>(null);
  const [panel, setPanel] = useState<null | 'tempo' | 'options' | 'loop'>(null);
  const [midi, setMidi] = useState<MidiStatus>(midiState().status);
  const [toast, setToast] = useState<string | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef<PlaySession | null>(null);
  const recentOut = useRef(new Map<number, number>());
  const touchPressed = useRef(new Map<number, number>());
  const layoutRef = useRef<KeyLayout | null>(null);
  const kbRect = useRef({ y: 0, h: 0 });

  const staff = useMemo(() => new StaffRenderer(song), [song]);
  const range = useMemo(() => rangeFor(song.notes.map((n) => n.midi), 24), [song]);
  const bars = useMemo(() => barCount(song), [song]);

  useEffect(() => onMidiState((s) => setMidi(s.status)), []);

  // input source lifecycle
  useEffect(() => {
    if (settings.input === 'mic') {
      startMic().then((ok) => !ok && flash(micError() ?? 'Micro indisponible'));
      return () => stopMic();
    }
    if (settings.input === 'midi' && midiState().status === 'idle') connectMidi();
  }, [settings.input]);

  useEffect(() => {
    synth.setVolume(settings.volume);
  }, [settings.volume]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), Math.max(2200, msg.length * 60));
  }

  const playAuto = (m: number, durSec: number, vel: number) => {
    const st = settingsRef.current;
    const useMidi = st.midiOut && hasMidiOut() && st.input === 'midi';
    if (useMidi) {
      recentOut.current.set(m, performance.now());
      midiOutNote(m, durSec * 1000, vel);
    } else if (st.appSound) {
      synth.playNote(m, durSec, vel);
    }
  };

  function makeSession(m: PlayMode) {
    const s = new PlaySession(
      song,
      {
        mode: m,
        hands,
        tempo,
        loop,
        metronome: m === 'rhythm' && metronome,
        countIn: m !== 'wait',
        anyKey: config.anyKey,
        hintDelayMs: HINT_DELAY[config.hints],
        latencyMs: settings.latencyMs,
      },
      {
        autoNote: playAuto,
        click: (accent) => {
          if (settingsRef.current.appSound) synth.click(accent);
        },
        wrong: () => {},
        end: (r) => {
          if (m === 'demo') {
            setPhase('ready');
            return;
          }
          setResult(r);
          setPhase('done');
          if (r.stars > 0) synth.fanfare(r.stars);
          onDone?.(r);
        },
      },
    );
    return s;
  }

  // (re)create the session when the settings change
  useEffect(() => {
    sessionRef.current = makeSession(mode);
    setPhase('ready');
    setResult(null);
  }, [song, hands, mode, tempo, loop, metronome]);

  // input events
  useEffect(() => {
    const offOn = onNoteOn((e) => {
      if (e.source === 'midi') {
        const t = recentOut.current.get(e.midi);
        if (t && performance.now() - t < 90) return; // our own accompaniment echoed back
      }
      if (e.source === 'touch') synth.noteOn(e.midi, 0.7);
      setLastNote(midiName(e.midi, settings.noteNames));
      sessionRef.current?.noteOn(e.midi, e.time, performance.now());
    });
    const offOff = onNoteOff((e) => {
      if (e.source === 'touch') synth.noteOff(e.midi);
    });
    return () => {
      offOn();
      offOff();
    };
  }, [settings.noteNames]);

  // render loop
  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const loopFn = () => {
      const s = sessionRef.current;
      const now = performance.now();
      const wrap = wrapRef.current;
      if (s && wrap) {
        s.update(now);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
          layoutRef.current = null;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const kbH = Math.round(Math.min(h * (view === 'falling' ? 0.28 : 0.36), 190));
        const topH = h - kbH;
        if (!layoutRef.current || layoutRef.current.lo !== range[0]) layoutRef.current = makeLayout(range[0], range[1], w);
        const layout = layoutRef.current;
        kbRect.current = { y: topH, h: kbH };

        const opts = { names, nameStyle: settings.noteNames, fingers: settings.showFingers, dark: false };
        if (view === 'falling') {
          drawFalling(ctx, layout, w, topH, s, opts, now);
        } else {
          staff.draw(ctx, w, topH, s, opts, now);
        }

        const tg = s.currentTargets(now);
        const showTargets = config.hints === 'always' || tg.hint;
        const fingers = new Map<number, number>();
        const labels = new Map<number, string>();
        if (s.opt.mode === 'wait') {
          const g = s.groups[s.groupIdx];
          g?.notes.forEach((n) => n.finger && settings.showFingers && fingers.set(n.midi, n.finger));
        }
        for (const k of layout.keys.values()) {
          if (k.midi % 12 === 0) labels.set(k.midi, midiName(k.midi, settings.noteNames) + (Math.floor(k.midi / 12) - 1));
          if (names && showTargets && tg.midis.includes(k.midi)) labels.set(k.midi, midiName(k.midi, settings.noteNames, song.key < 0));
        }
        const pressed = new Set<number>([...held, ...touchPressed.current.keys()]);
        const wrong = new Set<number>(s.wrongFlash.filter((f) => now - f.t < 260).map((f) => f.midi));
        const auto = new Set<number>(
          s.notes.filter((n) => n.state === 'auto' && n.start <= s.beat && n.start + n.dur > s.beat).map((n) => n.midi),
        );
        ctx.fillStyle = '#1f0617';
        ctx.fillRect(0, topH, w, kbH);
        drawKeyboard(ctx, layout, topH + 3, kbH - 3, {
          pressed,
          targets: new Set(tg.midis),
          showTargets,
          wrong,
          labels,
          fingers,
          auto,
        });

        // progress bar
        ctx.fillStyle = 'rgba(255,61,154,0.95)';
        ctx.fillRect(0, 0, w * s.progress(), 3);
      }
      raf = requestAnimationFrame(loopFn);
    };
    raf = requestAnimationFrame(loopFn);
    return () => cancelAnimationFrame(raf);
  }, [view, names, staff, range, settings.noteNames, settings.showFingers, config.hints, song]);

  // stop everything when leaving
  useEffect(
    () => () => {
      synth.allNotesOff();
      midiAllOff();
    },
    [],
  );

  // on-screen keyboard (touch / mouse)
  function pointer(e: React.PointerEvent, type: 'down' | 'move' | 'up') {
    const layout = layoutRef.current;
    const wrap = wrapRef.current;
    if (!layout || !wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const id = e.pointerId;
    const prev = [...touchPressed.current.entries()].find(([, pid]) => pid === id)?.[0];
    if (type === 'up') {
      if (prev !== undefined) {
        touchPressed.current.delete(prev);
        emitNoteOff({ midi: prev, velocity: 0, time: performance.now(), source: 'touch' });
      }
      return;
    }
    if (type === 'move' && prev === undefined) return;
    const m = keyAt(layout, x, y, kbRect.current.y, kbRect.current.h);
    if (m === prev) return;
    if (prev !== undefined) {
      touchPressed.current.delete(prev);
      emitNoteOff({ midi: prev, velocity: 0, time: performance.now(), source: 'touch' });
    }
    if (m !== null) {
      synth.unlockAudio();
      touchPressed.current.set(m, id);
      emitNoteOn({ midi: m, velocity: 0.7, time: performance.now(), source: 'touch' });
    }
  }

  async function begin() {
    await synth.unlockAudio();
    if (settings.input === 'midi' && midiState().status !== 'connected') {
      const st = await connectMidi();
      if (st !== 'connected')
        flash(st === 'unsupported' ? 'MIDI indisponible : utilise le micro ou le clavier écran' : 'Piano non détecté – câble USB ou bouton Bluetooth');
    }
    const s = sessionRef.current!;
    if (s.finished || phase === 'done') {
      sessionRef.current = makeSession(mode);
    }
    sessionRef.current!.restart(performance.now());
    setResult(null);
    setPhase('playing');
  }

  function pauseResume() {
    const s = sessionRef.current!;
    if (phase === 'playing') {
      s.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      s.start(performance.now());
      setPhase('playing');
    } else if (phase === 'ready') begin();
  }

  async function listen() {
    await synth.unlockAudio();
    if (phase === 'demo') {
      sessionRef.current = makeSession(mode);
      synth.allNotesOff();
      midiAllOff();
      setPhase('ready');
      return;
    }
    if (settings.input === 'midi' && settings.midiOut && midiState().status === 'idle') await connectMidi();
    const s = makeSession('demo');
    sessionRef.current = s;
    s.restart(performance.now());
    setPhase('demo');
  }

  function restart() {
    synth.allNotesOff();
    begin();
  }

  const statusColor = settings.input === 'midi' ? (midi === 'connected' ? 'var(--ok)' : 'var(--bad)') : 'var(--warn)';
  const statusText =
    settings.input === 'midi'
      ? midi === 'connected'
        ? midiState().ble
          ? 'Piano connecté en Bluetooth'
          : 'Piano connecté'
        : midi === 'unsupported'
          ? 'MIDI non disponible sur cet appareil'
          : 'Piano non connecté'
      : settings.input === 'mic'
        ? 'Micro (une note à la fois)'
        : 'Clavier à l’écran';

  const accuracyPct = result ? Math.round(result.accuracy * 100) : 0;
  const message = result
    ? result.stars === 3
      ? 'Magnifique ! 🎉'
      : result.stars === 2
        ? 'Très bien joué !'
        : result.stars === 1
          ? 'C’est réussi ! Encore un essai pour plus d’étoiles ?'
          : 'Courage, recommence plus lentement 🐢'
    : '';

  return (
    <div className="player">
      <div className="player-top">
        <button className="icon-btn" onClick={onExit} aria-label="Quitter">
          ✕
        </button>
        <div className="player-title">
          {song.title}
          {subtitle && <div className="muted small">{subtitle}</div>}
        </div>
        <button className="icon-btn" onClick={pauseResume} aria-label="Lecture / pause" disabled={phase === 'demo'}>
          {phase === 'playing' ? '⏸' : '▶'}
        </button>
        <button className="icon-btn" onClick={restart} aria-label="Recommencer">
          ↺
        </button>
        <button className={`icon-btn ${phase === 'demo' ? 'on' : ''}`} onClick={listen} aria-label="Écouter">
          {phase === 'demo' ? '⏹' : '👂'}
        </button>
        {!config.locked && (
          <div className="seg">
            <button className={mode === 'wait' ? 'on' : ''} onClick={() => setMode('wait')}>
              Attends-moi
            </button>
            <button className={mode === 'rhythm' ? 'on' : ''} onClick={() => setMode('rhythm')}>
              En rythme
            </button>
          </div>
        )}
        {!config.locked && song.notes.some((n) => n.hand === 'L') && song.notes.some((n) => n.hand === 'R') && (
          <div className="seg">
            <button className={hands === 'R' ? 'on' : ''} onClick={() => setHands('R')}>
              MD
            </button>
            <button className={hands === 'L' ? 'on' : ''} onClick={() => setHands('L')}>
              MG
            </button>
            <button className={hands === 'both' ? 'on' : ''} onClick={() => setHands('both')}>
              2 mains
            </button>
          </div>
        )}
        <button className={`chip ${panel === 'tempo' ? 'on' : ''}`} onClick={() => setPanel(panel === 'tempo' ? null : 'tempo')}>
          🐢 {Math.round(tempo * 100)} %
        </button>
        {!config.locked && (
          <button className={`icon-btn ${loop ? 'on' : ''}`} onClick={() => setPanel(panel === 'loop' ? null : 'loop')} aria-label="Boucle">
            🔁
          </button>
        )}
        <button
          className="icon-btn"
          onClick={() => {
            const v = view === 'staff' ? 'falling' : 'staff';
            setView(v);
            updateSettings({ view: v });
          }}
          aria-label="Changer d’affichage"
        >
          {view === 'staff' ? '🌧️' : '🎼'}
        </button>
        <button className={`icon-btn ${panel === 'options' ? 'on' : ''}`} onClick={() => setPanel(panel === 'options' ? null : 'options')} aria-label="Options">
          ⚙️
        </button>
      </div>

      <div
        className="player-canvas"
        ref={wrapRef}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          pointer(e, 'down');
        }}
        onPointerMove={(e) => pointer(e, 'move')}
        onPointerUp={(e) => pointer(e, 'up')}
        onPointerCancel={(e) => pointer(e, 'up')}
      >
        <canvas ref={canvasRef} />
        {toast && <div className="toast">{toast}</div>}
        {!toast && lastNote && phase === 'playing' && settings.input === 'mic' && <div className="toast">🎤 {lastNote}</div>}
        <div className="rotate-hint">↻ Tourne ton téléphone pour mieux voir</div>

        {panel === 'tempo' && (
          <div className="popover" onPointerDown={(e) => e.stopPropagation()}>
            <div className="row">
              <b className="grow">Vitesse</b>
              <span>{Math.round(tempo * 100)} %</span>
            </div>
            <input type="range" min={30} max={130} step={5} value={Math.round(tempo * 100)} onChange={(e) => setTempo(+e.target.value / 100)} />
            <div className="row wrap" style={{ marginTop: 8 }}>
              {[50, 70, 85, 100].map((v) => (
                <button key={v} className={`chip ${Math.round(tempo * 100) === v ? 'on' : ''}`} onClick={() => setTempo(v / 100)}>
                  {v} %
                </button>
              ))}
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              Tempo : {Math.round(song.bpm * tempo)} à la noire
            </div>
          </div>
        )}

        {panel === 'loop' && (
          <LoopPanel
            bars={bars}
            song={song}
            loop={loop}
            onChange={(l) => {
              setLoop(l);
              setPanel(null);
            }}
          />
        )}

        {panel === 'options' && (
          <div className="popover" onPointerDown={(e) => e.stopPropagation()}>
            <Toggle label="Noms des notes" value={names} onChange={setNames} />
            <Toggle label="Numéros des doigts" value={settings.showFingers} onChange={(v) => updateSettings({ showFingers: v })} />
            <Toggle label="Métronome" value={metronome} onChange={setMetronome} />
            <Toggle label="Sons de l’appli" value={settings.appSound} onChange={(v) => updateSettings({ appSound: v })} />
            <div className="row small" style={{ marginTop: 8 }}>
              <span className="status-dot" style={{ background: statusColor }} />
              <span className="grow">{statusText}</span>
              {settings.input === 'midi' && midi !== 'connected' && midi !== 'unsupported' && (
                <button className="btn small" onClick={() => connectMidi()}>
                  Connecter
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'ready' && (
          <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
            <div className="card col" style={{ alignItems: 'center' }}>
              <div className="title-l">{song.title}</div>
              <div className="muted">
                {hands === 'R' ? 'Main droite' : hands === 'L' ? 'Main gauche' : 'Deux mains'} ·{' '}
                {mode === 'wait' ? 'Attends-moi : le morceau t’attend à chaque note' : 'En rythme : suis le tempo'}
                {loop ? ` · mesures ${loop.from === 0 ? 'levée' : barNum(song, loop.from)}–${barNum(song, loop.to) - 1}` : ''}
              </div>
              {config.anyKey && <div className="chip">🥁 N’importe quelle touche : seul le rythme compte</div>}
              <div className="row small wrap" style={{ justifyContent: 'center' }}>
                <span className="status-dot" style={{ background: statusColor }} />
                <span>{statusText}</span>
                {settings.input === 'midi' && midi !== 'connected' && supportsBluetooth() && (
                  <button className="btn small" onClick={() => connectBluetooth().then((ok) => ok && flash('Piano connecté en Bluetooth 🎹'))}>
                    📶 Bluetooth
                  </button>
                )}
              </div>
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={listen}>
                  👂 Écouter
                </button>
                <button className="btn primary" onClick={begin}>
                  ▶ C’est parti !
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
            <div className="card col" style={{ alignItems: 'center' }}>
              <div className="title-l">Pause</div>
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={restart}>
                  ↺ Recommencer
                </button>
                <button className="btn primary" onClick={pauseResume}>
                  ▶ Reprendre
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
            <div className="card col" style={{ alignItems: 'center' }}>
              <div className="big-stars">
                {[1, 2, 3].map((i) => (
                  <span key={i} className={i <= result.stars ? 'star-on' : 'star-off'}>
                    ★
                  </span>
                ))}
              </div>
              <div className="title-l">{message}</div>
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <div className="stat" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <b>{accuracyPct} %</b>
                  <span>notes justes</span>
                </div>
                {result.timing !== null && (
                  <div className="stat" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <b>{Math.round(result.timing * 100)} %</b>
                    <span>rythme</span>
                  </div>
                )}
                {result.assisted > 0 && (
                  <div className="stat" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <b>{result.assisted}</b>
                    <span>avec aide</span>
                  </div>
                )}
                {result.wrong > 0 && (
                  <div className="stat" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <b>{result.wrong}</b>
                    <span>fausses notes</span>
                  </div>
                )}
              </div>
              {tempo < 1 && result.stars === 3 && <div className="muted small">Bravo ! Essaie un peu plus vite la prochaine fois 🐇</div>}
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <button className="btn" onClick={restart}>
                  ↺ Rejouer
                </button>
                {onNext ? (
                  <button className="btn primary" onClick={onNext}>
                    {nextLabel ?? 'Continuer'} →
                  </button>
                ) : (
                  <button className="btn primary" onClick={onExit}>
                    Terminer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function barNum(song: Song, beat: number) {
  const bpb = (song.timeSig[0] * 4) / song.timeSig[1];
  if (beat < song.pickup) return 0;
  return Math.round((beat - song.pickup) / bpb) + 1;
}

function LoopPanel({ bars, song, loop, onChange }: { bars: number; song: Song; loop: { from: number; to: number } | null; onChange: (l: { from: number; to: number } | null) => void }) {
  const first = song.pickup > 0 ? 0 : 1;
  const [a, setA] = useState(loop ? barNum(song, loop.from) : first);
  const [b, setB] = useState(loop ? barNum(song, loop.to) - 1 : Math.min(bars, first + 3));
  const opts = [];
  for (let i = first; i <= bars; i++) opts.push(i);
  return (
    <div className="popover col" onPointerDown={(e) => e.stopPropagation()}>
      <b>Travailler un passage</b>
      <div className="muted small">Le passage choisi se répète en boucle.</div>
      <div className="row">
        <span>De la mesure</span>
        <select className="text-input" value={a} onChange={(e) => setA(+e.target.value)}>
          {opts.map((i) => (
            <option key={i} value={i}>
              {i === 0 ? 'levée' : i}
            </option>
          ))}
        </select>
        <span>à</span>
        <select className="text-input" value={b} onChange={(e) => setB(+e.target.value)}>
          {opts.filter((i) => i >= a).map((i) => (
            <option key={i} value={i}>
              {i === 0 ? 'levée' : i}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        {loop && (
          <button className="btn small" onClick={() => onChange(null)}>
            Arrêter la boucle
          </button>
        )}
        <button className="btn small primary grow" onClick={() => onChange({ from: barStart(song, a), to: barStart(song, Math.max(a, b) + 1) })}>
          Boucler
        </button>
      </div>
    </div>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button className="toggle" style={{ width: '100%', textAlign: 'left' }} onClick={() => onChange(!value)}>
      <span>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint && <div className="muted small">{hint}</div>}
      </span>
      <span className={`switch ${value ? 'on' : ''}`} />
    </button>
  );
}
