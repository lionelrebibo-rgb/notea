import { Midi } from '@tonejs/midi';
import { unzipSync, strFromU8 } from 'fflate';
import type { Hand, Note, Rest, Song } from '../music/types';
import { LETTERS, spellMidi, spelledToMidi } from '../music/theory';

const q = (x: number, grid = 0.125) => Math.round(x / grid) * grid;

function finalize(partial: Omit<Song, 'id' | 'level' | 'imported' | 'composer'> & { composer?: string }, name: string): Song {
  const notes = partial.notes.filter((n) => n.dur > 0).sort((a, b) => a.start - b.start || a.midi - b.midi);
  const first = notes.length ? notes[0].start : 0;
  // estimate difficulty from note density, range and hands
  const end = notes.reduce((m, n) => Math.max(m, n.start + n.dur), 0);
  const density = notes.length / Math.max(1, end);
  const twoHands = notes.some((n) => n.hand === 'L') && notes.some((n) => n.hand === 'R');
  const level = Math.min(5, Math.max(1, Math.round(density * 1.2 + (twoHands ? 1 : 0) + (Math.abs(partial.key) > 2 ? 1 : 0))));
  return {
    ...partial,
    composer: partial.composer || 'Importé',
    id: `imp-${Date.now().toString(36)}`,
    title: partial.title || name.replace(/\.[^.]+$/, ''),
    level,
    imported: true,
    notes: first > 0 && first >= 4 ? notes.map((n) => ({ ...n, start: n.start - Math.floor(first / 4) * 4 })) : notes,
  };
}

/* ------------------------------------------------------------------ MIDI */

export function importMidi(buf: ArrayBuffer, name: string): Song {
  const midi = new Midi(buf);
  const ppq = midi.header.ppq || 480;
  const tempo = midi.header.tempos[0]?.bpm ?? 100;
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const ks = midi.header.keySignatures[0];
  const keyMap: Record<string, number> = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
  let key = ks ? keyMap[ks.key] ?? 0 : 0;
  if (ks?.scale === 'minor') {
    const minorMap: Record<string, number> = { A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, D: -1, G: -2, C: -3, F: -4, Bb: -5 };
    key = minorMap[ks.key] ?? 0;
  }
  const tracks = midi.tracks.filter((t) => t.notes.length && t.channel !== 9);
  if (!tracks.length) throw new Error('Aucune note trouvée dans ce fichier MIDI.');
  const notes: Note[] = [];
  const flats = key < 0;
  const split = tracks.length === 1;
  tracks.slice(0, 2).forEach((t, ti) => {
    for (const n of t.notes) {
      const start = q(n.ticks / ppq);
      const dur = Math.max(0.125, q(n.durationTicks / ppq));
      let hand: Hand = ti === 0 ? 'R' : 'L';
      if (split) hand = n.midi >= 60 ? 'R' : 'L';
      const s = spellMidi(n.midi, flats);
      notes.push({ midi: n.midi, start, dur, hand, step: s.step, alter: s.alter });
    }
  });
  // if two tracks but the first is lower, swap
  if (!split) {
    const avg = (h: Hand) => {
      const xs = notes.filter((n) => n.hand === h);
      return xs.reduce((a, n) => a + n.midi, 0) / Math.max(1, xs.length);
    };
    if (avg('R') < avg('L')) for (const n of notes) n.hand = n.hand === 'R' ? 'L' : 'R';
  }
  return finalize(
    {
      title: midi.name || '',
      bpm: Math.round(tempo),
      timeSig: [ts[0], ts[1]] as [number, number],
      key,
      pickup: 0,
      notes,
      rests: [],
    },
    name,
  );
}

/* ------------------------------------------------------------- MusicXML */

function text(el: Element | null | undefined, sel: string): string | null {
  const x = el?.querySelector(sel);
  return x ? x.textContent : null;
}

export function importMusicXml(xml: string, name: string): Song {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Fichier MusicXML illisible.');
  const title = text(doc.documentElement, 'work > work-title') || text(doc.documentElement, 'movement-title') || '';
  const composer = text(doc.documentElement, 'identification > creator[type="composer"]') || '';
  const parts = Array.from(doc.querySelectorAll('part'));
  if (!parts.length) throw new Error('Aucune partie trouvée.');

  const notes: Note[] = [];
  const rests: Rest[] = [];
  let key = 0;
  let timeSig: [number, number] = [4, 4];
  let bpm = 0;
  let pickup = 0;

  // Piano scores: one part with 2 staves. Otherwise: first part = right hand, second = left hand.
  parts.slice(0, 2).forEach((part, pi) => {
    let divisions = 1;
    let t = 0; // beats
    let lastStart = 0;
    const measures = Array.from(part.querySelectorAll(':scope > measure'));
    measures.forEach((m, mi) => {
      const measureStart = t;
      let maxT = t;
      for (const el of Array.from(m.children)) {
        if (el.tagName === 'attributes') {
          const d = text(el, 'divisions');
          if (d) divisions = parseFloat(d);
          const f = text(el, 'key > fifths');
          if (f !== null && pi === 0 && mi === 0) key = parseInt(f, 10);
          const beats = text(el, 'time > beats');
          const bt = text(el, 'time > beat-type');
          if (beats && bt && pi === 0 && mi === 0) timeSig = [parseInt(beats, 10), parseInt(bt, 10)];
        } else if (el.tagName === 'direction' || el.tagName === 'sound') {
          const snd = el.tagName === 'sound' ? el : el.querySelector('sound');
          const tp = snd?.getAttribute('tempo');
          if (tp && !bpm) bpm = parseFloat(tp);
        } else if (el.tagName === 'backup') {
          t -= parseFloat(text(el, 'duration') || '0') / divisions;
        } else if (el.tagName === 'forward') {
          t += parseFloat(text(el, 'duration') || '0') / divisions;
          maxT = Math.max(maxT, t);
        } else if (el.tagName === 'note') {
          if (el.querySelector('grace')) continue;
          const dur = parseFloat(text(el, 'duration') || '0') / divisions;
          const isChord = !!el.querySelector('chord');
          const start = isChord ? lastStart : t;
          const staff = parseInt(text(el, 'staff') || '1', 10);
          const hand: Hand = parts.length > 1 ? (pi === 0 ? 'R' : 'L') : staff >= 2 ? 'L' : 'R';
          const tieStop = Array.from(el.querySelectorAll('tie')).some((x) => x.getAttribute('type') === 'stop');
          if (el.querySelector('rest')) {
            if (!el.querySelector('rest')?.getAttribute('measure') || dur > 0) rests.push({ start: q(start), dur: q(dur), hand });
          } else {
            const stepL = text(el, 'pitch > step') || 'C';
            const alter = Math.round(parseFloat(text(el, 'pitch > alter') || '0'));
            const octave = parseInt(text(el, 'pitch > octave') || '4', 10);
            const step = LETTERS.indexOf(stepL);
            const midi = spelledToMidi(step, alter, octave);
            const fingerTxt = text(el, 'notations fingering');
            if (tieStop) {
              // extend the previous note instead of re-striking it
              const prev = [...notes].reverse().find((n) => n.midi === midi && n.hand === hand && Math.abs(n.start + n.dur - start) < 0.02);
              if (prev) prev.dur = q(prev.dur + dur);
            } else {
              notes.push({ midi, start: q(start), dur: q(Math.max(dur, 0.125)), hand, step, alter, finger: fingerTxt ? parseInt(fingerTxt, 10) || undefined : undefined });
            }
          }
          if (!isChord) {
            lastStart = t;
            t += dur;
          }
          maxT = Math.max(maxT, t);
        }
      }
      t = Math.max(t, maxT);
      if (mi === 0 && pi === 0 && m.getAttribute('implicit') === 'yes') pickup = t - measureStart;
    });
  });

  return finalize({ title, composer, bpm: Math.round(bpm || 90), timeSig, key, pickup, notes, rests }, name);
}

export async function importFile(file: File): Promise<Song> {
  const lower = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  if (lower.endsWith('.mid') || lower.endsWith('.midi')) return importMidi(buf, file.name);
  if (lower.endsWith('.mxl')) {
    const files = unzipSync(new Uint8Array(buf));
    const container = files['META-INF/container.xml'];
    let path = Object.keys(files).find((k) => !k.startsWith('META-INF') && (k.endsWith('.xml') || k.endsWith('.musicxml')));
    if (container) {
      const m = /full-path="([^"]+)"/.exec(strFromU8(container));
      if (m && files[m[1]]) path = m[1];
    }
    if (!path) throw new Error('Archive MXL vide.');
    return importMusicXml(strFromU8(files[path]), file.name);
  }
  if (lower.endsWith('.xml') || lower.endsWith('.musicxml')) {
    return importMusicXml(new TextDecoder().decode(buf), file.name);
  }
  throw new Error('Format non pris en charge. Utilise un fichier .mid, .musicxml, .xml ou .mxl.');
}
