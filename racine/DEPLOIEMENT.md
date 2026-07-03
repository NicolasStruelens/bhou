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

## Notes
- Contenu 100% privé derrière le mot de passe — personne ne peut lire `/api/*` sans session valide (vérifié par le backend, pas par un simple mot de passe front-end).
- Presse-papier : entrées limitées à ~800 Ko chacune (texte ou fichier en base64) — pense à mettre une expiration sur les mots de passe/commandes sensibles.
- Pas de lien avec www.nicolas-struelens.com (GitHub Pages, statique) — l'URL officielle sera `https://<ton-projet>.pages.dev`, comme pour SolariScreen.
