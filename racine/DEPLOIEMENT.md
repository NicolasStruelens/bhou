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
- [ ] Export JSON puis import dans un espace de test — les notes et clips réapparaissent avec la bonne hiérarchie
- [ ] État du système (⚙) affiche la bonne version de schéma et permet de créer/restaurer une sauvegarde
- [ ] Recettes : créer une recette avec plusieurs ingrédients, cocher "j'ai déjà", vérifier que "Copier/partager ce qui manque" exclut les ingrédients cochés, tester le bouton global "Liste de courses" (agrège toutes les recettes, dédoublonne), mettre une recette à la corbeille puis la restaurer
- [ ] Historique d'une note : éditer une note plusieurs fois, ouvrir « historique des versions », vérifier que les anciennes versions apparaissent et que « restaurer » recharge bien les anciens champs dans le formulaire
- [ ] Recherche par opérateurs : `tag:x`, `energie:x`, `espace:x`, `kind:x`, `avant:AAAA-MM-JJ`, `apres:AAAA-MM-JJ`, `someday:oui`, `pin:oui` filtrent correctement, seuls ou combinés
- [ ] Capture rapide (⚙ → section iOS Raccourcis) : générer le lien, faire un `curl -X POST <lien> -d '{"text":"test"}'` (ou un vrai raccourci iOS) et vérifier qu'une nouvelle idée taguée #raccourci apparaît ; révoquer le lien et vérifier que l'appel échoue ensuite
- [ ] Recharger l'app après un déploiement ne montre pas d'anciens fichiers (vérifier que les `?v=N` ont bien été incrémentés)
