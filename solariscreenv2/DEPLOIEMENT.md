# 🚀 Déploiement SolariScreen ERP (v3)

Ce dossier (`v2/`) est un **site Cloudflare Pages complet et déployable**. Tu pousses son contenu sur GitHub, Cloudflare Pages le build (rien à compiler) et le sert.

```
v2/
├── index.html              ← page d'accueil (lanceur)
├── app/                    ← simulateur, dashboard, devis, clients, factures, facture
├── assets/                 ← css, js, images
├── functions/api/[[catchall]].js   ← LE backend (API unique)
├── schema.sql              ← tables D1 (devis + clients + factures)
├── _routes.json            ← /api/* → fonction ; le reste = statique
└── tests/                  ← (dev seulement, sans impact)
```

---

## 1) Pousser sur GitHub

Crée un dépôt (ex. `solariscreen-erp`) et pousse le **contenu de `v2/`** à la racine du dépôt :

```bash
cd "v2"
git init
git add .
git commit -m "SolariScreen ERP v3"
git branch -M main
git remote add origin https://github.com/NicolasStruelens/solariscreen-erp.git
git push -u origin main
```

## 2) Créer le projet Cloudflare Pages

Dashboard Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → choisis le dépôt.
- Framework preset : **None**
- Build command : *(vide)*
- Build output directory : `/`
- Deploy.

## 3) Lier la base D1 (tes vrais devis !)

Tu réutilises **la base existante** `solariscreen-db` → tes devis actuels apparaîtront automatiquement, **aucune migration de données à faire**.

Pages → ton projet → **Settings → Functions → D1 database bindings** :
- Variable name : `DB`
- Database : `solariscreen-db`

Puis **redéploie** (Deployments → Retry deployment) pour que le binding prenne effet.

## 4) Créer les nouvelles tables (clients + factures)

La table `devis` existe déjà. On ajoute `clients` et `factures` (le script est sans danger, `IF NOT EXISTS`) :

```bash
wrangler d1 execute solariscreen-db --file=schema.sql --remote
```

Vérifie : ouvre `https://<ton-site>/api/health` → tu dois voir `{"ok":true,"devis_count":N,"version":"3.0"}`.

## 5) 🔒 Sécuriser l'API (corrige la faille de l'audit)

Le point critique : l'API doit être **derrière Cloudflare Access**, comme les pages.

1. **Zero Trust → Access → Applications → Add an application → Self-hosted**.
2. Domaine de l'app : ton domaine Pages (ex. `solariscreen-erp.pages.dev` **ou** ton sous-domaine custom).
   - **Important** : le chemin doit couvrir **tout le site, y compris `/api/*`** (laisse le path vide = tout le domaine). Comme l'API est **same-origin** (`/api/*`), elle est alors protégée automatiquement.
3. Policy : Allow → emails autorisés (toi + Yannick).
4. (Optionnel, ceinture + bretelles) Pages → Settings → **Environment variables** → ajoute `REQUIRE_ACCESS = true`. La fonction rejettera alors toute requête sans jeton Access.

## 6) ⚠️ Supprimer l'ancien Worker (ferme le trou)

L'ancien Worker `solariscreen-api` (`*.workers.dev`, sans authentification, CORS `*`) était la faille. Maintenant inutile :
- Workers & Pages → `solariscreen-api` → **Settings → Delete**, **ou** au minimum retire ses *routes* `nicolas-struelens.com/api/*` (sinon elles intercepteraient `/api/*` avant Pages).

## 7) Domaine custom (optionnel)

Pages → **Custom domains** → ajoute par ex. `erp.nicolas-struelens.com`. L'app et l'API restent same-origin.

## 8) Documents fournisseur (bon de commande / facture Harol) — bucket R2

Les PDF ne sont **jamais** stockés dans D1 (ça a déjà causé un souci avec des photos non compressées) —
ils vont dans un bucket **R2** (stockage objet Cloudflare, gratuit jusqu'à 10 Go). Sans ce bucket,
le bouton « Ajouter un fichier » sur la fiche devis affichera une erreur claire, rien ne casse ailleurs.

1. **Créer le bucket** : Dashboard Cloudflare → **R2** (menu de gauche) → **Create bucket**.
   - Nom : `solariscreen-documents` (ou ce que tu veux, le nom n'a pas d'importance).
   - Emplacement : Automatic. Pas besoin d'activer l'accès public.
2. **Lier le bucket au projet Pages** : ton projet Pages → **Settings → Functions → R2 bucket bindings** → **Add binding**.
   - Variable name : **`DOCS`** (exactement — c'est le nom que le code attend, `env.DOCS`).
   - Bucket : `solariscreen-documents`.
3. **Redéployer** (Deployments → Retry deployment, ou un simple `git push`) pour que la liaison prenne effet — comme pour la base D1 à l'étape 3, un binding ajouté après coup ne s'applique qu'au prochain déploiement.
4. Vérifie sur une fiche devis (`vue.html`) : le bouton « Ajouter un fichier » dans la carte **Documents fournisseur** doit fonctionner (plus d'erreur « Stockage non configuré »).

---

## ✅ Vérifications finales

- `https://<site>/api/devis` en navigation privée (non connecté) → **bloqué par Access** (page de login). ✔ faille fermée.
- Connecté : l'app charge tes devis, le dashboard les liste, CRM et factures fonctionnent.
- `Cf-Access` actif : le badge passe **● En ligne** dans le dashboard.

## 📦 À propos des données
- **Devis existants** : déjà dans D1 → visibles dès le binding fait (étape 3).
- **Clients / factures** : nouvelles tables, vides au départ — le CRM se remplit automatiquement à partir des devis ; les factures se créent à la demande.
- **Anciennes données localStorage** (navigateur) : si tu en as, utilise le bouton **⬇ Export** (ancien dashboard) puis **⬆ Import** dans le nouveau, ou laisse l'API D1 faire foi.
