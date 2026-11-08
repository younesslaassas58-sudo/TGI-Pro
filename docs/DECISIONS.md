# Décisions de mise en œuvre

- Conserver les patterns, dépendances et couches déjà présents plutôt que réécrire les modules.
- Ne pas modifier les règles métier par supposition lorsque le schéma ou les règles existantes sont ambigus ; consigner le manque comme partiel.
- Ne pas installer de dépendance ni exécuter de commande système ; reporter les vérifications et outils nécessaires dans COMMANDES_A_LANCER.md.
- Garder les montants en centimes et les filtres multi-critères côté client pour éviter les index composites.
- Éviter les modifications à grande échelle non vérifiées ; traiter les priorités dans l'ordre et marquer honnêtement les éléments non vérifiés.
- Remplacer les statistiques de démonstration par des métriques calculées sur les données accessibles au rôle ; afficher une liste partielle plutôt que des chiffres métier inventés.
- Considérer le contenu d'un contrat existant comme figé pour le commercial ; seules les transitions de statut/résiliation sont permises par les règles.
- Conserver les tests de règles hors du test Vitest standard et exécuter leur config dédiée seulement avec l'émulateur Firestore.
