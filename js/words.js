// js/words.js — global word tree data, loaded before app.js
// Buckets for Verb / Nomen / Adjektiv use T9 group keys (abc, def, …)
// so they match the two-level spelling wheel.
const WT_DATA = {

  Häufig: {
    'Häufig': ['du', 'ich', 'ja', 'nein'],
  },

  Verb: {
    'abc': [
      'anfangen','anrufen','antworten','atmen','aufhören','aufmachen',
      'aufstehen','aufwachen','ausruhen','ausatmen',
      'beenden','besuchen','bluten',
    ],
    'def': [
      'denken','drehen',
      'einatmen','essen',
      'fahren','fragen','frieren','fühlen',
    ],
    'ghi': [
      'geben','gehen','genießen',
      'halten','helfen','hören','husten',
    ],
    'jkl': [
      'kommen','können',
      'lachen','laufen','legen','lesen','liegen',
    ],
    'mno': [
      'möchten','mögen','müssen',
      'nehmen','nicken',
      'öffnen',
    ],
    'pqrs': [
      'reden','rufen',
      'sagen','schlafen','schließen','schmerzen','schreiben',
      'schlucken','schütteln','schwitzen','sehen','sitzen',
      'sprechen','stehen','stoppen','suchen',
    ],
    'tuv': [
      'trinken',
      'umdrehen','untersuchen',
      'verstehen',
      'übergeben',
    ],
    'wxyz': [
      'warten','waschen','weinen','wollen',
      'zeigen','zuhören','zurückkommen',
    ],
  },

  Nomen: {
    'abc': [
      'Allergie','Angst','Appetit','Arm','Arzt','Ärztin',
      'Atem','Atemnot','Auge','Ausgang',
      'Bad','Bauch','Bein','Behandlung','Bett',
      'Blut','Blutdruck','Brille','Brot','Bruder',
    ],
    'def': [
      'Decke','Diagnose','Durst',
      'Essen',
      'Familie','Fieber','Frau','Freund','Fuß',
    ],
    'ghi': [
      'Geschwister','Gelenk',
      'Hals','Hand','Haus','Herz','Hilfe','Hüfte','Hunger',
      'Infusion',
    ],
    'jkl': [
      'Kind','Kissen','Knie','Kopf','Kopfschmerzen','Körper',
      'Krankenhaus','Krankenschwester',
      'Leber','Logopäde','Lunge',
    ],
    'mno': [
      'Magen','Mann','Medikament','Mund','Muskel','Mutter',
      'Nacht','Nase','Neffe','Nichte','Notfall',
      'Ohr','Onkel','Operation',
    ],
    'pqrs': [
      'Partner','Pfleger','Physiotherapie','Puls',
      'Rezept','Rollstuhl','Röntgen','Rücken',
      'Schmerz','Schmerzmittel','Schulter','Schwester',
      'Schwindel','Schwellung','Sohn','Spritze','Stuhl',
    ],
    'tuv': [
      'Tag','Tablette','Tante','Tee','Tochter','Toilette',
      'Uhr','Untersuchung',
      'Vater',
    ],
    'wxyz': [
      'Wasser','Woche','Wunde',
      'Zahn','Zimmer','Zunge',
    ],
  },

  Adjektiv: {
    'abc': [
      'allein','ängstlich','aufgeregt',
      'benommen','besser','besorgt',
    ],
    'def': [
      'dankbar','deprimiert','dringend',
      'erschöpft',
      'froh','frustriert',
    ],
    'ghi': [
      'gefühllos','gereizt','geschwollen','glücklich','gut',
      'hungrig',
    ],
    'jkl': [
      'juckend',
      'kalt','klar','krank','kribbelig',
      'laut','leicht','leise',
    ],
    'mno': [
      'matt','müde',
      'nass','nötig',
    ],
    'pqrs': [
      'ruhig',
      'schläfrig','schlecht','schlimm','schmerzhaft',
      'schwach','schwindlig','stark','stechend','steif',
    ],
    'tuv': [
      'taub','traurig','trocken',
      'übel','unangenehm','unklar','unwohl',
      'verstanden','verwirrt',
    ],
    'wxyz': [
      'warm','wichtig','wund',
      'zittrig','zufrieden','zuversichtlich',
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
