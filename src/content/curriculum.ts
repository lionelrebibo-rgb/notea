import type { HandSel, Song } from '../music/types';
import { barStart } from '../music/theory';
import { sliceSong } from '../music/notation';
import { LIBRARY } from './songs';
import * as ex from './exercises';

export interface InfoStep {
  kind: 'info';
  title: string;
  text: string;
  emoji?: string;
  /** keys to highlight on an illustrative keyboard */
  keys?: number[];
}

export interface PlayStep {
  kind: 'play';
  title: string;
  song: () => Song;
  hands: HandSel;
  mode: 'wait' | 'rhythm';
  tempo?: number;
  /** inclusive bar range of the song */
  bars?: [number, number];
  /** 'always': keys shown on the keyboard, 'auto': after a hesitation, 'never' */
  hints?: 'always' | 'auto' | 'never';
  names?: boolean;
  anyKey?: boolean;
  metronome?: boolean;
}

export type Step = InfoStep | PlayStep;

export interface Lesson {
  id: string;
  title: string;
  emoji: string;
  steps: Step[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
  lessons: Lesson[];
}

const song = (id: string) => () => LIBRARY.find((s) => s.id === id)!;

export function stepSong(step: PlayStep): Song {
  const s = step.song();
  if (!step.bars) return s;
  const from = barStart(s, step.bars[0]);
  const to = barStart(s, step.bars[1] + 1);
  return sliceSong(s, from, to);
}

const info = (title: string, text: string, emoji?: string, keys?: number[]): InfoStep => ({ kind: 'info', title, text, emoji, keys });
const play = (title: string, s: () => Song, o: Partial<PlayStep> = {}): PlayStep => ({
  kind: 'play',
  title,
  song: s,
  hands: 'R',
  mode: 'wait',
  hints: 'auto',
  names: true,
  ...o,
});

export const COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Premiers pas',
    subtitle: 'Le clavier, le Do et tes premières mélodies',
    emoji: '🐣',
    color: '#7c4dff',
    lessons: [
      {
        id: 'c1l1',
        title: 'Le clavier',
        emoji: '🎹',
        steps: [
          info(
            'Les touches noires',
            'Regarde ton piano : les touches noires sont rangées par groupes de 2 et de 3. Ces groupes servent de repères pour trouver toutes les notes.',
            '👀',
            [61, 63, 66, 68, 70],
          ),
          info(
            'Le Do',
            'Le Do est la touche blanche juste à gauche du groupe de 2 touches noires. Il y a un Do à chaque octave !',
            '🎯',
            [48, 60, 72],
          ),
          play('Trouve les Do', () => ex.findNote(0, [3, 4, 5]), { hints: 'always', hands: 'both' }),
          info(
            'Le Do central',
            'Le Do du milieu du piano s’appelle le Do central (Do 4). Pose ton pouce droit (le doigt 1) dessus.',
            '👍',
            [60],
          ),
          play('Joue le Do central', () => ex.repeatNote(60, 6, 1), { hints: 'always' }),
        ],
      },
      {
        id: 'c1l2',
        title: 'Do Ré Mi',
        emoji: '🖐️',
        steps: [
          info(
            'Les numéros des doigts',
            'Au piano, chaque doigt a un numéro : pouce = 1, index = 2, majeur = 3, annulaire = 4, auriculaire = 5. C’est pareil pour les deux mains.',
            '🖐️',
          ),
          info('Do, Ré, Mi', 'Pouce sur Do, index sur Ré, majeur sur Mi. Garde la main bien arrondie, comme si tu tenais une balle.', '⚽', [60, 62, 64]),
          play('Do Ré Mi', () => ex.fiveFinger('R', 60, 3), { hints: 'always' }),
          play('Petits pains chauds', song('painschauds'), { hints: 'always' }),
          play('Petits pains chauds – sans aide', song('painschauds'), { hints: 'auto' }),
        ],
      },
      {
        id: 'c1l3',
        title: 'La position de Do',
        emoji: '✋',
        steps: [
          info('Cinq doigts, cinq notes', 'Pose tes 5 doigts sur Do Ré Mi Fa Sol : c’est la position de Do. Chaque doigt a sa touche, plus besoin de bouger la main !', '✋', [60, 62, 64, 65, 67]),
          play('Do Ré Mi Fa Sol', () => ex.fiveFinger('R'), { hints: 'always' }),
          play('Marie avait un petit agneau – début', song('marie'), { bars: [1, 4] }),
          play('Marie avait un petit agneau – fin', song('marie'), { bars: [5, 8] }),
          play('Marie avait un petit agneau – en rythme', song('marie'), { mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c1l4',
        title: 'Au clair de la lune',
        emoji: '🌙',
        steps: [
          play('Première phrase', song('auclair'), { bars: [1, 4] }),
          play('Les deux premières phrases', song('auclair'), { bars: [1, 8] }),
          info('On déplace la main', 'Dans la suite, la main descend : place le pouce sur le Sol sous le Do central. Les doigts indiqués t’aident.', '↙️', [55, 57, 59, 60, 62]),
          play('Le milieu', song('auclair'), { bars: [9, 12] }),
          play('Tout le morceau', song('auclair'), { bars: [1, 16] }),
          play('En rythme !', song('auclair'), { bars: [1, 8], mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c1l5',
        title: 'Frère Jacques',
        emoji: '🔔',
        steps: [
          play('Dormez-vous ?', song('frere'), { bars: [1, 4] }),
          info('Les croches', 'Les notes avec un petit drapeau sont des croches : elles vont deux fois plus vite. Dis « ti-ti » pour chaque paire.', '🚩'),
          play('Sonnez les matines', song('frere'), { bars: [5, 8] }),
          play('Tout le morceau en rythme', song('frere'), { mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c1l6',
        title: 'Hymne à la joie',
        emoji: '🎉',
        steps: [
          play('Première phrase', song('ode'), { bars: [1, 4] }),
          play('Deuxième phrase', song('ode'), { bars: [5, 8] }),
          play('Le milieu', song('ode'), { bars: [9, 12] }),
          play('Tout le morceau', song('ode')),
          play('En rythme avec l’accompagnement', song('ode'), { mode: 'rhythm', tempo: 0.8 }),
        ],
      },
    ],
  },
  {
    id: 'c2',
    title: 'Lire les notes',
    subtitle: 'La clé de sol et le rythme',
    emoji: '📖',
    color: '#00b3a4',
    lessons: [
      {
        id: 'c2l1',
        title: 'La clé de sol',
        emoji: '🎼',
        steps: [
          info('La portée', 'La musique s’écrit sur 5 lignes : la portée. Plus la note est haute sur la portée, plus le son est aigu.', '📏'),
          info('La clé de sol', 'La clé de sol s’enroule autour de la 2e ligne (en partant du bas) : la note sur cette ligne est un Sol. Le Do central est sous la portée, sur un petit trait.', '🌀'),
          play('Lis Do Ré Mi Fa Sol (avec les noms)', () => ex.noteQuiz(ex.POOLS.trebleC, 10, 'R', 11), { hints: 'auto', names: true }),
          play('Même chose, sans les noms !', () => ex.noteQuiz(ex.POOLS.trebleC, 12, 'R', 12), { hints: 'auto', names: false }),
        ],
      },
      {
        id: 'c2l2',
        title: 'Lignes et interlignes',
        emoji: '🔍',
        steps: [
          info('Les notes sur les lignes', 'Sur les lignes, de bas en haut : Mi, Sol, Si, Ré, Fa.', '〰️', [64, 67, 71, 74, 77]),
          play('Notes sur les lignes', () => ex.noteQuiz(ex.POOLS.trebleLines, 10, 'R', 21), { names: false }),
          info('Les notes dans les interlignes', 'Entre les lignes, de bas en haut : Fa, La, Do, Mi.', '↕️', [65, 69, 72, 76]),
          play('Notes dans les interlignes', () => ex.noteQuiz(ex.POOLS.trebleSpaces, 10, 'R', 22), { names: false }),
          play('Défi : toutes les notes', () => ex.noteQuiz(ex.POOLS.trebleAll, 16, 'R', 23), { names: false }),
        ],
      },
      {
        id: 'c2l3',
        title: 'Noire, blanche, ronde',
        emoji: '⏱️',
        steps: [
          info('La durée des notes', 'La noire (●) dure 1 temps. La blanche (○ avec une queue) dure 2 temps. La ronde (○) dure 4 temps. Compte à voix haute : « 1, 2, 3, 4 ».', '🕐'),
          info('Exercice de rythme', 'Ici, n’importe quelle touche marche : seul le moment compte ! Écoute le métronome et joue pile sur le temps.', '🥁'),
          play('Noires et blanches', () => ex.rhythm('1', 'C4q C4q C4h | C4q C4q C4h | C4h C4h | C4w', 80), { mode: 'rhythm', anyKey: true, metronome: true, names: false }),
          play('Avec des silences', () => ex.rhythm('2', 'C4q rq C4q rq | C4h C4h | C4q C4q C4q rq | C4w', 80), { mode: 'rhythm', anyKey: true, metronome: true, names: false }),
        ],
      },
      {
        id: 'c2l4',
        title: 'Les croches',
        emoji: '🚩',
        steps: [
          info('Deux croches = une noire', 'Une croche dure un demi-temps. Deux croches ensemble = 1 temps. Dis « ti-ti » pour deux croches et « ta » pour une noire.', '🎵'),
          play('Ta ta ti-ti ta', () => ex.rhythm('3', 'C4q C4q C4e C4e C4q | C4e C4e C4e C4e C4h | C4q C4e C4e C4q C4q | C4w', 80), { mode: 'rhythm', anyKey: true, metronome: true, names: false }),
          play('Ah ! vous dirai-je, maman', song('twinkle'), { bars: [1, 4] }),
          play('Ah ! vous dirai-je, maman – en entier', song('twinkle')),
          play('En rythme', song('twinkle'), { mode: 'rhythm', tempo: 0.85 }),
        ],
      },
      {
        id: 'c2l5',
        title: 'Deux nouveaux morceaux',
        emoji: '⭐',
        steps: [
          play('Hänschen klein', song('hanschen')),
          play('Hänschen klein – en rythme', song('hanschen'), { mode: 'rhythm', tempo: 0.85 }),
          play('Vive le vent – refrain', song('jingle'), { bars: [1, 8] }),
          play('Vive le vent – en entier', song('jingle')),
        ],
      },
    ],
  },
  {
    id: 'c3',
    title: 'La main gauche',
    subtitle: 'La clé de fa et les notes graves',
    emoji: '🫲',
    color: '#ff8a3d',
    lessons: [
      {
        id: 'c3l1',
        title: 'La clé de fa',
        emoji: '𝄢',
        steps: [
          info('La clé de fa', 'La main gauche lit souvent la clé de fa. Ses deux points entourent la 4e ligne : c’est le Fa sous le Do central.', '🔑'),
          info('Position de Do grave', 'Main gauche : auriculaire (5) sur le Do grave, puis 4, 3, 2 et le pouce (1) sur le Sol.', '🫲', [48, 50, 52, 53, 55]),
          play('Do Ré Mi Fa Sol – main gauche', () => ex.fiveFinger('L'), { hands: 'L', hints: 'always' }),
          play('Lis les notes graves', () => ex.noteQuiz(ex.POOLS.bassC, 10, 'L', 31), { hands: 'L', names: true }),
          play('Sans les noms', () => ex.noteQuiz(ex.POOLS.bassC, 12, 'L', 32), { hands: 'L', names: false }),
        ],
      },
      {
        id: 'c3l2',
        title: 'Mélodies à gauche',
        emoji: '🎶',
        steps: [
          play('Petits pains chauds – main gauche', () => ex.toLeftHand(LIBRARY.find((s) => s.id === 'painschauds')!), { hands: 'L' }),
          play('Marie… – main gauche', () => ex.toLeftHand(LIBRARY.find((s) => s.id === 'marie')!), { hands: 'L' }),
          play('Marie… – main gauche en rythme', () => ex.toLeftHand(LIBRARY.find((s) => s.id === 'marie')!), { hands: 'L', mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c3l3',
        title: 'Toutes les notes graves',
        emoji: '🐻',
        steps: [
          play('Lecture en clé de fa', () => ex.noteQuiz(ex.POOLS.bassAll, 14, 'L', 33), { hands: 'L', names: false }),
          play('Gamme de Do – main gauche', () => ex.scale('C', 'L'), { hands: 'L', hints: 'always' }),
          play('Gamme de Do – main gauche, sans aide', () => ex.scale('C', 'L'), { hands: 'L' }),
        ],
      },
    ],
  },
  {
    id: 'c4',
    title: 'Les deux mains',
    subtitle: 'Jouer main droite et main gauche ensemble',
    emoji: '🙌',
    color: '#ff5fa2',
    lessons: [
      {
        id: 'c4l1',
        title: 'Ensemble !',
        emoji: '🤝',
        steps: [
          info('La méthode', 'Pour apprendre à deux mains : d’abord la main droite, puis la main gauche, puis les deux ensemble – lentement. La vitesse viendra toute seule.', '🐢'),
          play('Les deux mains en miroir', () => ex.fiveFingerBoth(), { hands: 'both', hints: 'always' }),
          play('Encore, sans aide', () => ex.fiveFingerBoth(), { hands: 'both' }),
        ],
      },
      {
        id: 'c4l2',
        title: 'Au clair de la lune à 2 mains',
        emoji: '🌙',
        steps: [
          play('Main gauche seule', song('auclair'), { hands: 'L', bars: [1, 8] }),
          play('Deux mains – début', song('auclair'), { hands: 'both', bars: [1, 4] }),
          play('Deux mains – deux phrases', song('auclair'), { hands: 'both', bars: [1, 8] }),
          play('Deux mains en rythme', song('auclair'), { hands: 'both', bars: [1, 8], mode: 'rhythm', tempo: 0.75 }),
        ],
      },
      {
        id: 'c4l3',
        title: 'Hymne à la joie à 2 mains',
        emoji: '🎉',
        steps: [
          play('Main gauche seule', song('ode'), { hands: 'L' }),
          play('Deux mains – début', song('ode'), { hands: 'both', bars: [1, 4] }),
          play('Deux mains – en entier', song('ode'), { hands: 'both' }),
          play('Deux mains en rythme', song('ode'), { hands: 'both', mode: 'rhythm', tempo: 0.75 }),
        ],
      },
      {
        id: 'c4l4',
        title: 'Canon de Pachelbel',
        emoji: '💒',
        steps: [
          info('Deux dièses', 'Ce morceau est en Ré majeur : les dièses (♯) au début de la portée veulent dire qu’on joue Fa♯ et Do♯ (touches noires) à la place de Fa et Do.', '♯', [66, 73]),
          play('Main droite', song('canon')),
          play('Main gauche', song('canon'), { hands: 'L' }),
          play('Deux mains', song('canon'), { hands: 'both' }),
          play('Deux mains en rythme', song('canon'), { hands: 'both', mode: 'rhythm' }),
        ],
      },
    ],
  },
  {
    id: 'c5',
    title: 'Dièses, bémols et gammes',
    subtitle: 'Les touches noires et le passage du pouce',
    emoji: '♯',
    color: '#3f7bff',
    lessons: [
      {
        id: 'c5l1',
        title: 'Les touches noires',
        emoji: '⬛',
        steps: [
          info('Dièse et bémol', 'Le dièse ♯ monte la note d’une demi-touche (la noire juste à droite). Le bémol ♭ la descend (la noire juste à gauche). Do♯ et Ré♭ sont donc la même touche !', '↔️', [61, 63]),
          play('Les touches noires', () => ex.noteQuiz(ex.POOLS.black, 10, 'R', 51), { hints: 'auto' }),
          play('Mélange blanches et noires', () => ex.noteQuiz([...ex.POOLS.trebleC, ...ex.POOLS.black], 14, 'R', 52), { names: false }),
        ],
      },
      {
        id: 'c5l2',
        title: 'La gamme de Do',
        emoji: '🪜',
        steps: [
          info('Le passage du pouce', 'Pour jouer 8 notes avec 5 doigts, on passe le pouce sous la main : Do(1) Ré(2) Mi(3), puis le pouce passe sur Fa(1), Sol(2) La(3) Si(4) Do(5).', '🔄', [60, 62, 64, 65]),
          play('Gamme de Do – avec aide', () => ex.scale('C', 'R'), { hints: 'always' }),
          play('Gamme de Do', () => ex.scale('C', 'R')),
          play('Gamme de Do – en rythme', () => ex.scale('C', 'R'), { mode: 'rhythm', tempo: 0.8, metronome: true }),
        ],
      },
      {
        id: 'c5l3',
        title: 'La gamme de Sol',
        emoji: '🌞',
        steps: [
          info('Un dièse : Fa♯', 'La gamme de Sol majeur a un dièse : Fa♯. Tous les Fa deviennent des Fa♯ (touche noire).', '♯', [66]),
          play('Gamme de Sol – main droite', () => ex.scale('G', 'R'), { hints: 'always' }),
          play('Gamme de Sol – main gauche', () => ex.scale('G', 'L'), { hands: 'L', hints: 'always' }),
          play('Une petite musique de nuit', song('nachtmusik')),
        ],
      },
      {
        id: 'c5l4',
        title: 'Morceaux de fête',
        emoji: '🎂',
        steps: [
          info('La levée', 'Joyeux anniversaire commence par une levée : quelques notes avant la première barre de mesure.', '🎈'),
          play('Joyeux anniversaire', song('anniversaire')),
          play('Joyeux anniversaire – en rythme', song('anniversaire'), { mode: 'rhythm', tempo: 0.85 }),
          play('Douce nuit', song('doucenuit')),
        ],
      },
    ],
  },
  {
    id: 'c6',
    title: 'Les accords',
    subtitle: 'Accompagner une mélodie',
    emoji: '🎶',
    color: '#9c27b0',
    lessons: [
      {
        id: 'c6l1',
        title: 'Do, Fa, Sol',
        emoji: '🧱',
        steps: [
          info('Un accord', 'Un accord, ce sont plusieurs notes jouées en même temps. L’accord de Do : Do + Mi + Sol (doigts 1, 3, 5).', '🧩', [60, 64, 67]),
          play('Accord de Do', () => ex.chords('c', 'Accord de Do', 'C4+E4+G4h C4+E4+G4h | C4+E4+G4w', 'R'), { hints: 'always' }),
          info('Fa et Sol', 'Accord de Fa : Do + Fa + La. Accord de Sol : Si + Ré + Sol. Les doigts bougent à peine !', '🧩', [60, 65, 69]),
          play('Do – Fa – Do – Sol – Do', () => ex.chords('cfg', 'Enchaînement', 'C4+E4+G4h C4+F4+A4h | C4+E4+G4h B3+D4+G4h | C4+E4+G4w', 'R'), { hints: 'always' }),
          play('Main gauche', () => ex.chords('cfgL', 'Enchaînement main gauche', 'C3+E3+G3h C3+F3+A3h | C3+E3+G3h B2+D3+G3h | C3+E3+G3w', 'L'), { hands: 'L', hints: 'always' }),
        ],
      },
      {
        id: 'c6l2',
        title: 'Accompagner',
        emoji: '🎤',
        steps: [
          play('Ah ! vous dirai-je – accords main gauche', song('twinkle'), { hands: 'L' }),
          play('Les deux mains – début', song('twinkle'), { hands: 'both', bars: [1, 4] }),
          play('Les deux mains – en entier', song('twinkle'), { hands: 'both' }),
        ],
      },
    ],
  },
  {
    id: 'c7',
    title: 'Grands classiques',
    subtitle: 'Les morceaux célèbres',
    emoji: '🎻',
    color: '#d4a017',
    lessons: [
      {
        id: 'c7l1',
        title: 'Le roi de la montagne',
        emoji: '⛰️',
        steps: [
          play('Main droite – lentement', song('montagne'), { bars: [1, 4], tempo: 0.7 }),
          play('Main droite', song('montagne')),
          play('Deux mains', song('montagne'), { hands: 'both', tempo: 0.7 }),
          play('En rythme !', song('montagne'), { mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c7l2',
        title: 'Greensleeves',
        emoji: '🍃',
        steps: [
          info('La mesure à 6/8', 'En 6/8, on compte 2 grands temps, chacun divisé en 3 : « UN-deux-trois, DEUX-deux-trois ».', '💃'),
          play('Main droite', song('greensleeves')),
          play('Deux mains', song('greensleeves'), { hands: 'both' }),
        ],
      },
      {
        id: 'c7l3',
        title: 'Lettre à Élise',
        emoji: '💌',
        steps: [
          info('Les doubles croches', 'Ce morceau utilise des doubles croches (deux drapeaux) : très rapides ! Commence lentement.', '⚡'),
          play('Le début – main droite', song('elise'), { bars: [0, 2], tempo: 0.7 }),
          play('Main droite', song('elise'), { tempo: 0.8 }),
          play('Main gauche', song('elise'), { hands: 'L' }),
          play('Deux mains', song('elise'), { hands: 'both', tempo: 0.7 }),
        ],
      },
      {
        id: 'c7l4',
        title: 'Prélude de Bach',
        emoji: '🌊',
        steps: [
          play('Main droite', song('prelude')),
          play('Deux mains', song('prelude'), { hands: 'both' }),
          play('Deux mains en rythme', song('prelude'), { hands: 'both', mode: 'rhythm', tempo: 0.8 }),
        ],
      },
      {
        id: 'c7l5',
        title: 'Menuet en Sol',
        emoji: '👑',
        steps: [
          play('Première partie', song('menuet'), { bars: [1, 8] }),
          play('Deuxième partie', song('menuet'), { bars: [9, 16] }),
          play('Main gauche', song('menuet'), { hands: 'L' }),
          play('Deux mains', song('menuet'), { hands: 'both', tempo: 0.8 }),
        ],
      },
    ],
  },
];

export function findLesson(id: string): { course: Course; lesson: Lesson; index: number } | null {
  for (const c of COURSES) {
    const i = c.lessons.findIndex((l) => l.id === id);
    if (i >= 0) return { course: c, lesson: c.lessons[i], index: i };
  }
  return null;
}

export function playSteps(l: Lesson) {
  return l.steps.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'play') as { s: PlayStep; i: number }[];
}

export function lessonStars(l: Lesson, done: Record<string, number[]>): { stars: number; complete: boolean; started: boolean } {
  const ps = playSteps(l);
  const arr = done[l.id] ?? [];
  const got = ps.map((p) => arr[p.i] ?? 0);
  const complete = got.every((g) => g >= 1);
  const started = got.some((g) => g >= 1);
  const stars = complete ? Math.round(got.reduce((a, b) => a + b, 0) / got.length) : 0;
  return { stars, complete, started };
}

/** Flattened lesson order, used for locking. */
export const LESSON_ORDER = COURSES.flatMap((c) => c.lessons.map((l) => l.id));

/** Lessons available to the pupil: everything up to the first incomplete lesson (+ skipped courses by level). */
export function unlockedSet(done: Record<string, number[]>, startLevel: number, all: boolean): Set<string> {
  const set = new Set<string>();
  if (all) {
    LESSON_ORDER.forEach((id) => set.add(id));
    return set;
  }
  // start level: 1 = start at the very beginning, 2 = course 1 already open, 3 = courses 1-2 open…
  const freeCourses = COURSES.slice(0, Math.max(0, startLevel - 1));
  for (const c of COURSES) {
    for (const l of c.lessons) {
      set.add(l.id);
      if (!freeCourses.includes(c) && !lessonStars(l, done).complete) return set;
    }
  }
  return set;
}
