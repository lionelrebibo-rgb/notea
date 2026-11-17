import { buildSong, type SongDef } from '../music/notation';
import type { Song } from '../music/types';

/**
 * Built-in library: traditional tunes and classical pieces in the public domain,
 * arranged for beginners. Fingerings for the right hand (1 = thumb … 5 = little finger).
 */
const defs: SongDef[] = [
  {
    id: 'painschauds',
    title: 'Petits pains chauds',
    composer: 'Comptine anglaise',
    level: 1,
    bpm: 90,
    tags: ['comptine'],
    right: 'E4h-3 D4h-2 | C4w-1 | E4h-3 D4h-2 | C4w-1 | C4e-1 C4e C4e C4e D4e-2 D4e D4e D4e | E4h-3 D4h-2 | C4w-1',
  },
  {
    id: 'marie',
    title: 'Marie avait un petit agneau',
    composer: 'Comptine américaine',
    level: 1,
    bpm: 96,
    tags: ['comptine'],
    right:
      'E4q-3 D4q-2 C4q-1 D4q-2 | E4q-3 E4q-3 E4h-3 | D4q-2 D4q-2 D4h-2 | E4q-3 G4q-5 G4h-5 | ' +
      'E4q-3 D4q-2 C4q-1 D4q-2 | E4q-3 E4q-3 E4q-3 E4q-3 | D4q-2 D4q-2 E4q-3 D4q-2 | C4w-1',
  },
  {
    id: 'auclair',
    title: 'Au clair de la lune',
    composer: 'Chanson traditionnelle',
    level: 1,
    bpm: 92,
    tags: ['comptine', 'français'],
    right:
      'C4q-1 C4q-1 C4q-1 D4q-2 | E4h-3 D4h-2 | C4q-1 E4q-3 D4q-2 D4q-2 | C4w-1 | ' +
      'C4q-1 C4q-1 C4q-1 D4q-2 | E4h-3 D4h-2 | C4q-1 E4q-3 D4q-2 D4q-2 | C4w-1 | ' +
      'D4q-5 D4q-5 D4q-5 D4q-5 | A3h-2 A3h-2 | D4q-5 C4q-4 B3q-3 A3q-2 | G3w-1 | ' +
      'C4q-1 C4q-1 C4q-1 D4q-2 | E4h-3 D4h-2 | C4q-1 E4q-3 D4q-2 D4q-2 | C4w-1',
    left:
      'C3w-5 | G2w | C3h-5 G2h | C3w-5 | C3w-5 | G2w | C3h-5 G2h | C3w-5 | ' +
      'G2w | F2w | G2w | G2w | C3w-5 | G2w | C3h-5 G2h | C3w-5',
  },
  {
    id: 'frere',
    title: 'Frère Jacques',
    composer: 'Chanson traditionnelle',
    level: 1,
    bpm: 100,
    tags: ['comptine', 'français'],
    right:
      'C4q-1 D4q-2 E4q-3 C4q-1 | C4q-1 D4q-2 E4q-3 C4q-1 | E4q-3 F4q-4 G4h-5 | E4q-3 F4q-4 G4h-5 | ' +
      'G4e-4 A4e-5 G4e-4 F4e-3 E4q-2 C4q-1 | G4e-4 A4e-5 G4e-4 F4e-3 E4q-2 C4q-1 | C4q-2 G3q-1 C4h-2 | C4q-2 G3q-1 C4h-2',
  },
  {
    id: 'twinkle',
    title: 'Ah ! vous dirai-je, maman',
    composer: 'Chanson traditionnelle (Mozart en a fait des variations)',
    level: 1,
    bpm: 100,
    tags: ['comptine', 'français'],
    right:
      'C4q-1 C4q-1 G4q-5 G4q-5 | A4q A4q G4h-5 | F4q-4 F4q-4 E4q-3 E4q-3 | D4q-2 D4q-2 C4h-1 | ' +
      'G4q-5 G4q-5 F4q-4 F4q-4 | E4q-3 E4q-3 D4h-2 | G4q-5 G4q-5 F4q-4 F4q-4 | E4q-3 E4q-3 D4h-2 | ' +
      'C4q-1 C4q-1 G4q-5 G4q-5 | A4q A4q G4h-5 | F4q-4 F4q-4 E4q-3 E4q-3 | D4q-2 D4q-2 C4h-1',
    left:
      'C3+E3+G3w | C3+F3+A3h C3+E3+G3h | C3+F3+A3h C3+E3+G3h | B2+D3+G3h C3+E3+G3h | ' +
      'C3+E3+G3h C3+F3+A3h | C3+E3+G3h B2+D3+G3h | C3+E3+G3h C3+F3+A3h | C3+E3+G3h B2+D3+G3h | ' +
      'C3+E3+G3w | C3+F3+A3h C3+E3+G3h | C3+F3+A3h C3+E3+G3h | B2+D3+G3h C3+E3+G3h',
  },
  {
    id: 'hanschen',
    title: 'Hänschen klein',
    composer: 'Comptine allemande',
    level: 1,
    bpm: 100,
    tags: ['comptine'],
    right:
      'G4q-5 E4q-3 E4h-3 | F4q-4 D4q-2 D4h-2 | C4q-1 D4q-2 E4q-3 F4q-4 | G4q-5 G4q-5 G4h-5 | ' +
      'G4q-5 E4q-3 E4h-3 | F4q-4 D4q-2 D4h-2 | C4q-1 E4q-3 G4q-5 G4q-5 | C4w-1',
  },
  {
    id: 'ode',
    title: 'Hymne à la joie',
    composer: 'L. van Beethoven',
    level: 2,
    bpm: 100,
    tags: ['classique'],
    right:
      'E4q-3 E4q-3 F4q-4 G4q-5 | G4q-5 F4q-4 E4q-3 D4q-2 | C4q-1 C4q-1 D4q-2 E4q-3 | E4q.-3 D4e-2 D4h-2 | ' +
      'E4q-3 E4q-3 F4q-4 G4q-5 | G4q-5 F4q-4 E4q-3 D4q-2 | C4q-1 C4q-1 D4q-2 E4q-3 | D4q.-2 C4e-1 C4h-1 | ' +
      'D4q-2 D4q-2 E4q-3 C4q-1 | D4q-2 E4e-3 F4e-4 E4q-3 C4q-1 | D4q-2 E4e-3 F4e-4 E4q-3 D4q-2 | C4q-1 D4q-2 G3h-1 | ' +
      'E4q-3 E4q-3 F4q-4 G4q-5 | G4q-5 F4q-4 E4q-3 D4q-2 | C4q-1 C4q-1 D4q-2 E4q-3 | D4q.-2 C4e-1 C4h-1',
    left:
      'C3w | G2w | C3w | G2h G2h | C3w | G2w | C3w | G2h C3h | ' +
      'G2w | G2h C3h | G2w | C3h G2h | C3w | G2w | C3w | G2h C3h',
  },
  {
    id: 'anniversaire',
    title: 'Joyeux anniversaire',
    composer: 'Mildred & Patty Hill',
    level: 2,
    bpm: 100,
    timeSig: [3, 4],
    pickup: 1,
    tags: ['fête'],
    right:
      'G4e. G4s | A4q G4q C5q | B4h G4e. G4s | A4q G4q D5q | C5h G4e. G4s | ' +
      'G5q E5q C5q | B4q A4q F5e. F5s | E5q C5q D5q | C5h.',
  },
  {
    id: 'jingle',
    title: 'Vive le vent (Jingle Bells)',
    composer: 'J. Pierpont',
    level: 2,
    bpm: 112,
    tags: ['noël'],
    right:
      'E4q-3 E4q-3 E4h-3 | E4q-3 E4q-3 E4h-3 | E4q-3 G4q-5 C4q.-1 D4e-2 | E4w-3 | ' +
      'F4q-4 F4q-4 F4q.-4 F4e-4 | F4q-4 E4q-3 E4q-3 E4e-3 E4e-3 | E4q-3 D4q-2 D4q-2 E4q-3 | D4h-2 G4h-5 | ' +
      'E4q-3 E4q-3 E4h-3 | E4q-3 E4q-3 E4h-3 | E4q-3 G4q-5 C4q.-1 D4e-2 | E4w-3 | ' +
      'F4q-4 F4q-4 F4q-4 F4q-4 | F4q-4 E4q-3 E4q-3 E4e-3 E4e-3 | G4q-5 G4q-5 F4q-4 D4q-2 | C4w-1',
  },
  {
    id: 'doucenuit',
    title: 'Douce nuit',
    composer: 'F. X. Gruber',
    level: 2,
    bpm: 84,
    timeSig: [3, 4],
    tags: ['noël'],
    right:
      'G4q. A4e G4q | E4h. | G4q. A4e G4q | E4h. | D5h D5q | B4h. | C5h C5q | G4h. | ' +
      'A4h A4q | C5q. B4e A4q | G4q. A4e G4q | E4h. | A4h A4q | C5q. B4e A4q | G4q. A4e G4q | E4h. | ' +
      'D5h D5q | F5q. D5e B4q | C5h. | E5h. | C5q G4q E4q | G4q. F4e D4q | C4h. | C4h.',
  },
  {
    id: 'canon',
    title: 'Canon',
    composer: 'J. Pachelbel',
    level: 3,
    bpm: 66,
    key: 2,
    tags: ['classique'],
    right: 'F#5h E5h | D5h C#5h | B4h A4h | B4h C#5h | D5h C#5h | B4h A4h | G4h F#4h | G4h E4h | F#4w',
    left: 'D3h A2h | B2h F#2h | G2h D2h | G2h A2h | D3h A2h | B2h F#2h | G2h D2h | G2h A2h | D3w',
  },
  {
    id: 'nachtmusik',
    title: 'Une petite musique de nuit',
    composer: 'W. A. Mozart',
    level: 3,
    bpm: 100,
    key: 1,
    tags: ['classique'],
    right:
      'G4q-1 re D4e G4q re D4e | G4e D4e G4e B4e D5q rq | C5q re A4e C5q re A4e | C5e A4e F#4e A4e D4q rq',
    left: 'G2+G3w | G2+G3w | D3+F#3w | D3+F#3w',
  },
  {
    id: 'montagne',
    title: 'Dans l’antre du roi de la montagne',
    composer: 'E. Grieg',
    level: 3,
    bpm: 112,
    tags: ['classique'],
    right:
      'A3e-1 B3e-2 C4e-3 D4e-4 E4e-5 C4e-3 E4q-5 | D#4e-4 B3e-2 D#4q-4 D4e-4 Bb3e-2 D4q-4 | ' +
      'A3e-1 B3e-2 C4e-3 D4e-4 E4e-5 C4e-3 E4e-5 A4e | G4e E4e C4e E4e G4h | ' +
      'A3e-1 B3e-2 C4e-3 D4e-4 E4e-5 C4e-3 E4q-5 | D#4e-4 B3e-2 D#4q-4 D4e-4 Bb3e-2 D4q-4 | ' +
      'A3e-1 B3e-2 C4e-3 D4e-4 E4e-5 C4e-3 E4e-5 A4e | G4e E4e C4e E4e G4h',
    left: 'A2q E3q A2q E3q | B2q F#3q Bb2q F3q | A2q E3q A2q E3q | C3q G3q C3h | A2q E3q A2q E3q | B2q F#3q Bb2q F3q | A2q E3q A2q E3q | C3q G3q C3h',
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Chanson anglaise (XVIe siècle)',
    level: 3,
    bpm: 84,
    timeSig: [6, 8],
    pickup: 0.5,
    tags: ['classique'],
    right:
      'A4e | C5q D5e E5e. F5s E5e | D5q B4e G4e. A4s B4e | C5q A4e A4e. G#4s A4e | B4q G#4e E4q A4e | ' +
      'C5q D5e E5e. F5s E5e | D5q B4e G4e. A4s B4e | C5e. B4s A4e G#4e. F#4s G#4e | A4q. A4q.',
    left: 're | A2+E3h. | G2+D3h. | A2+E3h. | E2+B2h. | A2+E3h. | G2+D3h. | A2q. E2q. | A2+E3h.',
  },
  {
    id: 'elise',
    title: 'Lettre à Élise',
    composer: 'L. van Beethoven',
    level: 4,
    bpm: 66,
    timeSig: [3, 8],
    pickup: 0.5,
    tags: ['classique'],
    right:
      'E5s-5 D#5s-4 | E5s-5 D#5s-4 E5s-5 B4s-2 D5s-4 C5s-3 | A4e-1 rs C4s-1 E4s-2 A4s-3 | B4e-4 rs E4s-1 G#4s-3 B4s-4 | C5e-5 rs E4s-1 E5s-5 D#5s-4 | ' +
      'E5s-5 D#5s-4 E5s-5 B4s-2 D5s-4 C5s-3 | A4e-1 rs C4s-1 E4s-2 A4s-3 | B4e-4 rs E4s-1 C5s-4 B4s-3 | A4q.-2',
    left: 're | rq. | A2s-5 E3s-2 A3s-1 re. | E2s-5 E3s-2 G#3s-1 re. | A2s-5 E3s-2 A3s-1 re. | rq. | A2s-5 E3s-2 A3s-1 re. | E2s-5 E3s-2 G#3s-1 re. | A2s-5 E3s-2 A3s-1 re.',
  },
  {
    id: 'prelude',
    title: 'Prélude en Do majeur',
    composer: 'J. S. Bach',
    level: 4,
    bpm: 80,
    tags: ['classique'],
    right:
      'rq G4e-1 C5e-2 E5e-5 G4e-1 C5e-2 E5e-5 | rq G4e C5e E5e G4e C5e E5e | ' +
      'rq A4e-1 D5e-2 F5e-5 A4e-1 D5e-2 F5e-5 | rq A4e D5e F5e A4e D5e F5e | ' +
      'rq G4e-1 D5e-3 F5e-5 G4e-1 D5e-3 F5e-5 | rq G4e D5e F5e G4e D5e F5e | ' +
      'rq G4e-1 C5e-2 E5e-5 G4e-1 C5e-2 E5e-5 | rq G4e C5e E5e G4e C5e E5e',
    left:
      'C4e-5 E4e-3 rh rq | C4e E4e rh rq | C4e-5 D4e-4 rh rq | C4e D4e rh rq | ' +
      'B3e-5 D4e-3 rh rq | B3e D4e rh rq | C4e-5 E4e-3 rh rq | C4e E4e rh rq',
  },
  {
    id: 'menuet',
    title: 'Menuet en Sol',
    composer: 'C. Petzold (attribué à J. S. Bach)',
    level: 4,
    bpm: 100,
    timeSig: [3, 4],
    key: 1,
    tags: ['classique'],
    description: 'Main gauche simplifiée.',
    right:
      'D5q-5 G4e-1 A4e-2 B4e-3 C5e-4 | D5q-5 G4q-1 G4q-1 | E5q-5 C5e-2 D5e-3 E5e-4 F#5e-5 | G5q-5 G4q-1 G4q-1 | ' +
      'C5q-4 D5e-5 C5e-4 B4e-3 A4e-2 | B4q-3 C5e-4 B4e-3 A4e-2 G4e-1 | F#4q-2 G4e-1 A4e-2 B4e-3 G4e-1 | A4h.-2 | ' +
      'D5q-5 G4e-1 A4e-2 B4e-3 C5e-4 | D5q-5 G4q-1 G4q-1 | E5q-5 C5e-2 D5e-3 E5e-4 F#5e-5 | G5q-5 G4q-1 G4q-1 | ' +
      'C5q-4 D5e-5 C5e-4 B4e-3 A4e-2 | B4q-3 C5e-4 B4e-3 A4e-2 G4e-1 | A4q-3 B4e-4 A4e-3 G4e-2 F#4e-1 | G4h.-2',
    left:
      'G3h. | B3h. | C4h. | B3h. | A3h. | G3h. | D3h. | D3h. | ' +
      'G3h. | B3h. | C4h. | B3h. | A3h. | G3h. | D3h. | G2h.',
  },
];

export const LIBRARY: Song[] = defs.map(buildSong);

export function findSong(id: string, imported: Song[] = []): Song | undefined {
  return LIBRARY.find((s) => s.id === id) ?? imported.find((s) => s.id === id);
}
