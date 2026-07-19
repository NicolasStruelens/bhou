# Déploiement de Racine (Cloudflare Pages)

## 1. Mettre le code sur GitHub
Crée un repo (ou un sous-dossier `racine/` dans un repo existant comme `bhou`) et pousse tout le contenu de ce dossier `Racine/`.

## 2. Créer la base D1
Dans le dashboard Cloudflare → Workers & Pages → D1 :
- Créer une base, ex. `racine-db`.
- Onglet **Console** de la base → coller le contenu de `schema.sql` → exécuter.

## 3. Créer le projet Pages
Workers & Pages → Create → Pages → Connect to Git → choisir le repo.
- Build command : (vide, site statique)
- Build output directory : `/` (ou `racine/` si sous-dossier)

## 4. Lier la base D1 au projet
Projet Pages → Settings → Functions → D1 database bindings :
- Variable name : `DB`
- Base : `racine-db`

## 5. Définir le mot de passe
Projet Pages → Settings → Environment variables :
- `RACINE_PASSWORD` = ton mot de passe (marquer comme **secret/encrypted**)
- À faire pour les deux environnements (Production ET Preview) si tu comptes utiliser les deux.

## 6. Redéployer
Après avoir ajouté le binding D1 et la variable d'env, redéclenche un déploiement (les bindings ne s'appliquent qu'aux builds suivants).

## 7. Vérifier
- `https://<ton-projet>.pages.dev/` → doit rediriger vers l'écran de connexion.
- Entrer le mot de passe → doit arriver sur l'app.
- Tester : créer une idée, une tâche, épingler, coller un texte dans le presse-papier, le récupérer depuis un autre appareil/navigateur.

## Mises à jour d'une base déjà déployée
Si `racine-db` existe déjà (déploiement initial fait avant une évolution du schéma), exécute dans la Console D1, **une seule fois chacune, dans l'ordre** :
1. `migration_v2.sql` — corbeille
2. `migration_v3.sql` — espaces
3. `migration_v4.sql` — tags, rappels datés, favoris presse-papier
4. `migration_v5.sql` — liens entre notes
5. `migration_v6.sql` — suivi des migrations, sauvegardes automatiques, anti-bruteforce login
6. `migration_v7.sql` — énergie/someday sur les notes, presse-papier avancé (lecture unique, exclusion export, partage public par jeton)
7. `migration_v8.sql` — historique des versions d'une note
8. `migration_v9.sql` — jeton de capture rapide (iOS Raccourcis/Siri)
9. `migration_v10.sql` — recettes et listes de courses
10. `migration_v11.sql` — préférences synchronisées entre appareils
11. `migration_v12.sql` — boîte de dépôt et durée estimée des pensées

Un nouveau déploiement depuis `schema.sql` seul (première installation) inclut déjà tout ça — pas besoin de rejouer les migrations.

Pour vérifier où en est ta base : une fois connecté à l'app, l'état système (voir plus bas) affiche la version de schéma détectée. Si tu ajoutes une nouvelle migration à l'avenir, pense à terminer le fichier `.sql` par une ligne `INSERT INTO schema_migrations (version, applied_at) VALUES (N, <timestamp_ms>);` pour que ce suivi reste à jour.

## Notes
- Contenu 100% privé derrière le mot de passe — personne ne peut lire `/api/*` sans session valide (vérifié par le backend, pas par un simple mot de passe front-end).
- Exception volontaire : `/api/public/:token` (partage presse-papier) et la page `share.html` sont accessibles sans connexion — protégés uniquement par un jeton long aléatoire à expiration courte (24h max), révocable à tout moment depuis l'app.
- Presse-papier : entrées limitées à ~800 Ko chacune (texte ou fichier en base64) — pense à mettre une expiration sur les mots de passe/commandes sensibles, ou coche « lecture unique » / « ne jamais exporter ».
- Pas de lien avec www.nicolas-struelens.com (GitHub Pages, statique) — l'URL officielle sera `https://<ton-projet>.pages.dev`, comme pour SolariScreen.

## Tester la base D1 en local (optionnel)
Le poste de développement utilisé pour ce projet n'a ni Node.js ni `wrangler` installés — les commandes ci-dessous n'ont donc pas pu être exécutées ici, mais sont fournies pour une future session avec Node disponible :
```
npm install -g wrangler
wrangler d1 execute racine-db --local --file=./schema.sql
wrangler pages dev . --d1=DB=racine-db --binding RACINE_PASSWORD=test
```
⚠️ Ne PAS ajouter de fichier `wrangler.toml` à la racine du dossier déployé sur Cloudflare Pages : sa seule présence fait basculer le projet vers le système "Workers Builds" de Cloudflare, ce qui casse le déploiement classique en Production déclenché par un simple push GitHub (vécu en production sur ce projet — cause de plusieurs heures de déploiements "No deployment available"). Si tu veux tester avec `wrangler pages dev` en local un jour, crée ce fichier temporairement dans une copie du dossier, jamais dans celui poussé sur GitHub.

## Checklist de test manuel après déploiement
Pas de suite de tests automatisés (pas d'exécuteur JS dans cet environnement) — à vérifier à la main après chaque déploiement significatif :
- [ ] Connexion avec le bon mot de passe fonctionne, avec un mauvais mot de passe échoue (et se bloque après 5 essais)
- [ ] Créer une idée / tâche / note, épingler, marquer terminé, éditer, supprimer puis restaurer depuis la corbeille
- [ ] Créer un espace, changer sa couleur, le renommer, le supprimer (les racines repassent bien en « Général »)
- [ ] Ajouter un tag, filtrer par ce tag
- [ ] Poser un rappel daté sur une note, le voir apparaître dans l'onglet Rappels
- [ ] Palette de commandes : `/todo test /rappel demain 9h /espace Test /tag urgent` crée bien une tâche taguée, dans le bon espace, avec un rappel
- [ ] Sélectionner une énergie et « someday » sur une note, vérifier le filtre 🗓 dans la barre de recherche
- [ ] Onglet Aujourd'hui affiche bien rappels dus / tâches ouvertes / épinglés / clips récents
- [ ] Onglet Graphe affiche les notes liées et le clic ouvre la bonne note
- [ ] Revue hebdomadaire (📅) affiche des listes cohérentes
- [ ] Presse-papier : envoyer un texte, le récupérer/copier depuis un autre appareil ou navigateur ; tester « lecture unique » (doit disparaître après la première récupération) et « ne jamais exporter » (absent de l'export JSON)
- [ ] Partager un clip → ouvrir le lien `share.html#...` dans une fenêtre de navigation privée (sans session) → doit fonctionner ; révoquer → doit ensuite échouer
- [ ] Export JSON puis import dans un espace de test — les notes (avec énergie/someday/historique), clips (avec burn/no_export/épinglage) et recettes réapparaissent fidèlement
- [ ] État du système (⚙) affiche la bonne version de schéma, permet de créer/restaurer une sauvegarde, et le bouton « Vérifier la fidélité export/import » rapporte 0 problème
- [ ] Un clip marqué « ne jamais exporter » est absent à la fois de l'export JSON ET des sauvegardes automatiques
- [ ] Renommer un espace ou changer sa couleur sur un appareil, recharger l'app sur un autre navigateur/appareil → le changement doit apparaître (préférences synchronisées via D1)
- [ ] Recettes : créer une recette avec plusieurs ingrédients (avec et sans quantité/unité g/kg/pièce), vérifier l'autocomplétion des ingrédients courants, cocher "j'ai déjà" (la quantité/unité doit rester affichée), vérifier que "Copier/partager ce qui manque" exclut les ingrédients cochés et inclut la quantité/unité dans le texte copié, tester le bouton global "Liste de courses" (agrège toutes les recettes, dédoublonne), mettre une recette à la corbeille puis la restaurer
- [ ] Historique d'une note : éditer une note plusieurs fois, ouvrir « historique des versions », vérifier que les anciennes versions apparaissent et que « restaurer » recharge bien les anciens champs dans le formulaire
- [ ] Recherche par opérateurs : `tag:x`, `energie:x`, `espace:x`, `kind:x`, `avant:AAAA-MM-JJ`, `apres:AAAA-MM-JJ`, `someday:oui`, `pin:oui`, `depot:oui` filtrent correctement, seuls ou combinés
- [ ] Recherche en langage naturel : taper « idées maison en attente », « tâches urgentes de cette semaine », « notes épinglées » ou « à faire facile » filtre correctement sans connaître la syntaxe d'opérateurs (accents compris : « épinglées », « à faire »)
- [ ] Capture rapide (⚙ → section iOS Raccourcis) : générer le lien, faire un `curl -X POST <lien> -d '{"text":"test"}'` (ou un vrai raccourci iOS) et vérifier qu'une nouvelle idée taguée #raccourci apparaît ; révoquer le lien et vérifier que l'appel échoue ensuite
- [ ] Navigation au clavier uniquement (Tab/Entrée/Espace, sans souris) : ouvrir/fermer une modale, cocher une tâche, épingler, retirer un ingrédient de recette, ouvrir une note liée depuis un rappel — tout doit être atteignable et un contour de focus doit rester visible
- [ ] Hors-ligne : charger l'app une première fois en ligne, puis couper le réseau et recharger la page → l'app doit s'ouvrir et montrer les dernières données connues ; déposer une pensée, cocher une tâche ou supprimer un élément doit afficher « sera synchronisé au retour du réseau » ; remettre le réseau → les actions se synchronisent automatiquement sans doublon
- [ ] Navigation simplifiée : la barre du haut montre Clairière / Racines / Graphe / Atelier ; cliquer « Atelier » ouvre un menu avec Presse-papier, Recettes, Rappels, Corbeille ; cliquer un élément y navigue et referme le menu ; cliquer ailleurs ou Échap referme aussi ; le bouton Atelier reste visuellement actif tant qu'on est dans une de ces 4 vues
- [ ] Mode Focus : les notes en someday n'apparaissent jamais, celles marquées énergie "attente" non plus ; un rappel en retard passe en premier ; la session s'arrête à 7 éléments maximum avec un message indiquant combien attendent la prochaine fois ; si un filtre d'énergie est actif dans la barre de recherche, Focus le respecte aussi
- [ ] La Clairière (onglet Aujourd'hui) : affiche jusqu'à 4 cartes (Maintenant / À faire germer / Résonance / En attente), jamais de note someday dedans ; tester chaque bouton de décision (Faire maintenant, Garder pour plus tard, Développer, Relier, Pas aujourd'hui, Ne m'intéresse plus) ; « Pas aujourd'hui » ne doit plus proposer la même note avant le lendemain ; le reste (rappels dus/tâches/épinglés/presse-papier récent) continue d'apparaître en dessous sous « Le reste »
- [ ] Mode Agir (Focus) : cliquer sur le bouton cible ouvre maintenant un choix de temps (5/15/30/60 min) et d'énergie avant de démarrer ; vérifier que le nombre de cartes proposées varie selon le temps choisi et que l'énergie choisie filtre bien les tâches proposées
- [ ] Suggestions "Notes proches" (Faire germer v1) : ouvrir l'édition d'une note qui partage des tags/mots avec une autre → un bloc "Notes proches" doit apparaître avec un bouton "Relier" (un geste, crée le lien immédiatement) et un bouton pour ignorer définitivement une suggestion (elle ne doit plus jamais réapparaître, même après rechargement)
- [ ] La Constellation (onglet Graphe) : les notes sont regroupées visuellement par tag/espace (max 8 groupes, le reste sous "Divers") ; aucun nœud ne doit se chevaucher, même avec beaucoup de notes ; les libellés ne s'affichent PAS tous en permanence — seulement au survol/sélection, ou si peu de notes (≤6), ou à fort zoom (>2.2x) ; les notes isolées ont un contour en pointillés ; une note modifiée dans les 3 derniers jours a un halo qui pulse ; des lignes en pointillés jaunes proposent des liens (max 2 par note, pour éviter l'effet toile d'araignée) — cliquer dessus crée le lien ; cliquer un nœud puis un second affiche le chemin entre les deux ; cliquer deux fois le même nœud l'ouvre ; molette pour zoomer, glisser pour déplacer, bouton "Recentrer" ; le filtre temporel doit changer les notes affichées ; le bouton "Mode promenade" cache la barre d'outils et affiche un message calme
- [ ] Trois modes (Déposer/Déplier/Agir) : une barre visible sur tous les écrans propose ces 3 raccourcis — Déposer ouvre la boîte de dépôt sans rangement, Déplier ouvre le Graphe, Agir ouvre directement le choix temps/énergie du mode Focus
- [ ] Pousse de la semaine : dans l'onglet Aujourd'hui, si une racine a gagné des branches cette semaine, un bandeau doit l'indiquer et cliquer dessus doit ouvrir cette note
- [ ] Les Saisons (bouton calendrier) : la revue hebdomadaire a maintenant 4 catégories (Germé/Mûri/Dormant/Abandonné) plus une carte "pensée oubliée" tirée au hasard parmi les notes non touchées depuis 6 mois, avec un bouton pour en tirer une autre
- [ ] Regroupement de graines : si 3 idées récentes ou plus partagent un tag, un bandeau doit proposer de les regrouper sous une nouvelle racine ("Regrouper") ou d'ignorer la suggestion ("Pas maintenant", ne doit plus jamais réapparaître pour ce groupe précis)
- [ ] Recharger l'app après un déploiement ne montre pas d'anciens fichiers (vérifier que les `?v=N` ont bien été incrémentés)

## Version 49 — Constellation utile

La v49 ne change pas le schéma D1 : **aucune migration SQL à exécuter** si la version 12 est déjà présente. Il faut seulement publier l'ensemble des fichiers, notamment le nouveau `assets/js/graph-v49.js`, puis forcer une actualisation de l'application installée.

Checklist spécifique après déploiement :
- [ ] État du système affiche **App v49** et **Schéma v12**.
- [ ] Constellation s'ouvre par défaut sur la lentille **À regarder** et reste lisible avec beaucoup de pensées.
- [ ] Les lentilles Racines, En attente, Endormies et Tout changent réellement le contenu affiché.
- [ ] La recherche de Constellation et le filtre temporel fonctionnent ensemble ; Effacer restaure la vue.
- [ ] Un clic sélectionne une pensée et explique pourquoi elle est affichée ; un double-clic l'ouvre.
- [ ] Les branches parent-enfant et les liens déjà créés sont visuellement distincts.
- [ ] Une suggestion de lien n'est jamais créée automatiquement : elle affiche d'abord Relier / Pas pertinent.
- [ ] La liste accessible sous le graphe permet d'explorer les pensées au clavier.
- [ ] Sur mobile, la fiche d'une pensée s'ouvre en panneau bas au-dessus de la navigation.
- [ ] Sur mobile, Atelier donne aussi accès aux rappels, à l'import, à l'export et à l'état du système.
- [ ] Agir en 5 minutes ne propose aucune tâche trop longue et respecte strictement l'énergie choisie.
- [ ] Une pensée déposée hors ligne apparaît immédiatement et indique qu'elle sera synchronisée.
- [ ] Échap ferme la dernière fenêtre modale ouverte.

## Version 50 — Le poste de pilotage quotidien

La v50 ne change pas le schéma D1 : **aucune migration supplémentaire** si la version 12 est déjà installée. Si la base est encore en version 11, exécuter `migration_v12.sql` une seule fois avant de publier les fichiers.

Changements majeurs :
- une vraie boîte d'entrée pour trier les pensées déposées sans perdre le fil ;
- un radar qui signale les racines bloquées, dormantes ou sans prochaine action ;
- une Clairière plus calme : une action principale, les décisions secondaires à la demande ;
- des Racines moins chargées grâce aux actions contextuelles repliées ;
- une interface GSM compacte, avec filtres repliables et cartes de Clairière balayables horizontalement ;
- l'Atelier mobile donne aussi accès à la revue, au thème et à la déconnexion ;
- cache hors ligne et ressources unifiés en **v50**.

Checklist spécifique après déploiement :
- [ ] État du système affiche **App v50** et **Schéma v12**.
- [ ] La boîte d'entrée affiche le bon nombre de pensées déposées et le tri progresse sans recharger toute la page.
- [ ] « Ranger et développer » ouvre l'édition de la pensée sélectionnée.
- [ ] Le radar affiche au maximum quatre racines avec une raison compréhensible.
- [ ] Les cartes de Clairière n'affichent qu'une action principale et le bouton `•••` révèle les autres choix.
- [ ] Dans Racines, le bouton `•••` ouvre les actions secondaires sans masquer le bouton Terminer.
- [ ] Sur un écran de 390 px, les quatre onglets restent sur une ligne et Atelier est entièrement parcourable.
- [ ] Sur mobile, les cartes de Clairière se parcourent horizontalement et les filtres de Racines restent repliés au départ.
- [ ] Après actualisation forcée, aucun ancien fichier v49 ne reste chargé par le service worker.
