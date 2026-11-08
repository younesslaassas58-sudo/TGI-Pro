# État de finalisation

Légende : [ ] à faire · [~] partiel · [x] fait

## P1 — Audit et complétion des modules
- [~] Authentification et profil, dont changement de mot de passe (connexion, réinitialisation et profil existants ; changement ajouté, non exécuté)
- [~] Paramètres société et contrats (écrans et réglages présents ; audit champ par champ à terminer)
- [~] Clients et parc : parcours, fiches, pickers, import/export et onglets (modules présents ; audit d'intégration et validations à terminer)
- [~] Techniciens et utilisateurs (modules présents ; audit des restrictions et des parcours à terminer)
- [~] Interventions : vues, urgence, média, transitions, stock et documents (module présent ; audit de complétude à terminer)
- [~] Catalogue, fournisseurs, devis, commandes et livraisons (modules présents ; audit des transitions et documents à terminer)
- [~] Recouvrement et contrats (logique métier et tests présents ; audit UI/documents à terminer)
- [~] Stock et inventaires (écrans, transactions et tests présents ; audit de complétude à terminer)
- [~] Moteur documentaire et modèles (PDF/Word/Excel présents ; audit de chaque modèle et pagination à terminer)
- [~] Permissions par rôle sur les routes, actions et données (garde-fous client et règles présentes ; audit global non terminé)
- [~] Couverture des logiques métier par Vitest (tests de commercial, stock, recouvrement et interventions présents ; couverture exhaustive non vérifiée)

### Résumé d'audit P1
- Présents et confirmés par inspection : login par e-mail, réinitialisation de mot de passe, profil/civilité/photo, modules métier listés et tests pour Stock/Recouvrement/Interventions/Commercial.
- Le changement de mot de passe avec réauthentification et contrôle de robustesse est ajouté à la page profil.
- Incomplet/à confirmer : le tableau de bord a été partiellement rendu réel dans P3 ; la conformité de tous les autres parcours métier doit encore être auditée.
- L'audit intégral des formulaires, actions et règles par module n'est pas terminé ; ne pas considérer P1 prêt pour production.

## P2 — Sécurité et règles Firestore
- [~] Règles Firestore consolidées, refus par défaut et commentées (règles explicites couvrent les collections connues ; ancien accès générique actif supprimé ; règles des clauses/avenants et commentaires exhaustifs restent à compléter)
- [x] Configuration Firebase et index (firebase.json, émulateur Firestore et indexes vides)
- [~] Tests de règles dédiés et commande documentée (7 cas ajoutés ; dépendance de test non installée et émulateur non exécuté)
- [x] En-têtes et CSP Report-Only Vercel, réécritures SPA excluant /api
- [~] Routes API, validation, contrôle des droits et absence de secrets (routes utilisateurs protégées par requireDirecteur ; terminaison d’intervention conserve son contrôle rôle/affectation ; audit complet non exécuté)
- [x] Exclusions de secrets dans .gitignore (env, Vercel, clés et certificats usuels)

### Résumé d'audit P2
- Le catch-all qui autorisait toute collection inconnue aux comptes actifs a été supprimé ; le refus final s'applique désormais aux collections non explicitement autorisées.
- Les commerciaux ne peuvent plus modifier le contenu d'un contrat existant ; les changements de statut/résiliation restent autorisés.
- Aucun test Firestore n'a pu être exécuté conformément à l'interdiction de lancer des commandes système/npm.

## P3 — Tableau de bord, alertes et recherche globale
- [~] Tableau de bord par rôle et période (les nombres fictifs ont été remplacés par des comptes réels d'interventions, devis à relancer et échéances en retard ; période, finances, parc, stock et habilitations restent à intégrer)
- [ ] Centre de notifications dérivées par rôle
- [ ] Recherche globale et raccourcis

### Résumé d'audit P3
- Les cartes réelles sont cliquables et les devis/échéances ne sont chargés que pour directeur et commercial.
- Le tableau de bord demeure incomplet ; les métriques et fonctionnalités non présentes sont consignées comme restant à faire, sans chiffres factices.

## P4 — PWA et mode hors ligne
- [ ] Manifest, icônes et raccourcis
- [ ] Service worker, page hors ligne et mise à jour
- [ ] Persistance Firestore multi-onglets
- [ ] Blocage des opérations transactionnelles hors ligne
- [ ] Indicateur hors ligne, installation et instructions iOS

## P5 — Performance
- [ ] Routes paresseuses avec squelettes
- [ ] Découpage manuel des bundles
- [ ] Stale time et abonnements temps réel mesurés/limités

## P6 — Journal et sauvegarde
- [ ] Journal append-only et intégration des opérations sensibles
- [ ] Page de journal et export
- [ ] Export JSON de sauvegarde
- [ ] Guide de restauration et recommandations de sauvegarde

## P7 — Robustesse et finitions
- [ ] Error boundaries et pages d'erreur cohérentes
- [ ] Protection des formulaires modifiés et anti-double clic
- [ ] Traduction des erreurs Firebase
- [ ] Accessibilité, modals et impression
- [ ] Déconnexion après inactivité configurable
- [ ] Vérification responsive à 360 px

## P8 — Documentation et déploiement
- [ ] README complet
- [ ] Guide utilisateur par rôle
- [ ] Guide de déploiement
- [ ] Checklist QA

## P9 — Vérification finale
- [ ] Lint
- [ ] Tests
- [ ] Build
- [ ] Actions manuelles listées

## Progression
- Priorité active : P3 (tableau de bord partiel ; alertes et recherche globale non commencées)
- Les commandes de validation n'ont pas été lancées conformément à la consigne de ne pas exécuter de commandes npm ou système.
