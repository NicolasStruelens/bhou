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

**Application 1** — chemins sans extension :

| Chemin à bypasser | Pourquoi |
|---|---|
| `/track` | Suivi de commande envoyé au client après signature (jamais de prix) |
| `/devis-review` | Consultation/acceptation du devis avant signature (avec prix, jamais la marge) |
| `/api/track` | Backend de `/track` |
| `/api/devis-review` | Backend de `/devis-review` |
| `/assets/*` | CSS/JS/logo chargés par ces 2 pages — fichiers statiques, aucune donnée |

**Application 2** (une appli séparée : la 1 est déjà à 5/5 destinations, le max par appli) — les mêmes 2
pages, **avec** extension cette fois :

| Chemin à bypasser | Pourquoi |
|---|---|
| `/track.html` | Variante avec extension de `/track` |
| `/devis-review.html` | Variante avec extension de `/devis-review` |

**⚠️ Piège « Clean URLs » (vécu en prod à deux reprises, à ne plus refaire)** : Cloudflare Pages redirige
automatiquement certaines requêtes `/foo.html` → `/foo` (retire l'extension) **avant** qu'Access ne les
évalue — mais ce comportement n'est **pas fiable ni homogène entre les pages** (probablement un effet de
cache CDN qui se propage à des rythmes différents selon le fichier) : `/track.html` a été vu redirigé vers
`/track`, tandis qu'au même moment `/devis-review.html` a été vu reçu **tel quel, avec l'extension**. Se
fier à une seule forme (avec ou sans `.html`) casse tôt ou tard l'autre. **D'où les deux applications
ci-dessus, qui couvrent les deux formes pour ne plus jamais dépendre de ce comportement.** Pour
diagnostiquer ce cas précis : sur l'écran de connexion Cloudflare qui bloque à tort, décoder le JWT dans le
paramètre `meta` de l'URL (partie du milieu, base64url) — le champ `redirect_url` révèle le chemin exact
qu'Access a réellement reçu.

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

## 10) 🤖 L'assistant (Claude) — la clé API

Le bouton **Assistant** du menu parle à Claude par `/api/assistant`. Tant que la clé manque, il répond
« pas encore branché » : rien d'autre dans l'ERP n'en dépend.

1. **Créer la clé** : console Anthropic (platform.claude.com) → *API Keys* → *Create Key*, nom
   `solariscreen-erp`. Elle ne s'affiche qu'une fois : la copier tout de suite.
2. **Limiter la dépense** sur la même console (*Limits*) : une limite mensuelle. C'est le vrai garde-fou ;
   le plafond de l'ERP (150 échanges par personne et par jour) n'est qu'un frein de secours.
3. **La donner à Cloudflare, CHIFFRÉE** : Pages → le projet → *Settings* → *Variables and Secrets* →
   *Add* → type **Secret**, nom `ANTHROPIC_API_KEY`, environnement **Production**.
   ⚠️ Jamais dans le dépôt (il est PUBLIC), jamais collée dans un message ou une conversation.
4. **Redéployer** (*Deployments* → le dernier → *Retry deployment*) : un secret ne vaut que pour les
   déploiements suivants.
5. Facultatif : variable `ASSISTANT_PLAFOND_JOUR` pour changer le plafond quotidien.

Rien à installer ni à compiler : la route appelle l'API d'Anthropic directement (pas de SDK,
pas de `package.json` — voir CLAUDE.md, règle 41). L'assistant exige une identité Access (Nicolas ou
Yannick) : sur l'aperçu d'une branche, qui n'est pas derrière Access, il répond 403 — c'est voulu.
La table D1 `assistant_usage` (créée toute seule) compte les appels et les jetons par jour et par personne.

---

## 11) ✉️ Les mails de relance envoyés par l'ERP (SMTP2GO)

Le côté ERP est **déjà construit** (CLAUDE.md, règle 43) : dans la fenêtre de relance d'une fiche devis,
le bouton « Envoyer le mail » est grisé et marqué **En construction** tant que les deux pièces ci-dessous
manquent. Il s'allume tout seul quand elles sont là — rien à redéployer côté code.

**Ce que fait Yannick (ou celui qui a l'accès) chez SMTP2GO :**
1. **Créer le compte** (formule gratuite, serveurs en Europe), avec une adresse de la société.
2. *Sending* → *Verified Senders* → ajouter le **domaine** `solariscreen.be`.
3. **Max ajoute les 3 CNAME** que SMTP2GO affiche, dans le DNS du domaine. On ne touche **ni au SPF ni
   aux MX** : les mails reçus continuent d'arriver dans Zoho.
4. Revenir sur SMTP2GO → *Verify*.
5. *Sending* → *API Keys* → *Add* : nom `ERP SolariScreen - production`, droit d'**envoi seulement**.
   Dans les réglages du compte : suivi des ouvertures et des clics **désactivé**, pied de page de
   désinscription **désactivé** (une relance n'est pas une newsletter).

**Ce que fait Nicolas :**
6. **La clé dans Cloudflare, CHIFFRÉE** : Pages → le projet → *Settings* → *Variables and Secrets* →
   *Add* → type **Secret**, nom `SMTP2GO_API_KEY`, environnement **Production** uniquement.
   ⚠️ Jamais dans le dépôt (il est PUBLIC), jamais collée dans un message ou une conversation.
7. **Redéployer** (*Deployments* → le dernier → *Retry deployment*).
8. **ERP → Paramètres → E-mails** : l'adresse d'expédition (sur `solariscreen.be`), l'adresse de
   réponse (celle qu'on lit dans Zoho) et le nom affiché → *Enregistrer*. L'encadré passe à **Branché**.
9. **Premier essai sur soi** : un devis de test à sa propre adresse, puis un envoi vers
   [mail-tester.com](https://www.mail-tester.com) — viser 9/10 ou plus avant le premier vrai client.

Facultatif : `SMTP2GO_REGION` = `eu` si SMTP2GO répond que la région du compte ne correspond pas ;
`MAIL_PLAFOND_JOUR` pour changer le plafond (60 mails par personne et par jour).

L'envoi exige une identité Access (403 sinon) et l'expéditeur est relu dans les réglages par le
serveur, jamais fourni par le navigateur. Chaque envoi (réussi ou non) est noté dans la table D1
`mail_journal` (créée toute seule), et le mail parti est archivé dans la fiche du client.

---

## 12) 🧪 Le bac à sable : une base d'ESSAI pour les aperçus de branche

**Pourquoi.** Essayer l'ERP avec un client fictif en PRODUCTION n'est pas inoffensif : chaque facture
d'essai consomme un vrai numéro F2026-xxx (jamais réutilisé), le CA, le cockpit et les compteurs de
l'autre le comptent, et le journal d'activité en garde la trace. Le bac à sable donne aux **aperçus
de branche** (`<branche>.solariscreen-erp.pages.dev`) leur PROPRE base et leur propre stockage photos.
La production (`solariscreen-erp.pages.dev`) ne change pas : mêmes liaisons, mêmes données.
Dans l'ERP, un aperçu se reconnaît : bande hachurée sous le bandeau, pastille **ESSAI** devant le
nom de la page, et « ESSAI · » dans le titre de l'onglet (CLAUDE.md, règle 46).

**⚠️ L'ORDRE EST IMPORTANT : Access d'abord, la base ensuite.** Le dépôt est public et les adresses
d'aperçu se devinent (le nom de la branche) : une base branchée sur un aperçu NON protégé serait une
API ouverte à tous. La page de remplissage refuse d'ailleurs d'écrire tant qu'aucune identité Access
ne répond.

**1. Protéger les aperçus par Access**
1. Workers & Pages → `solariscreen-erp` → **Settings** → **General** → **Enable access policy**.
2. Zero Trust → **Access** → **Applications** : ouvrir l'application que Cloudflare vient de créer pour
   les aperçus. Vérifier que son domaine est bien le joker **`*.solariscreen-erp.pages.dev`** (il doit
   couvrir les aperçus à adresse aléatoire ET les adresses de branche ; la doc Cloudflare ne cite que
   les premières). Ne PAS mettre le domaine de production (sans rien devant) : il a déjà son application.
3. Dans sa **policy** : Allow → emails `nicolas.struelens@me.com` et `info@solariscreen.be` (par défaut,
   elle n'autorise que les membres du compte Cloudflare — Yannick n'en fait peut-être pas partie).
4. **Vérifier en navigation privée** : `https://amelioration-bac-a-sable.solariscreen-erp.pages.dev/api/health`
   (ou l'adresse de n'importe quelle branche) doit afficher l'écran de connexion Cloudflare, **pas** du
   JSON. Si du JSON s'affiche, l'adresse de branche n'est pas couverte : revoir le point 2.

**2. Créer la base d'essai et ses tables**
1. Workers & Pages → **D1 SQL Database** → **Create** → nom `solariscreen-essai`.
2. Ouvrir la base → onglet **Console** → coller TOUT le contenu de `solariscreenv2/schema.sql` → **Execute**.
   (Sans danger : tout est en `CREATE TABLE IF NOT EXISTS`. Les autres tables se créent toutes seules.)

**3. Créer le stockage photos et documents d'essai**
1. **R2** → **Create bucket** → nom `solariscreen-essai`, emplacement Automatic, pas d'accès public.
   Un seul bucket suffit pour les deux liaisons : photos et documents ont des chemins distincts.

**4. Brancher le tout sur l'environnement PREVIEW seulement**
Workers & Pages → `solariscreen-erp` → **Settings** → choisir l'environnement **Preview** (sélecteur
en haut de l'onglet) → **Bindings** → **Add** :
| Type | Variable name | Valeur |
|---|---|---|
| D1 database | `DB` | `solariscreen-essai` |
| R2 bucket | `PHOTOS` | `solariscreen-essai` |
| R2 bucket | `DOCS` | `solariscreen-essai` |

⚠️ **Repasser sur l'environnement Production et vérifier que RIEN n'y a bougé** : ses trois liaisons
pointent toujours sur les vraies ressources (`DB` → `solariscreen-db`, et les buckets photos et documents
des étapes 8 et 9). Le piège serait l'inverse : choisir `solariscreen-db` dans Preview — la page de
remplissage le détecterait et refuserait d'écrire, mais l'aperçu travaillerait alors sur les vrais devis.
⚠️ **Ne pas** ajouter `SMTP2GO_API_KEY` à l'environnement Preview : un essai ne doit jamais pouvoir
envoyer un mail (les adresses d'essai sont de toute façon en `.invalid`). `ANTHROPIC_API_KEY` non plus,
sauf décision contraire : l'assistant y dirait simplement « pas encore branché ».

**5. Redéployer un aperçu** : pousser n'importe quel commit sur une branche (ou *Retry deployment* sur le
dernier aperçu). Une liaison ne vaut que pour les déploiements qui suivent.

**6. Remplir** : ouvrir `https://<branche>.solariscreen-erp.pages.dev/tests/bac-a-sable.html`, se connecter
(Access), vérifier que les trois gardes sont vertes, cliquer **Remplir**. Vingt dossiers fictifs (un par
situation que l'ERP sait reconnaître), cinq demandes de visite, trois sujets, deux exceptions de planning,
les fiches clients et neuf factures. Relancer « Remplir » remet les scénarios à zéro ; « Vider » ne retire
que ce que la page a posé. La page REFUSE d'écrire hors d'un aperçu, sans identité Access, ou dans une base
qui contient de vraies données — c'est-à-dire si la production a été branchée par erreur sur Preview.

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
