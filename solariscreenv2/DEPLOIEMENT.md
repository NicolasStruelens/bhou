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

### 5bis) ⚠️ OBLIGATOIRE — Exempter les pages PUBLIQUES (lien envoyé au client)

Sans cette étape, **le client ne peut jamais ouvrir son devis ou son suivi de commande** : Cloudflare Access
intercepte la page avant même qu'elle n'atteigne le code et affiche un écran de connexion que le client ne
peut pas franchir (il n'a pas de compte autorisé). Le code (`functions/api/[[catchall]].js`) est déjà écrit
pour que ces routes soient publiques par jeton non-devinable — il manque uniquement la policy Cloudflare.

**Zero Trust → Access → Applications → Add an application → Self-hosted**, une application dédiée avec
policy **Bypass** (pas *Allow*) pour CHACUN de ces chemins, sur le même domaine que l'application de l'étape
5 (Cloudflare évalue le chemin le plus spécifique en priorité, donc ces exceptions n'affaiblissent pas la
protection du reste du site) :

| Chemin à bypasser | Pourquoi |
|---|---|
| `/track` **(sans `.html`, voir piège ci-dessous)** | Suivi de commande envoyé au client après signature (jamais de prix) |
| `/devis-review` **(sans `.html`)** | Consultation/acceptation du devis avant signature (avec prix, jamais la marge) |
| `/api/track` | Backend de `/track` |
| `/api/devis-review` | Backend de `/devis-review` |
| `/assets/*` | CSS/JS/logo chargés par ces 2 pages — fichiers statiques, aucune donnée |

**⚠️ Piège « Clean URLs » (vécu en prod, à ne plus refaire)** : Cloudflare Pages redirige automatiquement
`/track.html` → `/track` (retire l'extension) **avant** qu'Access n'évalue la requête. Si le chemin bypassé
dans Access est saisi AVEC `.html`, il ne correspond jamais à ce que Access voit réellement → écran de
connexion pour le client malgré une policy bypass en apparence correcte. **Les chemins ci-dessus doivent
être saisis SANS `.html`.** Pour diagnostiquer ce cas précis : sur l'écran de connexion Cloudflare qui
bloque à tort, décoder le JWT dans le paramètre `meta` de l'URL (partie du milieu, base64url) — le champ
`redirect_url` révèle le chemin exact qu'Access a réellement reçu.

**Vérification** : ouvre `https://<ton-site>/devis-review.html?t=xxx` (ou copie un vrai lien depuis la fiche
devis) **en navigation privée** → la page doit s'afficher directement, **sans** écran de connexion Cloudflare.

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

## 9) Photos (ouvertures, SAV, RDV, simulateur visuel) — bucket R2 dédié

Même logique que les documents fournisseur (étape 8) : les photos compressées ne vont plus dans le JSON
D1 mais dans un **bucket R2 séparé** — un devis avec beaucoup de photos ne fait plus grossir la ligne D1.
**Sans ce bucket, rien ne casse** : l'appli retombe automatiquement sur l'ancien comportement (photo
stockée directement dans le devis, comme avant) — c'est du best-effort, pas un blocage.

1. **Créer le bucket** : Dashboard Cloudflare → **R2** → **Create bucket**.
   - Nom : `solariscreen-photos` (ou ce que tu veux).
   - Emplacement : Automatic. Pas besoin d'accès public.
2. **Lier le bucket au projet Pages** : **Settings → Functions → R2 bucket bindings** → **Add binding**.
   - Variable name : **`PHOTOS`** (exactement — c'est le nom que le code attend, `env.PHOTOS`).
   - Bucket : `solariscreen-photos`.
3. **Redéployer** pour que la liaison prenne effet.
4. Vérifie : ajoute une photo à une ouverture (simulateur ou mode terrain) → elle doit s'afficher
   normalement. Si le bucket n'est pas lié, la photo reste stockée comme avant (dans le devis) —
   aucune erreur visible, juste pas de gain d'espace tant que le bucket n'est pas branché.

**Limitation connue (acceptée)** : seules les **nouvelles** photos (ajoutées après ce déploiement)
partent en R2. Les photos déjà présentes sur tes devis existants restent en base64 dans le JSON —
elles continuent de s'afficher normalement, elles ne sont juste pas migrées rétroactivement. Autre
limitation mineure : supprimer une photo d'une ouverture ne supprime pas (encore) le fichier dans R2 —
il reste orphelin (coût de stockage négligeable, R2 est gratuit jusqu'à 10 Go).

---

## ✅ Vérifications finales

- `https://<site>/api/devis` en navigation privée (non connecté) → **bloqué par Access** (page de login). ✔ faille fermée.
- `https://<site>/devis-review.html?t=xxx` (un vrai lien copié depuis une fiche devis) en navigation privée → **s'ouvre directement, sans écran de connexion**. Sinon voir 5bis (bypass Access manquant — le client ne peut pas accéder à son devis).
- Connecté : l'app charge tes devis, le dashboard les liste, CRM et factures fonctionnent.
- `Cf-Access` actif : le badge passe **● En ligne** dans le dashboard.

## 📦 À propos des données
- **Devis existants** : déjà dans D1 → visibles dès le binding fait (étape 3).
- **Clients / factures** : nouvelles tables, vides au départ — le CRM se remplit automatiquement à partir des devis ; les factures se créent à la demande.
- **Anciennes données localStorage** (navigateur) : si tu en as, utilise le bouton **⬇ Export** (ancien dashboard) puis **⬆ Import** dans le nouveau, ou laisse l'API D1 faire foi.
