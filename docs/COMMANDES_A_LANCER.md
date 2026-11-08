# Commandes à lancer manuellement

- `npm run lint` — vérifier ESLint après les changements.
- `npm run test` — exécuter la suite Vitest standard.
- `npm install -D @firebase/rules-unit-testing` — installer le SDK requis pour les tests de règles Firestore (aucune dépendance n'a été ajoutée au manifeste).
- `firebase emulators:exec --only firestore "npm run test:rules"` — exécuter les tests `tests/rules/`; requiert Firebase CLI et Java.
- `npm run build` — vérifier le type-check et le build de production.
- `npm run dev` — démarrer uniquement le client Vite pour le développement sans fonctions serveur.
- `vercel dev` — démarrer localement l'application avec les fonctions API Vercel.
