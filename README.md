# Notéa – apprendre le piano

Application web installable (PWA) pour apprendre et pratiquer le piano, pensée pour un Yamaha Clavinova CLP-825 relié en USB.

## Fonctionnalités

- **Écoute du vrai piano** : MIDI par câble USB (Chrome sur Android), micro (iPad), ou clavier à l'écran.
- **Deux affichages** : partition qui défile (clé de sol et clé de fa) ou notes qui tombent sur un clavier.
- **Modes de jeu** : « Attends-moi » (le morceau attend la bonne note) et « En rythme » (tempo, métronome, note de rythme).
- **Outils d'entraînement** : vitesse de 30 à 130 %, main droite, main gauche ou deux mains (l'autre main est jouée par l'appli ou par le Clavinova), boucle sur un passage, écoute du morceau, noms des notes (Do Ré Mi), doigtés.
- **Parcours guidé** : 7 parcours et 29 leçons, des premiers pas jusqu'aux grands classiques. Chaque leçon alterne explications et exercices.
- **Bibliothèque** : 17 morceaux du domaine public, plus l'import de fichiers MIDI ou MusicXML (pour les morceaux donnés par le professeur).
- **Exercices générés** : lecture de notes, gammes, rythme, accords.
- **Entraînement du jour** (environ 5 min) : il s'adapte au niveau et revient sur les notes difficiles.
- **Motivation** : étoiles, XP, série de jours, objectif quotidien, badges.
- **Espace parents** protégé par un code : minutes de pratique, progression, notes difficiles, sauvegarde et restauration.

## Développement

```bash
npm install
npm run dev
```

## Déploiement

À chaque `git push` sur `main`, GitHub Actions construit le site et le publie sur GitHub Pages (`.github/workflows/deploy.yml`).
Dans les réglages du dépôt : **Settings → Pages → Source : GitHub Actions**.

## Installation sur le téléphone Android

1. Ouvrir l'adresse GitHub Pages dans **Chrome**.
2. Menu ⋮, puis **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
3. Relier le Clavinova (prise USB TO HOST) au téléphone avec un câble USB-B vers USB-C.
4. Au premier lancement, autoriser l'accès aux appareils MIDI.

Pour obtenir un fichier APK : aller sur https://www.pwabuilder.com, saisir l'adresse du site, puis **Package for stores → Android**.

## iPad

Ouvrir l'adresse dans Safari, puis Partager → **Sur l'écran d'accueil**. Safari ne gère pas le MIDI : l'appli écoute le piano avec le micro.
