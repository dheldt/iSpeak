// js/words.js — global word tree data, loaded before app.js
// Buckets for Verb / Nomen / Adjektiv use T9 group keys (abc, def, …)
// so they match the two-level spelling wheel.
const WT_DATA = {

  Häufig: {
    'Häufig': ['du', 'ich', 'ja', 'nein', 'bitte', 'danke', 'gut', 'hilfe', 'okay'],
  },

  Verb: {
    'abc': [
      'anfangen','anrufen','antworten','atmen',
      'aufhören','aufmachen','aufstehen','ausruhen',
      'besuchen','bleiben',
    ],
    'def': [
      'denken','drehen','duschen',
      'einschlafen','essen',
      'fahren','fernsehen','fragen','fühlen',
    ],
    'ghi': [
      'geben','gehen','genießen',
      'halten','helfen','hören',
    ],
    'jkl': [
      'kommen','können',
      'lachen','laufen','lesen','liegen',
    ],
    'mno': [
      'möchten','mögen','müssen',
      'nehmen',
      'öffnen',
    ],
    'pqrs': [
      'reden','rufen','ruhen',
      'sagen','schlafen','schreiben','sehen','sitzen','spielen',
      'sprechen','stehen','stoppen','suchen',
    ],
    'tuv': [
      'trinken',
      'umdrehen',
      'verstehen',
    ],
    'wxyz': [
      'warten','waschen','wollen','wünschen',
      'zeigen','zuhören',
    ],
  },

  Nomen: {
    'abc': [
      'Abend','Arm','Arzt','Auge','Ausflug',
      'Bein','Besuch','Bett','Brot','Bruder','Buch',
    ],
    'def': [
      'Decke','Durst',
      'Enkel','Essen',
      'Familie','Fenster','Fernseher','Foto','Freude','Freund','Frau',
    ],
    'ghi': [
      'Garten','Gespräch','Geschwister',
      'Hand','Haus','Herz','Hilfe','Hunger',
    ],
    'jkl': [
      'Kaffee','Kind','Kissen','Kopf','Körper','Küche',
      'Licht','Luft',
    ],
    'mno': [
      'Mann','Morgen','Mund','Musik','Mutter',
      'Nacht','Name',
      'Obst','Oma','Opa',
    ],
    'pqrs': [
      'Pause','Pfleger',
      'Radio','Ruhe','Rücken',
      'Schmerz','Schwester','Sohn','Spaziergang','Stuhl','Suppe',
    ],
    'tuv': [
      'Tag','Tasse','Tee','Telefon','Tisch','Tochter','Toilette','Tür',
      'Uhr',
      'Vater',
    ],
    'wxyz': [
      'Wasser','Woche','Wunsch',
      'Zimmer',
    ],
  },

  Adjektiv: {
    'abc': [
      'allein','ängstlich','aufgeregt',
      'besser','besorgt',
    ],
    'def': [
      'dankbar','deprimiert','dringend','durstig',
      'erschöpft',
      'froh','frustriert',
    ],
    'ghi': [
      'gelangweilt','glücklich','gut',
      'hungrig',
    ],
    'jkl': [
      'kalt','klar','krank',
      'laut','leise',
    ],
    'mno': [
      'müde',
      'nass',
    ],
    'pqrs': [
      'ruhig',
      'schläfrig','schlecht','schmerzhaft','schwach',
    ],
    'tuv': [
      'traurig','trocken',
      'übel','unwohl',
    ],
    'wxyz': [
      'warm','wichtig',
      'zufrieden','zuversichtlich',
    ],
  },

  Andere: {
    'Ja / Nein': [
      'ja','nein','okay','bitte','danke','gerne',
      'leider','vielleicht','natürlich','sicher',
      'genau','stimmt','falsch','stop','weiter',
    ],
    'Ich / Du': [
      'ich','du','er','sie','es','wir','ihr',
      'mich','mir','mein','dein','sein','unser','alle',
    ],
    'Zeit': [
      'jetzt','sofort','bald','später',
      'heute','morgen','gestern',
      'früh','spät','immer','manchmal','nie','oft',
    ],
    'Zahlen': [
      'eins','zwei','drei','vier','fünf',
      'sechs','sieben','acht','neun','zehn',
      'zwanzig','dreißig','fünfzig','hundert',
    ],
    'Fragen': [
      'was','wer','wie','wo','warum','wann',
      'welche','wie viel','wie lange','wohin',
    ],
    'Konnektoren': [
      'und','oder','aber','weil','wenn','dass',
      'nicht','kein','noch','sehr','viel','wenig',
      'hier','da','dort','auch',
    ],
  },
};
