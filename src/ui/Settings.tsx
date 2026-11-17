import { useEffect, useState } from 'react';
import { connectMidi, midiState, onMidiState, supportsMidi, type MidiStatus } from '../input/midi';
import { startMic, stopMic, supportsMic } from '../input/mic';
import { onNoteOn } from '../input/hub';
import { midiNameWithOctave } from '../music/theory';
import { updateSettings, useProfile, useRoot, switchProfile } from '../store/store';
import { Header, go } from './common';
import { Toggle } from './Player';
import { click, unlockAudio, setVolume } from '../audio/synth';

export function useMidiStatus() {
  const [s, setS] = useState(midiState());
  useEffect(() => onMidiState(setS), []);
  return s;
}

export function ConnectionPill() {
  const p = useProfile()!;
  const m = useMidiStatus();
  const input = p.settings.input;
  const ok = input !== 'midi' || m.status === 'connected';
  const label = input === 'midi' ? (m.status === 'connected' ? 'Piano connecté' : 'Connecter le piano') : input === 'mic' ? 'Micro' : 'Clavier écran';
  return (
    <button
      className="chip"
      style={{ background: ok ? 'rgba(54,208,126,0.25)' : 'rgba(255,90,110,0.3)' }}
      onClick={async () => {
        if (input === 'midi' && m.status !== 'connected') {
          const st = await connectMidi();
          if (st !== 'connected') go('settings');
        } else go('settings');
      }}
    >
      {input === 'midi' ? '🎹' : input === 'mic' ? '🎤' : '📱'} {label}
    </button>
  );
}

const STATUS_TEXT: Record<MidiStatus, string> = {
  unsupported: 'Ce navigateur ne gère pas le MIDI. Sur Android, utilise Chrome. Sur iPad, choisis le micro.',
  idle: 'Pas encore connecté.',
  denied: 'Accès MIDI refusé. Autorise « Contrôler les appareils MIDI » dans les réglages du site.',
  'no-device': 'Aucun piano détecté. Vérifie le câble USB et que le piano est allumé.',
  connected: 'Piano connecté !',
};

export function SettingsScreen() {
  const p = useProfile()!;
  const root = useRoot();
  const s = p.settings;
  const m = useMidiStatus();
  const [test, setTest] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);

  useEffect(() => onNoteOn((e) => setTest(`${midiNameWithOctave(e.midi, s.noteNames)} (${e.source === 'midi' ? 'piano' : e.source === 'mic' ? 'micro' : 'écran'})`)), [s.noteNames]);
  useEffect(() => () => stopMic(), []);

  return (
    <div className="screen">
      <div className="screen-inner col" style={{ gap: 14 }}>
        <Header title="Réglages" onBack={() => go('profile')} />

        <div className="card col">
          <b>Comment l’appli entend ton piano</b>
          <div className="seg" style={{ alignSelf: 'flex-start', flexWrap: 'wrap' }}>
            <button className={s.input === 'midi' ? 'on' : ''} onClick={() => updateSettings({ input: 'midi' })}>
              🎹 Câble USB (MIDI)
            </button>
            <button className={s.input === 'mic' ? 'on' : ''} onClick={() => updateSettings({ input: 'mic' })}>
              🎤 Micro
            </button>
            <button className={s.input === 'touch' ? 'on' : ''} onClick={() => updateSettings({ input: 'touch' })}>
              📱 Écran
            </button>
          </div>

          {s.input === 'midi' && (
            <>
              <div className="muted small">
                Branche un câble <b>USB-B → USB-C</b> (ou un adaptateur OTG) entre la prise <b>USB TO HOST</b> du Clavinova et le téléphone. Ouvre l’appli dans <b>Chrome</b>.
              </div>
              <div className="row">
                <span className="status-dot" style={{ background: m.status === 'connected' ? 'var(--ok)' : 'var(--bad)' }} />
                <span className="grow">{STATUS_TEXT[m.status]}</span>
                {supportsMidi() && m.status !== 'connected' && (
                  <button className="btn small primary" onClick={() => connectMidi()}>
                    Connecter
                  </button>
                )}
              </div>
              {m.inputs.length > 0 && <div className="muted small">Entrée : {m.inputs.join(', ')}</div>}
              <Toggle
                label="Le piano joue les démos et l’accompagnement"
                hint="L’appli envoie les notes au Clavinova : tu entends l’autre main sur ton vrai piano."
                value={s.midiOut}
                onChange={(v) => updateSettings({ midiOut: v })}
              />
            </>
          )}
          {s.input === 'mic' && (
            <>
              <div className="muted small">
                Pose la tablette sur le pupitre. Le micro reconnaît une note à la fois : parfait pour les mélodies, moins pour les accords. Pour l’iPad, c’est le mode conseillé (Safari ne gère pas le MIDI).
              </div>
              {supportsMic() && (
                <button
                  className="btn small"
                  onClick={async () => {
                    if (micOn) {
                      stopMic();
                      setMicOn(false);
                    } else setMicOn(await startMic());
                  }}
                >
                  {micOn ? 'Arrêter le test du micro' : 'Tester le micro'}
                </button>
              )}
            </>
          )}
          {s.input === 'touch' && <div className="muted small">Pour jouer sur l’écran, sans piano (pratique pour essayer).</div>}
          <div className="card" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="muted small">Test : joue une note</div>
            <div className="title-l">{test ?? '…'}</div>
          </div>
        </div>

        <div className="card col">
          <b>Affichage</b>
          <div className="row">
            <span className="grow">Nom des notes</span>
            <div className="seg">
              <button className={s.noteNames === 'solfege' ? 'on' : ''} onClick={() => updateSettings({ noteNames: 'solfege' })}>
                Do Ré Mi
              </button>
              <button className={s.noteNames === 'letters' ? 'on' : ''} onClick={() => updateSettings({ noteNames: 'letters' })}>
                C D E
              </button>
            </div>
          </div>
          <div className="row">
            <span className="grow">Affichage par défaut</span>
            <div className="seg">
              <button className={s.view === 'staff' ? 'on' : ''} onClick={() => updateSettings({ view: 'staff' })}>
                🎼 Partition
              </button>
              <button className={s.view === 'falling' ? 'on' : ''} onClick={() => updateSettings({ view: 'falling' })}>
                🌧️ Notes qui tombent
              </button>
            </div>
          </div>
          <Toggle label="Afficher le nom des notes" value={s.showNoteNames} onChange={(v) => updateSettings({ showNoteNames: v })} />
          <Toggle label="Afficher les doigtés" value={s.showFingers} onChange={(v) => updateSettings({ showFingers: v })} />
        </div>

        <div className="card col">
          <b>Son</b>
          <Toggle label="Sons de l’appli (métronome, démo)" value={s.appSound} onChange={(v) => updateSettings({ appSound: v })} />
          <div className="field">
            <label>Volume de l’appli</label>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(s.volume * 100)}
              onChange={(e) => {
                updateSettings({ volume: +e.target.value / 100 });
                setVolume(+e.target.value / 100);
              }}
            />
          </div>
          <div className="field">
            <label>Compensation de latence : {s.latencyMs} ms</label>
            <input type="range" min={0} max={250} step={10} value={s.latencyMs} onChange={(e) => updateSettings({ latencyMs: +e.target.value })} />
            <div className="muted small">
              Si l’appli dit souvent « en retard » alors que tu joues bien en rythme (micro, Bluetooth), augmente cette valeur.
            </div>
            <button
              className="btn small"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                await unlockAudio();
                click(true);
              }}
            >
              Tester le son
            </button>
          </div>
        </div>

        <div className="card col">
          <b>Profils</b>
          {Object.values(root.profiles).map((q) => (
            <button key={q.id} className={`choice ${q.id === p.id ? 'on' : ''}`} onClick={() => switchProfile(q.id)}>
              {q.avatar} {q.name}
            </button>
          ))}
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => go('new-profile')}>
            + Ajouter un profil
          </button>
        </div>
      </div>
    </div>
  );
}
