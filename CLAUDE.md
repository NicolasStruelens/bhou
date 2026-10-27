# SolariScreen — guide du dépôt

Ce fichier est lu automatiquement par Claude Code au début de chaque session. Il porte ce qui
**ne se devine pas en lisant le code** : ce qui est vivant, ce qui est mort, les règles métier
tacites et les pièges déjà payés cher.

Tenez-le à jour : c'est la **seule mémoire commune** entre Nicolas et Yannick. L'historique de
conversation et la mémoire automatique de Claude restent sur la machine de chacun et ne se
synchronisent jamais. Ce qui n'est pas écrit ici est perdu pour l'autre.

## Ce qui est vivant, ce qui ne l'est pas

| Chemin | État |
|---|---|
| `solariscreenv2/` | **L'ERP. Le seul dossier vivant.** C'est lui que Cloudflare publie. |
| `index.html`, `reseau.html`, `tfe.html`, `family/`, `racine/`, `simulateur/`, `photo.html`, `steph.html` | Site personnel de Nicolas (GitHub Pages, www.nicolas-struelens.com). **Hors sujet ERP — ne pas y toucher.** |
| `racine/` | Application perso « Racine » (notes + presse-papier). Projet Cloudflare séparé — hors sujet ERP. |

Le dossier `solariscreen/` (ERP version 1) a été **supprimé le 09/08/2026**. Il reste consultable
dans l'historique git. Un audit externe a perdu des heures à l'analyser parce que rien n'indiquait
qu'il était mort — d'où ce tableau.

Les vestiges de l'ancien Worker à la racine (`functions/`, `api.js`, `_routes.json`) ont été
**supprimés le 30/08/2026**. Ils n'étaient servis par aucun projet — chacun a son propre
`functions/` dans son dossier — mais `functions/[[catchall]].js` offrait un CRUD complet sur la
table `devis`, sans aucune authentification et avec `Access-Control-Allow-Origin: *`. Inoffensif
tant que rien ne le branchait ; une API publique capable de vider la base le jour où quelqu'un
changerait le dossier racine d'un projet Pages. **Ne pas les réintroduire.**

Le **Worker Cloudflare « bhou »** (`bhou.nicolas-struelens.workers.dev`) est un instantané du dépôt
ENTIER pris en avril 2026 (`wrangler.toml` nommé « bhou », supprimé du dépôt le 26/04/2026). Vérifié
le 25/10/2026 : aucune API (`/api/*` en 404), aucune donnée, aucun identifiant dans son `.git/config` —
mais il sert publiquement une vieille copie de l'ERP et le dossier `.git`. Il ne sert à rien : à
supprimer (Workers et Pages → bhou → Paramètres → Supprimer). Le Worker « red-mode-8480 » est le
portfolio personnel de Nicolas, hors sujet ERP.

## La chaîne de déploiement — à comprendre avant tout

```
solariscreenv2/  →  git push  →  GitHub (bhou)  →  Cloudflare Pages  →  https://solariscreen-erp.pages.dev
```

**Un push sur `main` déploie en production, immédiatement.** L'ERP sert à établir de vrais devis et
de vraies factures pour de vrais clients.

**Règle absolue : on ne pousse jamais sur `main`.** On travaille sur une branche, Cloudflare en crée
un aperçu automatiquement, on vérifie, puis on fusionne.

```bash
git checkout main && git pull
git checkout -b amelioration/ce-que-je-fais
# … travail, commits …
git push -u origin amelioration/ce-que-je-fais
```

Tant que le **bac à sable** n'est pas branché (DEPLOIEMENT.md, étape 12), l'aperçu **n'est pas derrière
Cloudflare Access et n'a aucune base liée** : il affiche « 0 devis ». C'est normal, et c'est une sécurité —
on ne peut pas abîmer les vraies données depuis un aperçu. Une fois branché, l'aperçu est derrière Access,
travaille sur une base d'ESSAI séparée et le DIT à l'écran (règle 46) : jamais sur les vraies données.

## Architecture

Pages HTML autonomes, JavaScript **classique** — jamais de modules ES, l'application doit pouvoir
s'ouvrir en double-cliquant un fichier. Tout est exposé sur `window.*`.

| Fichier | Rôle |
|---|---|
| `assets/js/calc.js` | **Moteur de prix.** Fonctions pures, protégé par 58 tests. |
| `assets/js/api.js` | Client API, cache local, file d'envoi hors-ligne (`window.SS`) |
| `assets/js/ui.js` | Helpers partagés, icônes SVG, rendu des notes (`window.SSUI`) |
| `assets/js/config.js` | Réglages de l'ERP et **valeurs par défaut de référence** (`window.SSConf`) |
| `assets/js/nav.js` | Menu, identité, recherche globale (`window.SSNav`) |
| `assets/js/planning.js` | **Moteur du temps.** Fonctions pures, protégé par 121 tests (`window.SSPlanning`) |
| `assets/js/attente.js` | **Qui doit agir.** Réunit demandes, planning, SAV et échanges. 78 des 100 tests de sa suite (`window.SSAttente`) |
| `functions/api/[[catchall]].js` | **Tout le backend**, dans un seul fichier (Cloudflare Pages Function + base D1) |
| `tests/calc.test.html` | Les 58 tests du moteur de prix. À ouvrir dans un navigateur. |
| `tests/planning.test.html` | Les 121 tests du planning. Même principe. |
| `assets/js/carte.js` | **La géographie des dossiers** (règle 44) : distances, un point par client, « autour de », réalisations proches, secteurs, tournée. Fonctions pures, plus le géocodage Nominatim et la position de l'appareil, isolés pour les tests (`window.SSCarte`). |
| `tests/carte.test.html` | Les 44 tests de la carte : module pur, puis la vraie page avec un géocodage SIMULÉ (tournée, couleur = action, un point par client, autour de, réalisations proches, mémoire des adresses et une requête par seconde, autour de moi, secteurs, non localisés, molette, téléphone). **Par le serveur de test.** |
| `assets/js/vitrine.js` | **Ce que le portfolio montre** (règle 45) : couleurs lisibles par un client (sans référence fournisseur), une réalisation par ouverture photographiée, avant / après, diapositives, teintes, recherche sans accents, ce qui manque à la vitrine. Fonctions pures (`window.SSVitrine`). |
| `tests/portfolio.test.html` | Les 46 tests du portfolio : module pur, puis la vraie page avec des positions SIMULÉES (couleurs sans référence, toile, photos masquées et couverture, avant / après, près d'un prospect ou d'une commune, mode présentation et « retour », PDF client sans nom, filtre par teinte, ce qui manque, téléphone). **Par le serveur de test.** |
| `tests/planning-page.test.html` | Les 53 tests de la PAGE Planning (règle 13 bis) : couloirs alignés, pose sans équipe « À attribuer », jour non travaillé signalé, « Caler ici », dates proposées, météo de pose (simulée), fenêtres qui ne perdent rien, vue Jour (appeler, y aller, itinéraire, agenda), téléphone et « retour », et le créneau reçu par la demande de RDV. **Par le serveur de test.** |
| `tests/attente.test.html` | Les 100 tests du « qui doit agir » **et de la mise en attente d'un devis** (règle 38). Même principe. |
| `assets/js/theme.js` | **Les thèmes.** Table `THEMES` = source unique (`window.SSTheme`) |
| `tests/themes.test.html` | Les 77 tests des thèmes : contraste, séparabilité, et le défaut de société (appareil → société → système, mesuré sur un vrai chargement). **Obligatoire avant de publier un thème.** |
| `tests/amorce-theme.html` | **Pas une suite** — le banc de mesure que `themes.test.html` charge en iframe pour relever `data-theme` au plus tôt. Ne pas l'ouvrir seul. |
| `tests/fetes.test.html` | Les 97 tests du calendrier des fêtes et du contrat des décors. |
| `tests/planche-fetes.html` | **Pas une suite — le BANC D'ESSAI des décors.** Tous les dessins d'une fête côte à côte, à leur taille réelle ET agrandis, dans les deux thèmes. À ouvrir avant de garder un décor (règle 28). |
| `assets/js/remuneration.js` | **Ce que NICOLAS doit encaisser.** Fonctions pures, 140 tests (`window.SSRemu`) |
| `tests/remuneration.test.html` | Les 140 tests de la rémunération. **Obligatoire : c'est de l'argent réel.** |
| `assets/js/volet.js` | **Le configurateur VR150.** Rend la spec de `products.js` à l'écran et en résumé. 106 tests (`window.SSVolet`) |
| `tests/volet.test.html` | Les 139 tests du VR150 **et des règles d'ouverture partagées** (duplication, regroupement des configurations). **Obligatoire : ça remplit un bon de commande fournisseur.** |
| `assets/js/signal.js` | **Ce qui reste à remplir se voit.** Effets, teintes, règle du « commencé », défaut société. 58 tests (`window.SSSignal`) |
| `tests/signal.test.html` | Les 58 tests du signal, dont la résolution appareil → société → repli. |
| `assets/js/depenses.js` | **Les notes de frais.** États, ancienneté, totaux. Fonctions pures, 53 tests (`window.SSDepenses`) |
| `tests/depenses.test.html` | Les 53 tests des notes de frais. |
| `tests/nav.test.html` | Les 92 tests du menu (règle 24 bis) : page en cours, compteurs, « + Nouveau », réduction du rail, de vraies pages en cadre à 1500, 1200 et 390 px, et la marque du bac à sable (règle 46). **Par le serveur de test.** |
| `tests/bac-a-sable.js` | **Le bac à sable** (règle 46) : le jeu de dossiers FICTIFS, les trois gardes, Remplir et Vider (`window.SSBacASable`). Un outil d'essai, pas du code de l'ERP : seules les deux pages ci-dessous le chargent. |
| `tests/bac-a-sable.html` | **Pas une suite — la page de REMPLISSAGE** de la base d'essai, à ouvrir sur un aperçu de branche (DEPLOIEMENT.md, étape 12). |
| `tests/bac-a-sable.test.html` | Les 30 tests du bac à sable, joués contre le VRAI serveur (`[[catchall]].js`) sur une vraie base SQLite en mémoire (sql.js) : gardes, remplissage rejouable, montants, actions reconnues par le tableau de bord, scénarios SAV, outillage et kits, page de remplissage, vidage. **Par le serveur de test, avec accès à cdnjs.** |
| `tests/banc-serveur.js` | **Pas une suite — le BANC des tests serveur** (`window.SSBanc`) : le vrai `[[catchall]].js` sur une vraie base SQLite en mémoire, un faux réseau qui pose l'identité Access, et `cadre(url)` qui charge une vraie page déjà branchée dessus. Partagé par `bac-a-sable.test.html`, `sav.test.html` et `outillage.test.html` (règles 46 à 48). |
| `assets/js/outillage.js` | **Outillage & références** (règle 48) : recherche sans accents et par référence compacte, lecture des prix, fournisseurs et prix datés, « à racheter », kits de pose et « à emporter ». Fonctions pures (`window.SSOutil`). |
| `tests/outillage.test.html` | Les 58 tests de l'outillage : règles pures, les ROUTES (fusion, « à racheter » ciblé et signé, kits, refus hors-ligne), la vraie page remplie par le bac à sable et cliquée (recherche, liste de courses, deux fournisseurs, fiche et ses fenêtres, photos dans R2 et « Alléger », visionneuse, comptoir, kits, « à emporter »), le lien du planning, le téléphone et « retour ». Vérifié par 13 mutations. **Par le serveur de test, avec accès à cdnjs.** |
| `assets/js/sav.js` | **La page SAV** (règle 47) : la file (personne dessus, en retard, ancien), les étapes, l'ancienneté, « ce qui casse le plus », le bon d'intervention. Fonctions pures (`window.SSSav`). |
| `tests/sav.test.html` | Les 66 tests du SAV : règles pures, « qui doit agir », la ROUTE SERVEUR (passages signés, clôture refusée sans texte, pièce commandée, notes, anciens tickets, bon d'intervention), la vraie page cliquée au bureau (file, garantie, étapes, Je prends, pièce, note, réparé, rouvrir, photos, bon jusque dans le simulateur), la fenêtre « Nouveau ticket », la fiche devis, le téléphone (rien de coupé) et « retour ». Vérifié par 13 mutations. **Par le serveur de test, avec accès à cdnjs.** |
| `tests/dashboard.test.html` | Les 77 tests du tableau de bord (règles 40 et 40 bis) : prochaine action (dépannage, commande, pose à venir, clôture), situations, étapes, relais, bandeaux au détail (rien de coupé, rien qui chevauche), bureau, tablette, téléphone, réglages de la société. Données FICTIVES, remises en état à la fin. **Par le serveur de test.** |
| `assets/js/actions.js` | **La prochaine action**, « à faire maintenant », les chiffres du cockpit et « actif / clos / soldé », sortis du tableau de bord pour que l'écran et l'assistant suivent UNE règle (`window.SSActions`, règle 41). |
| `assets/js/assistant.js` | **L'assistant (Claude)** : le panneau, la conversation, les outils exécutés dans le navigateur (`window.SSAssistant`, règle 41). Chargé par `nav.js` au premier clic. |
| `tests/assistant.test.html` | Les 128 tests de l'assistant : module partagé comparé au tableau de bord, outils, écritures seulement après un clic, forme de la conversation envoyée à l'API, liens, la ROUTE SERVEUR (vrai fichier, faux serveur Anthropic : flux découpé, erreurs, nouveaux essais), bureau et téléphone. Aucun appel réel à Claude. **Par le serveur de test.** |
| `tests/mails.test.html` | Les 61 tests des mails envoyés par l'ERP (règle 43) : la ROUTE SERVEUR (vrai fichier, faux SMTP2GO : identité, ce qui manque, destinataires, en-têtes, échecs, envoi partiel, plafond, archive), la fenêtre de relance « en construction » puis « branchée » (envoi, relance notée, archive, échecs), téléphone, et la section E-mails des Paramètres. Aucun mail réel. **Par le serveur de test.** |
| `tests/clients.test.html` | Les 51 tests de la page Clients (règle 42) : chiffres égaux à ceux du tableau de bord, ligne « quoi faire », recherche, factures avec notes de crédit, argent du client, propagation ciblée des coordonnées, « À ranger », nouveau client, téléphone (« retour »), et la page Facturation sur la règle commune. **Par le serveur de test.** |
| `tests/tactile.test.html` | Les tests des champs à 16 px sur écran tactile (anti-zoom iOS) : les 21 pages et la page client chargées en cadre, chaque bloc `(pointer: coarse)` basculé à vrai (téléphone) puis à faux (bureau inchangé), les composants qui retaillent leurs champs, et une mesure directe sur un vrai écran tactile. **Par le serveur de test.** |

Stockage : base **D1** (une table par entité, avec un gros blob JSON dans la colonne `data`),
photos et documents dans **R2**.

## Règles qui ne se devinent pas

**1. Les réglages ne sont JAMAIS rétroactifs.** Un devis enregistre les taux avec lesquels il a été
calculé (`pricing_v2.rates`). À la réouverture on relit *ceux-là*, jamais les réglages du jour ; un
devis ancien sans taux stockés retombe sur les taux historiques (0,77 / 0,23 / 2,5). Modifier une
marge ne doit jamais changer un montant déjà annoncé à un client ni une facture émise.

**1 bis. LA POSE NE SE COMPTE QUE SUR UNE OUVERTURE CHIFFRÉE** (`SSCalc.ouverturesReelles`).
C'est cette fonction qui décide `install_qty`, donc un MONTANT.
⚠️ **LE DÉCLENCHEUR A CHANGÉ LE 10/10/2026, et il faut comprendre pourquoi.** Il était « une
largeur, une hauteur, une projection OU un prix » — autrement dit « dès qu'on a commencé à
décrire ». Sauf qu'on commence TOUJOURS par les mesures : on relève la baie chez le client, on
tape 1000 × 1000, et le devis affichait aussitôt **296,80 € TVAC pour un catalogue à 0 €**.
Nicolas : « quand je fais un nouveau devis il met déjà une somme ». Le chiffre n'était pas faux
— c'était bien une pose — mais il apparaissait AVANT que le devis ne veuille dire quoi que ce
soit, et **un total qu'on ne peut pas expliquer, on finit par ne plus le lire**.
Le prix est le bon déclencheur parce qu'il est le DERNIER geste : une ouverture chiffrée est une
ouverture décidée. Un prix à zéro ou négatif n'est pas un prix.
⚠️ **LA SOUPAPE RESTE** : le drapeau « quantité saisie à la main » du simulateur (`_qtyManual`)
décroche `install_qty` de ce compte. Un chantier où l'on pose une ouverture non chiffrée
(matériel fourni par le client, geste commercial sur la fourniture) se facture donc toujours —
à la main, ce qui est exactement le bon endroit pour une exception. Ne pas réintroduire
d'exception dans la règle elle-même.
⚠️ Comme toute règle d'argent, elle ne retouche AUCUN devis existant : les `calculs` sont figés
en base (règle 1). Un devis déjà enregistré garde son total tant qu'il n'est pas rouvert.
⚠️ La règle ne vivait que dans le simulateur, écrite en dur. Le **Mode Terrain** comptait TOUTES
les lignes : un devis fait chez le client avec une ouverture encore vide sortait déjà à 280 €
d'installation pour un catalogue à 0. Signalé par Nicolas le 06/10/2026 : « on a l'impression que
c'est un bug ». Il avait raison — et quatre jours plus tard, le même symptôme revenait par les
MESURES, d'où le changement de déclencheur ci-dessus.
Elle est dans `calc.js` et non dans `products.js` parce qu'elle détermine une entrée du moteur de
prix : c'est le seul fichier où une règle d'argent est couverte par des tests.
⚠️ `computeDevis` ne l'appelle PAS et ne doit pas l'appeler : il reçoit les quantités telles
qu'on les lui donne. On doit pouvoir facturer 3 poses pour 2 ouvertures si le chantier l'exige —
d'où aussi le drapeau « quantité saisie à la main » du simulateur, qui coupe la synchro.
⚠️ Ce correctif ne retouche AUCUN devis existant : les `calculs` sont figés en base (règle 1).
Un brouillon déjà créé garde son total tant qu'il n'est pas rouvert au simulateur.

**2. Ne jamais reconstruire un objet métier par liste blanche.** Étaler la source et ne surcharger
que ce qui change (`{...existant, ...nouveau}`). Une énumération de champs perd silencieusement tout
ce qu'elle ne connaît pas : ça a déjà fait disparaître la civilité d'une fiche client, et failli
effacer tout l'historique des e-mails.

**3. Les collections se modifient par écriture CIBLÉE, jamais en réécrivant l'objet entier.**
Notes, encaissements, photos de chantier, tickets SAV ont chacun leur route serveur, qui écrit sur
la valeur *actuelle* de la ligne. Réécrire l'objet complet écrase le travail simultané de l'autre.

**4. Tout calcul d'argent dû vit à un seul endroit** (`SSUI.duFacture`). Trois écrans le calculaient
séparément : ils ont fini par annoncer trois créances différentes.

**5. Les numéros de facture sont attribués par le SERVEUR** (table `compteurs`, incrément atomique).
Jamais côté client, jamais réutilisés après une suppression. Une facture ne peut pas être créée
hors-ligne : c'est volontaire.

**6. Un statut « ok » ne veut pas dire « écrit ».** Toute réponse portant un état (`conflict`,
`offline`, `queued`) doit être traitée par l'appelant. Un `ok: true` accompagné de `conflict: true`
a fait croire pendant trois semaines que les relances s'enregistraient.

**7. Un DÉPANNAGE est un devis sans ouvertures.** `type_document: 'depannage'` (absent = devis, ce
qui rend tous les anciens enregistrements valides). Ses postes sont les `extras` du moteur — d'où
un total correct sans toucher à `calc.js`. Deux modes : `depannage_mode: 'realise'` (bon
d'intervention, travaux faits, signature « travaux reçus », pas de CGV) ou `'a_realiser'`
(proposition à accepter, CGV jointes). **Jamais d'acompte sur un dépannage** : quatre écrans
l'annoncent (document, fiche, page client, facturation) et doivent dire la même chose au centime
près. Facture partielle interdite : elle compte des ouvertures, il n'y en a aucune.
⚠️ Le document existe en DEUX exemplaires — `app/devis.html` et `devis-review.html`
(`buildPaperHtml`). Toute modification de l'un doit être portée dans l'autre : c'est le même
client qui lit les deux.

**8. Le rapport d'intervention vit dans `devis.depannage`** — un seul objet, tous les champs
facultatifs : date et heure RÉELLES de passage (le document imprime celle-là, pas la date de
création), temps sur place, intervenants, motif de l'appel, constat, garantie (`non` / `partielle`
/ `totale`), garantie accordée en mois, suite à donner (`aucune` / `piece` / `retour`). Ces
textes sont ÉCRITS POUR LE CLIENT : ils passent la liste blanche de `/api/devis-review`. Rien
d'autre du dépannage n'y passe.

**9. Un devis doit se reconnaître SANS être ouvert.** Un client a souvent plusieurs devis en
cours ; dans une liste ils portent le même nom. `SSUI.resumeDevis(d)` en donne le résumé —
« 3 Screens SC 90 · Façade sud » — déduit des ouvertures déjà saisies, donc valable aussi sur
les devis existants. Il est affiché partout où l'on choisit un devis : tableau de bord, fiche
client, fiche devis, liste de facturation, recherche globale (où il est aussi cherchable).
Le VENDEUR accompagne le résumé, mais seulement quand la liste en contient plusieurs — sinon
c'est du bruit. Règle générale : ce qui est évident pour celui qui a rédigé le devis ne l'est
jamais pour l'autre.

**10. Le VOCABULAIRE vit dans `ui.js`, jamais en copie locale.** Noms des types de produit
(`SSUI.TYPE_LABEL`, formes singulier/pluriel dans `TYPE_FORMES`), noms des vendeurs
(`SSUI.SELLER_LABELS`) et libellés des statuts de devis (`SSUI.STATUT_DEVIS_LABEL` — ils vivaient
en cinq copies, les tables locales ne gardent plus que leur couleur ou leur classe de badge). Les types ont vécu en **13 copies** et elles avaient déjà divergé : le
tableau de bord ignorait `pergola` et `store_banne`, donc son filtre affichait « pergola » en
minuscule brut à côté de « Screen ». Ne pas confondre avec `SSProducts.ITEM_TYPES`, qui liste ce
qu'on peut encore CRÉER (4 types) — la table d'affichage garde en plus les types historiques,
parce qu'un devis de 2024 doit rester lisible.

**11. Un BON D'INTERVENTION ne se relance pas.** Les relances font ACCEPTER une offre ; sur des
travaux déjà faits il n'y a plus rien à accepter, et ce qu'on chasse c'est le paiement (factures,
alerte « acompte non payé »). `relanceEtat` sort donc immédiatement quand
`depannage_mode === 'realise'`. Une PROPOSITION de dépannage se relance normalement.

**12. Ce que le client écrit finit dans une page authentifiée.** Toute valeur venant de
`devis-review.html` (raison de refus, question) doit être échappée avant affichage.

**13. La DISPONIBILITÉ ne se saisit jamais, elle se déduit.** Un planning qu'il faut nourrir chaque
semaine est abandonné en trois semaines — c'est la raison d'être de `assets/js/planning.js`. Chacun
pose **une fois** sa trame hebdomadaire (réglages `planning.trame`, valeurs `non` / `matin` /
`apresmidi` / `journee`), l'ERP **soustrait** ce qui est déjà planifié, et on n'ajoute à la main que
les EXCEPTIONS : table `dispos`, `kind: 'indispo'` (congé, rendez-vous perso) ou `kind: 'dispo'`
(« exceptionnellement, ce samedi-là je peux »). Ce qui reste est libre, par construction — donc
juste dès le premier jour, sans rien remplir.
Trois sources deviennent un même ÉVÉNEMENT : la POSE (devis signé, `chantier.date_pose`), la VISITE
(`rdv` au statut `rdv_fixe`) et le DÉPANNAGE (`depannage.date_intervention`). Le dépannage
n'apparaissait dans AUCUN agenda alors qu'il porte date, heure, durée et intervenants : on pouvait
caler une intervention et une pose à la même heure sans qu'un écran ne dise rien. La liste des devis
le projette désormais sous `depannage_plan` — une projection de LECTURE, comme `items_min`, jamais
l'objet `depannage` complet et jamais à réécrire.
Conséquences à respecter : `sous_traitant` n'occupe **ni Nicolas ni Yannick** (c'est l'intérêt d'y
faire appel) ; un bon d'intervention passé (`depannage_mode: 'realise'`) est un compte rendu, pas un
rendez-vous, et ne prend pas de place dans le futur ; une personne sans trame n'est **jamais**
« toujours libre » (mieux vaut un planning vide qu'un planning qui ment) ; un conflit s'AVERTIT, il
ne se bloque pas (deux petites poses dans la journée, ça se fait). Les dispos ne s'écrivent pas
hors-ligne : une indisponibilité visible du seul téléphone qui l'a saisie est pire que pas
d'indisponibilité, l'autre planifie dessus en croyant la place libre.

**13 bis. LE PLANNING SE LIT EN COULOIRS ET SE REMPLIT PAR SES TROUS** (26/10/2026 — revue de la
page, propositions A à G choisies par Nicolas sur maquette). Protégé par `tests/planning-page.test.html`.
• **Une ligne par personne, coupée en matin / après-midi** : hachuré = ne travaille pas, pointillé
  vert = libre, le reste = pris. Les colonnes s'alignent par `subgrid` ; sous 900 px la même
  structure se replie jour par jour, et c'est la feuille de style seule qui décide (règle 24).
• **Une pose sans équipe n'est rangée chez PERSONNE** (`qui: []`, `equipe: ''`) : elle va dans le
  couloir « À attribuer » et attente.js la signale. Avant, `quiDeEquipe('')` la rangeait chez Nicolas :
  « Nic » à l'écran, sa charge gonflée (25 → 44 % sur un jeudi où il ne travaille pas) et « Nicolas »
  coché d'office dans « Qui s'en occupe », donc écrit au premier enregistrement — c'est l'équipe qui
  décide de la paie de pose. La fenêtre lit l'équipe ENREGISTRÉE et refuse d'enregistrer sans choix.
  `quiDeEquipe` garde son repli pour ses autres lecteurs.
• **« Hors de ses jours » s'avertit comme un conflit** (`SSPlanning.horsTrame`) : jour non travaillé,
  ou rendez-vous qui déborde de la journée (la pause de midi n'est pas un débordement). Calculé dans
  le planning et pas dans attente.js, parce qu'il a besoin des exceptions (dispos) que les autres
  écrans ne chargent pas. Un avertissement, jamais un blocage (règle 13).
• **Cliquer un trou propose de le REMPLIR** (« Caler ici ») : poses dont le matériel est reçu,
  dépannages sans date, visites à fixer — « Bloquer ce temps » en dernier. ⚠️ **Une visite ne se fixe
  pas d'ici** : le créneau rejoint les PROPOSITIONS de la demande (`rdv.html?open=…&creneau=…&moment=…`),
  c'est l'écran des RDV, avec ses messages, qui le soumet au client.
• **Dates proposées** (`SSPlanning.datesPossibles`) : les journées où toute l'équipe est libre assez
  longtemps D'UNE TRAITE (deux trous séparés par un rendez-vous ne font pas une place ; midi, si),
  jamais aujourd'hui, et sans les dates de pluie ou de grand vent chez le client. Sans équipe choisie,
  on propose « à deux » — et la confirmation le dit avant d'écrire.
• **Météo de pose** (`SSPlanning.meteoPose`, seuils `METEO_POSE` : 2 mm, 40 km/h, rafales 60) : en tête
  de chaque jour, et ROUGE seulement les jours où une pose est prévue — ailleurs la pluie reste une
  information. Une pose prévue sous la pluie a son alerte. Une seule prévision par ville et par page
  (`SSUI.previsionJours`, promesse gardée ; un échec n'est pas gardé).
• **Vue Jour** : Appeler, Y aller, Agenda sur chaque rendez-vous ; « Itinéraire du jour » (Maps, arrêts
  dans l'ordre). **Agenda** = un fichier `.ics` (`SSPlanning.icsDe`) : heures locales sans fuseau,
  identifiant STABLE (réimporter met à jour), lignes pliées à 75 OCTETS. Rien ne part vers un service tiers.
• **Le haut de page tient en une ligne** (résumé + charge) et une bande « six semaines »
  (`SSPlanning.chargeSemaines`). Sur téléphone, les cinq tuiles empilées poussaient la journée à 954 px ;
  au-delà de deux alertes, un bouton dit combien il en reste (« Voir les 2 autres alertes »).
• **Les fenêtres** suivent les règles déjà payées ailleurs : le fond ne ferme que si le geste y a
  COMMENCÉ, Échap dans un champ date ne ferme rien, une saisie entamée demande « Fermer sans
  enregistrer ? », et sur téléphone « retour » ferme la fenêtre (une étape d'historique ; une fenêtre
  qui en ouvre une autre la RELAIE sans toucher à l'historique ; quitter la page depuis une fenêtre
  retire l'étape AVANT de partir). Une visite exige une heure : elle partait à 09:00 sans un mot.

**14. Ce qui attend quelqu'un se lit à UN endroit** (`app/echanges.html`, table `sujets`). Les
échanges existaient déjà — notes de devis, « échange interne » d'une demande de RDV — mais
**enfermés dans une fiche** : pour savoir si l'autre avait répondu, il fallait rouvrir le bon
dossier, donc savoir lequel. Et une idée qui ne concerne aucun client n'avait nulle part où aller.
Quatre natures, pas davantage (`afaire` / `question` / `idee` / `attente`) : au-delà on hésite au
moment d'écrire, et un outil où l'on hésite à écrire ne sert plus à rien. Le lien vers un client ou
un dossier est FACULTATIF — c'est ce qui permet de déposer une idée en dix secondes.
Le moteur est `awaiting` : **de qui on attend quelque chose**. Il pilote le tri (ce qui m'attend
passe devant), le badge du menu, et les compteurs. Répondre LIBÈRE l'attente ; la case « et je lui
redemande » la repasse explicitement. Une chose classée n'attend plus personne, sinon le badge
compterait du travail terminé. L'auteur est signé par le SERVEUR à la création et ne change plus :
c'est lui qui reçoit la balle en retour.
⚠️ Les RÉPONSES ne transitent jamais par `POST /api/sujets` : elles ont leur route, qui écrit sur la
valeur actuelle de la ligne (règle 3). Le serveur les réinjecte à chaque enregistrement du sujet —
sans quoi renommer un titre effacerait le fil que l'autre vient d'écrire.

**15. Le « QUI DOIT AGIR » vit dans `assets/js/attente.js`, jamais en copie locale.** Quatre modules
savaient dire « ça attend quelqu'un » — le brief des demandes de RDV, les alertes du planning, les
tickets SAV, le `awaiting` des Échanges — et aucun ne parlait aux trois autres. Il fallait donc
ouvrir quatre écrans pour savoir ce qui nous attendait : personne ne le fait, et c'est exactement
là que les choses se perdaient. Les règles ont été DÉMÉNAGÉES (pas copiées) dans ce module ; le
brief de `rdv.html` et les alertes de `planning.html` le consomment, le badge du menu aussi.
Deux principes que le module impose, et qui sont la réponse à « aucune décision n'est prise » :
**une chose sans NOM dessus n'avance pas** (chacun croit que l'autre s'en occupe) — d'où le tri,
qui fait passer ce que personne n'a pris AVANT le plus urgent ; et **une chose sans DATE n'est
jamais urgente** — d'où l'ancienneté affichée partout, qui devient gênante à 3 jours et criante à 7.
Un ticket SAV porte donc désormais `pour` et `echeance`. ⚠️ Le serveur reconstruit le ticket CHAMP
PAR CHAMP : tout appelant de `saveSavTicket` doit renvoyer `pour` et `echeance`, sinon il les efface.
`depuisPlanning(…, { inclureVisites })` : l'écran commun EXCLUT les visites (les demandes de RDV les
signalent déjà, et une liste qui se répète perd sa crédibilité), le planning les INCLUT — c'est son
écran. Même raison pour « à recontacter », qui n'est produit que si quelqu'un est déjà assigné.
Le TABLEAU DE BORD le consomme aussi depuis le 03/10/2026. Il ne chargeait même pas `attente.js` :
on ouvrait l'ERP sur un écran qui annonçait la journée en ignorant les tickets SAV et les échanges,
pendant que le badge du menu, lui, les comptait. Le cockpit (règle 40) en tire désormais ses
actions RDV, SAV et Échanges, donc les chiffres ne peuvent plus diverger d'un écran à l'autre.
⚠️ Les actions DEVIS du cockpit (relances, acompte, solde, devis expiré, chantier) ne sont PAS des
copies : `attente.js` ne couvre ni les relances ni l'argent. Les deux sources sont
COMPLÉMENTAIRES — ne pas les « dédoublonner » en croyant bien faire, on perdrait la moitié du brief.
Seul un même DOSSIER n'apparaît qu'une fois : quand le devis porte déjà son action, l'élément
d'attente qui pointe sur lui se tait.
Les seuils métier (4 h / 24 h sur un lead, 2 j, 3 j, 7 j) vivent dans `SSAttente.SEUILS` : ils
étaient dans `rdv.html`, ils n'y sont plus.
⚠️ **L'ANCIENNETÉ NE SE LIT JAMAIS SUR `date_modification`** (trouvé dans le bac à sable le 27/10/2026).
Toute écriture sur un dossier — une note, une photo de chantier, une réassignation — l'avance : trois
alertes s'en servaient, et un chantier en attente depuis des semaines s'affichait « depuis à
l'instant ». C'est pourtant l'ancienneté qui rend une chose urgente. Chaque alerte part de SON moment :
« matériel pas commandé » de la signature (`SSUI.dateSignature`), « pose à planifier » de la réception
du matériel (`SSUI.dateReception` : `commande.recu_le`, posé par la fiche quand la commande passe à
« Reçu », projeté à plat dans la liste sous `commande_recu_le` et gardé par `normDevis` ; sans lui,
repli sur la signature), « visité, en attente du devis » de la visite (`date_rdv`). Tests G1 à G6.

**15 quater. UN COMPTEUR QUI NE DÉSIGNE RIEN FAIT CHERCHER — donc, au bout de deux fois, plus
rien.** « C'est quoi la situation critique ? » (Nicolas, 12/10/2026, capture à l'appui). Le
bandeau des Échanges annonçait « 1 situation critique » et les trois lignes en dessous étaient
**rigoureusement identiques à l'œil**. Rien ne portait l'urgence : le liseré de gauche dit la
SOURCE, l'âge dit l'ÂGE — et à 9, 10 et 11 jours les trois étaient rouges. Pour répondre, il
fallait connaître les seuils d'`attente.js` par cœur.
⚠️ **C'EST LA MÊME FAMILLE QUE LA RÈGLE 36**, et elle revient pour la troisième fois : les
pastilles « ce qui manque » qui NOMMAIENT un champ sans y emmener, le signal qui parlait d'un
champ au lieu de l'allumer, et maintenant un compteur qui compte sans montrer. **Un texte qui
parle d'une chose oblige à la CHERCHER, et entre les deux on abandonne.**
⚠️ **LA PASTILLE NOMME L'URGENCE, elle ne se contente pas de la colorier** (`.at-urg`,
« Critique »). Le mot vient d'`URGENCE_LABEL` dans `attente.js`, pas de la page : le vocabulaire
vit à un seul endroit (règle 10), sinon l'écran et le moteur finissent par ne plus dire la même
chose. Et **seul le niveau CRITIQUE est marqué** : marquer aussi « urgent » reviendrait à
marquer presque tout, donc à ne rien marquer (règle 36, premier point).
⚠️ **ELLE NE TOUCHE NI LE LISERÉ NI LE FOND DE LA LIGNE.** Les deux disent déjà autre chose —
la source, et « personne ne s'en occupe » (`.orphelin`, qui est déjà rouge). Deux sens sur un
même signe, et **les deux se perdent** (règle 21).
⚠️ **ET LE BANDEAU EMMÈNE** (`voirCritique`) : il est devenu un vrai `<button>` qui porte son
mot (« La voir → »), parce qu'un bandeau cliquable que rien ne signale, personne ne clique
dessus — et **sur téléphone il n'y a pas de survol pour le découvrir** (règle 33).
Trois détails qui font la différence entre « ça marche » et « ça ne passe pas pour cassé » :
• **Le bloc « Chez l'autre » peut être REPLIÉ et il compte dans le total.** Sans dépliage
  préalable, le bouton promettrait « la voir » et ne sauterait nulle part : **une promesse
  d'écran doit être tenable** (même règle que le tarif de pose, 30 bis-2).
• **Plusieurs critiques ? Chaque clic passe à la suivante**, puis revient au début. Un bouton qui
  ramène toujours au même endroit alors que le compteur en annonce trois passe pour cassé.
• **La pulsation marque un ÉVÉNEMENT, pas un ÉTAT** : 1,5 s puis plus rien (règle 36, 3e point).
  Et toute visée en cours est éteinte AVANT d'en poser une nouvelle — deux clics rapprochés
  allumaient deux lignes à la fois, c'est-à-dire le défaut qu'on corrige, en plus petit. Le
  `classList.remove` + lecture d'`offsetWidth` avant de remettre la classe n'est pas une
  précaution de style : **sans ce reflux, recliquer sur la MÊME ligne ne rejoue pas l'animation**,
  et le bouton a l'air inerte.

**15 bis. ON PEUT CORRIGER CE QU'ON A ÉCRIT, et la correction SE VOIT.**
Un fil où l'on ne peut pas se relire se remplit de « (pardon, je voulais dire…) », et une faute
de frappe dans un titre reste là pour toujours. Le SUJET (titre + corps, même convention qu'à la
publication : première ligne = titre) se corrige par les deux — c'est un travail à faire ensemble
— et le serveur signe `modifie_par` / `modifie_le`, affichés dans la ligne de méta.
⚠️ **Une RÉPONSE ne se corrige que par SON auteur**, et c'est le SERVEUR qui le vérifie (403) :
l'identité vient d'Access, donc la garde ne se contourne pas depuis le navigateur. Corriger sa
faute de frappe est normal ; réécrire ce que l'autre a dit ne l'est pas, et un fil où c'est
possible cesse de valoir comme mémoire commune. Une réponse corrigée porte « modifié … ».
La signature n'est posée que si le TEXTE a changé — même discipline que la décision : renvoyer le
sujet pour une autre raison (statut, destinataire, échéance) ne doit pas faire croire à une
réécriture.
⚠️ La correction d'une réponse est une écriture CIBLÉE sur `$.reponses` (règle 3), jamais un
réenregistrement du sujet — qui effacerait ce que l'autre vient d'ajouter. Et l'enregistrement du
sujet ÉTALE l'existant (règle 2) : une énumération de champs perdrait l'échéance, le client lié
et la décision déjà prise.
La boîte de correction porte aussi le CLIENT, le DESTINATAIRE et l'ÉCHÉANCE. Ils ne se posaient
qu'à la publication : un sujet créé « pour nous deux » ne pouvait plus être confié à quelqu'un, et
un sujet écrit dans l'urgence restait orphelin de client pour toujours — or c'est justement celui
qu'on ne retrouve pas trois semaines plus tard. Vider le champ client le DÉTACHE ; un nom inconnu
est gardé tel quel mais sans clé CRM (mieux vaut conserver ce qui a été écrit que l'effacer).
⚠️ Le destinataire ne peut pas vivre dans le DOM comme les autres champs : c'est un groupe de
boutons, pas un `input`, donc il n'a pas de `value` à relire. Il vit dans `EDITE_POUR`, remis à
`null` à chaque ouverture — sinon le choix fait sur un sujet suivrait sur le suivant — et
`null` signifie « non touché », donc la valeur enregistrée survit.
Une PHOTO peut désormais être jointe à un sujet DÉJÀ publié (bouton dans la boîte de correction).
Pas de file d'attente dans ce cas, contrairement à la publication : l'identifiant existe, l'envoi
part tout de suite. Les photos restent au niveau du SUJET — un second modèle de photos sur les
réponses, c'en serait un de trop (règle 25).

**15 ter. ON NE RÉCLAME UNE DATE DE POSE QU'UNE FOIS LE MATÉRIEL REÇU.**
`SSPlanning.aPlanifierDe` exige désormais `SSUI.materielRecu(d)`. Réclamer une date sur un
chantier encore en fabrication chez le fournisseur, c'est réclamer une décision que personne ne
peut prendre — et **un écran qui réclame pour rien, on apprend très vite à ne plus le lire**.
Signalé par Nicolas : un dossier en « Fabrication » remontait en « chantier signé sans date de
pose » alors qu'il n'y avait rien à planifier.
⚠️ **CONTREPARTIE OBLIGATOIRE : `aCommanderDe`.** Sans elle, resserrer la première liste créait
un ANGLE MORT — un devis signé jamais commandé n'aurait plus été réclamé par personne, ni pour
la commande (aucune alerte n'existait) ni pour la pose. **Les deux listes sont complémentaires et
doivent le rester : si l'une se resserre, l'autre doit s'élargir.** Un test vérifie qu'aucun
dossier ne peut être dans les deux, et qu'ensemble elles couvrent tout chantier vivant sauf ceux
dont la balle est chez le fournisseur (« commandé », « fabrication ») — où il n'y a justement
rien à décider de notre côté.
C'est aussi la BONNE action à montrer : sur un dossier qui n'est pas parti chez Harol, ce qu'il
faut faire n'est pas de planifier, c'est de commander — d'où le lien vers `vue.html?id=…#commande`.
L'état de la commande vit dans **`SSUI.etatCommande`** (source unique) : cinq étapes, et l'absence
de statut vaut « à commander ». Il comprend les DEUX formes, l'objet `commande.statut` de la
fiche et le `commande_statut` à plat de la liste — sans quoi le planning et le tableau de bord
répondraient différemment sur le même dossier.
⚠️ On **n'EMPÊCHE PAS** de saisir une date de pose avant la livraison : un conflit s'avertit, il ne
se bloque pas (règle 13), et il arrive qu'on cale une pose en sachant que la marchandise arrivera.
La fiche devis le DIT, en rouge quand la pose précède la livraison estimée — l'erreur est invisible
autrement, puisque la date de pose vit dans une carte et la livraison dans une autre, et que
personne ne compare deux cartes de tête.

**16. Une question qu'on classe doit laisser une DÉCISION ÉCRITE.** C'est ce qui sépare une
messagerie d'une mémoire commune : « on avait dit quoi pour les coulisses de Depaepe ? » doit avoir
une réponse dans l'ERP, pas dans un SMS perdu. La décision est demandée AU MOMENT de classer (après,
personne ne revient l'écrire), **obligatoire sur une `question`** et facultative ailleurs. Le serveur
la signe et l'horodate, et seulement quand elle CHANGE — renvoyer le sujet pour une autre raison ne
doit pas réattribuer une décision prise par l'autre. Elle survit à une réouverture (une décision
prise reste un fait) et elle est cherchable : c'est ce qu'on vient relire des semaines plus tard.

**17. Après la visite, c'est le DEVIS qui dit où en est l'affaire.** Une demande de RDV s'arrête à
`converti` ; l'état réel (brouillon / envoyé / signé) vit dans le devis. Les deux ne se parlaient
pas : une demande visitée dont le devis avait été fait au simulateur restait « en attente du devis »
POUR TOUJOURS. `SSAttente.devisDeRdv(rdv, devis)` fait le rapprochement — lien EXPLICITE
(`devis.rdv_id`, posé par « Créer le devis », ou `rdv.devis_id`) ou PROBABLE (même client, pour un
devis établi directement). Conséquences : on ne réclame plus un devis qui existe ; on signale au
contraire celui resté en BROUILLON, y compris sur une demande déjà `converti` — c'est celui qu'on
oublie, puisque le travail semble fait. Le badge de la carte dit « Devis à envoyer / envoyé /
signé » au lieu du simple « Devis lié », sans aucune ressaisie.
⚠️ Le statut « envoyé » s'appelle **`envoye_client`**, pas `envoye`.
La COLONNE du kanban suit la même source (`colonneDe` dans `rdv.html`). `converti` n'était posé que
par le bouton « Créer le devis » : un devis établi au simulateur ou directement laissait la demande
en « Visité » POUR TOUJOURS, pendant que sa pastille annonçait « Devis envoyé » juste en dessous.
La colonne disait donc « est passée par ce bouton-là » en faisant croire à « a un devis ».
Deux garde-fous à ne pas retirer : la déduction ne s'applique qu'au statut `visite` — sinon une
demande encore « Nouveau » sauterait en « Converti » parce que le client a un vieux devis sans
rapport, `devisDeRdv` rapprochant par CLIENT sans aucune garde de date ; et le statut STOCKÉ n'est
jamais réécrit, on n'enregistre pas une donnée déduite d'une heuristique.

**18. « Aujourd'hui » se calcule en heure LOCALE** (`SSUI.aujourdhui()`, `SSUI.isoDate(date)`).
`new Date().toISOString().slice(0,10)` renvoie une date UTC : entre minuit et 2 h du matin en heure
d'été belge (1 h en hiver), c'est LA VEILLE. Un devis créé à 00h30 portait donc la mauvaise date —
et une date ÉCRITE en base reste fausse pour toujours. Restent justes, et ne doivent pas être
« corrigés » : les calculs qui partent d'une chaîne ISO forcée en UTC (`… + 'T00:00:00Z'`) et y
restent d'un bout à l'autre, puisque aucune heure locale n'y intervient.

**19. Une question se pose LÀ OÙ ELLE SE POSE.** Depuis une fiche devis ou une demande de RDV, le
⚠️ UNE SEULE PORTE PAR ÉCRAN. `app/rdv.html` est le seul à porter déjà un fil interne
(« Un mot à Yannick ») : il est en contexte, il ne fait pas quitter la page, et son `awaiting`
alimente la liste partagée exactement comme un sujet. Le bouton « Demander à l'autre » y faisait
donc doublon — deux portes pour la même intention, sans que rien ne dise laquelle prendre — et il
était pire que redondant : posé dans le pied à côté d'« Enregistrer », il faisait un `location.href`
sans garde, donc sur une demande pas encore enregistrée il emportait tout le formulaire.
Il a été retiré de là, et SEULEMENT de là. Sur la fiche devis et le SAV, `lienSujet` reste la seule
porte : ne pas l'y toucher.
bouton « Demander à l'autre » ouvre les Échanges avec le contexte déjà posé (client, dossier,
destinataire, nature) via `SSUI.lienSujet()`, curseur dans le champ. Avant, il fallait ouvrir les
Échanges et RETAPER le nom du client : trois gestes pour une question de dix secondes, donc elle
repartait par SMS. Dans l'autre sens, la fiche devis affiche « Échanges sur ce dossier » — et
surtout les DÉCISIONS prises, lisibles là où elles servent.

**20. Un SAV se crée dès que le devis est SIGNÉ** (`SSUI.savPossible`), pas seulement après la
pose : sur 33 screens livrés, un seul était défectueux — AVANT la pose. Le limiter aux chantiers
posés rendait ce cas, pourtant réel, impossible à enregistrer nulle part. D'où aussi la nature
`materiel` (« Matériel / livraison ») dans `SSUI.SAV_TYPE_LABEL`, source unique des natures.
La GARANTIE ne court qu'à partir de la pose RÉELLE : une date de pose PRÉVUE ne la démarre pas
(sinon un chantier planifié s'affiche « sous garantie », ce qui pousserait à ne pas facturer une
intervention qui l'est). Trois réponses distinctes : « sous garantie », « pose prévue le … —
garantie non démarrée », « garantie inconnue — pas de date de pose ».
Les photos sont en DEUX séries, `photos` (le constat) et `photos_apres` (la réparation) : les
mélanger fait perdre la seule preuve utile et on ne sait plus à quoi ressemblait le défaut.

**20 bis. Un SAV se juge d'abord sur la GARANTIE, et se clôt sur CE QUI A ÉTÉ RÉPARÉ.**
`SSUI.garantieDe(devis, reglages)` répond à « facturable ou pas ? » depuis la date de pose et
`prix.garantie_mois` (12 par défaut) — la question se posait de tête, dossier par dossier. Sans date
de pose, on répond « inconnue » : on ne devine pas.
Clore un ticket EXIGE d'écrire la réparation (la cause reste facultative) — même règle que la
décision d'un sujet : six mois plus tard, le même défaut revient et personne ne sait ce qui avait
été fait. **C'est le SERVEUR qui le tient** (400 sans texte, depuis le 27/10/2026 : le menu de statut
de la fiche devis passait « Résolu » sans un mot). Chaque clôture devient un PASSAGE daté et signé,
qui s'ajoute aux précédents si le ticket rouvre puis se referme (règle 47).
Les NOTES du ticket ont leur propre route (`/api/devis/:id/sav/:tid/note`), en écriture ciblée.
⚠️ Le serveur reconstruit un ticket CHAMP PAR CHAMP : tout appelant de `saveSavTicket` doit renvoyer
le ticket ENTIER — `pour` et `echeance` surtout, sinon il les efface. Les notes, les passages et la
pièce commandée (`piece_prevue`, `piece_note`), eux, sont repris de la base quand ils manquent.
Les deux écrans du SAV — `app/sav.html` et la carte de `app/vue.html` — doivent afficher la même
chose, sinon on refait le diagnostic.

**21. Deux statuts différents ne portent JAMAIS la même couleur** (`SSUI.STATUT_DEVIS_COULEUR`).
`relance_1` et `relance_2` étaient toutes deux en `--warn`, `brouillon` et `annule` toutes deux en
`--text-subtle` : un devis relancé deux fois ressemblait à un devis relancé une fois, et un
brouillon EN COURS à un dossier abandonné. La couleur raconte la progression — neutre, bleu,
orange, rouge-orangé, puis vert gagné / rouge perdu / éteint abandonné.
`relance_2` n'est pas le rouge de `refuse` : une relance 2 est encore en jeu, un refus ne l'est
plus. Même teinte dans le CRM (`.badge-relance2`) et sur le tableau de bord, sinon les deux écrans
racontent deux histoires. `annule` se distingue de `brouillon` par l'extinction, pas par la teinte.

**21 bis. Le liseré du tableau de bord ne montre PAS le statut, il montre l'ACTION à faire**
(`prochaineAction`, puis `railColor`). À ne pas confondre avec la règle 21 : corriger les couleurs
de STATUT n'a strictement rien changé à l'écran, parce que le statut n'est qu'un REPLI, utilisé
seulement quand il n'y a rien à faire. On a cherché au mauvais endroit un aller-retour entier.
Neuf actions pour SIX familles — une famille = un genre de travail = une couleur ET une icône :
rien à faire (gris `--text-subtle`), à rédiger de mon côté (bleu `--accent`), à pousser le client,
devis ou paiement (ambre `--warn`), ça se perd (rouge `--danger`), gagné à formaliser (vert `--ok`),
chantier à organiser (violet `--accent-3`). Ce qui se regroupe se regroupe VOLONTAIREMENT : c'est
le texte, toujours affiché à côté, qui dit lequel. Les pastilles « Aujourd'hui » désignent les
mêmes actions sur la même page et suivent donc les mêmes familles.
Trois pièges, tous payés ici :
• **Une teinte ne se juge qu'en THÈME SOMBRE.** `--accent-2` (#ffd23f) et `--warn` (#ffb020) sont
  deux jaunes à ΔE **18,8** en sombre, mais à ΔE 42,5 en clair : la collision n'existait QUE dans le
  thème réellement utilisé. Vérifier en clair aurait conclu « tout va bien ». L'or a donc quitté le
  liseré (il reste au halo « client chaud », qui est une ombre, pas une teinte de texte).
• **Se mesurer, pas s'estimer** : résoudre chaque `var(--…)` en RGB réel via `getComputedStyle`,
  convertir en Lab et exiger un ΔE ≥ 25 entre deux familles. La paire la plus serrée aujourd'hui est
  bleu / violet (ΔE 25 en sombre, 31,7 en clair).
• **L'icône se porte par l'ACTION, jamais déduite de la couleur.** `signalIcon(color)` devinait le
  pictogramme en reniflant la chaîne `var(--…)` : chaque collision de teinte se propageait donc à
  l'icône, qui ne pouvait pas rattraper l'ambiguïté. Même remarque pour la cliquabilité, qui se
  déduisait d'une regex sur le LIBELLÉ affiché (`/Relance/i`) — vrai par chance pour « à relancer »
  du devis expiré, et cassé au premier libellé reformulé. L'action porte `ic` et `hash`.

**22. Une couleur ne peut pas identifier un client à elle seule** (`SSUI.avatarsClients`).
Le liseré dit QUOI FAIRE (règle 21 bis), donc trois clients qui attendent un acompte sortent en
trois filets identiques — et la liste se lit comme un bloc. D'où la pastille à côté du nom :
initiales + teinte, qui répond « qui ? » pendant que le liseré répond « quoi ? ».
⚠️ Ne pas la réécrire en « simple couleur calculée depuis le nom » : ça a été essayé, c'est faux.
Avec 48 combinaisons, sept clients affichés ensemble en partagent une **une fois sur trois**
(paradoxe des anniversaires) — mesuré sur les données de test : trois des sept clients tombaient
sur la MÊME couleur, ΔE 0. Et agrandir la palette ne règle rien : à 54 combinaisons le plancher
tombe à ΔE 6, c'est-à-dire des QUASI-doublons, où l'on hésite au lieu de lire — pire qu'un doublon
franc. Vingt clients ne peuvent pas avoir vingt couleurs distinctes, aucun réglage n'y change rien.
La solution tient en une phrase : **le nom donne la case de départ, la LISTE arbitre les chocs.**
Un client garde sa couleur (même sur plusieurs devis, même d'un écran à l'autre), mais une pastille
qui tomberait à moins de `AVA_SEUIL` d'une déjà posée dans la même liste est déplacée vers la case
libre la plus éloignée de toutes les autres — et non vers la première libre venue, qui est souvent
la voisine immédiate de celle qu'on fuit. Ce qui est à l'écran est donc toujours séparable.
Mesuré après coup : ΔE minimal **20,9** à 7 clients, 17,6 à 10, 10,6 à 20, et **jamais de doublon**.
Trois contraintes à ne pas perdre en retouchant :
• **Le contraste passe avant l'écart.** Les variantes à 3 tons largement espacés gagnaient 2 points
  de ΔE mais faisaient tomber les initiales à 2,5 de contraste : illisibles. On tient 5,1 (sombre)
  et 4,6 (clair), donc au-dessus du seuil AA.
• **Mesurer en peignant un pixel**, jamais en lisant `getComputedStyle().color` : depuis le passage
  à OKLCH il renvoie la chaîne `oklch(0.84 0.12 120)` telle quelle, et une conversion qui attend du
  `rgb()` lit la TEINTE comme une composante rouge. Ça a produit un « ΔE 12,2 » entièrement faux,
  identique dans les deux thèmes — ce qui était le seul indice. Passer par un canvas 1×1.
• **Sur téléphone la pastille rétrécit à 21 px** : à 26 px elle faisait déborder `.m-nm` de 6 px et
  rabotait le nom de 80 à 60 px. C'est le NOM qui identifie ; la couleur n'est qu'un appui.

**23. Ce qui n'attend personne doit quand même revenir** (revue des idées, `app/echanges.html`).
`SSAttente.depuisSujets` écarte volontairement un sujet sans destinataire ET sans échéance : c'est une
idée en réserve, pas quelque chose qui bloque, et la liste de ce qui attend se remplirait d'idées.
Mais sans contrepartie ces sujets-là ne remontent **jamais** — or ce sont justement les « choses à
mettre en place », celles qu'on dépose ici PARCE QU'elles n'ont pas de client. Le bandeau « en
réserve depuis plus de deux mois » est cette contrepartie, et son critère est l'exact complément de
l'exclusion de `attente.js` : **si l'une change, l'autre doit changer avec elle**, sinon une idée
tombe dans le trou entre les deux ou s'affiche aux deux endroits.
Quatre sorties, pas une de moins : « Je prends » et « Pour l'autre » en font une TÂCHE avec un nom
dessus (une chose sans nom n'avance pas — règle 15), « Classer » passe par la décision habituelle,
et « Garder » écrit `revu_le` et repousse de deux mois. **Ne pas supprimer « Garder »** : sans lui le
bandeau harcèlerait pour une idée qu'on veut précisément laisser mûrir, et on apprendrait à ne plus
le lire — ce qui coûterait aussi les trois autres.
`revu_le` survit parce que tous les appelants étalent le sujet (`{...s, ...}`, règle 2) et que le
serveur valide le format ; une énumération de champs l'effacerait en silence.

**23 bis. Les décisions sont dans le Ctrl+K.** Elles étaient cherchables depuis toujours — mais
seulement en pensant à ouvrir l'écran des Échanges, donc on ne les retrouvait pas. Le groupe
« Échanges et décisions » est volontairement le DERNIER de la palette : on cherche d'abord un
dossier, et un sujet qui remonterait devant le devis du même client ferait manquer le devis.
Le résultat pointe vers `echanges.html?sujet=<id>`. ⚠️ Une décision vit sur un sujet CLASSÉ, donc
masqué par défaut : l'arrivée coche « voir ce qui est fait » avant de viser la carte, sinon on
atterrit sur une page qui semble ne pas contenir ce qu'on vient d'y chercher.

**24. Le RAIL DE NAVIGATION rend les compteurs permanents** (`nav.js`, `.ssrail`).
Les badges d’alerte vivaient DANS le volet déroulant : fermé, il ne restait qu’un point rouge qui
disait « quelque chose, quelque part » sans dire quoi ni combien. Il fallait donc OUVRIR le menu
pour apprendre qu’un SAV attendait — un geste qu’on ne fait pas, d’où l’impression que les modules
vivent chacun dans leur coin. Le rail les affiche en continu, sur les 20 pages, même replié en
icônes (le compteur devient alors une pastille sur l’icône : c’est tout l’intérêt du repli).
Trois règles à ne pas défaire :
• **Le rail n’apparaît qu’au-delà de 1400 px, et le volet déroulant DISPARAÎT alors.** Les deux
  ensemble, ce serait deux navigations côte à côte — le défaut des « deux portes » (règle 19).
• **Aucune branche JS sur la largeur** : tout passe par la media query, donc rien ne peut se
  désynchroniser en redimensionnant. L’état replié est posé sur `<html>` AVANT le rendu, sinon le
  rail s’affiche large puis se rétracte sous les yeux à chaque chargement.
• ⚠️ **Une media query mesure la FENÊTRE, pas la place disponible.** La fiche devis passait en trois
  colonnes dès 1500 px en croyant disposer de 1500, alors que le rail en prenait 212 : les colonnes
  se serraient (17 px de débord interne, 41 sur une rangée). Son seuil est donc passé à 1712 =
  1500 + 212, et son complément à 1711. Toute page qui ajoute une mise en page large doit faire la
  même addition.
Le total du point rouge ne compte QUE le volet : sinon le rail le doublerait.
⚠️ **UNE SEULE MARQUE À L'ÉCRAN.** Dès que le rail est là, il porte le logo et le nom ; le bandeau
les répétait 200 px plus loin — deux fois la même chose, et c'est ce que Nicolas a vu tout de
suite. Au-delà de 1400 px le bandeau masque donc `.brand-logo` et `.brand h1`, et promeut
`.brand .module` : il annonce la PAGE, ce qui est son rôle. Il y gagne la place qui lui manquait
à droite (le badge « HORS-LIGNE » passait sur deux lignes). Sous 1400 px, rien ne change : pas de
rail, donc la marque reste dans le bandeau. C'est la MÊME media query qui décide des deux, donc
elles ne peuvent pas se désynchroniser.
Contrepartie obligatoire : **le logo RAMÈNE au tableau de bord**, aux deux endroits où la marque
vit (le logo du bandeau et la marque du rail), donc le raccourci existe quelle que soit la
largeur. Seul le NOM était cliquable auparavant (`<h1><a>`) — jamais le logo — et masquer le
bandeau au-delà de 1400 px avait purement supprimé le raccourci sur grand écran. Posé dans
`nav.js` (`logoCliquable`), pas dans les 20 pages. Le `<span class="brand-logo">` est REMPLACÉ
par un `<a>` de même classe, jamais enveloppé dans un `<a display:contents>` : ce mode est mal
rendu dans l'arbre d'accessibilité de plusieurs navigateurs, et un lien qu'un lecteur d'écran ne
voit pas n'est pas un lien.

**24 bis. LE MENU SUIT LE FIL DE L'AFFAIRE (variante B, choisie par Nicolas le 25/10/2026).**
Ordre du rail ET du volet : Tableau de bord · **+ Nouveau** (Devis, Dépannage, Demande de RDV) ·
Affaires · Chantiers · Après-vente · Argent · Équipe · et Paramètres en pied, avec la ligne
« qui ». Les groupes suivent la vie d'un dossier, de la demande à l'encaissement : on cherche
une page par « où en est l'affaire », pas par ordre alphabétique. **Une seule description**
(`NAV_ACCUEIL`, `NAV_CREER`, `NAV_GROUPS`, `NAV_REGLAGES`) rendue deux fois — rail et volet ne
peuvent pas diverger. Protégé par `tests/nav.test.html` (92 tests, dont des cadres réels à
1500, 1200 et 390 px).
⚠️ **QUATRE DÉFAUTS TROUVÉS EN ENQUÊTANT, AUCUN NE SE VOYAIT EN RELISANT :**
• **La page en cours ne s'allumait JAMAIS en production.** Le test comparait à `echanges.html`,
  or Cloudflare Pages sert les pages SANS `.html` (`/app/echanges`). En local tout allait bien.
  `pageKey()` normalise (extension, `?`, `#`, `/` final, casse) ; `PAGE_MERE` oriente les pages
  hors menu sur leur mère (fiche devis, document, simulateur → Tableau de bord ; facture →
  Facturation). Un dossier seul (`/app/`) n'allume rien plutôt que d'allumer au hasard.
• **Le compteur « Échanges » changeait selon la page** : 16 pages ne chargent pas `attente.js`,
  et le calcul retombait sur une version réduite. Le menu va le chercher lui-même
  (`chargerAttente`, depuis le dossier de `nav.js`), et rend `null` plutôt qu'un faux chiffre
  s'il échoue.
• **Sur grand écran, les compteurs ne se rafraîchissaient jamais** : le volet les recalculait à
  l'ouverture, le rail — toujours ouvert — jamais. Rafraîchis toutes les 2 min quand l'onglet
  est visible, et au retour sur l'onglet (`setInterval`, pas rAF : voir les pièges).
• **Le bouton « Menu » réduisait le menu** : un libellé qui dit le contraire de ce qu'il fait.
  Remplacé par une icône de panneau à côté du logo, dont le libellé accessible dit l'action
  (« Réduire le menu » / « Déployer le menu »).
⚠️ **LE RAIL DOIT TENIR SUR 900 px DE HAUT, DÉCOR DE FÊTE COMPRIS.** La première version montait
à 1 068 px : le pied passait sous le bord et la citrouille se posait sur le nom. Et **2 px de
trop suffisent** : la barre de défilement apparaît, vole 9 px de LARGEUR et coupe
« Outillage & références ». Le test mesure `scrollHeight − clientHeight === 0`, pas un seuil.
⚠️ **`[hidden]` EST BATTU PAR UN `display: flex` DE LA FEUILLE** : la ligne « qui », vide hors
connexion, s'affichait quand même. `.ssrail [hidden] { display: none !important }`. Et
`.ssrail > * { flex: none }` : une colonne flex de hauteur fixe ÉCRASE ses enfants au lieu de
défiler (même piège que `.vue-rail`).
⚠️ **UNE SEULE IDENTITÉ À L'ÉCRAN** : au-delà de 1400 px, la pastille « qui » du bandeau se
masque, le pied du rail la porte (même raison que la marque, règle 24).
⚠️ **« Nouveau › Demande de RDV » ouvre `rdv.html?nouvelle=1`** : la page ouvre la fenêtre de
création puis RETIRE le paramètre de l'adresse — sinon un rechargement en rouvrirait une.
⚠️ **SUR TÉLÉPHONE, UN MENU NE DOIT NI ENFERMER NI CACHER** (demande de Nicolas). Le volet tient
dans l'écran à 375 et 390 px, défile seul (`overscroll-behavior: contain`), chaque entrée se
touche, et l'on en sort par les trois gestes qu'un pouce essaie : toucher à côté, retoucher le
bouton, Échap. Les cas T1 à T9 du test le rejouent au geste.
⚠️ **TOUCHER À CÔTÉ FERME LE MENU, ET RIEN D'AUTRE** (26/10/2026). Le clic qui fermait le volet
continuait jusqu'à ce qu'il y avait dessous : sur téléphone, une ligne du tableau de bord — on fermait
le menu et on atterrissait sur un autre dossier. Le gestionnaire est désormais en phase de CAPTURE et
n'avale QUE ce clic-là (menu ouvert, clic hors du menu) ; menu fermé, il ne fait rien. Le défaut était
invisible parce que T6 cliquait justement sur une ligne : le cadre partait sur la fiche, et T7 à T9
vérifiaient un document détaché — ils passaient sans rien prouver. **Un test qui rejoue un geste doit
vérifier qu'il est resté sur la page** (T6 compare maintenant le document et l'adresse).

**25. Une PHOTO sur un sujet suit la même discipline que les réponses.** Une photo est souvent LE
message — une pièce cassée, un mail fournisseur, un repérage de façade — et la décrire coûte dix
fois plus cher que la montrer. Route ciblée `POST /api/sujets/:id/photo` (et `DELETE …/photo/:pid`),
et les photos sont RÉINJECTÉES à l’enregistrement complet : sans ça, renommer un titre effacerait la
photo que l’autre vient d’ajouter — exactement ce qui était arrivé aux notes avant la règle 3.
L’image part dans R2 AVANT (`SSUI.compressAndUploadPhoto`) ; la base ne reçoit que l’adresse. La
borne de 2 Mo sur l’url ne sert qu’au repli dataURL quand R2 est indisponible : mieux vaut une photo
lourde qu’une photo perdue.
⚠️ La photo se CHOISIT avant de publier (on écrit et on montre, c’est le même geste) mais ne PART
qu’après : la route ciblée a besoin de l’identifiant, qui n’existe pas avant l’enregistrement. D’où
la file `PHOTOS_EN_ATTENTE`. Chaque échec d’envoi est DIT — une photo qu’on croit jointe et qui ne
l’est pas vaut moins que pas de photo du tout. Et aucune file d’attente hors-ligne : une photo qui
n’existe que sur le téléphone qui l’a prise est pire qu’une photo absente, l’autre croirait l’avoir vue.

**26. Une photo s’ouvre DANS la page** (`SSUI.ouvrirPhotos(urls, index)`, `SSUI.fermerPhotos()`).
Partir sur un autre onglet fait perdre sa place dans la liste et oblige à revenir en arrière pour
continuer à lire. Fermeture par la croix, par Échap ou par le fond ; flèches clavier et boutons
pour passer d’une photo à l’autre, masqués quand il n’y en a qu’une — elles ne mèneraient nulle part.
Le défilement du fond est bloqué à l’ouverture, sinon on retrouve la liste ailleurs en fermant.
⚠️ Deux pages (`vue`, `devis-review`) portent ENCORE leur propre
visionneuse en copie locale (le portfolio n'en a plus depuis le 26/10/2026 : son mode présentation
l'a remplacée, règle 45 ; l'outillage non plus depuis le 27/10/2026, règle 48) — leur STYLE, lui,
était déjà dédoublonné dans `base.css`. Le helper
partagé utilise donc l’identifiant `ssLightbox` et non `lightbox` : deux éléments de même id dans
un document, c’est le genre de collision qu’on ne voit qu’un jour de malchance. Toute nouvelle page
passe par le helper ; les deux copies restent à ramener dessus, quand on y touchera pour autre chose.
Le clic sur le fond suit la règle des modales : il ne ferme que si le geste a COMMENCÉ sur le fond.

**26 bis. UNE IMAGE QUI RATE UNE FOIS RESTE CASSÉE POUR TOUJOURS — une page web ne réessaie
JAMAIS.** Signalé par Nicolas le 12/10/2026 : une vignette d'Échange sortait en icône de papier
déchiré, alors que **la même photo s'ouvrait parfaitement dans la visionneuse au clic**.
⚠️ **LA PREMIÈRE CHOSE À ÉTABLIR ÉTAIT QUE CE N'ÉTAIT PAS UN DÉFAUT DE CODE.** La vignette et
la visionneuse lisent la même `url`, dans le même tableau, sans aucune transformation : les
seules différences de balisage sont `loading="lazy"` et l'échappement HTML, et **ni l'un ni
l'autre ne peut faire échouer une requête**. Ce constat élimine d'un coup toute une famille de
causes et déplace la question : ce n'est pas le CHEMIN qui diffère, c'est la REQUÊTE qui avait
raté. **Ctrl+F5 et la vignette revenait** — c'est ce fait, demandé à Nicolas plutôt que deviné,
qui a tranché. Ne pas réparer un symptôme qu'on n'a pas reproduit : c'est le piège du
`position: sticky`, déjà payé une fois.
⚠️ **NOS PHOTOS SONT DERRIÈRE CLOUDFLARE ACCESS** (`/api/photos/...`). Quand la session se
renouvelle, la requête d'image reçoit la page de connexion — **un 200 avec du HTML**, pas une
erreur réseau. L'`<img>` échoue, et rien ne la relance : elle reste cassée jusqu'au prochain
rechargement complet de la page.
⚠️ **LE PARAMÈTRE AJOUTÉ AU RÉESSAI N'EST PAS DE LA SUPERSTITION** : cette réponse d'échec peut
être MISE EN CACHE, précisément parce que c'est un 200. Redemander l'URL à l'identique se ferait
resservir l'échec depuis le cache, et le réessai ne prouverait rien.
⚠️ **UN SEUL ÉCOUTEUR DÉLÉGUÉ, EN CAPTURE, ET C'EST LA CLÉ.** L'événement `error` d'une image
**ne bouillonne pas** — mais il DESCEND en phase de capture. `document.addEventListener('error',
…, true)` dans `ui.js` couvre donc toutes les photos de toutes les pages d'un coup, **y compris
les trois qui portent encore leur visionneuse en copie locale** (règle 26) et celles qu'on
écrira demain — sans une ligne à brancher sur aucun appel.
⚠️ **ET SEULEMENT NOS PHOTOS** : le filtre sur `/api/photos/` écarte logos, images partenaires
et pictogrammes. Un réessai général masquerait de vraies erreurs de chemin derrière une seconde
chance.
⚠️ **APRÈS LE SECOND ÉCHEC, UN REPÈRE NEUTRE PLUTÔT QUE L'ICÔNE DU NAVIGATEUR** (`ss-photo-ko`).
C'est la question que Nicolas a posée telle quelle : devant un papier déchiré, **rien ne dit si
la photo est perdue ou si c'est seulement l'affichage qui a raté**. La vignette reste cliquable,
et l'ouvrir refait une requête neuve — le geste naturel est donc aussi le bon.
⚠️ **`width` ET `height` SUR LE SVG DU REPÈRE SONT OBLIGATOIRES.** Sans dimensions intrinsèques,
le navigateur attribue à un SVG une taille PAR DÉFAUT (300 × 150) : avec `object-fit: contain`,
le repère sortait minuscule et calé en haut à gauche de la vignette — **ce qui ressemblait
encore à une image cassée**, donc exactement ce qu'on venait de remplacer. Vu à l'écran,
invisible dans le code et dans les mesures (`naturalWidth` répondait bien 150).
⚠️ `object-fit: contain` y porte un `!important` délibéré : les vignettes le passent à `cover`
avec une sélectivité ÉGALE (`.ec-ph img`), depuis une feuille chargée APRÈS `base.css`.

**27. Une relance ne se réclame jamais le jour où l’on vient d’en envoyer une** (`relanceEtat`).
L’échéance de chaque relance est ancrée sur la date d’ENVOI du devis (R1 à J+4, R2 à J+9, R3 à
J+21), et c’est VOULU : un devis oublié rattrape son retard. Mais prise seule, cette règle
réclamait la relance suivante à la seconde où l’on enregistrait la précédente, dès que le devis
était parti depuis plus longtemps que le plan — deux relances le même jour, ce qu’on ne fait
jamais, et le compteur « 1 devis à relancer » qui ne descendait pas.
S’ajoute donc un PLANCHER : l’écart que le plan lui-même prévoit entre ces deux étapes (9 − 4 = 5
jours entre R1 et R2, 21 − 9 = 12 entre R2 et R3), compté depuis la dernière relance RÉELLEMENT
envoyée. L’échéance retenue est la plus TARDIVE des deux.
⚠️ Les relances seulement DÉDUITES du statut (`implied: true`, `date: null`) ne comptent pas dans
ce plancher : on ne sait pas quand elles sont parties, et leur inventer une date retarderait la
suivante sans raison. Un devis jamais relancé reste donc en retard de son vrai nombre de jours.

**28. Un décor de fête vit dans `assets/js/fetes.js`, jamais dans une page.** Un décor saisonnier
recopié sur vingt pages, c'est vingt endroits à retrouver le 2 novembre — donc des toiles
d'araignée encore en place à Noël. Le calendrier décide seul (bornes en `MM-JJ`, qui reviennent
chaque année sans millésime à tenir à jour), et **ajouter une fête = une entrée dans `FETES`** :
les emplacements (`coin` et sa `bete`, `marque`, `volants`) sont les mêmes pour toutes, on
remplace les dessins, pas le code. Un dessin s'écrit en SVG en ligne (`svg:`) ou en fichier
(`img:`) ; le SVG est préféré, il suit le thème via `currentColor` et ne coûte aucune requête.
Trois règles, et ce sont elles qui justifient le module :
• **JAMAIS SUR CE QUE LE CLIENT VOIT.** Rien dans `.paper`, rien sur `devis-review.html` ni
  `track.html` (les deux pages servies par lien à jeton, hors Access), rien à l'impression. Une
  araignée sur un devis d'école, ce n'est pas drôle : c'est une facture qu'on ne prend pas au
  sérieux. Le script n'est pas inclus sur ces pages ET le module s'y arrête de lui-même.
• **LE DÉCOR NE DIT RIEN.** Ici la couleur porte du sens (règles 21 bis et 22). Les décors se
  reconnaissent à leur FORME et vivent en opacité basse : personne ne prend une citrouille pour
  une alerte, même si son orange est voisin de `--warn`.
• **ÇA DOIT POUVOIR S'ÉTEINDRE**, et par APPAREIL (`localStorage`, réglage dans Paramètres) :
  un client par-dessus l'épaule et l'envie de chauves-souris tombe, sans rien changer pour l'autre.
⚠️ Les coins se reposent à chaque rendu (`MutationObserver`). Presque toutes les listes de l'ERP
arrivent de l'API APRÈS le chargement : un décor posé une seule fois n'apparaissait sur AUCUN de
ces écrans, et disparaissait au premier filtre sur les autres. L'observateur est groupé par
`setTimeout`, **pas** `requestAnimationFrame` — voir le piège ci-dessous.
⚠️ **Une teinte de décor s'écrit `{ sombre, clair }`**, et le module en fait des variables CSS.
Coloriés en dur, les décors étaient calibrés en SOMBRE : en clair — le thème réellement utilisé en
production — la toile grise à 35 % sur du blanc ne se voyait presque plus. Deux tests du contrat
l'exigent désormais, pour que la prochaine fête ne puisse pas l'oublier.
⚠️ **Un décor de coin doit être RETOURNÉ selon le coin qu'il occupe.** La toile est dessinée avec
son moyeu à l'origine du viewBox, donc en haut à gauche ; posée telle quelle en haut à DROITE, son
moyeu se retrouvait 58 px à l'intérieur de l'encadré — ça ne se lisait plus comme une toile
accrochée dans l'angle. À 35 % d'opacité et 58 px, c'était invisible : il a fallu l'agrandir en
rouge pour le voir. Le miroir porte sur la TOILE SEULE et jamais sur le conteneur, sinon
l'araignée pendrait vers le haut dans le coin bas-gauche. Les coins alternent haut-droite /
bas-gauche — les deux angles que les coins « ticked » laissent libres.
⚠️ **Un décor posé DANS le rail se cale en `position: fixed`, jamais en `absolute`.** Le rail
DÉFILE dès que la liste dépasse la hauteur de l'écran, et un élément en `absolute` dans un
conteneur qui défile REMONTE AVEC LE CONTENU : la citrouille se retrouvait au milieu du menu, à
côté de « Facturation ». En `fixed` elle se cale sur la fenêtre — donc sur le bas du rail, qui
est lui-même fixe de haut en bas. Sa largeur suit celle du rail (212 px, 60 px replié) et le
dessin se centre dedans, la taille étant posée sur un élément INTÉRIEUR : sans ça on ne peut pas
centrer sans connaître la taille dans la feuille de style.
⚠️ **UN DÉCOR NE CACHE JAMAIS UNE NAVIGATION : le rail RÉSERVE la hauteur de son décor de pied.**
Conséquence directe du `position: fixed` ci-dessus — le pied flotte par-dessus le bas de la
fenêtre, donc par-dessus les dernières entrées dès que le rail défile. Tant que les décors
mesuraient 30 px, personne ne l'a vu. Saint Nicolas en fait 68 : mesuré sur un écran de 740 px de
haut — un portable ordinaire — il recouvrait « Échanges », « Facturation » et « Notes de frais »,
qui restaient CLIQUABLES (`pointer-events: none`) : pire que masquées, invisiblement vivantes.
`poserRail` pose donc un `padding-bottom` égal à la hauteur RENDUE du décor plus une respiration,
et `nettoyer` le reprend — sans quoi un trou de 86 px resterait au bas du rail toute l'année.
⚠️ La hauteur se MESURE (`offsetHeight`), elle ne se déduit pas de `taille` : `taille` est une
LARGEUR, et la hauteur dépend du viewBox de chaque dessin. Quatre tests le gardent, et ils ont
été vérifiés en désactivant la correction — deux échecs — avant d'être conservés.
⚠️ **Un décor posé DANS le rail doit être hors du flux.** La citrouille de pied, en flux, ajoutait
30 px à la colonne : le rail passait en défilement dès 820 px de haut, et la barre lui volait 10 px
de largeur — « Outillage & références » se faisait tronquer. Ancrée par le bas, elle n'allonge plus
le contenu. Mesurer `scrollHeight > clientHeight` ET `clientWidth` du rail après tout ajout.
⚠️ **CE QUI FAIT QU'UN DÉCOR EST SOIGNÉ**, et ce qui manquait aux premières versions de
décembre — retour de Nicolas, justifié : « c'est la fête, il faut que ce soit magnifique ».
La différence avec Halloween se nomme précisément, et tient en trois points :
• **Trois couches par objet** : la masse, un détail DÉCOUPÉ dans `var(--surface)` (le visage de
  la citrouille, les yeux de l'araignée, le zigzag peint de la boule), et un reflet.
  Une silhouette pleine d'une seule teinte sort toujours en tache.
• **Une animation qui APPARTIENT à l'objet**, pas seulement son déplacement : les ailes battent,
  les bulles montent, l'étoile scintille, la fumée s'échappe. Les classes sont partagées
  (`ssfete-scintille`, `-bulle`, `-fumee`, `-eclore`, `-eclat`) et s'appliquent à un MORCEAU
  du dessin. ⚠️ Elles exigent `transform-box: fill-box`, sinon `transform-origin: center`
  désigne le centre du viewBox et la forme part en diagonale au lieu de pivoter sur elle-même.
• **De la VARIÉTÉ là où l'objet se répète** : `tombe.svg` accepte une LISTE. Un seul flocon
  répété seize fois se voit immédiatement — c'est ce qui faisait « pas soigné ».
⚠️ **Juger sur PLANCHE avant de garder.** Construire une page qui affiche tous les dessins de
`SSFetes.FETES` côte à côte et agrandis : c'est le seul moyen de voir qu'un décor est plus
pauvre que ses voisins. Ça a fait retirer la fusée, refaire le traîneau et les confettis, et
abandonner le saint sur son âne — trois fois que le défaut n'était PAS visible en situation.
⚠️ **À 85 px, en mouvement et en opacité basse, il faut QUATRE FORMES FRANCHES — pas une
illustration.** Saint-Nicolas sur son âne a été dessiné, jugé à l'écran en grand, refait avec
l'âne en retrait, rejugé, puis ABANDONNÉ : l'âne et le cavalier fusionnaient en une seule masse,
et aucun détail ne rattrape ça à cette taille. Avant de peaufiner un décor figuratif, l'agrandir à
200 px et le regarder : ce qui ne se lit pas en grand ne se lira jamais en petit.
⚠️ **UN DÉCOR NE DEMANDE RIEN À PERSONNE : on dessine un PORTRAIT, pas une SCÈNE.** Le bateau à
vapeur qui avait remplacé l'âne se lisait parfaitement — coque, cabine, cheminée, fumée — et il a
pourtant été retiré. Nicolas, le 10/10/2026 : « je ne vois pas ce que le bateau vient faire dans
la fête ». Il avait raison : il faut connaître la légende (le saint arrive d'Espagne par bateau)
pour que l'image veuille dire quelque chose, et un décor qui exige un préalable a déjà échoué.
Le buste l'a remplacé : mitre pointue, croix dorée, visage, grande barbe blanche — quatre formes
qui ne se recouvrent pas, la silhouette la plus reconnaissable de décembre. **Le bon critère
n'est donc pas « est-ce que ça se lit » mais « est-ce que ça se reconnaît sans explication ».**
⚠️ **`var(--surface)` SERT AUX DÉCOUPES, PAS AUX FORMES BLANCHES** — et la confusion s'est payée
TROIS FOIS sur la même planche. Le visage de la citrouille est un TROU qui laisse voir le fond,
et ça marche parce que la citrouille est POSÉE sur ce fond. Une barbe n'est pas un trou : dessinée
en `var(--surface)`, elle disparaît, et il ne reste qu'une tête qui flotte au-dessus d'une chape.
Même panne pour les quartiers de la mandarine (sortis en bleu nuit sur l'orange, un fruit fêlé) et
pour le ruban d'un cadeau qui TOMBE — un objet qui traverse la page n'a aucune carte sous lui.
**Et le piège est SYMÉTRIQUE** : un relief en crème littérale est parfait sur le thème sombre et
INVISIBLE sur le clair dès qu'il DÉPASSE de son objet — le nœud du cadeau s'était évaporé ainsi.
La règle complète : **un relief clair ne vaut que s'il reste À L'INTÉRIEUR de l'objet ; ce qui
dépasse se dessine dans la couleur de l'objet, pour se lire par sa FORME et non par son contraste.**
Corollaire : deux formes voisines de même couleur (moustache et barbe) ne se distinguent que par
la ligne d'ombre qui passe entre elles. **Toujours basculer le thème : un seul des deux laisse
passer la moitié des défauts.**
⚠️ **L'ÉCHELLE D'UN DÉCOR NE SE COPIE PAS D'UNE FÊTE À L'AUTRE.** Le moteur réduit chaque objet
qui tombe de 0,62 à 1,13 fois sa `taille` : à 17 (la valeur des feuilles), les friandises
tombaient à 10 px, où un biscuit, un cadeau et un bonbon sont trois mouchetures identiques. Une
feuille et un flocon sont des SILHOUETTES VIDES, leur contour suffit ; une friandise porte un
ruban, des quartiers, un visage — du détail INTÉRIEUR, qui a besoin de place. La taille se déduit
de ce que le dessin doit MONTRER, et se mesure sur téléphone, où c'est le plus cruel.
⚠️ **UN DÉCOR SE COMPARE À SES VOISINS, PAS À LUI-MÊME.** Noël portait sa marque à 17 px
quand la mitre de Saint-Nicolas en fait 27, un pied de rail à 30 quand le saint en fait 52, et
des flocons à 16 quand les friandises sont à 21 : **la fête la plus importante avait le décor le
plus timide**, et ça ne se voyait pas en la regardant seule. C'est la PLANCHE qui le montre —
d'où la règle de la juger avant de garder.
⚠️ **UN DESSIN PENSÉ POUR ÊTRE LU EN PETIT N'A PAS LA DENSITÉ QU'IL FAUT EN GRAND, et l'agrandir
ne la crée pas.** Le sapin de la marque (trois étages, deux guirlandes, cinq boules) est juste à
17 px et devient VIDE à 52. `SAPIN_DECORE` est donc un dessin à part — quatre étages, un socle,
neuf boules, une étoile qui scintille — et non le premier mis à l'échelle. La réciproque est la
raison d'être du spéculoos-silhouette : ce qui porte du détail intérieur ne descend pas.
⚠️ **DEUX OBJETS DE MÊME FORME CÔTE À CÔTE NE FONT PAS DEUX OBJETS**, ils font un objet et sa
copie. Une boule rouge qui pend à côté d'un sapin couvert de boules rouges n'ajoute rien : la
couronne l'a remplacée, et elle se reconnaît à son CONTOUR seul — un anneau — donc elle tient
à 24 px là où un détail intérieur se serait perdu.
⚠️ **`rare: true` SUR LE PLUS BEAU DESSIN EST UNE ERREUR.** Le traîneau n'apparaissait qu'un
passage sur deux : un objet qu'on voit une fois sur deux, on ne le voit jamais. Le drapeau garde
son sens pour un clin d'œil, jamais pour la pièce maîtresse.
⚠️ **ET LE TRAÎNEAU A ÉTÉ REFAIT POUR LA MÊME RAISON QUE LE BATEAU A ÉTÉ RETIRÉ.** L'ancien
était une masse rouge : vu sur planche à 150 px, on lisait un canapé. Le nouveau est une
SILHOUETTE, et c'est le **patin recourbé** qui fait tout le travail — la seule forme que
personne ne confond. Pas d'attelage : deux rennes devant demanderaient un viewBox deux fois plus
large, donc des rennes de 25 px réels, et l'âne de Saint-Nicolas a déjà montré ce que ça donne.
⚠️ **UNE GUIRLANDE DOIT COURIR, SINON C'EST UNE ACCOLADE.** Demande de Nicolas : « des
guirlandes illuminées qui passent de cadre en cadre ». Elle occupe l'emplacement `coin` de
Noël — celui qui se pose sur CHAQUE encadré de la page, jusqu'à six — donc elle va bien de
cadre en cadre sans toucher au moteur. **Elle REMPLACE la branche de sapin dans ce coin, elle ne
s'y ajoute pas** : le moteur n'a qu'un emplacement par angle, et deux décors au même endroit se
recouvriraient. La branche reste au coin du RAIL, où elle est seule.
⚠️ **190 px et non 62** : à la taille d'un décor de coin ordinaire, une guirlande n'est qu'une
accolade avec des points dessous. Et **le fil PEND, il ne passe pas droit** — une ligne
horizontale n'est pas une guirlande, c'est un trait : c'est la courbe qui dit qu'un fil est
tendu entre deux points et qu'il a du poids. Les ampoules pendent perpendiculairement À LA
COURBE, pas à la verticale du cadre, sinon elles ont l'air collées dessus.
⚠️ **LES LUMIÈRES S'ALLUMENT EN VAGUE, ET PAS TOUTES.** Retards échelonnés sur le cycle
(0 → 2 s pour 2,6 s), aussi bien sur la guirlande que sur les boules du sapin : des lumières qui
clignotent ENSEMBLE ne font pas une guirlande, elles font un gyrophare — et au bas d'un menu
qu'on regarde toute la journée, ça se paie. Une sur cinq reste FIXE : **sans point de repère
immobile, on ne voit plus ce qui bouge.**

⚠️ **UN FIL À AMPOULES N'EST PAS UNE GUIRLANDE : IL LUI MANQUE LE FEUILLAGE.** Retour de
Nicolas, 11/10/2026, sur la première version : « la guirlande bien, mais pas encore assez, je
trouve, plus fini, plus de détail ». Il avait raison, et le défaut se nomme : un trait, trois
attaches et six verres, c'est une **rallonge électrique**. Ce qui l'a réparée, dans l'ordre
d'importance : seize touffes d'aiguilles le long du fil (le même détail qui rend la branche du
rail lisible à 56 px) ; **trois couches par ampoule** — la masse (le verre), un détail à
l'intérieur (le filament) et la lumière (deux halos) ; une douille filetée POSÉE par-dessus le
verre, sans quoi l'ampoule flotte à côté du fil ; des baies de houx et un nœud, parce qu'un
feuillage régulier de bout en bout est mécanique. **Et la teinte est passée au VERT** : elle
était gris-bleu, la couleur d'un câble — juste tant que le dessin était un câble.
⚠️ **LES ANGLES SE CALCULENT, ILS NE S'ESTIMENT PAS.** Chaque ampoule pend perpendiculairement
à la courbe, et l'angle vient de la TANGENTE de la Bézier, calculée point par point. À l'œil,
deux ou trois sortent toujours de travers — et c'est exactement ce qui fait « pas fini » sans
qu'on sache dire pourquoi.
⚠️ **UNE AMPOULE NE GROSSIT PAS QUAND ELLE S'ALLUME, ELLE ÉCLAIRE.** D'où `ssfete-ampoule`,
séparée de `ssfete-scintille` : celle-là porte un `scale`, parfait pour une étoile, et qui
décollerait le verre de sa douille à chaque pulsation. Pas de transform, donc pas besoin de
`transform-box` — et quand l'animation est coupée (mouvement réduit), l'ampoule reste ALLUMÉE,
ce qui est le bon état par défaut.

⚠️ **CE QUI PEND NE SE RETOURNE PAS : `miroir: 'x'`.** Un décor de coin est mis en miroir selon
l'angle qu'il occupe — juste pour une toile, dont le moyeu doit rester dans l'angle. Pour une
guirlande c'est FAUX : retournée verticalement dans le coin bas-gauche, elle s'arque vers le
haut et ses ampoules pointent vers le ciel. **La gravité ne se retourne pas avec le coin.** Un
décor qui pend porte donc `miroir: 'x'` : haut-droite retourné horizontalement (la variété
reste), bas-gauche tel qu'il est dessiné.

⚠️ **LE PÈRE NOËL DANS LE TRAÎNEAU — ET POURQUOI CE N'EST PAS LE BATEAU DE SAINT-NICOLAS.**
Demande de Nicolas (« et le père noël dans son traineau ? »). Le bateau avait été retiré parce
qu'il fallait connaître la légende pour le comprendre ; ici c'est l'inverse, et c'est la même
règle : un traîneau VIDE demande au lecteur de deviner à qui il est, le Père Noël dedans ne
demande rien à personne. **Le critère reste « est-ce que ça se reconnaît sans explication ».**
À 25 px de haut, ce qui le fait reconnaître, c'est le BONNET POINTU et la BARBE — un visage
avec des yeux serait trois mouchetures. Toujours pas d'attelage (règle de l'âne) : le bras levé
remplace les rênes et ne coûte pas un pixel de largeur.
⚠️ **TOUT CE QUI EST CLAIR RESTE À L'INTÉRIEUR DU ROUGE** : barbe, visage, bandeau du bonnet,
revers de manche sont POSÉS dans une masse rouge d'un seul tenant (buste + tête + bonnet),
dessinée d'abord exprès pour qu'aucun d'eux ne puisse dépasser. C'est la leçon payée trois fois
sur la planche de Saint-Nicolas. **Le pompon, lui, dépasse par nature : il est donc ROUGE**, avec
un point crème à l'intérieur et une ombre qui le sépare du bonnet — deux formes voisines de
même couleur ne se distinguent que par la ligne d'ombre qui passe entre elles.
⚠️ **ET AUCUNE DÉCOUPE EN `var(--surface)` SUR UN VOLANT.** Un objet qui TRAVERSE la page n'a
aucune carte sous lui : la découpe ne montre pas le fond, elle pose une tache claire. Les
reliefs d'un volant sont des teintes plus SOMBRES de l'objet, qui se lisent sur les deux thèmes.

⚠️ **DEUX CIELS POUVAIENT COEXISTER, ET LE SECOND SURVIVAIT AU NETTOYAGE.** `nettoyer()` retirait
le ciel par `getElementById`, **qui ne rend que le PREMIER élément portant l'id**. Une page qui
demande un aperçu avant le `DOMContentLoaded` (la planche le fait) en monte un, puis le montage
automatique en monte un second sans passer par le nettoyage : **la sorcière d'Halloween
continuait de traverser l'écran pendant l'aperçu de Noël**, sans la moindre erreur. On retire
désormais par `querySelectorAll`, et `monter()` refuse d'en laisser deux. La leçon générale :
**`getElementById` sur un id qu'on peut créer plusieurs fois est un nettoyage à moitié fait.**

⚠️ **LE MÊME DESSIN À DEUX ENDROITS N'EST PAS DEUX OBJETS.** Le Nouvel An posait le MÊME feu
d'artifice au coin des cartes ET au coin du rail — donc deux fois la même image à l'écran, en
même temps. Chaque objet garde un endroit : le feu reste au coin du RAIL, où il est seul (et il
y gagne 18 px), et les cartes reçoivent une **guirlande de fanions**, qui court de cadre en
cadre là où un feu d'artifice est par nature un point fixe.
⚠️ **MÊME GESTE, PAS MÊME DESSIN.** Les fanions reprennent la Bézier et les crochets de la
guirlande de Noël — c'est le même geste, un fil tendu entre deux points qui pend — et **rien
d'autre**. Des fanions ne s'allument pas, ils flottent ; ils n'ont ni douille, ni filament, ni
halo. Recopier la guirlande en changeant la couleur aurait donné **deux fois la même fête à six
jours d'intervalle**. La géométrie se partage, le vocabulaire visuel non.
⚠️ **UN FANION PIVOTE DEPUIS SON ATTACHE, PAS DEPUIS SON MILIEU** (`ssfete-flotte`,
`transform-origin: 50% 0`). Au centre — la valeur que partagent toutes les autres animations de
détail — le triangle tourne sur son ventre et se décroche du fil à chaque oscillation : le même
défaut que l'araignée qui se décrochait de sa soie. Et six flottent, six restent fixes : **un
drapeau qui bouge ne se voit que parce que son voisin ne bouge pas.**
⚠️ **UN RELIEF DE LA MÊME COULEUR QUE L'OBJET DISPARAÎT SUR L'UN DES DEUX THÈMES.** La coiffe
de la bouteille était un `#8a5f00` translucide — parfait sur le thème sombre, où la bouteille
est en or clair, et **invisible sur le clair, où la bouteille EST `#8a5f00`** : la même couleur
posée sur elle-même. Un **noir translucide** assombrit toujours, quelle que soit la teinte
dessous ; un blanc translucide éclaircit toujours. C'est le seul relief qui ne demande pas de
connaître la couleur de l'objet — d'où aussi les plis des fanions et les facettes de la boule.
⚠️ **UN EMPLACEMENT VIDE EST UN DÉFAUT, PAS UNE SOBRIÉTÉ.** Le Nouvel An n'avait RIEN qui pende
(`coin.bete`) alors que c'est le seul décor qui bouge sans traverser l'écran, et **un seul
volant** quand Noël en a deux — le ciel était vide la moitié du temps. Une boule à facettes et
une bouteille qui saute. **Et la bouteille règle les deux défauts qui avaient fait retirer la
fusée** : son profil (corps, épaule, col long, bague) ne ressemble à rien d'autre, et ce n'est
pas une traînée lumineuse de plus à côté de l'étoile filante. **Le bouchon qui part devant**
transforme un objet posé en événement : une bouteille fermée qui traverse le ciel ne dit rien,
une bouteille qui saute dit minuit.
⚠️ **UNE SPHÈRE SEULE EST UNE BOULE DE NOËL.** Ce qui fait une boule à facettes, c'est le
quadrillage — des **arcs**, pas une grille droite : une grille droite sur un disque fait un
filet à provisions, des arcs qui se resserrent vers les bords font une sphère. Et ses éclats ne
s'allument jamais ensemble : une boule à facettes dont tout s'allume d'un coup est une
guirlande, pas une boule qui tourne.
⚠️ **L'HORLOGE PASSE DE 30 À 62 PX, ET ELLE SONNE.** Le pied du rail est le seul endroit où un
objet a de la place — Saint Nicolas et le sapin y tiennent 52 px. Et deux arcs de chaque côté,
qui battent avec `ssfete-eclat`, séparent une horloge DESSINÉE d'une horloge qui marque minuit.
⚠️ **LE CADRAN RESTE EN `var(--surface)`, ET C'EST JUSTE LÀ** : le pied du rail est POSÉ sur le
rail, donc une découpe y montre bien le fond. C'est sur un VOLANT qu'elle serait fausse. La
question n'est jamais « quelle couleur », c'est **« qu'y a-t-il sous cet objet »**.

⚠️ **UN BORD LISSE NE FAIT PAS UN CONIFÈRE.** Les quatre étages du sapin du rail avaient un bas
en courbe douce : ça se lisait comme un cône à étages. Dentelés, ils portent le mot
« aiguilles » — même détail que les touffes de la guirlande, même raison. Et il y a désormais
des cadeaux au pied : **un sapin seul est un sapin de catalogue, c'est ce qu'il y a dessous qui
en fait un matin de Noël.** Ils tiennent dans la largeur déjà occupée, de part et d'autre du
pot — élargir le viewBox aurait rétréci l'arbre à taille égale.

⚠️ **LE CORTÈGE A ÉTÉ CONSTRUIT TROIS FOIS, PUIS RETIRÉ — ET C'EST L'HISTOIRE QUI COMPTE.**
Demande de Nicolas (11/10/2026) : « une animation sur le thème d'Halloween qui défile de gauche
à droite UNE SEULE FOIS à chaque fois qu'on arrive sur la page ». Un emplacement `defile` a donc
été ajouté, puis **supprimé le jour même** à sa demande : « pour l'animation que j'avais
demandée, on l'enlève, j'aime pas ». Il ne reste rien dans le code, et c'est volontaire :
**ne pas le reconstruire sans que Nicolas le redemande.**
Les trois versions valent d'être retenues, parce qu'elles se sont trompées en sens CONTRAIRE :
1. **Trois objets pleins et nets dans le bandeau** (brume + fantôme + chat noir) — verdict :
   « absolument horrible ». Le défaut ne tenait à aucun des trois dessins, il tenait à ce
   qu'ils étaient TROIS, PLEINS et NETS : en haut d'un outil de travail, c'est une **banderole
   de fête foraine**.
2. **Un seul corbeau flouté à 13 %**, toujours dans le bandeau. Consigne suivie à la lettre
   (« très discret ») — et **parfaitement invisible**, mesuré à l'écran derrière la pastille
   « Terrain ». **Un décor qu'on ne voit pas n'est pas discret, il est absent.**
3. **Le même corbeau dans le ciel**, à 120 px et 22 % : lisible, sans gêner. Techniquement
   juste, et refusé quand même — **ce qui est la vraie conclusion.**
⚠️ **LA LEÇON N'EST PAS UN RÉGLAGE, C'EST UNE QUESTION DE GENRE.** Les décors de ce fichier
sont des ÉTATS : ils sont là, on les oublie, ils ne demandent rien. Une animation qui se
DÉCLENCHE à l'arrivée sur la page est un ÉVÉNEMENT : elle réclame l'attention au moment précis
où l'on vient travailler, et sur vingt pages par jour ça se paie. **Aucune valeur d'opacité ne
répare ça** : entre « trop visible » et « invisible » il n'y avait pas de fenêtre, et les
versions 1 et 2 sont la preuve des deux bords.
⚠️ **ET LE BANDEAU RESTE LA MAUVAISE SCÈNE, quoi qu'on y mette.** 60 px de haut, plein de
boutons : c'est déjà ce qui avait fait retirer l'araignée ancrée au bandeau. **Deux fois la
même conclusion sur le même endroit — ne pas y revenir une troisième.**
⚠️ **CE QUE LE RETRAIT A RAPPORTÉ** : l'emplacement `defile`, le dessin du corbeau, la file
d'attente `apresDefile`, l'enveloppe `try/finally` autour de `monter()`, le filet de 2 s, le
conteneur plein écran, deux jeux d'animations CSS et un cas de contrat par fête. **Une
fonctionnalité qu'on retire rend toujours plus de code qu'elle n'en avait l'air** — ici la
moitié n'existait que pour réparer les ennuis qu'elle causait.

⚠️ **LA TOUCHE DE SAISON SUR LE DOCUMENT — ET COMMENT ELLE NUANCE LA RÈGLE 1 SANS LA CASSER.**
Demande de Nicolas (11/10/2026) : « une case à cocher comme dans photos pour mettre ou pas, en
saison de fête, les petites images du thème dans le devis — ça peut être sympa et festif pour
les clients à ces périodes ». La règle 1 dit « jamais sur ce que le client voit » : elle n'est
pas annulée, elle est **précisée**. Elle vise le décor **SUBI** — une araignée qui arrive toute
seule sur un devis d'école, c'est un document qu'on ne prend pas au sérieux. Ici le décor est
**CHOISI**, devis par devis, par celui qui l'envoie : ce n'est plus le même geste. D'où trois
garde-fous : **jamais par défaut**, **jamais hors période** (la case n'apparaît même pas), et
jamais sur les pages à jeton (`devis-review`, `track`), où personne ne serait là pour décider.
⚠️ **IL NE PORTE PAS LA CLASSE `.ssfete`, ET C'EST VOULU.** `nettoyer()` retire tout `.ssfete`
quand on éteint les décors dans Paramètres — or ce réglage parle de **l'écran de Nicolas** (un
client par-dessus l'épaule), pas du document qu'il a décidé d'envoyer. Deux interrupteurs
indépendants parce qu'ils répondent à deux questions différentes. Même raison pour la feuille
de style, qui est à part : celle de la coque peut ne pas exister.
⚠️ **AUCUN DESSIN NEUF** (règle 28) : le décor se déduit de ce que la fête déclare déjà — son
dessin de COIN, justement tracé pour un angle, et sa MARQUE, qui est déjà son emblème à côté du
logo. Les cinq fêtes sont servies sans une ligne de configuration en plus, et la sixième le sera
sans y penser.
⚠️ **UN SEUL ENDROIT SUR LA FEUILLE** : l'angle haut-droit, derrière le numéro de devis — là
où un en-tête de saison se met depuis toujours. La leçon du cortège rejeté vaut ici encore plus
fort : trois touches dispersées sur un devis, c'est une carte de vœux, pas un devis.
⚠️ **LE COIN EST À 13 % ET L'EMBLÈME À 85 %** : le premier est un filigrane, il ne doit jamais
disputer sa place au numéro qu'il accompagne ; le second est le seul vrai point de couleur de la
feuille. **Vérifié qu'il ne touche aucun texte** : la citrouille tient dans la marge de 15 mm, à
12 px du bloc de méta.
⚠️ **POSITION, TOP, RIGHT ET Z-INDEX SONT EN LIGNE, PAS DANS LA FEUILLE DE STYLE.** `.paper > *`
impose `position: relative` ET `z-index: 1` à tous les enfants directs du document : à égalité de
spécificité, le décor serait passé **devant** le texte du devis. Même famille de piège que le
filigrane INFORMATIF.
⚠️ **À L'IMPRESSION, LA FEUILLE EST BLANCHE QUEL QUE SOIT LE THÈME** : les teintes « sombres »
(pensées pour un fond foncé) y seraient invisibles, d'où un bloc `@media print` qui force les
teintes claires. Et le choix se mémorise **dans ce navigateur seulement** (`localStorage`) : ce
n'est pas une donnée du document, c'est une préférence d'impression — la mémoriser évite de
recocher à chaque devis pendant les trois semaines d'une fête, et **la période l'éteint d'elle-
même à sa fin**, sans rien à décocher.

⚠️ **PAS DE PALETTE SUR LA NEIGE**, contrairement aux friandises et aux confettis : la neige est
blanche, des flocons de six couleurs ne seraient plus de la neige. La variété vient des trois
DESSINS, pas de la teinte — c'est l'opacité et la taille qu'il fallait relever, pas la couleur.

⚠️ **Les périodes ne doivent JAMAIS se chevaucher.** `active` retient la PREMIÈRE qui correspond,
donc deux fêtes qui se recouvrent se voleraient la vedette — et laquelle gagne dépendrait de
l'ordre dans la table, ce qui ne se devine pas en la lisant. Un test balaie les 365 jours.
L'emplacement **`tombe`** (neige en décembre, confettis au Nouvel An, et demain au Carnaval)
s'appelle ainsi et non « neige » parce que seul le dessin change. Il accepte une **`palette`** :
sans elle, les confettis sortiraient tous de la même couleur — et des confettis d'une seule
couleur ne sont plus des confettis. Une palette est faite de couleurs LITTÉRALES, volontairement
indépendantes du thème.
⚠️ **L'APERÇU** (`SSFetes.apercu(id)`, sélecteur dans Paramètres) sert à juger un décor de
décembre en octobre. Ce n'est pas un confort de développeur : **la console n'existe pas sur
iPhone**, et c'est là que Nicolas teste — sans lui, un décor ne pouvait être jugé qu'une fois sa
période arrivée, donc trop tard. Il est volontairement NON persistant (il disparaît au
rechargement : un aperçu oublié afficherait Noël en juillet), et une date EXPLICITE passée à
`active(d)` l'emporte toujours sur lui, sinon les tests se mettraient à mentir dès qu'il est actif.
⚠️ Le `MutationObserver` est posé UNE SEULE FOIS pour la vie de la page, et il lit la fête
COURANTE au lieu de la capturer. Chaque remontage (réglage éteint puis rallumé, aperçu) en
empilait un de plus, et un observateur qui aurait gardé SA fête aurait continué à reposer les
toiles d'Halloween pendant l'aperçu de Noël.
⚠️ `nettoyer()` retire aussi la FEUILLE DE STYLE : elle porte les variables de teinte de la fête
courante et `style()` sort immédiatement si elle existe déjà. La garder ferait afficher les
dessins de Noël avec les teintes d'Halloween, sans la moindre erreur. Chaque élément tire sa colonne, sa
durée, sa dérive et sa rotation de son RANG : pas de tirage au hasard, donc un rendu reproductible
d'un chargement à l'autre, et un bug qui se reproduit.
⚠️ L'hôte d'un décor se choisit sur la PLACE DISPONIBLE (`260 × 130` px), pas sur une liste noire
qui n'aurait jamais fini de grandir. Les tuiles de chiffres s'écrivent `class="kpi ticked"` et les
modales `class="modal ticked"` : sans ça, une toile de 58 px atterrissait sur un carré de 150, et
une autre sur une fenêtre de saisie masquée, prête à surgir.

**29. Un thème se MESURE avant de se publier** (`assets/js/theme.js`, `tests/themes.test.html`).
Ici la couleur porte du sens — le liseré dit l'ACTION (règle 21 bis), la pastille dit le CLIENT
(règle 22), le badge dit le STATUT (règle 21). Un thème dont les teintes se ressemblent trop
ferait lire un devis perdu comme un devis gagné : **un thème qui ne passe pas les tests ne se
publie pas, même s'il est beau.** Les seuils sont calés sur les deux thèmes d'origine, et le
relevé en tête du fichier de tests donne les valeurs de chacun.
⚠️ Le sombre est **pile au seuil** sur les familles d'action (ΔE 25,02 pour un minimum de 25) :
il n'y a aucune marge, toute retouche de `--accent` ou `--accent-3` doit être remesurée.
**La table `THEMES` est la source unique** : le sélecteur des Paramètres, le bouton lune/soleil,
les décors de fête et les tests la lisent tous. Ajouter un thème = une entrée + sa feuille
`theme-<id>.css`. Ne jamais recopier la liste dans une page — c'est l'erreur des types de produit,
qui ont vécu en 13 copies avant de diverger.
`clair: true` n'est pas un goût, c'est une INFORMATION TECHNIQUE : elle dit sur quel fond le thème
pose son contenu. Les décors de fête s'en servent pour choisir leurs teintes (sans quoi le premier
thème clair ajouté hériterait des teintes du SOMBRE et deviendrait invisible sur blanc), et le
bouton lune/soleil pour savoir dans quelle famille basculer.
⚠️ Le bandeau garde DEUX boutons, pas une liste : jour/nuit est le geste qu'on fait vingt fois par
jour, le choix du thème se fait une fois dans les Paramètres. Les boutons visent donc une FAMILLE
et reviennent au dernier thème choisi dedans — sinon, à dix thèmes, le bouton devient inutilisable.
⚠️ Le CHOIX du thème est PAR APPAREIL (`localStorage`), pas dans les réglages partagés : Nicolas
et Yannick n'ont aucune raison de vouloir le même. Le DÉFAUT, lui, est au serveur — ci-dessous.

**29 bis. APPAREIL → SOCIÉTÉ → SYSTÈME, et `affichage.theme_defaut` est enfin branché**
(10/10/2026). Il était déclaré dans `config.js`, affiché et enregistrable dans Paramètres… et
**aucun code ne le lisait** : le choix était sans effet, en silence, depuis sa création.
Ce qu'on obtient maintenant : un appareil qui n'a **jamais** choisi prend le défaut de la société
dès le premier rendu ; un appareil qui a choisi **garde son choix** ; l'option « Comme la société »
du sélecteur est le **chemin du retour** (même rôle, même raison que le `SUIVRE` de la règle 36 —
elle EFFACE la préférence locale, et elle est volontairement hors de `THEMES`).
⚠️ **`theme_defaut` vaut une FAMILLE, pas un thème** : `'systeme' | 'clair' | 'sombre'`. « clair »
donne le premier thème clair de `THEMES`, « sombre » le premier sombre. Un défaut qui nommerait
`zen` deviendrait faux le jour où ce thème quitte la table, et imposerait un goût là où il ne
s'agit que de lisibilité. `SSTheme.FAMILLES` fait foi ; Paramètres construit son menu avec.
⚠️ **LA VRAIE CAUSE N'ÉTAIT PAS L'ORDRE DE CHARGEMENT — C'ÉTAIT QU'AFFICHER UNE PAGE VALAIT
CHOIX.** `applyTheme()` enregistrait `ss_theme` à chaque appel, y compris celui, automatique, de
fin de fichier. Dès la PREMIÈRE page vue, un appareil portait donc un thème « choisi » qu'il
n'avait jamais choisi : plus aucun défaut de société ne pouvait s'appliquer, et
`prefers-color-scheme` n'était consulté qu'UNE fois dans la vie d'un navigateur — passer son
système en sombre ensuite ne changeait plus rien. D'où le second paramètre `retenir` :
**une application automatique n'enregistre RIEN.** C'est la moitié du correctif, et celle qu'on
ne voit pas. Un test la tient (`themes.test.html`, « une application AUTOMATIQUE n'enregistre pas
de choix ») ; le désactiver fait tomber quatre cas.
⚠️ **`theme.js` LIT `localStorage['ss_reglages']` À LA MAIN, SANS `SSConf`, et c'est voulu.** Il
est dans le `<head>` — avant `config.js`, qui vit en fin de page — pour éviter le clignotement :
`SSConf` n'existe pas encore quand `getTheme()` tourne. Et **douze pages chargent `theme.js` sans
charger `config.js`** (devis, facture, picking, portfolio, index…) : sans lecture directe, le
style de la maison ne s'appliquerait qu'à la moitié de l'ERP. **Le prix est un couplage par le nom
de la clé** : `CLE_REGLAGES` (theme.js) et `CLE_CACHE` (config.js) doivent rester identiques, et
les renommer d'un seul côté ne casse rien de visible — le thème retomberait juste sur le système,
en silence. Les deux fichiers portent l'avertissement : **ne jamais en renommer qu'un**.
⚠️ **C'est `config.js` qui PRÉVIENT `theme.js`**, depuis `ecrireCache()`, pas l'inverse. Sans ça,
celui qui vient d'enregistrer un nouveau défaut ne le verrait pas sur son propre écran. Et
`theme.js` ne demande les réglages lui-même (`SSConf.charger()`, au DOMContentLoaded) **que si le
cache n'a jamais répondu** : sept pages chargent `config.js` sans appeler `charger()`, ce serait
sept requêtes gratuites par visite.
⚠️ **ON NE REPOSE LE THÈME QUE SI LA VALEUR EFFECTIVE CHANGE** (`suivreLaSociete()` rend `null`
sinon). Un appareil déjà juste — le cas de tous les jours, le cache étant là — ne doit pas
clignoter. Mesuré, pas supposé : `themes.test.html` charge `tests/amorce-theme.html` dans une
iframe et compare `data-theme` **au plus tôt** (dans le `<head>`, juste après `theme.js`), en fin
de document, puis après l'arrivée des réglages. Trois valeurs identiques ⇒ pas de clignotement.
⚠️ **Le SEUL cas qui clignote est le tout premier démarrage d'un navigateur** : la valeur vit au
serveur, on ne peut pas la connaître avant que le réseau réponde. Une fois, puis plus jamais.
⚠️ **UN APPAREIL DÉJÀ UTILISÉ NE BOUGERA PAS**, et c'est volontaire : il porte un `ss_theme` écrit
par l'ancien défaut. Pour le remettre au commun, il faut choisir « Comme la société » une fois.
Migrer d'office aurait voulu dire deviner quel `ss_theme` était un vrai choix — et retourner
l'écran de quelqu'un qui avait bel et bien choisi.
⚠️ **MESURER AVEC LA FAMILLE OPPOSÉE À CELLE DU SYSTÈME, toujours.** Un défaut « clair » testé sur
une machine qui préfère déjà le clair donne le bon thème même si le réglage n'est pas lu du tout.
C'est exactement l'erreur qui a laissé croire que ce réglage fonctionnait.

**30. LA RÉMUNÉRATION EST ÉCRITE DU POINT DE VUE DE NICOLAS, et c'est voulu.**
SolariScreen facture sous SysCore et **Yannick est le patron** : ce qui lui revient, il en fait ce
qu'il veut, ça ne se suit pas ici. Sa commission reste affichée — elle fait partie du partage de
la marge et doit être lisible — mais il n'y a ni « reste à toucher » ni prélèvement pour lui.
**Ne pas « symétriser » `remuneration.js` en croyant bien faire** : ce serait inventer un
copropriétaire qui n'existe pas, et noyer le seul chiffre qui compte ici.

**30 bis. LA PAIE DE POSE SE COMPTE EN OUVERTURES, PAS EN EUROS DU DEVIS.**
50 € nets par screen, volet roulant **ou tablier de volet** posé, 100 € nets par tente solaire,
**× le nombre posé, quoi qu'il arrive**.
⚠️ Le tablier en était EXCLU, à tort : j'avais raisonné qu'une PIÈCE de rechange n'est pas une
ouverture posée. C'est faux — **remplacer un tablier, c'est un déplacement et une pose**, et
Nicolas touche 50 € comme pour le reste. Il a dû le repérer lui-même sur un chantier terminé qui
ne lui rapportait rien : d'où le garde-fou ci-dessous. C'est un tarif convenu entre Nicolas et Yannick, pas une part du devis : si
un devis a été sous-chiffré, l'écart est pour la société, jamais pour Nicolas.
⚠️ **C'EST LE PIÈGE LE PLUS COÛTEUX DE CE MODULE, et il a été payé deux fois en deux jours.**
`prix.tech1_gross` vaut 125 € bruts et le diviseur brut→net vaut 2,5 : 125 ÷ 2,5 = **50 € nets**,
exactement le tarif d'un screen. **Ça tombe juste, et c'est précisément ce qui rend l'erreur
invisible.** Une tente est chiffrée elle aussi à 125 € bruts : lue sur le devis, elle ne payait
que 50 € au lieu des 100 convenus, et personne ne l'aurait vu.
**Le devis dit comment la pose est FINANCÉE ; il ne dit pas ce que Nicolas a négocié.** Ne jamais
rebrancher `calculs.tech1_total` sur la paie de Nicolas. Deux tests sont là pour l'empêcher.
(Chiffrer une tente à 250 € sur la ligne Tech 1 reste la bonne pratique — ça évite que la
société paie la différence de sa poche — mais ça ne change RIEN à ce qui est dû à Nicolas.)
Corollaire : **s'il était sur le chantier, il touche TOUTES les ouvertures**, pas la moitié parce
que Yannick était là aussi. 10 screens à deux, c'est 500 € pour Nicolas. Décidé explicitement.

**30 bis-2. UN TYPE D'OUVERTURE SANS TARIF SE SIGNALE, il ne vaut jamais zéro en silence.**
C'est exactement ce qui a laissé passer le tablier : `detailPose` ignorait les types absents du
tarif, donc un chantier terminé ne rapportait rien **sans que rien ne le dise**. Elle renvoie
désormais `sans_tarif`, et un dossier que Nicolas a POSÉ avec un type non tarifé est signalé
(`incomplet: ['tarif']`, badge « tarif ? », bandeau qui NOMME le type et sa quantité).
Ailleurs — sous-traité, posé par Yannick, pas encore posé — ça ne lui coûte rien, donc on se tait.
⚠️ Les deux types HISTORIQUES (`store_banne`, `pergola`), plus créables mais présents sur
d'anciens devis, sont dans la table à **zéro** plutôt qu'absents : zéro = non tarifé, donc
signalé, **et réglable**. Sans ça, l'avertissement « ajoute un tarif dans les Réglages »
désignerait un champ qui n'existe pas — **une promesse d'écran doit être tenable.**
Et puisque `SSConf.fusionner` est une liste blanche, une clé absente des DEFAUTS ne pourrait de
toute façon pas être enregistrée : les deux tables doivent bouger ensemble (un test les compare).

**30 ter. QUI A POSÉ vit dans `chantier.equipe`, et nulle part ailleurs.** Quatre valeurs
(`nicolas` / `yannick` / `nicolas_yannick` / `sous_traitant`), saisies dans la fiche devis ET dans
le planning, traduites en personnes par `SSPlanning.quiDeEquipe` (règle 10 : le vocabulaire vit à
un seul endroit). Un `pricing_v2.pose` avait été inventé pour ça : il aurait été **effacé en
silence**, parce que la fusion serveur d'`upsertDevis` est PEU PROFONDE
(`Object.assign({}, existant, payload)`) et que le simulateur reconstruit `pricing_v2` de zéro.
Toute nouvelle donnée sur un devis doit se demander : « quel écran renvoie l'objet parent sans ma
clé ? »
⚠️ **`quiDeEquipe('')` retombe sur Nicolas.** Désastreux pour de l'argent : il lui attribuerait la paie
de TOUS les chantiers non renseignés. (Le planning ne s'en sert plus pour les poses depuis le
26/10/2026 : une pose sans équipe y est « À attribuer », voir règle 13 bis.) `SSRemu.poseurs` garde donc sa propre garde avant l'appel, et un test
vérifie les deux comportements côte à côte pour que la différence reste visible.

**30 quater. LA PAIE SUPPOSE QUE LA POSE A EU LIEU — et l'inconnue se SIGNALE, jamais ne s'ignore.**
On s'appuie sur `SSUI.isPoseDone` (PV de réception, ou commande au statut « posé »), et à défaut
sur une **date de pose déjà passée** — sinon un chantier réellement fait dont le PV n'a pas été
rempli disparaîtrait de la paie, en silence et au détriment de Nicolas. C'est le sens dans lequel
on ne veut pas se tromper : **toute incertitude fait baisser le total, donc toute incertitude doit
être signalée à l'écran, avec le montant en jeu et le geste pour le débloquer.**
⚠️ Un chantier daté dans le FUTUR n'est pas « à compléter » : il est à venir. La distinction
tient au champ `datee` de `poseFaite` ; sans elle, tout chantier planifié sortait en dossier à
corriger — et un écran qui réclame pour rien, on apprend très vite à ne plus le lire.

**30 quinquies. AUCUN PRORATA SUR LE TOTAL — le déclencheur du paiement n'est PAS acté.**
Yannick a évoqué « à chaque CA de SysCore », sans fréquence fixée, et c'est justement ce que
Nicolas et lui doivent se dire. **Tant que ce n'est pas décidé, l'ERP n'invente pas de règle** : il
annonce le TOTAL gagné, et donne à côté, en information, la part déjà couverte par l'argent que
les clients ont réellement versé (`couvert` / `en_attente_client`). Deux nombres, aucun arbitrage.
Le jour où la règle sera posée, il n'y aura qu'à choisir lequel des deux pilote « reste à
toucher » — d'où le bandeau qui l'explique à l'écran plutôt qu'un « disponible » inventé.
La commission, elle, vient du devis et n'est **jamais** recalculée : 18 % / 5 % n'est qu'un défaut,
une répartition personnalisée est possible (École du Bonheur était en moitié-moitié) et c'est
`calculs.nicolas_net` qui porte ce qui a été réellement convenu sur CE devis.
⚠️ Le tarif de pose vit à DEUX endroits, et il faut les deux — `config.js` parce que `fusionner`
est une liste blanche (une clé absente des DEFAUTS ne peut pas être enregistrée du tout), et
`remuneration.js` pour que le moteur réponde juste même appelé sans réglages. Un test compare les
deux : c'est lui qui les empêche de diverger.
⚠️ Toute page qui affiche de la rémunération charge `ui.js` et `planning.js` **avant**
`remuneration.js`.

**30 sexies. Un « ce qu'on me doit » sans registre de VERSEMENTS ne fait que monter.**
Table `prelevements` (`/api/prelevements`), une ligne par versement réellement reçu. Sans elle, le
chiffre devient faux au premier virement — et un chiffre faux sur de l'argent ne se rattrape pas.
Aucune écriture hors-ligne, volontairement : un versement qui n'existerait que sur le téléphone
qui l'a saisi ferait afficher un « reste à toucher » trop élevé, donc une seconde réclamation sur
de l'argent déjà reçu. Ce n'est PAS de la comptabilité : la pièce officielle reste dans
SysCore / Falco, d'où le champ `ref_externe`, comme sur une facture.

**30 septies. `/api/stats` a été SUPPRIMÉE le 04/10/2026.** Elle recalculait toutes les
statistiques côté serveur et **aucun écran ne l'appelait** : `app/stats.html` calcule depuis les
devis complets. C'était une seconde implémentation dormante des mêmes chiffres — avec la marge
écrite en dur (`* 0.23`), ce qui viole la règle 1. `SS.getStats()` est parti avec. Ne pas
réintroduire : si un calcul serveur redevient nécessaire, il devra lire les taux FIGÉS sur chaque
devis, jamais un taux écrit dans le code.

**30 octies. Un total d'argent s'affiche avec sa DÉCOMPOSITION, et la décomposition doit
retomber sur le total au centime.** « Commission sur les ventes : 1 333,84 € » tenait sur une
ligne, et la première question de Nicolas devant l'écran a été : « il y a pas École du
Bonheur ? ». Un chiffre qu'on ne sait pas décomposer ne se défend pas en face de son patron —
et le dossier à répartition personnalisée est précisément celui qu'on cherche des yeux.
D'où `commission_par_taux` dans `SSRemu.cumul` : un groupe par pourcentage, l'assiette, le brut
et le net. ⚠️ **L'invariant est que la somme des groupes égale le total** (test K19). Un vieux
devis qui porte un montant sans son taux a donc son propre groupe « taux non stocké » plutôt que
de manquer en silence : un détail qui ne retombe pas sur son total est PIRE que pas de détail,
on cesse de croire les deux.
⚠️ L'assiette affichée est le catalogue **brut** (`total_catalog_ht_brut`), pas le net : la
réduction commerciale se déduit de la commission du vendeur, jamais de l'assiette. Afficher
« 18 % de 12 300 » au lieu de « 18 % de 12 500, moins 200 de réduction » donne un taux faux — et
un taux faux se discute.

**30 nonies. Un zéro d'argent est toujours SIGNALÉ, jamais silencieux.** Trois fois le même
défaut, trois fois corrigé après que Nicolas l'a vu lui-même : le tablier de volet sans tarif
(50 € perdus par pose), un type historique sans tarif, et un devis chiffré qui ne porte **aucun
partage de commission** — ni taux, ni montant — donc une commission à 0 € dont rien ne disait
qu'elle manquait. Pire encore : l'écran masque les dossiers qui ne rapportent rien, donc le
dossier disparaissait entièrement. Tout zéro d'argent produit par une donnée ABSENTE (et non par
une donnée à zéro, qui est une réponse) entre dans `incomplet` et porte un badge qui mène à
l'endroit où on le corrige.

**30 decies. Quand un dossier ne paie RIEN, l'écran doit dire POURQUOI.**
École du Bonheur sortait avec sa commission (954,82 €) et zéro pose, sans un mot. Nicolas a
donc demandé « il y a pas École du Bonheur ? » alors que le dossier ÉTAIT là : seule sa pose
manquait. Un écran qui se tait sur de l'argent oblige à rouvrir les dossiers un par un.
`SSRemu.parDossier` renvoie donc `pose_raison`, toujours remplie :
`payee` · `sans_ouverture` · `equipe_inconnue` · `sous_traitee` · `sans_moi` · `a_venir` ·
`pose_inconnue` · `sans_tarif` · `inactif`. L'ordre des questions EST le raisonnement, et la
colonne « Posé par » la rend telle quelle.
⚠️ Deux trous fermés au passage, tous deux de la même famille (règle 30 nonies) :
• **Une équipe hors vocabulaire se lisait « sous-traitée ».** `quiDeEquipe` renvoie `[]` aussi
  bien pour `sous_traitant` que pour une valeur inconnue — et `[]` signifie « Nicolas n'y était
  pas ». Une donnée abîmée lui faisait perdre sa paie pendant que le tableau AFFIRMAIT une
  sous-traitance. `SSPlanning.EQUIPE_QUI` est exporté pour que la rémunération distingue les deux.
• **Un devis avec du catalogue mais aucune ouverture reconnue ne pouvait rien dire** : tous les
  signalements de pose vivaient sous `if (tarife.total > 0)`, or il vaut zéro, justement. Le
  catalogue est le bon discriminant — un dépannage n'en a pas, et n'a légitimement aucune
  ouverture. Pour la même raison, un dépannage est hors du signalement de commission.

**31. LE CONFIGURATEUR VR150 EST DÉCRIT UNE FOIS (`SSProducts.VR_CHAMPS`) ET RENDU TROIS FOIS.**
Le bloc vivait en DEUX copies, dans `app/simulateur.html` et `app/terrain.html`, et à quatre
champs elles avaient déjà divergé (grid-4 contre grid-2, classes de case différentes). Le
portail de commande Harol en demande une **trentaine** : à ce volume, deux copies, c'est la
certitude qu'un champ existera d'un côté et pas de l'autre — et qu'on le découvrira **en passant
la commande**, quand il est trop tard pour redemander au client.
La table décrit chaque champ (`g` groupe, `k` clé, `l` libellé, `t` type, `vals`, `si`, `aide`,
`client`, `pilote`, `horsFormulaire`) ; `SSVolet` la rend : à l'écran (simulateur, Mode Terrain),
en résumé **client** (devis PDF et lien de consultation) et en résumé **complet** (picking).
Ajouter une option = **une ligne dans la table**, et elle apparaît partout.
⚠️ **`client: true` est le seul arbitrage, et il est volontaire.** Le client lit ce qu'il a
acheté — lame, couleurs, ajourage, montage, motorisation — jamais les références de commande
Harol (perçage A168, rivets, embouts A66, bouchons, suppléments, sortie de câble). Lui montrer
tout, c'est noyer ce qu'il doit vérifier et exposer le détail fournisseur sur un document qui
circule. Ne pas « compléter » l'encadré du devis en croyant bien faire.
⚠️ **`pilote: true`** marque les champs qui en COMMANDENT d'autres (alimentation, combinaison,
moustiquaire, bouchons, « coulisses différentes », caisson, montage). Eux seuls re-rendent le
bloc : le faire à chaque menu ferait sauter la page sous les doigts, et à chaque frappe ferait
perdre le focus. On re-rend le **bloc seul** (`data-volet-block`), jamais la carte — la
reconstruire rechargerait les photos et remonterait la page au-dessus du champ qu'on touche.
⚠️ **`horsFormulaire: true`** = résumé mais pas saisi ici. La couleur du caisson se saisit dans
le sélecteur RAL commun à tous les types, en haut de la carte ; la remettre dans le bloc ferait
deux champs pour une même donnée, et c'est toujours celui qu'on ne regarde pas qui finit chez le
fournisseur. Elle doit pourtant figurer sur le devis : c'est la première chose qu'un client vérifie.

**31 bis. UNE VALEUR ENREGISTRÉE NE DISPARAÎT JAMAIS D'UN MENU** (`SSProducts.vrOptions`).
Un `<select>` dont la valeur courante ne figure dans aucune option affiche « — » **sans rien
signaler**, et le premier enregistrement l'écrase par du vide. Silencieux, et irréversible.
La mise à jour du 09/10/2026 a créé ce cas **deux fois** : les caissons 137 et 150, que le
portail Harol ne propose plus, et les 25 libellés de couleur de lame réécrits d'après le portail
(« 90 — 9005 Noir » et non plus « Noir profond »). `vrOptions` réinjecte donc toujours la
valeur enregistrée, en tête, marquée « valeur enregistrée » avec un avertissement à l'écran.
**Ne jamais construire un `<option>` de ce bloc sans passer par elle.**
C'est aussi pourquoi `VR_CAISSONS` porte `courant: false` sur 137 et 150 plutôt que de les
supprimer : plus proposables, toujours lisibles, et leur hauteur max reste connue.
Corollaire, même famille : `vrMoteursFor('')` renvoie **tous** les moteurs plutôt qu'aucun — un
ancien devis porte déjà un moteur, et un menu vide le ferait disparaître.

**31 quater. LE RAL DU CAISSON SE RÉPERCUTE — MAIS N'ÉCRASE JAMAIS UN CHOIX**
(`SSVolet.appliquerRal`). Demandé par Nicolas le 09/10/2026 : « quand je prends un RAL il se
répercute sur la lame finale et sur les deux coulisses, c'est logique, c'est rarement le
contraire ». Les quatre pièces sortent presque toujours du même bain de laquage, et recopier la
teinte quatre fois est le genre de saisie qu'on bâcle — donc une coulisse au mauvais RAL chez le
fournisseur.
⚠️ « Rarement le contraire » n'est pas « jamais ». Une teinte qui DIFFÈRE de l'ancienne couleur
de caisson a été posée exprès : l'écraser détruirait une décision en silence, et ça ne se verrait
qu'à la livraison. Trois cas, et trois seulement : champ VIDE → on remplit ; champ égal à
l'ANCIENNE couleur → il suivait, il suit encore ; champ différent → on n'y touche pas. C'est la
même discipline que le drapeau « quantité saisie à la main » du simulateur.
⚠️ La couleur ancienne se lit AVANT `collectItem`, qui l'écrase. Le branchement est donc dans le
listener `change` des deux pages, pas sur le champ RAL : le nuancier écrit la valeur puis
déclenche `change`, donc un seul point d'entrée couvre la frappe ET la palette.
⚠️ « 7016 » et « 7016 — Gris anthracite » sont la MÊME teinte : sans `normaliserRal`, le code
seul poserait dans les menus une valeur hors liste, affichée comme une donnée périmée. Le résumé
normalise aussi à l'affichage (`ral: true`), mais **ne réécrit jamais la donnée saisie** : le champ
RAL est partagé avec les screens, les tentes et les tabliers.
Les bouchons PVC ne suivent PAS : Nicolas a nommé la lame finale et les deux coulisses, un bouchon
est souvent contrasté, et propager sans qu'on l'ait demandé reviendrait à décider à sa place.

**31 ter. LE LIEN DE CONSULTATION CLIENT FILTRE LES OUVERTURES PAR LISTE BLANCHE.**
`/api/devis-review` ne renvoie **que** les champs qu'il énumère. Conséquence à connaître avant
de chercher : la ligne de méta de `devis-review.html` lisait `it.variante`, `it.moteur`,
`it.couleur`… qui n'étaient **jamais envoyés** — elle était vide depuis toujours, sans erreur.
Le PDF portait donc une description que la page ouverte par le client ne portait pas : deux
documents qui se contredisent, pour le même client (règle 7).
Les 18 clés de niveau client sont désormais renvoyées, et **elles seules**. La liste est donc
écrite à DEUX endroits — `VR_CLES_CLIENT` dans le serveur et `SSProducts.vrClesClient()` — ce
qui finit toujours par diverger : **`tests/volet.test.html` lit le fichier du serveur et compare
les deux** (cas H2). Ajouter un champ `client: true` sans le porter côté serveur fait échouer ce
test, et c'est exactement son rôle.

**31 quinquies. UN BLOC RE-RENDU DOIT ÊTRE REBRANCHÉ, sinon on perd des DONNÉES.**
`SSVolet.rafraichir` remplace le bloc par `outerHTML` : les anciens éléments sont détruits et
les écouteurs que la page avait posés dessus partent avec eux. Sans `opts.bind`, **tous** les
champs du bloc cessaient d'être collectés dès le premier changement d'alimentation ou de
combinaison : on les remplissait, ils s'affichaient correctement à l'écran, et ils n'arrivaient
jamais dans le devis. Le symptôme ne ressemblait pas à la cause — trouvé en rejouant le geste
réel, pas en relisant le code. `bind` n'est pas facultatif.

**31 sexies. `input` PART TOUJOURS AVANT `change` — ne jamais lire « l'ancienne valeur » sur
l'objet au moment du `change`.** La propagation du RAL ne se déclenchait jamais chez Nicolas :
on lisait `it.couleur` juste avant `collectItem` dans le gestionnaire `change`, en croyant tenir
l'ancienne couleur. Mais `input` est parti avant et a déjà collecté — le nuancier émet les
DEUX évènements (`ui.js`, `remplir()`), et la frappe émet `input` à chaque caractère. « Ancienne »
valait donc « nouvelle », et la comparaison sortait toujours égale.
La valeur précédente vit maintenant HORS de l'ouverture : une `Map` par ouverture dans le
simulateur, une variable dans le Mode Terrain. ⚠️ Pas une clé sur l'ouverture : tout ce qu'on y
pose part en base avec le devis, et ceci est de l'état de formulaire.
⚠️ **La leçon porte sur la MÉTHODE.** Mes essais passaient au vert parce que j'y émettais
`change` tout seul — une séquence qui n'existe dans aucun navigateur. **Rejouer le GESTE
(cliquer, taper, ouvrir le nuancier), jamais l'API.** Et le nuancier écrit le CODE DE COMMANDE
Harol (« 7016 — Gris anthracite · réf. 7m16st (laque texturée) »), pas un RAL nu : toute
comparaison de couleur passe par `SSVolet.normaliserRal`.

**31 septies. L'ENCADRÉ DU DEVIS EST UN FLUX, PAS UNE GRILLE — et c'est ce qui le fait tenir
sur une page.** En grille 2 colonnes, 18 options font 9 rangées : mesuré, la feuille passait à
1 112 px pour **1 032 px utiles** en A4 (210 × 297 moins 12 mm de marge, à 96 dpi), et le PDF
sortait avec une page de plus **ne contenant que le pied de page**. Signalé par Nicolas sur un
vrai devis. En flux, les mêmes 18 options tiennent en 4 lignes : 1 020 px.
Essayé avant de trancher : **3 colonnes AGGRAVE** (185 px contre 173), parce que 8 valeurs sur
14 passent alors sur deux lignes. Resserrer interlignes et paddings ne rendait que 40 px.
⚠️ Le flux vaut à l'ÉCRAN AUSSI, volontairement : **l'aperçu doit être le PDF**. Une mise en
page différente entre les deux, et on valide un aperçu pour obtenir autre chose.
⚠️ Et puisqu'un devis à plusieurs ouvertures débordera toujours légitimement : `.doc-foot` porte
`break-before: avoid` et `.signatures` `break-after: avoid`. Si le pied ne rentre pas, il emmène
le bloc de signature avec lui — la page suivante porte alors ce qu'on signe, jamais une ligne
seule. **Mesurer la hauteur rendue en forçant les règles d'impression** (parcourir
`document.styleSheets` et passer les media `print` à `all`) : c'est le seul moyen de vérifier
une pagination sans générer le PDF.
⚠️ **UN SEUL ENCADRÉ POUR DES OUVERTURES IDENTIQUES** (`SSVolet.groupesConfig`). Sur un vrai
devis (Kerremans, deux VR150 d'une même façade), les deux encadrés étaient identiques MOT POUR
MOT et pesaient 123 px chacun : c'est eux, et eux seuls, qui faisaient passer le devis à DEUX
pages. Mesuré : 1 091 px avant, **912 px après** pour 1 032 utiles. Sur huit ouvertures, trois
pages deviennent deux. Et un client qui lit deux fois la même chose cesse de la lire.
• **Consécutives seulement**, et c'est un choix : un encadré sous la ligne 3 qui couvrirait
  aussi la ligne 1 obligerait à remonter par-dessus l'encadré de la ligne 2. Ça ne coûte rien
  en pratique — **une ouverture dupliquée se range juste après son original** (règle 35), donc
  les identiques sont déjà voisines. Une ouverture SANS encadré (un screen entre deux volets)
  ne coupe pas un groupe : elle n'insère rien entre eux, la lecture reste continue.
• **La comparaison porte sur le RÉSUMÉ AFFICHÉ, pas sur l'objet** : deux ouvertures peuvent
  différer par des champs `client: false` (perçage, rivets) et présenter le même encadré. C'est
  l'encadré qu'on dédoublonne, donc c'est lui qu'on compare. Ni les dimensions ni le prix n'y
  entrent : ils vivent sur la ligne de produit.
• **L'encadré NOMME ce qu'il couvre** dès qu'il en couvre plus d'un — sans ça on ne saurait
  pas où s'arrête sa portée. Sur une seule ouverture, pas d'intitulé : écrire « ouverture 1 »
  sous la ligne 1 n'apprend rien.
  ⚠️ **ET IL NOMME DES PRODUITS, PAS DES NUMÉROS DE LIGNE** (11/10/2026) : « 4 volets » et non
  « ouvertures 1 et 2 ». Demande de Nicolas sur un PDF réel, et c'est une question de POINT DE
  VUE : une « ouverture 1 » désigne une ligne de tableau — une notion d'ERP — là où le client
  compte des volets. **Et le compte n'est pas le même** : deux lignes de quantités 1 et 3, ça
  fait QUATRE volets, ce que l'ancien intitulé ne disait nulle part.
  ⚠️ La quantité se lit comme la LIGNE la lit (`quantite || 1`), **jamais avec
  `SSRemu.quantiteDe`** : celle-là est la règle de l'ARGENT (un zéro écrit vaut zéro). Ici
  l'intitulé doit s'accorder au chiffre de la colonne « Qté » juste au-dessus — deux règles
  différentes, et l'encadré contredirait le tableau.
  ⚠️ Trois replis vers l'ancien intitulé, et aucun n'est de la prudence gratuite : sans les
  ouvertures, avec des types MÉLANGÉS dans un groupe, ou sans `SSUI`. Dans ces trois cas on ne
  peut pas nommer le produit honnêtement, **et un intitulé faux est pire qu'un intitulé
  technique**.
  ⚠️ `TYPE_FORMES` était INTERNE à `ui.js` : la fonction retombait donc sur l'ancien intitulé
  **en silence**, sur la page comme dans les tests. Ce sont les trois cas ajoutés à
  `volet.test.html` qui l'ont dit — la page, elle, affichait juste « l'ancien » sans erreur.
• ⚠️ **`tr.spec-row { break-before: avoid }`** : mesuré sur huit ouvertures, la ligne 7 tombait
  en bas de page et son encadré ouvrait la suivante, seul, sans le produit qu'il décrit. Limite
  assumée : il colle à sa DERNIÈRE ligne, pas au groupe entier — l'intitulé nomme les lignes,
  donc on sait toujours de quoi il parle.

⚠️ **LA REMISE SE POSE APRÈS LA DERNIÈRE LIGNE PRODUIT, AVANT L'ENCADRÉ DE CONFIGURATION.**
Écrite après la boucle, elle tombait SOUS l'encadré — et l'encadré porte un filet d'accent et un
fond, donc l'œil regroupe ce qui le touche : la remise avait l'air de se rapporter à la
CONFIGURATION plutôt qu'aux produits qu'elle réduit. Signalé par Nicolas sur un vrai devis.
⚠️ `ligneRemise` et `dernierItem` se préparent AVANT la boucle : on ne peut pas décider « après
la dernière ligne » depuis l'intérieur d'une boucle qui ne sait pas encore où elle s'arrête.
⚠️ **Contrepartie obligatoire : `tr.remise-row { break-before: avoid }`.** La remise s'intercale
maintenant entre une ligne produit et son encadré ; or `spec-row` s'accroche à ce qui la
précède, c'est-à-dire à la remise. Sans cette règle, un saut de page coupe le groupe en deux et
l'encadré décrit des lignes qu'on ne voit plus.
⚠️ Vérifié sur TROIS cas, pas un : 2 ouvertures (remise juste avant l'encadré, 946 px, 1 page),
8 ouvertures (même règle, 1 829 px, 2 pages) et un devis SANS remise (aucune ligne parasite).

⚠️ **LES TOTAUX FLOTTENT À DROITE, LE RAPPEL DE PAIEMENT S'ÉCRIT À CÔTÉ.** Les totaux occupent
320 px à droite et l'acompte s'écrivait DESSOUS, pleine largeur : il restait un quart de page
vide juste avant la zone la plus regardée du document (« il faut vraiment que le devis soit plus
joli », Nicolas, 10/10/2026). Côte à côte, le vide disparaît et on gagne 56 px.
**Un flottant, pas une grille**, parce qu'il ne faut toucher AUCUN des deux gabarits : le rappel
vit dans un ternaire à trois branches (devis, dépannage réalisé, dépannage proposé), dans les
DEUX documents — six modifications de gabarit pour ce que trois lignes de style obtiennent, et
six occasions de les faire diverger.
⚠️ `overflow: hidden` sur le voisin n'est pas un rognage : c'est ce qui en fait un bloc qui
occupe la place RESTANTE au lieu de s'enrouler autour du flottant. Et `clear: both` sur tout ce
qui suit est obligatoire, sinon la ligne de validité et les partenaires remontent à côté des
totaux. Vérifié dans les deux cas, avec et SANS rappel de paiement.

⚠️ **SURÉLEVER UN CONTENEUR, C'EST SURÉLEVER TOUTE SA SURFACE** — le filigrane INFORMATIF.
À l'impression, `--surface` devient blanc opaque : le filigrane, peint derrière le contenu, se
faisait recouvrir. On l'avait donc fait passer DEVANT, puis remonter `.doc-table` et `.totals`
au-dessus de lui pour que le bandeau bleu et le pavé « TOTAL TVAC » ne soient pas traversés par
une tache claire. Le raisonnement sur l'empilement était juste (ce sont des `.paper > *` en
`z-index: 1`, donc des contextes dont les enfants ne sortent pas) — **mais pas la conséquence** :
sur un devis ordinaire le tableau occupe la moitié de la page, et il ne restait du mot que
« …RMATIF » au-dessus et « INFO… » en dessous. Signalé par Nicolas : « le INFORMATIF n'est pas
bien derrière tous les encadrés, alors que dans l'ERP c'est nickel ».
**La sortie : RETIRER le contexte d'empilement** (`z-index: auto` sur les conteneurs), ce qui
libère leurs enfants positionnés ; seuls les deux aplats vraiment opaques
(`thead th`, `.t-ttc`) montent alors au-dessus du filigrane.
⚠️ **PAS DE `mix-blend-mode`**, bien qu'un `multiply` résoudrait aussi le problème : un mode de
fusion peut forcer la rastérisation de la couche à la génération du PDF. **Quand on n'a besoin
que d'ordre de peinture, on ne demande rien de plus au moteur d'impression.**

⚠️ **VINGT-SEPT PIXELS SUFFISENT À FAIRE UNE DEUXIÈME PAGE.** Retour transmis par Nicolas le
11/10/2026 : « dommage que les conditions de paiement et les signatures soient seules sur la
deuxième page ». Mesuré sur le devis Kerremans : **1 059 px pour 1 032 utiles**. Le pied
démarrait à 1 035 — et comme il porte `break-before: avoid` et les signatures `break-after:
avoid`, il emmenait tout le bloc de signature sur une page qui ne contenait QUE ça.
**On resserre les BLANCS DU BAS, et eux seuls** (`.pay-note`, `.doc-ref`, `.signatures`,
`.partners`, `.doc-foot`), uniquement à l'impression : 1 059 → **1 025 px**, une page.
**Un devis se resserre par ses blancs, jamais par son texte** — sinon on gagne une page et on
perd le document. Et `.sig-box` garde ses 70 px : une signature manuscrite demande 18 mm, soit
68 — c'est le seul blanc du bas qui n'en est pas un.
⚠️ Un devis PLUS gros débordera toujours légitimement, et c'est très bien : les deux règles de
saut font alors voyager les signatures AVEC le pied, donc la page suivante porte ce qu'on signe.
⚠️ **UN DEVIS INFORMATIF N'A PAS DE BLOC SIGNATURE** (`${info ? '' : …}`) : il pesait 942 px
là où le même devis normal en fait 1 059. **Mesurer le mauvais des deux, c'est conclure qu'il
n'y a pas de problème.**

**39. UNE OPTION QUI PORTE TROIS NOMS N'EN EST PLUS UNE — la commande murale.**
Demande de Nicolas (11/10/2026) : « pour éviter toute ambiguïté, je préciserais “ Commande
murale Somfy individuelle incluse ” — pour chaque volet, mais pour les screens également et les
tentes aussi ».
⚠️ **TROIS FORMULAIRES, TROIS MOTS, ET RIEN SUR LE DOCUMENT.** Le volet et le screen portent
`emetteur` (« Émetteur inclus »), la tente porte `telecommande` (« Avec commande à distance »).
Sur le devis : un « Émetteur » sec dans l'encadré d'un volet — un mot de CATALOGUE, où
personne ne sait s'il s'agit d'une télécommande, d'un boîtier mural ou d'une pièce du moteur —
et **absolument rien** pour un screen ou une tente, qui n'ont pas d'encadré de configuration.
C'est exactement le genre d'ambiguïté qui se règle par téléphone trois semaines plus tard.
**C'est à l'ERP de réunir les trois, pas au lecteur du devis** (règle 10) : `SSUI.commandeIncluse`
et `SSUI.MENTION_COMMANDE`, écrits une fois, lus par les deux documents.
⚠️ **« INDIVIDUELLE » N'EST PAS DE L'ORNEMENT** : l'encadré de configuration peut couvrir
PLUSIEURS ouvertures (« ouvertures 1 à 3 », règle 31 septies). Sans ce mot, le client peut
comprendre une commande pour le lot ; avec, il comprend une par ouverture — ce qui est vendu.
⚠️ **LE LIBELLÉ COURT EST CELUI QUE LIT LE CLIENT.** C'est `lCourt` qui part sur le devis, pas
`l` : c'est donc lui qui porte la phrase entière. Et une case cochée se MENTIONNE sans valeur
(« Oui » est tu sur le document client), donc la phrase se lit telle quelle dans l'encadré.
⚠️ **POUR UN SCREEN OU UNE TENTE, LA MENTION VA SUR LA LIGNE**, pas dans un encadré : ils n'en
ont pas. Deux endroits différents pour la même phrase selon le type, et c'est voulu — chacun la
porte là où le client lit le produit.
⚠️ **ET `telecommande` A DÛ ENTRER DANS LA LISTE BLANCHE DU LIEN CLIENT** (règle 31 ter), sinon
la mention sortait sur le PDF et PAS sur la page que le client ouvre — deux documents qui se
contredisent pour le même client (règle 7). **Dans une liste SÉPARÉE** (`AUTRES_CLES_CLIENT`) :
ce n'est pas une clé du VR150, et le test qui compare `VR_CLES_CLIENT` à
`SSProducts.vrClesClient()` aurait échoué — à juste titre.

⚠️ **LE PDF DOIT ÊTRE LE DOCUMENT QU'ON A VALIDÉ À L'ÉCRAN.** « Dans le PDF à enregistrer,
c'est beaucoup moins joli que la prévisualisation sur l'ERP » (Nicolas, 11/10/2026, capture à
l'appui). La cause n'est pas une faute de style, c'est une règle du navigateur : **à
l'impression, Chrome SUPPRIME les fonds de couleur** (économie d'encre), sauf ceux qui demandent
`print-color-adjust: exact`. Seuls trois éléments le faisaient — le bandeau du tableau, la
pastille de paiement, le pavé TOTAL TVAC. Tout le reste (l'encadré de configuration, les bandes
« FOURNITURES » et « PRESTATIONS », l'alternance des lignes, l'encadré d'estimation) sortait
**en blanc**. La règle porte donc sur `.paper` ET sa descendance : **c'est le document qu'on
veut fidèle, pas trois éléments choisis.**
⚠️ Ça ne remet pas le filigrane en cause : il est peint à 5, au-dessus du tableau passé à
`z-index: auto` — un fond qui réapparaît ne le masque pas.
⚠️ **ET ÇA NE SE VÉRIFIE PAS EN FORÇANT LES RÈGLES `print` À L'ÉCRAN** : la suppression des
fonds appartient au pipeline d'impression, pas à la media query. L'écran montrera toujours les
couleurs. **Seul un PDF réellement généré fait foi** — d'où l'intérêt de le relire avec
`pymupdf` plutôt que de conclure depuis un aperçu.

⚠️ **UNE FEUILLE A4 A UNE HAUTEUR FIXE, PAS LE DOCUMENT — D'OÙ LA BANDE BLANCHE.**
« Sur l'ERP web il utilise toute la page ; quand je crée et enregistre le PDF il y a une bande
blanche en dessous » (Nicolas, 11/10/2026). Les deux observations sont justes, et c'est la même
chose vue des deux côtés : **à l'écran `.paper` s'arrête où son contenu s'arrête**, donc aucun
vide ne se voit ; **sur une feuille A4 la hauteur est imposée**, et tout ce que le contenu ne
remplit pas reste blanc. Mesuré : 1 025 px pour 1 032 utiles sur un devis complet — mais
**849 px** dès qu'il manque un bloc (devis informatif : ni acompte ni signatures), soit près de
5 cm de blanc sous le pied.
**La réponse n'est pas d'étirer le contenu, c'est d'ANCRER LE PIED EN BAS DE LA FEUILLE** : le
vide passe alors AU-DESSUS du bloc de clôture, entre le devis et sa signature, où il se lit comme
une marge et non comme une page coupée. D'où `.doc-close`, qui réunit partenaires + signatures +
mentions **d'un seul tenant** : trois frères séparés auraient demandé trois ancrages, et le
premier écart entre eux aurait tout décalé.
⚠️ **ET SURTOUT PAS EN PASSANT `.paper` EN FLEX** (`margin-top: auto` sur le pied), qui est
pourtant la réponse « évidente ». Essayé, mesuré, écarté : **`.totals` FLOTTE à droite** pour
que le rappel d'acompte tienne à côté des totaux. En flex chaque enfant devient un élément de
flux — le flottant cesse de chevaucher, les marges ne fusionnent plus — et le devis passe de
**1 025 à 1 091 px**, donc sur une 2e page. La mise en page en bloc est VOULUE.
⚠️ **LA RÉSERVE (`--close-reserve`) N'EST PAS UNE MARGE DÉCORATIVE.** Le bloc de clôture étant
hors flux, **rien n'empêcherait le contenu de passer dessous** sur un devis long : ce
`padding-bottom` tient le flux à distance du bas de la feuille. C'est la page elle-même qui porte
la garantie, pas la chance. Elle vaut la hauteur RÉELLE du bloc, arrondie vers le haut — 176 px
(47 mm) avec signatures, 76 px (21 mm) sans — et `renderPaper` la règle selon la variante. **Une
réserve plus COURTE que le bloc ne protège plus de rien** : c'est exactement ce qui arrivait avec
18 mm, où les 8 derniers pixels débordaient dans la zone où le texte a le droit de descendre.
⚠️ **LES 2 px EN MOINS SUR `min-height` SONT DÉLIBÉRÉS** : une feuille calée au pixel près sur
la hauteur utile, et le moindre arrondi la fait déborder sur une page blanche — exactement le
défaut ci-dessous.
⚠️ **ET LA RÈGLE SE BRANCHE SUR `:has(> .doc-close)`, PAS SUR LE NOM DE LA PAGE.** Appliquée à
un document sans bloc de clôture, la réserve confisquerait 4,7 cm de page sans rien y mettre —
et ferait gagner une page à tout document un peu long. Une feuille future l'aura ou ne l'aura
pas, sans que personne ait à y penser. La facture a reçu le même bloc, même défaut, même
correction.

⚠️ **UN CONTENEUR VIDE QUI FORCE UN SAUT DE PAGE FABRIQUE UNE PAGE BLANCHE.** Trouvé le
11/10/2026 dans un PDF réellement généré par Nicolas : deux pages, et la seconde ne contenait
RIEN (mesuré à zéro caractère avec pymupdf). Un devis INFORMATIF n'a ni CGV ni attestation TVA,
donc sans photo d'ouverture `#annex` reçoit une chaîne vide — mais le `<div>` restait dans la
page avec son `page-break-before: always`, et le navigateur ouvrait une feuille pour n'y rien
mettre. `.annex:empty { display: none }` suffit, et se désactive dès qu'une annexe existe.
**Un aperçu à l'écran ne montre PAS ça** : une page blanche n'existe qu'au moment où le moteur
d'impression pagine. Pour la voir, il faut lire le PDF — `pymupdf` est installé sur la machine
de Nicolas, et `page.get_text()` sur chaque page dit immédiatement laquelle est vide.

⚠️ **L'INTITULÉ ET LA VALEUR DOIVENT SE DISTINGUER AU PREMIER COUP D'ŒIL.** « Le cadre, je ne
trouve pas ça super clair, il faut plus voir la différence entre la description et l'option »
(Nicolas, sur le PDF généré). Les deux étaient au MÊME poids et ne différaient que par une
nuance de gris : quatorze paires à la file, séparées par un point médian fin, ça se lit comme
une seule phrase. La valeur passe en **600**, l'intitulé en `--text-subtle`, et une **barre
verticale** sépare les paires là où le point médian se confondait avec la ponctuation des
valeurs (« 7016 — Gris anthracite · Coulisses »). Coût en hauteur : **zéro** (124 px avant
comme après).
⚠️ **ET LE PIÈGE QUI A FAILLI PASSER : `white-space: nowrap` SUR LA PAIRE.** Il rendait chaque
paire insécable — exactement ce qu'on veut — et la boîte tombait de 124 à 60 px, ce qui avait
l'air d'un gain. **C'était trois lignes de 2 342 px** : le `::before` du séparateur hérite du
nowrap, donc il ne reste AUCUNE occasion de couper, et le tableau passait de 703 à **2 406 px**.
Seul l'intitulé porte `nowrap`. **Mesurer la boîte seule aurait validé le défaut : c'est la
largeur du TABLEAU qu'il fallait regarder.**

Le document retire aussi les **codes de menu Harol** des valeurs (`SSVolet.sansCodeMenu`) : « 1 :
type 1 (dans le jour) » se lit « Type 1 (dans le jour) ». ⚠️ On ne retire QUE un index (1-2
chiffres) ou une référence d'article (A4118) — jamais 3 ou 4 chiffres, parce que « 7016 — Gris
anthracite » est un RAL et « 135 — glissière de sécurité » une référence : elles DÉSIGNENT le
produit. Et `muets: ['Simple']` tait « Combinaison : Simple », qui n'apprend rien — la règle
existait déjà dans `picking.html` (`VALEURS_MUETTES`) et devait suivre les volets dans la spec.

**32. LES NOTES DE FRAIS SONT UN OUTIL À PART, et c'est une décision de Nicolas.**
Table `depenses` (`/api/depenses`), écran `app/depenses.html`, logique dans `assets/js/depenses.js`.
Il achète du matériel de chantier avec son argent, SolariScreen doit le rembourser, et le ticket
finit dans une poche. Ses mots, le 10/10/2026 : « c'est une sécurité pour moi de pouvoir être
remboursé et ne pas tomber dans l'oubli ».
⚠️ **AUCUN LIEN avec les statistiques, la rémunération ou le paiement**, demandé explicitement :
« il ne doit pas être lié aux stats ni au paiement ». Un remboursement de matériel et une paie de
pose ne sont pas la même nature d'argent — les additionner donnerait un chiffre que personne ne
pourrait défendre en face de Yannick. **Ne pas « intégrer » ce module à `remuneration.js`.**
⚠️ Pas de TVA, pas de catégorie, pas de moyen de paiement, pas de référence comptable : « c'est
juste du remboursement matériel acheté dans des magasins de bricolage ou des magasins pro pour
les chantiers ». Chaque champ en plus est un champ qu'on ne remplit pas, donc un registre qu'on
abandonne. La pièce officielle reste chez SysCore / Falco.
**Trois états, et c'est tout le modèle** : à remettre · au bureau · remboursé. Les deux dates sont
posées par celui qui SAIT (Nicolas coche « remis » en déposant, « remboursé » en voyant l'argent),
sans aucune validation qui bloque — une file d'attente qui dépend de quelqu'un d'autre, c'est
exactement ce qui fait tomber les choses dans l'oubli. Registre PARTAGÉ : Yannick voit et corrige.
⚠️ **« Remboursé » l'emporte sur « remis »** : on est parfois remboursé de la main à la main,
sans passer par le bureau. Exiger l'un avant l'autre laisserait ces tickets dans un état faux —
une ligne d'argent qu'on croirait encore due.
⚠️ **L'ANCIENNETÉ EST LE CŒUR DE L'OUTIL**, pas le montant : c'est « 23 j » à côté d'une somme
qui fait qu'on se décide à aller au bureau. Elle se compte depuis le DERNIER geste — la date
d'achat tant que le ticket est dans la poche, la date de remise une fois qu'il est au bureau.
Compter depuis l'achat dans les deux cas ferait passer pour urgent un ticket déposé hier, et un
écran qui crie pour rien, on apprend très vite à ne plus le lire. Deux seuils différents, et c'est
voulu : 14 jours dans la poche, 30 jours au bureau (un bureau met légitimement un mois à payer).
Le tri suit la même logique : ce qui attend depuis le plus longtemps passe devant, le remboursé
ferme la marche. Un registre trié par date d'achat enterre le vieux ticket au fond.
⚠️ **Aucune écriture hors-ligne**, même raison que les prélèvements : un ticket qui n'existerait
que sur le téléphone qui l'a saisi serait resaisi le lendemain, et on réclamerait deux fois.
⚠️ Les PHOTOS passent par une route ciblée (`/api/depenses/:id/photo`, règle 3) et sont
RÉINJECTÉES à l'enregistrement complet : sans ça, corriger un montant effacerait la photo que
l'autre vient d'ajouter. Celles choisies AVANT le premier enregistrement attendent en mémoire —
la route ciblée a besoin d'un identifiant qui n'existe pas encore (même mécanique que la règle 25).
Le compteur du menu (`badge: 'depenses'`) ne compte que MES tickets non remboursés : ceux de
l'autre ne me concernent pas, et un compteur qui parle d'autre chose, on cesse de le regarder.
Il ne passe PAS par `attente.js` — cet outil est à part, le menu COMPTE, il n'intègre pas.

**33. UN RACCOURCI SE JUGE SUR OÙ L'ON EST, PAS SUR CE QU'IL AFFICHE.**
⚠️ **Trois versions de la même rangée en une journée** (10/10/2026), et c'est la troisième qui
porte la bonne distinction — les deux premières cherchaient au mauvais endroit.
1. Huit pictogrammes muets : « je ne vois pas trop ce que c'est, je ne l'utilise pas ».
2. Trois pastilles AVEC leur libellé : « ça me sert à rien, et c'est mal intégré ». Rendre
   lisible ne suffisait donc pas — **un raccourci qu'on n'utilise pas ne devient pas utile
   parce qu'il est lisible.** Retirées, tout dans le menu ⋯.
3. Et Nicolas : « dans la version mobile, garder Appeler et Y aller, c'est top sur le terrain ».
**C'est le LIEU qui tranche, pas le bouton.** Au bureau, le menu ⋯ est à un clic et la ligne
doit rester lisible. Dans la camionnette, appeler ou lancer l'itinéraire doit coûter UN appui,
et ouvrir un menu avec le pouce n'en est pas un.
`raccourcisTerrain(d)` rend donc **deux** boutons — Appeler, Y aller — affichés uniquement
sous 560 px, cible tactile 38 px. ⚠️ « Écrire » n'y est pas, et ce n'est pas un oubli : on
n'écrit pas un mail depuis un chantier, on appelle. Le mail reste dans le ⋯.
⚠️ Ils sont rendus TOUJOURS et masqués par la feuille de style : **aucune branche JavaScript
sur la largeur** (règle 24), donc rien ne se désynchronise quand on tourne le téléphone.
⚠️ Largeur LIBRE, cible tactile en HAUTEUR : un carré fixe écraserait le libellé — piège
mesuré le matin même (66 px voulus, 30 donnés).
Le menu ⋯ garde tout, en deux groupes écrits : **Contacter** (avec le vrai numéro et la vraie
adresse dans le libellé) et **Aller à**.

**33 zero bis. L'HISTORIQUE DE CE QU'ON A ESSAYÉ, parce qu'il explique pourquoi on n'y revient pas.**
⚠️ **La rangée de raccourcis de la ligne de devis a été RETIRÉE le 10/10/2026**, après DEUX
tentatives. D'abord huit pictogrammes muets — « je ne vois pas trop ce que c'est, je ne
l'utilise pas ». Puis trois pastilles avec leur libellé, et Nicolas a tranché : « Appeler,
Écrire et Y aller ne me servent à rien, et je ne trouve pas ça bien intégré ». Il avait raison
sur les deux points : posée sous la ligne de méta, la rangée flottait sans appartenir à rien.
Tout vit désormais dans le menu ⋯, en deux groupes écrits en toutes lettres : **Contacter**
(appeler, écrire, itinéraire — avec le vrai numéro et la vraie adresse dans le libellé) et
**Aller à** (fiche client, facture, espace client, planning, SAV).
**La place sur une ligne de liste se mérite ; le menu, lui, ne coûte rien à personne.**
Ne pas remettre ces raccourcis sur la ligne sans que Nicolas le demande.
Le texte qui suit garde l'historique de l'étape intermédiaire, parce qu'elle explique pourquoi
on n'y revient pas.

Et la leçon de l'étape 1, qui reste vraie : **un raccourci sans son mot n'est pas un raccourci.**
Le bandeau d'un devis portait huit pictogrammes de 13 px, gris à 62 % d'opacité, expliqués par
un seul `title` au survol. Nicolas ne s'en servait pas, et il l'a dit exactement : « c'est petit,
beau, mais on n'a pas envie de cliquer, je ne vois pas trop ce que c'est ». Et **sur téléphone il
n'y a pas de survol** : ils étaient muets par construction, là où ils servent le plus.
Il en reste TROIS, et ils portent leur nom : Appeler · Écrire · Y aller — les gestes du terrain.
Les six autres (document, fiche client, espace client, facture, planning, SAV) sont passés dans le
menu ⋯, sous un intertitre « Aller à ».
⚠️ Ils n'ont PAS été supprimés, et il ne faut pas le faire : ce sont de vrais raccourcis, et le
menu ⋯ ne portait que « agir sur le devis ». Les deux listes sont COMPLÉMENTAIRES — une seule
entrée était en double (« Devis / PDF »), et c'est la seule qui a disparu.
⚠️ `.m-jp` ne porte plus de largeur FIXE : le carré de 32 px du bloc téléphone écrasait la
pastille à libellé à 30 px de contenu pour 66 voulus. La cible tactile se tient en HAUTEUR
(36 px), la largeur suit le mot. Et `flex: 0 0 auto`, sinon la rangée de méta la comprime.

**33 bis. UNE COLONNE QUI PEUT GRANDIR DÉCALE TOUT CE QUI EST À CÔTÉ.**
« C'est pas aligné » (Nicolas, capture à l'appui). La ligne centre ses trois colonnes
verticalement, mais celle de droite était une PILE : le montant au-dessus, l'état de paiement en
dessous. Dès qu'un badge existait, le bloc grandissait et le montant REMONTAIT par rapport à la
pastille d'action — trois hauteurs sur la même ligne, et des lignes qui ne s'alignaient plus
entre elles selon qu'elles portaient un badge ou non.
L'état de paiement a rejoint la pastille d'action : ils disent la même chose (où en est ce
dossier). La colonne de droite ne porte plus qu'UNE ligne — `⋯` + montant — donc sa hauteur est
la même pour toutes les lignes (mesuré : 30 px partout, montants alignés au pixel).
⚠️ Depuis le 25/10/2026 (règle 40 bis), l'état de paiement vit SOUS le montant, en position
absolue (`argentHtml`) : à côté d'une action de largeur fixe, il la faisait couper. La règle de
fond ne change pas — rien dans la colonne de droite ne doit pouvoir la faire grandir.
**La règle générale** : dans une rangée centrée verticalement, une colonne à hauteur variable
désaligne ses voisines. Soit on fige sa hauteur, soit on l'aplatit sur une ligne.

**33 ter. `flex-basis: auto` FAIT SAUTER UN ÉLÉMENT À LA LIGNE SUIVANTE AVANT DE LE RÉTRÉCIR.**
Sur téléphone, le nom du client tombait à **60 px** — « Ecole… » — écrasé entre les badges et le
montant. L'addition ne tombe pas : nom (~130) + badge (~46) + montant (~95) + ⋯ (38) dépassent les
~310 px de la ligne, quoi qu'on rogne. Il faut donc que quelque chose descende, et **ce n'est pas
le nom** : c'est lui qui identifie le dossier.
`flex-wrap: wrap` sur la rangée du nom fait descendre le BADGE quand la place manque, et seulement
alors. Mais avec `flex: 1 1 auto`, la base du nom vaut la largeur de son TEXTE (206 px) : en mode
wrap, un élément dont la base dépasse la place restante part à la ligne suivante **avant** de se
rétrécir — la pastille d'initiales restait donc seule sur sa ligne, le nom dessous. Vu à l'écran,
invisible dans les mesures. `flex: 1 1 0` règle ça : base nulle, le nom reste à côté et s'ellipse.
Résultat mesuré : 147–156 px pour le nom au lieu de 60.

**33 quater. UNE LIGNE DE DEVIS SIGNÉ DOIT DIRE OÙ EN EST LE CHANTIER.**
Elle affichait le statut, le montant et l'action — mais ni l'état de la commande chez Harol, ni
la date de pose. Les deux existaient dans l'ERP ; il fallait ouvrir la fiche. **C'est exactement
le genre de détour qu'on ne fait pas, donc l'information n'existait pas.**
`suiviChantier(d)` pose deux pastilles discrètes dans la ligne de méta : l'étape de commande et
« Pose le 12/11 ». ⚠️ **Uniquement sur un devis signé ou terminé** — sur un brouillon ces deux
notions n'existent pas, et une pastille « À commander » sur un devis pas encore envoyé serait un
faux signal. « Posé » n'est pas affiché : le statut du devis le dit déjà.
Seul **« À commander » est coloré** (ambre) : c'est le seul état où la balle est dans NOTRE camp.
« Commandé » et « Fabrication » attendent le fournisseur — rien à faire, donc gris.
⚠️ Les libellés des étapes sont remontés dans `SSUI.COMMANDE_LABEL` (règle 10) : ils vivaient en
DEUX copies, `vue.html` et **`track.html` — la page que le CLIENT ouvre**. Une divergence s'y
serait vue de l'extérieur.

**33 quinquies. LE MONTANT D'UNE LIGNE N'EST PAS L'ARGENT QUI MANQUE.**
La ligne montrait 31 796,82 € sur un chantier dont 9 539 € étaient déjà rentrés. Le total dit la
valeur du dossier ; ce qu'on cherche, c'est **ce qui reste à encaisser** — 22 257,82 €. Il
s'écrit désormais sous le montant, et seulement s'il APPREND quelque chose (rien facturé, rien
payé, ou soldé : la ligne se tait).
⚠️ **Il est en `position: absolute`, et c'est la condition pour qu'il existe.** L'écrire dans le
flux rendrait la colonne de droite variable en hauteur et recréerait l'escalier de la règle
33 bis — corrigé le matin même. En absolu il se pose sous le montant sans rien décaler : vérifié,
montants alignés au pixel et hauteur de ligne inchangée, y compris en mode Compact (12 px de
marge sous le texte). Il y a la place parce que **c'est la colonne de GAUCHE qui fixe la hauteur
de la rangée**.
⚠️ Ne pas remplacer ce calcul par `SSUI.duFacture` : celui-ci répond « combien dû sur les
factures ÉMISES », alors qu'on veut « combien reste sur le DEVIS » — ce qui n'est pas encore
facturé compte aussi. Deux questions voisines, deux réponses différentes.

**34. LE CONTRAT D'UNE NOUVELLE PAGE : le bandeau ne suffit pas, il faut le MONTER.**
`app/depenses.html` est sortie **sans navigation**. Les emplacements étaient pourtant bien là
(`#quickNav`, `#themeToggle`) — personne ne les remplissait. On arrivait sur la page et on ne
pouvait plus aller nulle part, sauf par le bouton « Dashboard ». Nicolas l'a vu à la première
ouverture : « j'ai pas le menu à gauche ? ».
Deux lignes, et elles sont obligatoires sur **toute** page de `app/` :
```js
window.SSTheme.mountThemeToggle(el('themeToggle'));
window.SSNav.mount(el('quickNav'));
```
⚠️ Le défaut est INVISIBLE à la relecture : le HTML du bandeau est complet, rien n'échoue,
aucune erreur en console. Il ne se voit qu'en ouvrant la page — une raison de plus de toujours
regarder l'écran, pas seulement les mesures.
**Le contrôle qui attrape ça d'un coup**, pour toutes les pages :
```bash
for f in app/*.html; do q=$(grep -c 'id="quickNav"' "$f"); m=$(grep -c 'SSNav.mount' "$f");
  [ "$q" -gt 0 ] && [ "$m" -eq 0 ] && echo "MENU NON MONTE : $f"; done
```
Une nouvelle page doit aussi : porter le `viewport`, le `manifest` et l'`apple-touch-icon` (sinon
pas d'icône à l'ajout sur l'écran d'accueil), charger `ui.js` puis `nav.js`, et être déclarée
dans `NAV_GROUPS` de `nav.js` — sans quoi on ne peut y arriver que par l'URL.

**35. DUPLIQUER UNE OUVERTURE : ce qu'une copie emporte est une décision MÉTIER, pas un détail
d'écran.** Sur une façade, les ouvertures ne diffèrent souvent que par deux chiffres — même RAL,
même lame, même caisson, même moteur. Les ressaisir, c'est une quarantaine de champs pour deux
mesures, et une occasion de se tromper à chaque champ. La règle vit dans
`SSProducts.dupliquerOuverture` (règle 10) parce que **le simulateur ET le Mode Terrain
dupliquent** : en deux exemplaires elle aurait divergé au premier champ ajouté au configurateur.
⚠️ **La fonction ne POSE AUCUN `_id`, et c'est structurel.** Une copie qui garderait
l'identifiant de son original se confondrait avec lui au premier `find`, et les deux ouvertures
se modifieraient ensemble. En ne le produisant pas, l'oubli devient *impossible* au lieu d'être
seulement déconseillé — c'est l'appelant qui doit en poser un pour que sa copie existe.
⚠️ **Les photos ne suivent jamais.** Une photo documente UNE fenêtre précise ; recopiée, elle
part sur le document client et sur la feuille de pose en désignant la mauvaise ouverture — pire
qu'absente.
⚠️ **Les mesures et le prix, EUX, se copient.** Deux fenêtres identiques sont le cas fréquent :
les vider obligerait à retaper ce qu'on vient de dupliquer. Et un prix vidé seul laisserait des
mesures sans prix, donc un devis faux en silence. **C'est à l'interface de mettre la largeur sous
le curseur, pas à la donnée de disparaître** : la copie se range juste APRÈS son original et son
champ largeur part sélectionné, pour que corriger soit le geste par défaut.
⚠️ **La copie est PROFONDE.** Un tableau partagé entre l'original et sa copie se modifierait des
deux côtés à la fois, et personne ne le verrait avant de relire le devis enregistré —
c'est-à-dire chez le client.
⚠️ **`selectionStart` vaut `null` sur un `input[type=number]`** : une assertion écrite dessus
répond toujours « non sélectionné », même quand ça marche. La sélection se vérifie en TAPANT
vraiment au clavier et en regardant si la valeur est remplacée ou allongée. Encore un cas où il
faut rejouer le GESTE, pas l'API.
⚠️ Et un piège de méthode : remplir un `<select>` avec une valeur qui n'est pas dans ses options
échoue **en silence** (`e.value` reste vide). Un essai écrit comme ça « passe » en ne prouvant
rien — toujours comparer `e.value` à ce qu'on a voulu poser après l'avoir posé.

**36. CE QUI RESTE À REMPLIR SE VOIT SUR LE CHAMP, pas dans un message qui en parle.**
Demande de Nicolas (10/10/2026) : « des effets néon sur les boîtes de dialogue, dont on pourra
changer la couleur dans les paramètres… pour attirer l'attention sur les choses pas remplies ».
Le problème réel : un VR150 porte 38 champs, 6 bloquent la commande, et ils n'étaient signalés
que par du TEXTE. **Un texte qui parle d'un champ oblige à lire, puis à CHERCHER le champ — et
entre les deux, on abandonne.** `assets/js/signal.js` (`window.SSSignal`) pose le signal sur le
champ lui-même ; les réglages (effet, couleur) sont dans Paramètres, **par appareil**.
⚠️ **TROIS DISCIPLINES, SANS LESQUELLES CE MODULE DEVIENT DU PAPIER PEINT.**
• **On n'allume QUE ce qui bloque la commande** (`SSProducts.CHAMPS_REQUIS`), ~6 champs sur 38.
  Choix explicite de Nicolas. Un signal qui montre tout ne montre rien. La source est celle qui
  alimente déjà les pastilles « incomplet » du Mode Terrain (règle 10) : pas de seconde liste.
  Le PRIX n'y est pas, et ne doit pas y entrer : il se remplit au bureau, donc toute ouverture
  relevée chez le client s'allumerait jusqu'au retour — donc tout le temps, donc pour rien.
• **On n'allume qu'une ouverture COMMENCÉE**, c'est-à-dire dès qu'UN champ bloquant est rempli.
  Une ouverture neuve est vide par définition : l'allumer en entier, c'est accueillir chaque
  nouvelle ouverture par six champs en néon et apprendre à ne plus les voir dès le deuxième devis.
  La règle se lit aussi à l'envers, et c'est là qu'elle est bonne : **une ouverture DUPLIQUÉE
  arrive pleine, donc rien ne s'allume** — le signal ne crie pas après un travail déjà fait.
• **Le mouvement marque un ÉVÉNEMENT, pas un ÉTAT.** Un halo fixe se parcourt du regard ; une
  animation permanente se subit. Les effets animés existent parce que Nicolas les a demandés,
  mais `viser()` — la pulsation d'arrivée quand on saute sur un champ — dure une seconde et
  s'éteint seule. C'est la seule animation qui soit toujours juste.
⚠️ **RETIRER EST LA MOITIÉ DU TRAVAIL, et c'est celle qu'on oublie.** `appliquer()` nettoie TOUS
les champs de la racine avant de poser. Sans ça, un champ allumé puis rempli gardait son halo
jusqu'au prochain rendu complet de la carte : **du néon sur un champ plein, et le signal perd
tout son crédit en deux minutes.** Il se repose donc à chaque COLLECTE (simulateur) et à chaque
frappe (`majManque` en Mode Terrain), jamais au seul rendu.
⚠️ **Un bloc re-rendu doit être re-DÉCORÉ, exactement comme il doit être re-branché**
(règle 31 quinquies). Le bloc volet remplacé par `outerHTML` rend des éléments NEUFS : sans
rappel d'`appliquer`, le halo disparaissait au premier changement d'alimentation.
⚠️ **LA PALETTE ÉVITE LE VERT ET LE ROUGE**, et ce n'est pas une question de goût : ici la couleur
porte du sens (règles 21 bis et 22). Un « à compléter » en vert se lirait « c'est bon », en rouge
« erreur ». Un test MESURE la teinte de chaque couleur proposée et refuse les plages interdites —
on ne se fie pas à son nom. Chaque teinte a ses deux tons `{ sombre, clair }`, même discipline
que les décors, et les tons clairs visent TOUS les thèmes clairs via `SSTheme.idsClairs()`.
⚠️ **LES PASTILLES DE « CE QUI MANQUE » SONT DES BOUTONS**, en Mode Terrain. Elles NOMMAIENT ce
qui manquait et laissaient chercher : dans 38 champs répartis en six groupes, retrouver
« Caisson » au doigt coûte plus cher que l'information ne rapporte, donc on ne le faisait pas.
Elles sautent maintenant sur le champ. ⚠️ Un champ peut être MASQUÉ (pas d'alimentation choisie
→ pas de menu moteur) : on le DIT, plutôt que de défiler vers un élément invisible, ce qui
passerait pour un bouton cassé.
⚠️ **`@media (pointer: coarse)` NE SE VÉRIFIE PAS DANS UN NAVIGATEUR DE BUREAU**, même rétréci à
366 px : la pastille mesurait 18 px de haut et la règle avait l'air de ne rien faire. Il faut
ÉMULER UN APPAREIL TACTILE (préréglage « mobile » du panneau) — là, `matchMedia('(pointer:
coarse)')` répond vrai et la pastille passe à 32 px. Et un composant maison doit s'inscrire
lui-même dans ce bloc : la règle de `base.css` ne couvre que `.btn` et consorts.
⚠️ **UNE LIGNE DE RÉGLAGE FAIT 168 px à DROITE** : un aperçu de 280 px plus son explication n'y
tiennent pas, et les deux se CHEVAUCHAIENT. Rien ne débordait de la page — donc aucune mesure ne
le disait — et ça se voyait au premier coup d'œil. D'où `.reg--pleine`, pour ce qui est une
DÉMONSTRATION et non un champ.
⚠️ **L'aperçu est un VRAI champ**, avec les mêmes classes que le simulateur, pas une vignette
dessinée pour l'occasion : une vignette serait une seconde vérité, et elle finirait par montrer
autre chose que ce qu'on obtient.
⚠️ **TROIS NIVEAUX, ET L'ORDRE EST TOUT : appareil → société → repli.** Nicolas, le
10/10/2026 : « les changements ne doivent pas être opérés serveur, comme ça c'est régi par celui
qui décide ? ». **Le défaut, oui ; le réglage, non** — et la nuance est tout le montage.
`affichage.signal_effet` et `affichage.signal_couleur` sont des réglages SERVEUR (bouton
« Enregistrer », pastille « société ») : ils s'appliquent à tout appareil qui n'a jamais choisi.
Un appareil qui choisit garde son choix (`localStorage`, pastille « cet appareil »).
• **Pourquoi pas serveur SEUL** : Yannick changerait la couleur depuis son Android et l'écran de
  Nicolas changerait au milieu d'un devis, sans qu'il sache pourquoi. Et la lisibilité dépend de
  l'écran : un halo calibré sur un moniteur est trop discret sur un téléphone en plein soleil.
  Ce qui doit être RÉGI — quels champs bloquent une commande — l'est déjà dans `CHAMPS_REQUIS`,
  et personne ne peut le changer depuis Paramètres.
• ⚠️ **`SUIVRE` ('societe') est le CHEMIN DU RETOUR, et il est obligatoire.** Il n'est dans
  aucune des deux listes : il ne désigne pas un effet, il désigne l'ABSENCE de choix local, et
  le choisir EFFACE la préférence. Sans lui, un appareil qui a choisi une fois ne pourrait plus
  jamais revenir au réglage commun — et le défaut serveur deviendrait inutile pour tout le monde
  dès la première fois qu'on y touche. L'inscrire dans `EFFETS` en ferait au contraire une valeur
  enregistrable, donc un appareil porterait l'effet « societe », qui n'a aucune feuille de style :
  **plus rien ne s'allumerait, sans la moindre erreur.**
• ⚠️ **Les deux clés DOIVENT exister dans `config.js`** : `SSConf.fusionner` est une liste blanche
  sur DEFAUTS, donc une clé absente d'ici est silencieusement jetée à l'enregistrement.
• ⚠️ **`signal.js` se charge APRÈS `config.js`** sur les trois pages : il lit le défaut de la
  société au montage. Et il **remonte sa feuille quand les réglages arrivent** — `SSConf.get()`
  lit un CACHE, vide sur un appareil qui ouvre l'ERP pour la première fois, donc sans ce rappel
  il faudrait recharger la page pour voir le style de la maison. Uniquement si l'appareil n'a
  rien choisi : sinon on écraserait son choix une seconde après l'avoir affiché.
• ⚠️ **La resynchro des libellés « Comme la société · … » se fait APRÈS l'enregistrement**, pas
  sur le `change` du menu : le cache n'est réécrit qu'une fois le serveur d'accord
  (`SSConf.enregistrer`). Branchée sur le `change`, elle relisait l'ANCIENNE valeur et affichait
  « Comme la société · Halo » alors qu'on venait de choisir Pouls — un écran qui contredit le
  geste qu'on vient de faire.
• ⚠️ **Une valeur serveur abîmée retombe sur le repli du module**, jamais sur rien : sinon un
  réglage mal écrit éteindrait le signal sans que personne ne comprenne pourquoi.
⚠️ **UN RÉGLAGE SOCIÉTÉ SE PRÉVISUALISE AVANT D'ÊTRE ENREGISTRÉ.** Il part au serveur, donc
tant qu'on n'a pas cliqué « Enregistrer » le cache de `SSConf` porte encore l'ancienne valeur :
choisir une couleur ne changeait RIEN à l'écran. Nicolas : « quand je change la couleur ça
marche pas ». Il avait raison du point de vue qui compte — **un aperçu posé juste sous le menu
et qui ne bouge pas ne se lit pas « pas encore enregistré », il se lit « ça ne marche pas ».**
`SSSignal.previsualiserSociete` ajoute un quatrième niveau, VOLATIL : **appareil → aperçu →
société enregistrée → repli**. Il ne s'écrit nulle part, un rechargement le perd — et le bandeau
« réglage modifié, pas encore enregistré » de la page dit déjà que rien n'est acté.
⚠️ **Il ne passe JAMAIS devant le choix de l'appareil** : un appareil qui a choisi garde le sien
pendant qu'on règle le défaut de la maison, sinon on lui ferait croire que son réglage a sauté.
⚠️ **`regler()` annule l'aperçu, et l'écran le REPOSE ensuite.** Les deux répondent à la même
question ; les laisser actifs ensemble afficherait une couleur qui n'est ni l'une ni l'autre.
Mais sans le reposer, revenir à « Comme la société » ramenait l'ancienne valeur pendant que le
menu société affichait la nouvelle — deux endroits de la même page qui se contredisent. Les
écouteurs de la page sont posés APRÈS ceux de `monterSelecteurs`, donc ils repassent derrière.

⚠️ **PARAMÈTRES MÊLE DEUX NATURES DE RÉGLAGE, et ça doit SE VOIR.** La plupart partent au serveur
(bouton « Enregistrer ») ; décors de fête et choix d'appareil du signal ne partent nulle part et
s'appliquent à l'instant. **Un bouton gris après une modification ne se lit pas « déjà fait »,
il se lit « ça n'a pas marché »** — Nicolas a posé la question. D'où les deux pastilles
`« cet appareil »` et `« société »` à côté du nom de la ligne.

⚠️ **Les cases à cocher ne sont PAS signalées dans cette version**, et c'est en attente, pas un
oubli : aucune n'est dans `CHAMPS_REQUIS`, et Nicolas a préféré voir le résultat avant de
trancher (« je verrai le résultat et je te dirigerai »). La vraie question, quand on y
reviendra : **une case décochée veut-elle dire « non » ou « pas encore regardé » ?** Les deux
ont exactement la même tête à l'écran, et c'est tout le problème.

**37. UN ÉCHANGE E-MAIL SE CORRIGE, ET IL PORTE SES PIÈCES.**
Demande de Nicolas (10/10/2026) : « je sais pas modifier un échange ? ça serait intéressant. Et
pouvoir ajouter une image ou un PDF. » Un mail archivé est un COLLAGE : l'analyse devine
l'expéditeur, l'objet et le sens, et elle se trompe parfois. Sans correction, la seule issue
était de SUPPRIMER et de recoller — en perdant la date d'archivage et le rattachement au devis.
**Entre perdre ça et laisser une erreur, on laissait l'erreur.**
⚠️ **Écriture CIBLÉE sur le seul mail** (`PATCH /api/clients/:key/mail/:mid`, règle 3) : jamais
la fiche entière, qui écraserait les coordonnées corrigées ailleurs. Et les champs sont
**étalés sur l'existant** (règle 2) : un champ absent du corps de requête garde sa valeur, sinon
corriger un objet effacerait les pièces jointes et le devis rattaché.
⚠️ **La signature « modifié » n'est posée que si le TEXTE a changé** — même discipline que la
décision d'un sujet (règle 15 bis). Corriger un objet mal lu ou rattacher un devis n'est pas une
réécriture du message ; l'afficher ferait douter du contenu.
⚠️ **Les octets d'une pièce vivent dans R2, la ligne D1 ne garde que la métadonnée**, comme les
documents fournisseur. Et **pas de repli dataURL** ici, contrairement aux photos : une photo
d'ouverture perdue est gênante, un PDF de 15 Mo dans D1 casse la ligne pour tout le monde. Sans
la liaison R2 « DOCS », on le DIT plutôt que de dégrader en silence.
⚠️ **Liste blanche de types** (images + PDF) : une pièce jointe est le seul endroit où un
fichier venu de l'extérieur entre dans le système. Et la taille est refusée **avant** l'envoi :
le serveur refuserait aussi, mais après avoir téléversé 15 Mo en 4G sur un chantier.
⚠️ **La pièce ne se joint qu'À UN MAIL DÉJÀ ARCHIVÉ**, et c'est structurel : la route est
ciblée, donc elle a besoin d'un identifiant qui n'existe pas avant. On archive d'abord, on joint
ensuite — un mail se colle en deux secondes.
⚠️ **LE MÊME FORMULAIRE ARCHIVE ET CORRIGE** : c'est la même saisie, et un second formulaire
aurait fini par diverger du premier. Seuls le titre et le bouton changent, pilotés par
`MAIL_EDITE` — qui vit **hors du DOM** : dans un `data-`, il disparaîtrait au premier re-rendu
de la fiche et on enverrait une CORRECTION comme un nouvel archivage, donc un doublon (même
famille que `EDITE_POUR`, règle 15 bis). Et les champs sont marqués « touchés » à l'ouverture,
sinon `lireMail` les écraserait dès la première frappe avec ce qu'on est en train de corriger.
⚠️ **La fiche DEVIS montre les échanges, elle ne les édite pas** : « Corriger » ouvre la fiche
client sur le bon mail (`?mail=<id>`), exactement comme « Archiver un nouvel échange » y menait
déjà. Les mails vivent sur le CLIENT, pas sur le dossier ; un second éditeur aurait divergé.
Sans le paramètre, on atterrirait sur le CRM avec la consigne implicite de retrouver le bon mail
soi-même — le détour qu'on ne fait pas.

**38. UNE MISE EN ATTENTE ARRÊTE LA CADENCE SANS PERDRE LE DOSSIER.**
Demande de Nicolas (11/10/2026) sur un cas réel : relance 1 envoyée à Doris Zurstrassen, elle
répond par mail « je reviens vers vous en novembre » — et l'ERP réclamait la relance 2.
« Pouvoir arrêter ce décompte, mettre pourquoi, et me rappeler en novembre. »
⚠️ **LE PROBLÈME N'ÉTAIT PAS LA CADENCE, C'EST QU'ELLE NE SAIT RIEN DE LA CONVERSATION.** Elle
compte des jours depuis l'envoi ; elle ne peut pas savoir qu'une réponse est arrivée entre-temps.
Et **un écran qui réclame une relance qu'on ne fera pas, on apprend très vite à ne plus le
lire** — ce qui coûte AUSSI les relances qu'il fallait vraiment envoyer.
⚠️ **CE N'EST PAS UN STATUT DE PLUS, et c'est tout le choix de conception.** Un statut
« en attente » aurait fait perdre « où en est la cadence » (relance 1 faite), il aurait fallu le
remettre à sa valeur précédente ensuite, et personne ne le ferait. Une mise en attente **se pose
PAR-DESSUS** : les statuts continuent de fonctionner normalement, elle ne fait que REPOUSSER
l'échéance et porter le pourquoi. C'est exactement ce que Nicolas demandait : « que je puisse
laisser faire normalement, et si une info autre, arrêter ce décompte ».
⚠️ **DEUX CHAMPS, ET LES DEUX SONT OBLIGATOIRES** (le serveur le tient, pas seulement l'écran).
Le MOTIF : sans lui, trois semaines plus tard, on a un dossier gelé dont personne ne sait
pourquoi — même défaut que la décision d'un sujet (règle 16) et la réparation d'un ticket SAV
(règle 20 bis). La DATE : **une mise en attente sans date n'est pas une attente, c'est un trou**
— le dossier sortirait de tous les compteurs et ne reviendrait jamais. Et elle doit être dans le
FUTUR : une attente « jusqu'à hier » naît échue, donc elle n'a servi à rien.
⚠️ **L'ATTENTE S'ÉTEINT TOUTE SEULE.** Au jour dit elle devient échue, la cadence reprend où elle
en était, et **le motif s'affiche À CÔTÉ de la relance réclamée** — c'est au moment d'écrire le
message qu'on a besoin de savoir ce que le client avait dit. Aucun geste pour « réveiller » le
dossier : **un rappel qui dépend d'un geste n'arrive jamais.** « Revoir le 3 » veut dire que le
3, le dossier est DÉJÀ dans la liste du jour — d'où `echue` dès que la date est AUJOURD'HUI.
⚠️ **ELLE NE SUSPEND QUE CE QUI POUSSE LE CLIENT À ACCEPTER** : la cadence de relance, « devis
expiré » et « lien jamais ouvert » — les trois disent la même chose, et n'en faire taire qu'une
revenait à fermer une bouche sur trois. **Pas l'argent** (acompte, solde) : une facture émise est
une obligation, pas une conversation. **Pas le chantier** (commande, pose) : ça dépend de nous.
D'où `SSUI.attenteApplicable`, qui la limite aux devis qui attendent une réponse — signer un
devis l'éteint donc **sans aucune écriture**, et sans rien effacer de l'historique.
⚠️ **ELLE REPOUSSE L'ÉCHÉANCE, ELLE NE LA REMPLACE PAS** : `due = max(due, revoir_le)`. Si la
cadence tombe de toute façon APRÈS la date annoncée, c'est la cadence qui gagne — sinon mettre
en attente RAPPROCHERAIT la relance, l'inverse du but. Et `retard` se déduit de `due`, donc geler
la date suffit à faire taire les quatre écrans : **un drapeau « ne pas relancer » en plus,
c'étaient deux vérités à tenir d'accord.**
⚠️ **UN DOSSIER EN ATTENTE RESTE VISIBLE**, en GRIS et en dernier dans le bandeau
(« N en attente client », avec son filtre). Sans cette pastille il disparaîtrait de tous les
compteurs — et un dossier qu'on ne voit plus nulle part finit par s'oublier, **ce que la mise en
attente devait précisément ÉVITER**. Gris et pas ambre : la couleur dit l'ACTION (règle 21 bis),
et sur un dossier qu'on a mis de côté exprès il n'y a rien à faire.
⚠️ **LA RÉGLETTE S'ARRÊTE AUSSI** (état `pause` : repère creux, immobile). Demandé explicitement :
« jusqu'à la ligne du temps où l'on voit clairement où ça en est ». Une barre qui continue
d'avancer pendant que la cadence est gelée raconterait le contraire de ce qu'on vient de décider.
⚠️ **ÉCRITURE CIBLÉE** (`POST|DELETE /api/devis/:id/attente`, règle 3) et **invariant serveur** :
`upsertDevis` réinjecte `attentes` depuis la base, comme les commentaires. La fiche devis garde
un DEVIS complet en mémoire et le réenregistre au moindre changement de statut — sans l'invariant,
poser une attente puis changer le statut depuis un onglet resté ouvert l'effacerait en silence.
⚠️ **UNE ATTENTE LEVÉE N'EST PAS SUPPRIMÉE** : `attentes` est une LISTE, la courante est la
dernière non levée. Ce qu'on s'est dit avec le client est la mémoire du dossier — « elle avait
déjà demandé un report en juin » se lit sur la fiche, et c'est ça qu'on vient chercher.
Envoyer une relance LÈVE l'attente (on a repris la main) ; l'échec de cette levée est DIT, jamais
avalé — la relance, elle, est déjà enregistrée.
⚠️ **ELLE NE SORT JAMAIS VERS LE CLIENT** : `attentes` n'est pas dans la liste blanche de
`/api/devis-review` (règle 31 ter). « Le client est en vacances » n'a rien à faire sur une page
qu'il peut ouvrir.
⚠️ **ET LE DÉFAUT QUI A ÉTÉ TROUVÉ EN REJOUANT LE GESTE : `normDevis` EST UNE LISTE BLANCHE.**
Le moteur répondait juste, la fiche devis affichait « cadence gelée », les 20 tests passaient —
et le tableau de bord continuait de réclamer la relance, parce que SES devis passent par
`normDevis`, qui ne connaissait pas `attentes` et la jetait **en silence**. Invisible à la
relecture, invisible aux tests du moteur : il a fallu charger la vraie page avec un vrai devis
(règle 2, et « vérifier son travail » n° 5). **Toute nouvelle clé d'un devis doit se demander :
qui la reconstruit par liste blanche ?** Ici il y en avait trois : `normDevis`, la projection SQL
de `/api/devis`, et l'invariant d'`upsertDevis`.

**38 bis. UNE FENÊTRE QUI PROPOSE DEUX CHOSES OPPOSÉES SE LIT COMME DU DÉSORDRE.**
« Je trouve l'outil relance un peu trop brouillon » (Nicolas, 11/10/2026). Le défaut n'était
pas esthétique et il ne se corrige pas en reprenant les marges : **la fenêtre se contredisait.**
Elle annonçait en haut « cadence gelée — aucune relance ne sera réclamée », et proposait juste
en dessous un message de relance 2 tout rédigé avec un bouton « Marquer relance 2 envoyée ».
Deux intentions OPPOSÉES au même niveau : l'œil ne sait pas laquelle est la bonne, et il lit du
désordre. **Le message se replie donc quand la cadence est gelée** — on peut toujours relancer
(« Relancer quand même »), mais c'est alors un CHOIX, pas la pente naturelle de la fenêtre.
⚠️ **L'ORDRE EST CELUI DU RAISONNEMENT** : où ça en est → le parcours → ce que je fais
maintenant → le réglage. La date d'envoi trônait EN HAUT avec son champ de saisie alors qu'on y
touche une fois dans la vie d'un devis ; elle est en pied, repliée derrière « corriger la date ».
**Ce qu'on vient faire passe devant ce qui se règle une fois.**
⚠️ **UN SEUL NIVEAU D'ENCADRÉ.** Il y en avait trois emboîtés — la fenêtre, une boîte grise
dedans, la boîte d'attente dans celle-là. Trois bordures et trois fonds empilés : on ne sait
plus ce qui appartient à quoi. Les sections se séparent par de l'ESPACE, pas par un cadre de plus.
⚠️ **TROIS FORMATS POUR LA MÊME CHOSE, C'EST TROIS CHOSES.** Le suivi affichait
« R1 ✓ 03/10/2026 », « R2 — gelée jusqu'au 28/11/2026 » et « R3 — J+21 ». Même vocabulaire
pour les quatre jalons désormais. Et **une étape à venir ne porte PAS de date** : sa date de
plan est comptée depuis l'envoi, donc elle est souvent déjà PASSÉE sur un devis ancien (R3 à
J+21 sur un devis parti il y a 42 jours). **Une échéance fausse est pire que pas d'échéance.**
⚠️ **UN BOUTON ALIGNÉ AVEC QUATRE AUTRES PASSE POUR LE CINQUIÈME DE LA SÉRIE.**
« Marquer relance 2 envoyée » était au bout de la rangée Copier / Email / SMS / WhatsApp — or
ces quatre-là enregistrent DÉJÀ la relance. Il passait donc pour un cinquième moyen d'envoi, ou
pour une étape obligatoire de plus. Il est sorti de la rangée et porte son vrai rôle :
**« J'ai relancé autrement — noter R2 comme envoyée »** (téléphone, de vive voix).
⚠️ **ET LE DÉFAUT QUE LA REFONTE A FAILLI INTRODUIRE** : annuler une relance ne tenait plus
qu'à un POINT DE 12 PX, découvrable au seul survol. C'est la règle 33 à l'envers — un raccourci
sans son mot, et **sur téléphone il n'y a pas de survol**, donc muet là où il sert le plus. C'est
la COLONNE entière du jalon qui clique (~130 × 70 px), le libellé vire au rouge et le mot
« annuler » apparaît dessous — sa place est RÉSERVÉE, donc rien ne saute au survol.
⚠️ Deux pièges de style, mesurés sur l'écran et pas dans le code : **deux `<span>` l'un sous
l'autre sont en ligne** (le titre et le sous-titre du bandeau sortaient collés — « En attente du
clientReprise le 28/11 »), et **une espace ordinaire en tête d'un pseudo-élément est avalée**
(« Suivi de la relance —Doris »). Les deux demandent `display: block` et ` a0`.
⚠️ **UNE CLASSE D'ÉTIQUETTE NE DOIT PAS DÉPENDRE DE SON PARENT.** `.rl-k` était écrite
`.rl-row .rl-k` : la nouvelle étiquette « Envoyer par », qui n'est pas dans une `.rl-row`,
sortait en texte brut — et aucune mesure ne le signalait.

**40. LE TABLEAU DE BORD : COCKPIT, RELAIS, FIL DE L'AFFAIRE** (25/10/2026 — variantes « haut A +
relais B + bandeaux A » choisies par Nicolas sur maquettes). Protégé par `tests/dashboard.test.html`.
De haut en bas : le **cockpit** (bonjour, résumé du jour, 4 chiffres), le **poste** (« à faire
maintenant » + le **relais** avec l'autre), les **étapes** cliquables, la barre d'outils, la liste.
• **« À faire maintenant » nomme des DOSSIERS, pas des compteurs.** L'ancienne bande disait « 2 devis
  à relancer » : il fallait cliquer, puis lire la liste filtrée. Les cartes portent le client, l'action
  et le bouton qui y mène. Tri : ce que PERSONNE n'a pris d'abord (règle 15), puis le poids
  (`poidsAction` : perdu/gagné > pousser/chantier > rédiger), puis le plus ancien. QUI = vendeur pour
  une action de devis, le `qui` d'attente.js pour le reste. Quatre cartes au bureau, trois sur
  téléphone, « voir les N » déplie SANS quitter la page.
• **LE RELAIS REMPLACE LA FENÊTRE « QUOI DE NEUF »** qui s'ouvrait toute seule à l'arrivée : un
  ÉVÉNEMENT qui réclame l'attention au moment où l'on vient travailler (la leçon du cortège, règle
  28). C'est un ÉTAT : ce que l'autre a fait depuis le repère, ce qui l'attend, un mot pour lui.
  ⚠️ Le repère (`ss_activity_seen`) n'avance plus à chaque chargement mais sur « Tout vu », et
  jusqu'à la DERNIÈRE nouvelle affichée (pas « maintenant ») : ce qui arrive pendant qu'on lit
  revient au prochain chargement au lieu d'être perdu.
  ⚠️ **Le mot à l'autre est un SUJET des Échanges** (`pour` = l'autre), fabriqué par
  `SSUI.nouveauSujet` — la même fabrique que l'écran des Échanges (règle 10). Le champ ne se vide
  qu'APRÈS la confirmation du serveur (règle 6), et le formulaire n'est JAMAIS réécrit par le rendu
  (le tableau de bord se redessine à chaque retour d'onglet : un mot en cours de frappe partirait).
  ⚠️ **Sans identité connue, le relais se TAIT** : on ne devine pas qui est l'autre — un mot adressé
  à la mauvaise personne est pire que pas de mot.
  La PRÉSENCE (bandeau + relais) lit les battements déjà enregistrés (`/api/connections`) :
  « en ligne » = un battement depuis moins de 3 min (il part toutes les 30 s quand on travaille).
• **LE FIL DE L'AFFAIRE** (`filAffaire`) : Créé → Envoyé → relances → Signé → Posé → Payé. Il
  remplace les cinq points muets ET la jauge de vues (qui ajoutait une rangée de hauteur variable).
  L'étape en cours prend la couleur de l'ACTION (règle 21 bis), creuse et immobile si le dossier est
  mis en attente (règle 38), pulsante si le client est chaud. ⚠️ **Frise, action et montant ont des
  largeurs FIXES** : chaque ligne est sa propre grille, sans ça la frise tombait à une abscisse
  différente d'une ligne à l'autre (test B1). La légende ne répète PAS les pastilles de suivi.
• **CE QUI A ÉTÉ RANGÉ, PAS SUPPRIMÉ** : Export / Import / Journal / densité / masquer les chiffres
  → menu « Plus » (la sauvegarde y est masquée sur téléphone) ; statut, vendeur, produit et les
  situations « à traiter » → panneau « Filtres », chaque rangée NOMMÉE, sans défilement de côté ;
  « + Nouveau devis » et « Terrain » du bandeau → masqués au-delà de 1400 px, le rail les porte
  (règle 24) ; « En ligne » → le badge ne s'affiche plus que HORS LIGNE ; la pensée du jour → sous
  le bonjour. ⚠️ Les raccourcis au survol de la maquette (Note · Appeler · → Yannick) n'ont PAS été
  posés sur la ligne (règle 33 zero bis) : « Demander à … » vit dans le menu ⋯ (porte de la règle 19).
• **SIX DÉFAUTS TROUVÉS EN ENQUÊTANT**, chacun tenu par un test :
  1. un DÉPANNAGE signé réclamait un acompte et une commande (règle 7) ;
  2. un chantier jamais commandé réclamait une date de pose (règle 15 ter) — désormais « Matériel à
     commander », puis rien pendant que la balle est chez le fournisseur, puis la date ;
  3. trois situations comptaient une population et en filtraient une autre (« à relancer » comptait
     les relances DUES et filtrait « 7 jours dans le statut ») → `SITUATIONS`, UN prédicat lu par le
     compte ET par le filtre ;
  4. trois réglages des Paramètres n'étaient lus par personne (`vue_defaut`, `densite`,
     `kpi_replies`) — même famille que la règle 29 bis ; ordre appareil → société → repli ;
  5. un mot de plus de 200 caractères perdait sa fin (titre borné, rien ne gardait le reste) ;
  6. sur téléphone le premier devis tombait à 1 147 px : la bande prenait tout le premier écran.
• **TÉLÉPHONE** : le premier devis commence dans le premier écran (test T3). Les actions deviennent
  des BANDES (nom + action + bouton), les étapes tiennent sur une rangée en libellé court, le relais
  se replie dès qu'il passe sous les cartes (≤ 1100 px, par la seule media query).
• **« SIGNÉ CE MOIS »** lit `SSUI.dateSignature` (déménagée de `stats.html` : deux copies n'auraient
  pas compté le même mois). L'anneau n'existe que si `usage.objectif_mensuel` > 0 (Paramètres) :
  mieux vaut pas de cible qu'une cible inventée.

**40 bis. LES BANDEAUX, AU DÉTAIL PRÈS** (retour de Nicolas sur la production, 25/10/2026, capture
à l'appui : « il faut qu'ils soient impeccables, précis dans le détail »). Chaque point ci-dessous
est un défaut VU sur de vraies données, et tenu par un test de `dashboard.test.html` (cas L, T, M).
• **Chaque chose dite UNE fois, à SA place.** La pastille d'action dit QUOI faire (et QUAND pour
  une mise en attente : « En attente · revoir le 28/11 ») ; la légende de la frise dit DEPUIS
  QUAND (« envoyé il y a 26 j · non ouvert ») ou POURQUOI (« « Le client revient vers moi » »,
  en italique) ; les pastilles de gauche disent l'ÉTAT (statut, commande, pose) ; sous le montant,
  l'ARGENT (« soldé ✓ », « en retard · reste … », « reste … » — `argentHtml`). Avant : la date
  d'attente en double, le statut répété dans la colonne d'action (« Signé » à côté de SIGNÉ).
• **Les libellés d'action tiennent en ~32 caractères** : c'est la colonne (« Accepté en ligne — à
  faire signer », « Expiré — à relancer ou classer », « Posé et soldé — à clôturer »). Le détail
  (vues, motif d'une attente échue) est dans l'infobulle, sous la frise, et sur la carte du cockpit
  (qui a deux lignes et prend la phrase complète). ⚠️ Une pastille trop longue DÉBORDAIT VERS LA
  GAUCHE par-dessus la frise : une case de grille calée à droite (`justify-self: end`) prend la
  largeur de son contenu ; elle est désormais étirée (`stretch`), et c'est la pastille qui cède.
• **Les largeurs se CALCULENT sur le texte le plus long** (190 px de légende, 260 px d'action à
  ≤ 1250 px), elles ne s'estiment pas. Sous 1100 px la ligne passe sur deux rangées — identité +
  montant, puis frise + action CÔTE À CÔTE (`.m-bas`, transparent au bureau) : empilées, elles
  faisaient 178 px par devis. Sur téléphone, la légende passe SOUS la frise (pleine largeur).
• **Une pose À VENIR n'est pas faite, même avec un PV** (`poseAVenir`) : un chantier en deux poses
  (École du Bonheur) affichait « soldé ✓ » et rien ne prévenait de préparer la seconde. Et un
  chantier posé n'est jamais « à commander » (l'ambre disait « à toi » sur du matériel au mur).
• **« Rien à faire » se DIT** dans la colonne d'action ; un dossier posé, payé et toujours « signé »
  reçoit « Posé et soldé — à clôturer » (poids FAIBLE : c'est du rangement, pas une urgence).
• **Les relances sont des perles SUR le trait envoyé → signé** : collées au nœud, elles coupaient
  la ligne et faisaient un amas. Une fois signé, seules celles réellement faites restent.
• **Méthode** : on juge un bandeau à la LOUPE (une copie de la ligne agrandie par `transform`, la
  capture d'écran étant réduite de moitié) ET par la mesure (`scrollWidth > clientWidth` pour ce
  qui est coupé, chevauchement des boîtes) — à 1560, 1250, 1100, 1000 et 375 px, sur des données
  qui ont la forme des vraies (motifs longs, chantiers en deux poses, liens jamais ouverts).

**41. L'ASSISTANT (Claude) LIT AVEC LES RÈGLES DES ÉCRANS ET N'ÉCRIT QU'APRÈS UN CLIC** (25/10/2026 —
choix de Nicolas : un panneau sur toutes les pages, lecture + actions confirmées, Claude Opus 5.5).
Protégé par `tests/assistant.test.html`. Mise en service de la clé : DEPLOIEMENT.md, étape 10.
• **Le serveur ne fait que parler à Claude** (`routeAssistant`, en bas de `[[catchall]].js`). Les
  OUTILS tournent dans le navigateur avec `SS.*`, `SSActions`, `SSUI` : mêmes règles, mêmes routes
  ciblées (règle 3), même identité Access. Un outil qui relirait la base côté serveur serait une
  seconde implémentation des mêmes réponses (règle 10).
• **« À faire », les chiffres et « actifs » viennent de `assets/js/actions.js`**, sorti du tableau de
  bord pour ça. Il ne lit JAMAIS une variable de page : les listes lui sont passées en FONCTIONS —
  une copie passée une fois garderait les factures du premier chargement (test M4).
• **Trois écritures, toutes des CARTES à confirmer** : un mot à l'autre (sujet des Échanges), une
  note interne sur un devis, une mise en attente. Ni suppression, ni changement de statut, ni envoi
  au client (test S16). Ajouter une écriture = une carte + une route ciblée qui existe déjà + un test.
• **La conversation ne se réécrit jamais.** Elle repart entière à chaque tour, et l'API refuse un
  historique retouché (les blocs de réflexion sont liés à ce qui les précède). On AJOUTE : une carte
  laissée sans réponse reçoit « annulée » en tête du message suivant, un tour échoué voit la question
  suivante compléter le même message, un refus sans un mot reçoit un texte de remplacement — jamais
  un message vide, jamais deux messages de suite du même côté (tests C).
• **Soli, la mascotte, est LA porte d'entrée** (en bas à droite, toutes les pages qui ont un menu ;
  dessin unique `SSNav.mascotte`, dans `nav.js`) : un soleil qui porte en lunettes l'écran bleu du logo.
  Le menu n'a plus d'entrée « Assistant » — deux portes pour la même pièce, c'est une de trop.
  Au bureau, une FENÊTRE au-dessus de Soli (pas un panneau pleine hauteur : il recouvrait le relais).
• **Sur téléphone, « retour » ferme l'assistant** (étape d'historique posée à l'ouverture, retirée par
  « Fermer » ; un lien suivi depuis le panneau retire l'étape AVANT de partir). Et le panneau ne se
  rouvre JAMAIS tout seul en changeant de page : il le faisait, et chaque « retour » y renvoyait —
  Nicolas restait enfermé dedans (25/10/2026). « Fermer » s'écrit en toutes lettres.
• **Un outil donne à Claude des PHRASES, jamais des champs bruts qui se contredisent en apparence.**
  Sur l'École du Bonheur (posée en deux fois), « pose faite : oui » + « date de pose : 29/10 » + commande
  « Posé » lui ont fait diagnostiquer une incohérence et proposer de « corriger » des données justes
  (25/10/2026). La pose se dit maintenant en une phrase, avec la règle du tableau de bord (`poseAVenir`) :
  « première pose faite (PV), la suite est prévue le … », et les repères du métier le disent aussi.
• **Soli prend le style du THÈME** (une palette par thème, en variables `--ssm-*` dans `nav.js` :
  Pro = la marque, Néon, Cyberpunk lumineux, Zen doux, Ardoise) et, pendant une fête si les décors
  sont allumés, l'accessoire de la saison (`ACCESSOIRES` : sorcière, mitre, bonnet, chapeau de fête,
  toque). Le dessin ne change pas : ajouter un thème = ajouter sa palette. Il réfléchit (rayons qui
  tournent) pendant que l'assistant travaille, et saute quand la réponse arrive.
• **La fenêtre se déplace (l'en-tête), se redimensionne (bords et coins, minimum 340 × 380), s'aimante
  aux bords, garde sa place et sa taille d'une page à l'autre** (`ss_assistant_fenetre`, propre à
  l'appareil) — et elle est TOUJOURS ramenée dans l'écran. Double-clic sur l'en-tête : sa place par
  défaut. Une question commencée survit au changement de page. Rien de tout ça sur téléphone.
• **Soli ne se pose jamais sur une barre collée en bas d'écran** (Mode Terrain, Paramètres) : il monte
  au-dessus. Une nouvelle barre de ce genre prend `data-barre-bas` (liste `BARRES_BAS`, nav.js).
• **L'identité Access est exigée (403 sinon)** : l'aperçu d'une branche n'est pas derrière Access, et
  n'importe qui y dépenserait le crédit. Plafond par personne et par jour (table `assistant_usage`,
  150 appels, `ASSISTANT_PLAFOND_JOUR`) ; le vrai garde-fou reste la limite de dépense de la console.
• **La clé `ANTHROPIC_API_KEY` vit dans les secrets chiffrés de Cloudflare Pages**, jamais dans le
  dépôt (public), jamais dans une conversation.
• **Un lien ne s'affiche que vers l'ERP** (`/app/…`), `tel:` ou `mailto:` : un lien inventé reste du
  texte (test L2). Le texte de Claude est échappé AVANT sa mise en forme.
• **Ce qui part chez Anthropic** : ce que renvoient les outils (noms, coordonnées, montants). Les
  bénéfices des vendeurs en font partie — le prompt interdit de les reprendre dans un texte destiné
  à un client.
• **Pas de SDK : un appel HTTP direct** (`fetch` vers l'API Messages, `anthropic-version: 2026-10-21`,
  flux SSE relu par `assistantLireFlux`). Le SDK officiel a été essayé le 25/10/2026 : il importe des
  modules Node (`child_process`, `fs`, `os`…) que Cloudflare Pages ne compile pas sans `nodejs_compat`
  — le build de l'aperçu a ÉCHOUÉ. Activer ce réglage changerait le moteur de TOUT le backend ;
  Nicolas a choisi l'appel direct. Aucun `package.json` : le site se publie toujours sans étape de
  build. Ne pas réintroduire le SDK sans ce réglage ET un aperçu vert.

**42. LA PAGE CLIENTS NE CALCULE RIEN À SA FAÇON** (revue du 25/10/2026, propositions A à E choisies
par Nicolas). Protégé par `tests/clients.test.html`.
• **L'argent et l'action d'un client viennent d'`actions.js` (`bilanDevis`)** : signé et « chez lui »
  sur les devis NON archivés (comme le cockpit), encaissé et reste dû sur TOUTES ses factures (l'argent
  ne s'archive pas, notes de crédit déduites par `SSUI.duFacture`), action = la plus urgente de ses
  devis (même poids que « À faire maintenant »). Le « CA signé » du haut EST `chiffres().caSigne`.
  Avant : le CA signé comptait les archivés, le « CA » par client comptait les devis REFUSÉS.
• **Le statut d'une facture vit dans `ui.js`** (`statutFacture`, `badgeFacture`, `factureEnRetard`,
  `TYPE_FACTURE_LABEL`), partagé avec la Facturation. La copie de la fiche client affichait un avoir
  « Soldée » et la facture qu'il annule « Impayée ».
• **Enregistrer une fiche ne réécrit QUE les devis dont le téléphone, l'e-mail ou l'adresse diffèrent**,
  et avec détection de conflit : avant, une étiquette ajoutée réécrivait tous les devis du client
  (date de modification avancée, faux « modifié par quelqu'un d'autre » chez l'autre).
• **Doublons : l'ERP SIGNALE, il ne fusionne rien** (panneau « À ranger », et alerte dans « Nouveau
  client »). La clé « nom|prénom » ne pardonne ni faute ni accent. Un numéro bouche-trou (six chiffres
  identiques de suite) n'identifie personne.
• **Pas d'étiquette « À relancer » ni « Chaud » en raccourci** : l'ERP les calcule. Les étiquettes
  existantes restent affichées.
• **Téléphone : « retour » revient à la liste** (étape d'historique à l'ouverture d'une fiche ; pas
  d'étape quand on ARRIVE sur une fiche par `?key=`, pour que « retour » ramène d'où l'on vient).

**43. LES MAILS DE RELANCE PARTENT DE L'ERP — CONSTRUIT AVANT D'ÊTRE BRANCHÉ** (26/10/2026, demande
de Nicolas : « mettre les boutons inaccessibles pour l'instant, en construction, comme ça le jour où on
se décide on n'a plus qu'à brancher »). Protégé par `tests/mails.test.html`. Mise en service :
DEPLOIEMENT.md, étape 11.
• **Ce qui manque se lit à UN endroit** : `GET /api/mail/etat` répond `pret` et `manque` (`cle` = le
  secret `SMTP2GO_API_KEY`, `expediteur` = l'adresse d'expédition des Paramètres). Tant que quelque
  chose manque, la fenêtre de relance montre « Envoyer le mail » GRISÉ, dans un cadre en pointillés
  marqué « En construction », avec ce qui manque — et la section E-mails des Paramètres dit pareil.
  L'état est redemandé à chaque ouverture : la clé posée, le bouton s'allume sans recharger.
• **Les trois réglages (`mail.expediteur`, `mail.reponse`, `mail.nom`) sont VIDES par défaut** : ce
  sont des décisions, pas des préférences. Une adresse proposée par défaut partirait chez les clients
  sans que personne l'ait choisie. Paramètres les propose en grisé (placeholder).
• **Le SERVEUR choisit l'expéditeur** (relu dans `settings`), jamais le navigateur ; l'identité Access
  est exigée (403). Le nom affiché est en ASCII (« Nicolas | SolariScreen ») : un nom mal encodé
  s'afficherait « =?utf-8?… » chez le client.
• **Envoyer = les mêmes conséquences que les quatre autres canaux** (`markRelanceSent({ auto: true })` :
  relance notée, attente levée) **+ l'archive dans la fiche client**, faite par le SERVEUR dans la même
  requête (`archiverMailClient`, la même écriture ciblée que l'archivage à la main — règle 3). La fiche
  CRM est créée avant l'envoi si elle n'existe pas. L'archive est une SUITE de l'envoi : un mail parti
  mais pas archivé est dit comme tel (« Mail envoyé ✓ — mais PAS archivé »), jamais comme un échec.
• **Ne jamais dire « pas parti » quand on ne sait pas** : SMTP2GO peut répondre 200 avec `failed > 0`
  (échec), ou accepter une adresse sur deux (le mail EST parti, l'adresse refusée est nommée), ou ne pas
  répondre du tout (« impossible de savoir — regarde l'activité SMTP2GO avant de réessayer », sinon le
  client le recevrait deux fois).
• **Aucune file d'attente hors-ligne** : un mail mis en file partirait des heures plus tard, peut-être
  après une relance faite autrement. Un retour à la ligne dans l'objet est aplati (injection d'en-tête),
  5 destinataires au plus, 60 envois par personne et par jour (`MAIL_PLAFOND_JOUR`), journal D1
  `mail_journal`.
• **L'objet est un champ** de la fenêtre (« Objet (e-mail) »), utilisé aussi par le bouton Email : il était
  écrit en dur dans le lien `mailto:`.
• **Pas encore fait, et c'est volontaire** : l'envoi groupé des « relances du jour » et le rappel de
  paiement de la Facturation. On les construit APRÈS les premiers vrais envois (mail-tester, réponses
  qui arrivent bien dans Zoho) : un envoi groupé sur un circuit qui n'a jamais envoyé un seul mail
  réel, c'est multiplier une erreur qu'on n'a pas encore vue.

**44. LA CARTE DIT OÙ ALLER ET QUOI Y FAIRE** (26/10/2026 — revue de la page, propositions A à G choisies
par Nicolas sur maquette). Les calculs vivent dans `assets/js/carte.js` (`window.SSCarte`, fonctions
pures) ; protégé par `tests/carte.test.html`.
• **Quatre modes** : Tournée (par défaut — les rendez-vous de la semaine du Planning, numérotés dans
  l'ordre de chaque jour, avec l'itinéraire du jour), À faire, Tous, Secteurs ; et « Autour de moi ».
• **La couleur d'un point est celle de l'ACTION** (`SSActions.prochaineAction` sur `SSUI.normDevis`,
  règle 21 bis) — la même que le tableau de bord, pas une table de statuts recopiée. Un ticket SAV
  ouvert et une demande de visite pas encore fixée sont aussi des choses à faire sur place.
• **Un point par client** (`SSCarte.grouper`) : ses dossiers réunis, l'action la plus lourde, l'adresse
  du dossier le plus récent. Des points au même endroit s'écartent en spirale, TOUJOURS pareil
  (`ecarter`) : l'ancien décalage au hasard faisait bouger la carte et dédoublait les clients.
• **« Autour de… »** (10 km, `autourDe`) sur un client ou un arrêt de la tournée : une sortie, plusieurs
  dossiers avancés. **Réalisations proches** (2 km, `realisationsProches`) sur un prospect : un NOMBRE
  et la phrase à dire, jamais les noms des autres clients. **Secteurs** : tout l'historique, archives
  comprises, taux = signés ÷ (signés + refusés). **Autour de moi** : la position ne quitte pas l'appareil.
• **L'adresse exacte, mémorisée sur l'appareil** (`ss_geo_adresses`) : la commune tout de suite (code
  postal), puis la rue chez OpenStreetMap (Nominatim) — ⚠️ choix de Nicolas : l'adresse sort de l'ERP,
  c'est le prix de la précision. **Une requête par seconde au plus et une seule fois par adresse** (règles
  d'usage de Nominatim) ; une adresse introuvable n'est redemandée qu'après 30 jours ; sans réseau, la file
  s'arrête. Un point placé à la commune a un bord en pointillés et les distances le disent.
  Cette mémoire se lit par `SSCarte.lireGeo` / `ecrireGeo` / `positionDans` (clés `cleGeoAdresse`,
  `cleGeoCommune`) : le portfolio s'en sert aussi (règle 45), sans jamais interroger Nominatim lui-même.
• **La liste suffit** : l'ancienne carte rechargeait CHAQUE devis complet, photos comprises, pour en lire
  l'adresse. Le résumé d'un dossier vient de `SSUI.resumeDevis` (la copie locale écrivait « 2 Tente
  solaires » et comptait une quantité 0 pour 1).
• **La carte n'enferme plus le défilement** : sur écran tactile, un doigt fait défiler la PAGE et deux
  doigts déplacent la carte (`dragging` coupé, `touch-action: pan-x pan-y`) ; au bureau, la molette fait
  défiler la page et Ctrl + molette zoome. Un mot l'explique au geste. Sans Leaflet (réseau), la page le
  dit et les listes restent utilisables. Le cadrage ne suit que ce qui est affiché.
• ⚠️ **Tester Leaflet dans un cadre hors écran** : ses animations de zoom ne se terminent jamais (même
  piège que les transitions) — couper `map._zoomAnimated` avant de mesurer un zoom, sinon un test de
  molette passe à tort (vérifié par mutation).

**45. LE PORTFOLIO EST CE QU'ON MONTRE : rien n'en sort qui trahisse un fournisseur ou un autre client**
(26/10/2026 — revue de la page, propositions A à G choisies par Nicolas sur maquette). Les règles vivent
dans `assets/js/vitrine.js` (`window.SSVitrine`, fonctions pures) ; protégé par `tests/portfolio.test.html`.
• **Des couleurs qu'un client lit** (`couleurLisible`, `toileLisible`) : « 7016 Gris anthracite », jamais
  la référence de commande Harol que le nuancier écrit (« · réf. 7m16st (laque texturée) ») — même raison
  que l'encadré du devis (règle 31). La TOILE d'un screen passe avant la couleur du caisson : c'est elle
  qu'on voit, et elle n'apparaissait nulle part.
• **Jamais le nom d'un autre client sur ce qu'on montre** : ni sur la carte d'une réalisation (« Voir la
  fiche → » seul), ni en présentation, ni dans le PDF, ni dans « Autour de… », qui nomme la COMMUNE et
  jamais le prospect. Le nom reste cherchable dans la barre de recherche : c'est un outil de bureau.
• **A — Mode présentation** : plein écran, une photo à la fois, glisser / flèches / Échap ; légende =
  produit, couleurs, ville, distance (ni nom ni prix). Sur téléphone, « retour » le ferme (une étape
  d'historique, comme les fenêtres de la règle 13 bis). La photo suivante est préchargée.
• **B — Près de chez le client** : un prospect (devis envoyé ou relancé, demande de visite ouverte) ou une
  commune, et un rayon (2 à 20 km, ou toutes par distance). Les positions viennent de la mémoire de la
  carte (règle 44) ou du code postal. **Le portfolio n'interroge jamais Nominatim** : une vitrine qu'on
  ouvre devant un client n'envoie pas d'adresse à un service tiers.
• **C — Avant / après** : la première photo « avant » et la première « terminé » du journal de chantier,
  comparées au curseur, et seulement si les DEUX existent (une moitié vide ne compare rien). « Avant » ne
  sort QUE là ; « problème » et « réserve », jamais (`PHASES_VITRINE`).
• **D — Choisir les photos** : la couverture (`portfolio_couvertures`, par ouverture) et les photos
  masquées (`portfolio_masquees`) sont écrites SUR LE DEVIS, donc communes à Nicolas et Yannick ; masquer
  n'efface rien. Le devis est RELU avant d'être enregistré (`ecrireDevis`), jamais réécrit depuis la
  liste. Clés au premier niveau du devis : la fusion d'`upsertDevis` les garde quand le simulateur
  enregistre sans elles (même question que la règle 30 ter).
• **E — PDF client** : couverture (logo, accroche, portée « près de … (moins de N km) »), deux photos par
  réalisation, coordonnées de la société. Ni nom de client, ni référence fournisseur, ni prix.
• **F — Filtre par teinte** (`teintes`) : les RAL de caisson présents, avec leur pastille, du plus fréquent
  au plus rare. **G — Ce qui manque à la vitrine** (`manquants`) : les chantiers POSÉS qui n'y sont pas —
  avec photos (« Ajouter », refusé si rien n'est montrable : `montrable`, même règle que le bouton de la
  fiche devis) ou sans (lien vers le journal : une photo à prendre au prochain passage). Lu sur la LISTE
  (`photos_count`, `chantier_photos_count`) : aucun devis rechargé pour ça.
• **Téléphone** : la première réalisation commence dans le premier écran ; « Près de… » tient en trois
  rangées (prospect · commune · rayon) au lieu de se couper au hasard.

**46. LE BAC À SABLE : on essaie sur une base d'ESSAI, jamais sur la vraie** (26/10/2026 — demande de
Nicolas : « des tests avec un client fictif et des simulations tous azimuts »). Mise en place :
DEPLOIEMENT.md, étape 12. Remplissage : `tests/bac-a-sable.html`. Protégé par `tests/bac-a-sable.test.html`.
• **Pourquoi pas en production** : une facture d'essai consomme un vrai numéro (règle 5) ; le CA, le
  cockpit et les compteurs de l'autre comptent le faux client ; le journal d'activité en garde la trace.
• **Les aperçus de branche ont leur base** (`solariscreen-essai`, liaisons de l'environnement Preview)
  **et sont derrière Access — Access D'ABORD** : le dépôt est public et l'adresse d'un aperçu se devine,
  une base branchée sur un aperçu ouvert serait une API ouverte.
• **Un aperçu se VOIT** (`SSUI.hoteBacASable`, décidé sur le nom d'hôte, sans requête) : bande hachurée
  PEINTE sous le bandeau, pastille « Essai » en `::before` du libellé de page (elle survit si la page
  réécrit ce libellé), « ESSAI · » dans le titre de l'onglet. Rien ne change de taille : le bandeau est
  fixe et sa hauteur mesurée (tests B3 à B5 de `nav.test.html`). Hachures et non une teinte : ici chaque
  couleur dit une action (règle 21 bis).
• **Trois gardes avant la première écriture** (`SSBacASable.verifier`) : l'hôte est un aperçu ; une
  identité Access répond ; la base est vide, porte des dossiers `ESSAI-` ou la fiche-marqueur
  « Bac à sable ESSAI ». La troisième ne dépend d'aucun réglage Cloudflare : la PRODUCTION branchée par
  erreur sur Preview est refusée (test G5). Les gardes lisent la base SANS repli sur le cache du
  navigateur — `SS.list*` y retombent, et un cache vide laisserait passer une base illisible.
• **La fiche-marqueur** est posée en premier et jamais retirée par « Vider » : sans elle, une base d'essai
  vidée qui garde un devis saisi à la main ressemble trait pour trait à une vraie, et serait refusée pour
  toujours (tests V2 et V3).
• **Vingt et un dossiers, un par situation que le tableau de bord reconnaît** — brouillon, relances 1 et 2,
  mise en attente, accepté en ligne, acompte à encaisser, chez le fournisseur, pose à planifier, chantier à
  préparer, solde en retard, soldé au portfolio, refusé, expiré, dépannage fait et à faire, SAV, archive,
  devis informatif, données abîmées, SAV hors garantie — plus cinq demandes de visite, trois sujets, deux
  exceptions de planning et un quasi-doublon de fiche. Côté SAV (règle 47, tests R14 à R16) : une pièce
  commandée (ESSAI-11), un ticket réparé avec son passage (ESSAI-12), un ticket confié (ESSAI-17) et un
  ticket HORS garantie sans personne depuis neuf jours (ESSAI-21) — écrit dans le devis et non par la
  route, parce que le serveur date un ticket « maintenant » et que c'est son ANCIENNETÉ qu'il faut voir.
  Côté outillage (règle 48, test R17) : six références (deux fournisseurs dont un prix ancien, une sans
  catégorie, une apostrophe, une photo laissée dans la base pour essayer « Alléger »), deux kits, et des
  chevilles « à racheter » par la route ciblée — la pose de l'école (ESSAI-10) remplit « À emporter ». Le test R10 vérifie CHAQUE dossier avec la vraie règle
  (`SSActions`) sur la liste telle que le serveur la projette. Noms à apostrophe (L'Hoest,
  Braine-l'Alleud), accents, TVA 21 %.
• **Faux par construction** : e-mails en `@exemple.invalid` (ne peut rien recevoir, RFC 2606),
  téléphones « 0000 … » (ne compose rien), « Rue de l'Essai », photos dessinées. Les communes et codes
  postaux sont réels : carte, météo et portfolio s'en servent.
• **Rien d'inventé** : montants du vrai moteur (`SSCalc.computeDevis`, réglages par défaut), factures
  numérotées par le serveur de la base d'essai, encaissements, attentes, notes et tickets SAV par LEURS
  routes ciblées (auteur signé par le serveur, règle 3).
• **Rejouable** : « Remplir » réécrit devis, demandes, sujets et congés avec des dates RELATIVES au jour
  même ; une facture, une note, un ticket ou une attente déjà posés ne sont pas recréés (test R4).
  **« Vider » ne retire que ce que la page a posé** — ce qu'on saisit à la main pendant un essai reste.
• **Le test joue le VRAI serveur** : `[[catchall]].js` importé dans la page, une vraie base SQLite en
  mémoire (sql.js 1.10.3 depuis cdnjs, fonctions JSON comprises), une surface D1 réduite à
  `prepare / bind / first / all / run` — aussi stricte que D1 (un `undefined` lié lève une erreur) — et un
  faux réseau qui pose l'en-tête Access. C'est le seul banc qui rejoue des écritures de bout en bout sans
  Cloudflare : **à réutiliser pour toute nouvelle route** — il vit dans `tests/banc-serveur.js` depuis le
  27/10/2026 (`window.SSBanc`, règle 47). Vérifié par mutation (garde « vraie base », doublons de
  factures, champs privés envoyés).
• ⚠️ **Jamais de clé SMTP2GO dans l'environnement Preview** : un essai ne doit pas pouvoir envoyer de mail.
• **BRANCHÉ le 27/10/2026.** Adresse fixe : `essai-bac-a-sable.solariscreen-erp.pages.dev` (branche
  `essai/bac-a-sable`, la production telle quelle plus un commit vide — jamais fusionnée). Access :
  application « solariscreen-erp - Cloudflare Pages » sur `*.solariscreen-erp.pages.dev`, stratégies
  « Allow Members » + « Equipe SolariScreen ». Tous les aperçus partagent la MÊME base d'essai.
• ⚠️ **Ce que seul le vrai Cloudflare montre** (trouvé en jouant le bac à sable, invisible en local) :
  - l'adresse d'une branche est **tronquée à 28 caractères** (`amelioration/bac-a-sable-scenarios` →
    `amelioration-bac-a-sable-sce.…`) : lire l'adresse dans le rapport de build, ne pas la deviner ;
  - **une adresse inexistante ne répond PAS 404** : faute de `404.html`, Pages sert une autre page sans
    rien dire — un lien cassé dans l'ERP passe inaperçu en ligne, alors que le serveur de test, lui,
    répond 404 ;
  - le traceur Web Analytics de Cloudflare (`cloudflareinsights.com`) remplit la console d'erreurs CORS
    sur les aperçus : c'est du bruit côté Cloudflare, sans effet sur l'ERP.

**47. LA PAGE SAV EST UNE FILE DE TRAVAIL : QUI s'en occupe, DEPUIS QUAND, et CE QUI A DÉJÀ ÉTÉ FAIT**
(27/10/2026 — revue de la page, propositions A à G choisies par Nicolas sur maquette). Les règles vivent
dans `assets/js/sav.js` (`window.SSSav`, fonctions pures) ; protégé par `tests/sav.test.html`.
• **A — La file.** Une ligne de résumé remplace les trois tuiles (317 px sur téléphone : les boutons du
  premier ticket passaient sous l'écran). L'ordre EST le raisonnement de la règle 15 : ce que PERSONNE
  n'a pris, puis ce qui est en retard (échéance dépassée, ou pièce pas arrivée à la date prévue), puis le
  plus ANCIEN. Avant, le plus récent passait devant : le client qui attendait depuis trois semaines
  finissait en bas. L'âge est sur chaque carte (gênant à 3 jours, criant à 7 : `SSAttente.SEUILS`). Les
  réparés sont repliés derrière un bouton. ⚠️ Les étapes PASSENT À LA LIGNE, elles ne coupent jamais :
  « Pris en ch… » et « Yannick · 01/… » cachaient l'étape et l'échéance (vu sur l'aperçu, invisible aux
  mesures de débordement de la page) ; le chantier s'écrit SOUS le nom, sur toute la largeur.
• **Quatre étapes** (`SSUI.SAV_STATUTS`, libellés dans `SAV_STATUT_LABEL`, partagés avec la fiche devis) :
  Ouvert → Pris en charge (`en_cours`) → Pièce commandée (`attente_piece`) → Réparé.
  ⚠️ **Un nom posé suffit à « pris en charge », et c'est le SERVEUR qui le fait** (`ouvert` + `pour` →
  `en_cours`) : « Je prends » laissait le ticket « Ouvert », et la colonne « En cours » ne contenait que
  les tickets ROUVERTS. Corollaire, trouvé en relisant la route : **la page n'envoie jamais `en_cours`
  elle-même.** « Je prends » n'envoie AUCUN statut — sinon une pièce commandée sans responsable
  reculait en « pris en charge » et son attente disparaissait (test N12) ; « Pièce reçue » et « Rouvrir »
  envoient `ouvert`, que le serveur relève s'il y a un nom. Un statut inconnu garde celui d'avant.
• **Pièce commandée** (`piece_prevue`, `piece_note`) : la balle est chez le fournisseur. `attente.js` la
  liste sans peser tant que la date prévue n'est pas passée, puis « Pièce SAV en retard » (urgent) :
  c'est à nous de relancer Harol. La date est exigée : sans elle, rien ne dit quand s'inquiéter.
• **D — L'historique des passages** (`passages`, `SSUI.savPassages`) : chaque clôture AJOUTE une ligne
  datée et signée par l'identité Access. ⚠️ Avant, une seule « résolution » : reclore un ticket rouvert
  effaçait la première réparation, et la signature restait celle du premier réparateur — Yannick
  réparait, le ticket disait « Nicolas ». Un ticket clos AVANT l'historique voit son ancienne résolution
  reprise comme premier passage (`p0`), au serveur à la première écriture et à l'écran dès la lecture.
  Les champs à plat (`resolution`, `cause`, `resolu_par`) restent le miroir du DERNIER passage, pour les
  appelants d'avant. Un ticket ROUVERT montre ses réparations en « Passages précédents », jamais
  « Réparé : » en vert — la fiche devis le faisait, sur un ticket qui ne l'était plus.
• **B — Nouveau ticket SUR PLACE** (fenêtre `#modalNew`) : le chantier se cherche par client, ville ou
  numéro, avec son résumé (`SSUI.resumeDevis`) et ses tickets ; seuls les devis SIGNÉS (`savPossible`,
  règle 20) — la page disait « chantier posé ». Description obligatoire, photos du constat, qui s'en
  occupe (un nom propose une échéance à trois jours : un nom sans date ne rend rien urgent). Les règles
  des fenêtres (règle 13 bis) : le fond, Échap dans un champ date, « Fermer sans enregistrer ? »,
  « retour » sur téléphone. `?nouveau=1&devis=…` l'ouvre, puis le paramètre quitte l'adresse.
• **E — Hors garantie, un BON D'INTERVENTION** : « Créer le bon d'intervention » ouvre le simulateur en
  dépannage pré-rempli (`ss_prefill_client` et `ss_prefill_depannage` : motif « SAV moteur — … » et
  `sav_origine`), lus une fois puis effacés. Le dépannage porte `sav_origine`, projeté à plat par la
  liste (`sav_origine_devis`, `sav_origine_ticket`, gardés par `normDevis`) : la carte retrouve son bon
  (`SSSav.bonDe`, par le devis ET le ticket) et y MÈNE au lieu d'en proposer un second — sans rien
  réécrire sur le ticket. Sous garantie, la carte dit « — gratuit ».
• **F — Terrain** : Appeler / Y aller sur téléphone seulement (règle 33 ; `jsAttr`, « Rue de l'Église »).
  Les photos s'ouvrent DANS la page (`SSUI.ouvrirPhotos`, règle 26) : un nouvel onglet faisait quitter
  l'ERP installé sur l'iPhone, sans chemin du retour.
• **G — Ce qui casse le plus** (`SSSav.synthese`) : douze mois glissants, par nature, et les moteurs des
  chantiers en panne moteur (lus dans `items_min` : `moteur_ref` d'un screen, `moteur` d'un volet ou
  d'une tente). Un même moteur à deux pannes ou plus est signalé « à dire à Harol » : un défaut de série
  se prouve par les tickets, pas de mémoire.
• **L'assistant lisait `t.type`, qui n'existe pas** : la nature d'un ticket s'appelle `probleme`.
• ⚠️ **LE BANC DES TESTS SERVEUR VIT DANS `tests/banc-serveur.js`** (`window.SSBanc`, sorti du test du bac
  à sable). `SSBanc.cadre(url)` ÉCRIT la page dans un cadre déjà branché (`document.open` / `write`).
  Deux essais écartés, et pourquoi : régler le `fetch` d'un cadre vide puis naviguer ne tient pas
  (Chrome donne au document une fenêtre NEUVE) ; naviguer et GUETTER le nouveau document par minuterie
  marche quand on regarde, et échoue une fois sur deux quand le panneau du navigateur est masqué — ses
  minuteries tombent à une par seconde, la page a déjà fait ses requêtes et retombe sur le cache. **Un
  test qui passe « parfois » a le même défaut que celui qui ne passe jamais** : `cadre.branche` le
  vérifie (test P1). ⚠️ Un document ÉCRIT n'a pas d'entrée d'historique à lui : « retour » y change
  l'état sans déclencher `popstate`. « Retour » se teste donc par une VRAIE navigation (tests T4 à T6).

**48. L'OUTILLAGE SERT AU COMPTOIR ET AVANT UNE POSE** (27/10/2026 — revue de la page, propositions A à
G choisies par Nicolas sur maquette). Les règles vivent dans `assets/js/outillage.js` (`window.SSOutil`,
fonctions pures) ; protégé par `tests/outillage.test.html`.
• **A — Retrouver une référence comme on la lit.** Une ligne de résumé remplace les trois tuiles (252 px
  sur téléphone). La recherche ignore les accents et l'ordre des mots, et une référence se tape d'un bloc :
  « 0179440 » trouve « 0179 4 40 » (`compacte`, à partir de trois caractères).
• **B — Rien de coupé, rien de caché sur téléphone.** Une colonne, la vignette à gauche ; les actions
  PASSENT À LA LIGNE (sur deux colonnes de 141 px, Modifier et Supprimer étaient coupés hors de la carte,
  donc inatteignables) ; les notes restent visibles (elles étaient masquées sous 560 px) ; les
  catégories tiennent dans UN menu (quatre rangées de pastilles poussaient la première référence sous le
  premier écran). La feuille de style seule décide (règle 24).
• **C — Les photos dans R2** (règle 25) : envoyées dès qu'on les choisit, la base ne garde que l'adresse.
  Avant, chaque photo vivait en clair dans la ligne : chaque ouverture de la page téléchargeait toutes les
  photos de toutes les références, et le cache du téléphone saturait en silence. « Alléger » déplace
  celles qui y sont encore — en n'envoyant que l'identifiant, le nom et les photos : le serveur étale le
  reste. La visionneuse locale est partie : `SSUI.ouvrirPhotos` (règle 26).
• **D — À racheter, par une route CIBLÉE** (`POST|DELETE /api/outillage/:id/racheter`, règle 3), signée
  par l'identité Access : on s'en aperçoit sur un chantier, et l'autre peut corriger la fiche au même
  moment. La liste de courses est groupée par FOURNISSEUR (là où l'on va), « Acheté » vide la ligne et le
  dit (`dernier_achat` : qui, combien), « Retirer » (une erreur) ne laisse pas de trace d'achat.
  ⚠️ `upsertOutillage` ÉTALE l'existant (règle 2) ET reprend `racheter` / `dernier_achat` de la base :
  réenregistrer une fiche, même avec `racheter: null`, ne touche jamais à la liste (test R5).
• **E — Kits de pose et « à emporter »** (table `kits`, route `/api/kits`) : un kit dit, pour un type
  d'ouverture ou pour tout chantier, quelles références emporter, « par ouverture » ou « par chantier ».
  « À emporter » (depuis les poses des trois semaines, ou `?pose=<devis>` — le planning le propose sur
  chaque pose de la vue Jour) multiplie par les ouvertures du chantier, comptées avec
  `SSRemu.ouverturesParType` : la règle de l'argent (`quantiteDe`), pas une copie. Une même vis dans deux
  kits fait UNE ligne ; une référence supprimée reste listée et nommée. Ce qui est chargé se coche SUR
  L'APPAREIL (`ss_emporter_<devis>`) ; « Il en manque » l'envoie dans « À racheter ».
• **F — Prix datés, deux fournisseurs** (`autre`) : la date d'un prix change quand le PRIX change, pas
  quand on corrige une note (`datePrix`) ; au-delà de six mois, il est « à revérifier » ; le moins cher
  est marqué et « Commander » y va. ⚠️ « 1 234,50 » valait 1 € (la lecture s'arrêtait à l'espace des
  milliers) : `lirePrix` lit la virgule et les milliers, et REFUSE ce qu'il ne sait pas lire.
• **G — Montrer au comptoir** : la photo et la référence en grand, la page figée derrière ; Échap ou
  « retour » ferme.
• ⚠️ **AUCUNE ÉCRITURE HORS-LIGNE.** L'ancien « Enregistré (hors-ligne) » n'avait aucune file d'envoi :
  la référence n'arrivait jamais au serveur et disparaissait au chargement suivant, une suppression
  revenait (règle 6). La fiche reste ouverte, on réessaie. Le cache, lui, est réécrit à chaque lecture
  réussie : sans réseau, au fond d'un magasin, on CONSULTE la dernière liste connue.
• **La catégorie affichée est celle qui sera enregistrée** : une référence sans catégorie s'ouvrait sur
  « Visserie & boulonnerie » et l'écrivait au premier enregistrement. Elle est rangée dans « Autre »,
  partout (`categorieDe`).
• Les fenêtres (fiche, kit, à emporter, comptoir) suivent la règle 13 bis ; « Créer un kit » depuis
  « À emporter » RELAIE la fenêtre sans toucher à l'historique.

## Pièges déjà payés — ne pas les repayer

- **`quantite || 1` EST FAUX SUR DEUX CAS, et le second coûte de l'argent.** Le repli à 1 existe
  parce que beaucoup d'items n'ont pas de champ `quantite` — légitime. Mais il avale aussi :
  • le **zéro ÉCRIT**, qui devient 1 : on paie une ouverture qui n'existe pas ;
  • le **négatif**, qui passe tel quel : −3 screens = **−150 € de pose soustraits du total**.
  Le second est la pire forme d'erreur d'argent, parce qu'elle est **invisible** : l'écran de
  rémunération masque les dossiers qui ne rapportent rien, donc le total baissait sans qu'aucune
  ligne ne l'explique. Trouvé le 04/10/2026 en rejouant la page Statistiques sur des données
  dégradées, pas en relisant le code.
  `SSRemu.quantiteDe(item)` est la seule source : champ absent/vide/illisible → 1, sinon la valeur
  si elle est > 0, et **0 dans tous les autres cas, jamais un négatif**. `app/stats.html` la
  consomme aussi (répartition par type, marge par type) plutôt que d'en garder une copie.
  La leçon générale : **un `|| valeurParDéfaut` sur un NOMBRE confond « absent » et « zéro »**,
  et ne dit rien du signe. Sur de l'argent, il faut les trois cas séparément.

- **UN FORMULAIRE QUI AFFICHE UN DÉFAUT NON ENREGISTRÉ MENT, et personne ne s'en aperçoit.**
  `el('chEquipe').value = ch.equipe || 'nicolas'` : le sélecteur d'équipe affichait « Nicolas »
  alors que `chantier.equipe` n'existait pas en base. On lisait « Nicolas » à l'écran, donc on ne
  touchait pas au champ, donc `onchange` ne tirait jamais, donc **rien ne s'enregistrait — jamais**.
  La fiche annonçait une donnée qu'elle n'avait pas.
  Le défaut est resté invisible jusqu'au jour où un AUTRE écran a lu la même donnée à la SOURCE :
  la rémunération sortait « équipe ? » sur un chantier que Nicolas voyait pourtant renseigné,
  pose effectuée et commande au statut « posé ». C'est lui qui a demandé « c'est fait mais il dit
  que c'est pas fait ??? » — et il avait raison des deux côtés.
  **Un champ vide se montre VIDE** (`<option value="">— à renseigner —</option>`), et il dit ce que
  le vide coûte, là où il se corrige. Corrigé dans `vue.html` ET `planning.html`, qui portaient le
  même repli.
  ⚠️ `SSPlanning.quiDeEquipe('')` retombe encore sur Nicolas, mais la GRILLE du planning ne s'en sert
  plus pour les poses : rangée chez Nicolas, une pose sans équipe se retrouvait cochée « Nicolas »
  dans la fenêtre « Qui s'en occupe » — exactement ce piège-ci, par un autre chemin (règle 13 bis).
  La règle générale : **un `|| valeurParDéfaut` au moment d'AFFICHER un champ éditable est
  toujours suspect.** Il est légitime au moment de LIRE pour calculer, jamais au moment de peupler
  un formulaire — sinon l'utilisateur valide de tête quelque chose qui n'existe pas.

- **Le défilement par SCRIPT est inerte dans le panneau d'automatisation, mais la MOLETTE marche.**
  `window.scrollTo`, `body.scrollTop` et `documentElement.scrollTop` laissent tous `scrollY` à 0 sur
  une page pourtant défilable. **En revanche `computer` avec `action: "scroll"` défile pour de vrai**
  (`scrollY: 1000` mesuré) : c'est un vrai évènement de molette, pas un appel de script.
  ⚠️ Cette distinction a coûté cher. Faute de l'avoir essayée, un `position: sticky` a été déclaré
  cassé sans preuve, « réparé » à l'aveugle, publié, et il a fallu revenir en arrière. **Avant de
  conclure quoi que ce soit sur un comportement au défilement, essayer la molette.** Il faut une
  capture d'écran préalable pour pouvoir viser des coordonnées, et la page doit avoir de quoi
  défiler (allonger avec un bloc de remplissage si besoin).
  À ne pas confondre avec `innerHeight: 0`, qui est le même panneau simplement masqué.
- **Un conteneur `flex` en colonne avec `max-height` ÉCRASE ses enfants au lieu de défiler.**
  `flex-shrink` vaut 1 par défaut : sur un écran court, les deux cartes du rail de la fiche devis
  perdaient 42 et 57 px, et comme chacune porte `overflow: hidden`, « Ajouter au portfolio » et les
  dernières entrées du sommaire devenaient **inatteignables** — pas rognées : absentes.
  ⚠️ Le piège est que la MESURE dit que tout va bien : le conteneur annonce
  `scrollHeight === clientHeight`, donc aucune barre de défilement et rien à faire défiler. Il faut
  mesurer les ENFANTS (`enfant.scrollHeight > enfant.clientHeight`), pas le parent. Correctif :
  `.vue-rail > * { flex: none; }` — le parent déborde alors pour de vrai et son `overflow-y: auto`
  reprend son rôle. Vérifié à 808, 620, 528, 420 et 320 px de hauteur de rail.
- **`.section` porte DÉJÀ un `::before` ET un `::after`** — ce sont les coins « ticked »
  (`width/height: var(--tick)`, soit 8 px). Y ajouter un décor en `::before` ne crée pas un second
  pseudo-élément : il écrase le premier, donc le coin DISPARAÎT, et le nouveau décor hérite en
  silence du `width: 8px` qu'il n'a pas déclaré. Un filigrane posé en `inset: 0` sortait ainsi à
  **8 × 8 px**, invisible, en ayant l'air parfaitement configuré : `maskImage`, `opacity` et
  `z-index` étaient tous corrects à la lecture. Même famille que `.ec-ph button`, et la même leçon
  qu'il a fallu payer deux fois : **mesurer la TAILLE rendue de l'élément qu'on ajoute**, pas
  seulement vérifier que ses propriétés sont les bonnes. Tout décor sur une `.section` passe par un
  ÉLÉMENT RÉEL (`.filigrane-marque`), jamais par un pseudo.
  ⚠️ Un élément en `z-index: -1` a besoin d'`isolation: isolate` sur son hôte, sinon il part
  derrière le fond de la section et disparaît tout autant.
- **Un `style="overflow:hidden"` en ligne sur un `.table-wrap` coupe les colonnes.** Il est pose
  pour que les coins arrondis rognent le tableau, mais il écrase le `overflow-x: auto` de
  `base.css` — et sur téléphone la dernière colonne finit hors écran, SANS aucun moyen d’y accéder.
  Le `body { overflow-x: hidden }` global masque le symptôme : la page ne déborde pas, tout a l’air
  normal. **Mesurer les ENFANTS, et vérifier qu’un ancêtre défile vraiment** (`overflowX` en
  `auto`/`scroll`) — pas seulement `document.scrollWidth`. Poser les DEUX axes :
  `overflow-x: auto; overflow-y: hidden`, sinon la spec bascule aussi l’axe vertical sur auto.
- **Le bandeau de l'application est en `position: FIXED`, jamais en `sticky`.** `sticky` dépend
  d'une question — « quel est mon conteneur de défilement ? » — et les moteurs n'y répondent pas
  pareil dès que `body` porte un `overflow`. Mesuré à la molette : Chromium fait coller le bandeau
  sans problème avec `overflow-x: hidden`, et sur l'iPhone de Nicolas il ne tenait pas. `fixed` ne
  pose pas la question : il se cale sur la fenêtre.
  Contreparties, toutes les deux indispensables :
  • Il sort du flux, donc le contenu doit être décalé. `nav.js` MESURE la hauteur réelle du bandeau
    dans `--ss-header-h` et la tient à jour par `ResizeObserver` — elle n'est pas constante (le
    bandeau passe sur deux lignes sur téléphone, et change encore quand les polices chargent).
    Elle vaut 0 par défaut : cinq pages document n'ont pas de `.app-header` du tout.
  • `fixed` IGNORE le `padding-left` que le rail pose sur le body : son `left` est recalé dans la
    media query du rail (212 px, 60 px replié), sinon le bandeau passe par-dessus le rail.
- **NE PAS remplacer `body { overflow-x: hidden }` par `overflow-x: clip` pour « reparer » le
  bandeau collant.** Essaye le 03/10/2026, publie, puis retire le lendemain : le bandeau tenait
  tres bien avec `hidden`, et c'est `clip` qui l'a fait lacher sur iPhone.
  Le raisonnement etait pourtant juste sur le papier — avec `overflow-x: hidden` et
  `overflow-y: visible`, la valeur UTILISEE de `overflow-y` bascule sur `auto` (meme regle de spec
  que le piege du `.table-wrap` ci-dessus), le body devient un conteneur de defilement, et un
  `position: sticky` enfant devrait coller a CE conteneur, qui ne defile jamais. Un montage de
  controle dans Chromium le confirmait meme : avec `hidden` l'element sticky part a −400 px, avec
  `clip` il reste a 0. **Sur iOS Safari, c'est l'inverse.**
  ⚠️ La lecon porte sur la METHODE, pas sur l'overflow. **Le defilement est inerte dans le panneau
  d'automatisation** : on ne peut pas y verifier un sticky en faisant defiler, et un montage de
  controle dans un moteur ne dit RIEN du comportement d'un autre moteur. Un raisonnement de spec
  plus une mesure Chromium, ca reste une hypothese tant que l'appareil ne l'a pas confirmee — et
  ici l'appareil disait le contraire. Ne rien changer a cette ligne sans pouvoir tester sur
  l'iPhone de Nicolas.
- **`backdrop-filter` rend le texte FLOU sur iOS.** Il promeut l'element en couche composite, et
  le texte de cette couche est alors lisse en NIVEAUX DE GRIS au lieu du sous-pixel. Sur le
  bandeau, le libelle du module — 10,88 px en mono — paraissait flou sur iPhone. Ce n'etait PAS un
  probleme de contraste : mesure a 6:1, donc largement au-dessus du seuil AA. Le verre depoli est
  retire sous 640 px et le fond y passe a 100 % d'opacite ; il reste au-dela, ou il ne pose pas ce
  probleme. Un fond opaque est de toute facon necessaire des lors que le bandeau COLLE et que le
  contenu defile dessous.
- **Fermer une modale sur `e.target === leFond` perd les saisies.** Sélectionner du texte dans un
  champ et relâcher la souris EN DEHORS de la fenêtre envoie le `click` au plus proche ancêtre
  commun du mousedown et du mouseup — c'est-à-dire le fond. La modale se fermait donc « toute
  seule » en pleine saisie, et comme aucun brouillon n'existe, vingt champs partaient avec. Exiger
  que le geste ait COMMENCÉ sur le fond (drapeau posé au `mousedown`). Corrigé sur la demande de
  RDV, les commentaires du tableau de bord, la relance et le formulaire d'outillage ; les
  visionneuses d'images gardent le clic simple, il n'y a rien à y perdre.
- **`Échap` remonte depuis le sélecteur de date du navigateur.** Refermer le petit calendrier d'un
  `input[type=date]` fermait la modale entière. Ignorer la touche quand la cible est un `SELECT`
  ou un champ date/heure. Et toute fermeture qui n'enregistre rien demande confirmation dès qu'un
  caractère a été tapé — pas avant, sinon on apprend à cliquer OK sans lire.
- **`@media (pointer: coarse)`** impose `min-height: 44px` aux boutons sur écran tactile. Un
  navigateur de bureau ne le déclenche pas : une mise en page validée au bureau peut être cassée
  sur téléphone. Fixer explicitement la taille des boutons à icône seule.
- **`min-width: 0` sur un bloc flex pour « le faire rentrer »** : il s'écrase complètement et le
  texte se casse LETTRE PAR LETTRE, en colonne verticale. Les mesures annonçaient pourtant « ça
  rentre » — seule la capture d'écran l'a montré (bandeau du document, titre « BON
  D'INTERVENTION »). La bonne réponse était `flex-wrap: wrap` sous 560 px.
- **Renommer un bouton par `section .btn`** attrape le premier bouton de la section — qui devient
  le « ✕ » d'une ligne dès qu'il en existe une. Viser par identifiant.
- **Un texte en `text-overflow: ellipsis` à côté d'un badge, dans une rangée flex** se fait
  écraser : « Martine Dubois » tombait à 8 px — une seule lettre — dès qu'un badge un peu long
  partageait la ligne. Donner un plancher au texte qui IDENTIFIE (`min-width: 6ch`) et refuser au
  badge de grandir (`flex: 0 0 auto`), sinon c'est le nom qui cède.
- **Un maître/détail replié sur une colonne** met le détail SOUS la liste : avec 20 clients, la
  fiche s'ouvrait 290 px sous le bas de l'écran, on croyait que le clic ne marchait pas. Sur
  téléphone, le détail doit REMPLACER la liste, avec un bouton de retour.
- **`@media (pointer: coarse)` ne couvre que `.btn` et consorts** : les composants maison
  (`.salut-seg button`, `.tagp`, `.cf-chip`, `.tb-chip`) restaient à 21 px de haut sur un vrai
  téléphone. Les ajouter explicitement à la liste du bloc `pointer: coarse` de `base.css`.
- **Une zone de touche élargie par un pseudo-élément absolu compte quand même** dans le
  `scrollWidth` de ses ancêtres : agrandir la pastille de probabilité faisait déborder la rangée
  de 10 px. Dans une ligne déjà pleine, il n'y a pas de place cachée.
- **`parseInt` sur une quantité** : une main-d'œuvre se compte en heures, et 1,5 h devenait 1 h à
  chaque enregistrement, sans un mot. `parseFloat` partout où une quantité peut être fractionnaire
  — et le champ doit alors porter un `step` décimal, sinon il refuse la valeur qu'il affiche.
- **Un `return` anticipé dans une fonction de rendu** saute tout ce qui suit : dans `vue.html`, le
  bloc des MONTANTS est rendu APRÈS les ouvertures. Brancher en `if/else`, jamais en sortie.
- **Le serveur de test doit envoyer `Cache-Control: no-store`** : sans lui le navigateur resservait
  un `ui.js` d'il y a dix minutes, et les vérifications portaient sur du code déjà remplacé.
  `python -m http.server` ne l'envoie PAS. Utiliser `solariscreenv2/tests/serveur-test.py`, qui
  l'envoie et refuse de démarrer si le port est déjà pris (voir le piège du `pkill` plus bas) :
  `python solariscreenv2/tests/serveur-test.py` → http://127.0.0.1:8732/app/dashboard.html
- **Un backtick dans un commentaire à l'intérieur d'un `template literal`** le termine. **Payé
  TROIS fois** : la requête SQL de `/api/devis` (déploiement Cloudflare en échec, invisible en
  local), puis deux fois dans la feuille de style injectée — `fetes.js` puis `nav.js`, où citer
  « position: fixed » entre backticks dans un commentaire a tué le fichier entier.
  **PAYÉ UNE CINQUIÈME FOIS le 06/10/2026**, encore dans `fetes.js`, encore en citant un nom de
  propriété entre backticks dans un commentaire CSS : `window.SSFetes` à `undefined`, plus un seul
  décor sur aucune page.
  ⚠️ **Compter les backticks du fichier NE SUFFIT PAS** : on en ajoute presque toujours une PAIRE,
  donc le total reste pair et le contrôle passe au vert alors que le template est coupé. Le seul
  contrôle qui vaille est de REPARSER le fichier :
  `new Function(await (await fetch('/assets/js/fetes.js?v=' + Date.now())).text())`.
  Le symptôme est toujours le même et il ne ressemble pas à la cause : `window.SSNav` ou
  `window.SSFetes` vaut `undefined`, la page a l'air à moitié vivante, et la seule trace est un
  `Uncaught SyntaxError` sur un mot au hasard.
  **Dans ces commentaires-là, écrire les noms de propriétés entre guillemets français, jamais
  entre backticks. Et après TOUTE modification d'un `.js`, vérifier dans la console qu'il n'y a pas
  de `SyntaxError` ET que le `window.SSxxx` du fichier existe** — c'est deux secondes, et ça attrape
  cette famille entière.
- **Aucun navigateur ne charge `functions/api/[[catchall]].js`** : une faute de syntaxe y passe
  toutes les vérifications de page et ne se voit qu'au déploiement. Node n'est pas installé sur la
  machine de Nicolas, donc pas de `node --check` — le contrôle se fait dans la console du
  navigateur, avec le serveur de test lancé :
  `await import('/functions/api/%5B%5Bcatchall%5D%5D.js?v=' + Date.now())`. Il doit renvoyer
  `{ onRequest }` ; toute autre réponse est une erreur de syntaxe.
- **Fixer une `height` sur un `.input`/`.select`** pour le rendre compact : le padding de base fait
  déjà ~37 px de contenu et `line-height` vaut 1,6 par héritage. Le texte sort de la boîte et se
  fait rogner — « Journée », « Matin (9h — 12h) ». Le rognage dépend du navigateur, donc un rendu
  correct sur une machine ne prouve rien. Resserrer le `padding` ET fixer `line-height: 1.25`,
  jamais la hauteur. À noter : `scrollHeight > clientHeight` ne détecte PAS ce cas sur un `select`
  — seule la capture d'écran le montre.
- **`SSUI.clientKeyOf` prend `(prenom, nom)`, pas l'objet client.** Lui passer la fiche entière
  produit la clé « |[object object] », qui ne rapproche évidemment aucune fiche CRM — et sans erreur.
- **Déclarer une constante APRÈS la fonction qui l'utilise** ne tient que par l'ordre d'exécution :
  `const A = window.SSAttente` posé 270 lignes sous `cardHtml` a fait planter tout le rendu du
  kanban (`A is not defined`) dès qu'un rendu est survenu plus tôt. Déclarer ces raccourcis en tête
  de script, avec `const SS = window.SS`.
- **Un `pkill` ne tue pas toujours le serveur de test sous Windows** : les pages continuaient de
  servir d'anciennes données et le scénario testé n'existait pas. Relancer sur un NOUVEAU port.
  La cause exacte, mesurée depuis : `HTTPServer` met `allow_reuse_address = 1`, donc `SO_REUSEADDR`
  — et sous Windows cette option n'a pas le sens qu'elle a sous Linux. Elle autorise **deux**
  serveurs à se lier au MÊME port : le second démarre sans broncher et c'est l'ANCIEN qui répond.
  `tests/serveur-test.py` remet `allow_reuse_address = False`, donc il ÉCHOUE au lieu de mentir.
- **Mesurer la mise en page quand le panneau du navigateur est masqué** donne `clientWidth: 0`, donc
  un faux « ça déborde » — et `requestAnimationFrame` ne se déclenche jamais, ce qui fait expirer le
  script. Vérifier que la largeur est non nulle avant de conclure.
  ⚠️ Ce n'est pas qu'un défaut d'outil : **rAF ne tire pas non plus dans un ONGLET en arrière-plan**.
  Toute logique qui doit s'exécuter même sans être regardée (ici, décorer une liste rendue pendant
  qu'on est sur un autre onglet) passe par `setTimeout`. Avec rAF, ça ne se produisait jamais, et
  rien ne le signalait.
- **`SSUI.jsAttr()` renvoie la valeur AVEC ses guillemets** (`JSON.stringify`, puis `"` → `&quot;`).
  L'entourer de quotes en plus produit `attribuer('"sav:2026-0012:abc"')` : l'identifiant arrive
  avec des guillemets LITTÉRAUX, ne correspond à rien, et la fonction sort en silence. S'écrit
  `onclick="f(' + jsAttr(x) + ')"`, jamais `onclick="f('' + jsAttr(x) + '')"`. Ce défaut a cassé
  d'un coup « Je prends », le clic sur un événement du planning, la date de pose, et Répondre /
  Classer / Supprimer sur un sujet — **sans une seule erreur en console**.
- **L'autre moitié de la même famille : une apostrophe dans la DONNÉE.** `onclick="f('…')"` construit
  avec des quotes simples écrites à la main casse dès que la valeur en contient une — et en Belgique
  c'est la norme : « L'Hoest », « D'Hondt », « Rue de l'Église », une référence « VIS-L'H-40 ». Le
  gestionnaire devient `f('VIS-L'H-40', …)` et le navigateur dit **`Uncaught SyntaxError: missing )
  after argument list`** (ou `Unexpected identifier 'hoest'` quand c'est une affectation du genre
  `location.href='…'` au lieu d'un appel). Le bouton ne fait alors ABSOLUMENT rien.
  **Aucun échappement HTML ne protège cette position :**
  - `esc()` n'échappe pas l'apostrophe du tout ;
  - `escAttr()` la transforme en `&#39;` — que le parseur HTML **redécode en `'`** avant de compiler
    le gestionnaire. Protection nulle, et c'est ce qui trompe : le code a l'air échappé ;
  - `encodeURIComponent()` **laisse l'apostrophe telle quelle** (elle est légale dans une URL).
    C'est exactement ce qui cassait « Fiche client » du tableau de bord, dont la clé est `nom|prenom`.
  La seule écriture correcte reste `jsAttr()`, qui produit une chaîne JS entre `&quot;` : l'apostrophe
  se retrouve dans une chaîne à guillemets doubles, où elle est inoffensive. `escAttr()` garde son
  usage — le TEXTE d'un attribut (`src`, `alt`, `value`, `title`) — mais jamais l'intérieur d'un `on*`.
- **Un attribut `on*` est compilé AU DÉCLENCHEMENT de l'événement, pas à l'injection.** Conséquence
  à retenir avant de chercher pendant deux heures : une faute de syntaxe dans un gestionnaire généré
  ne produit **rien** au chargement de la page — ni à l'écriture du `innerHTML`, ni au rendu. Elle
  n'apparaît qu'au clic, et seuls `onerror`/`onload` (une image qui échoue) se déclenchent tout seuls.
  Donc : une erreur présente DÈS le chargement ne peut pas venir d'un `onclick` généré ; et
  inversement, instrumenter le `set` de `innerHTML` ne révèle pas la faute — il faut compiler les
  attributs soi-même.
- **Une `function X()` au premier niveau d'un script classique crée déjà `window.X`.** Réassigner
  `window.X = function …` ensuite fait que l'appel interne à `X()` résout vers la NOUVELLE fonction :
  récursion infinie, « Maximum call stack size exceeded », et plus rien ne s'enregistre. Donner un
  nom distinct à la fonction interne (`ecrireChantier` vs `window.setChantier`).
- **Tester un bouton en appelant sa fonction depuis la console ne prouve RIEN** : `fixerPose(id, v)`
  marchait parfaitement alors que le bouton était cassé, parce que l'erreur était dans la chaîne
  `onclick` générée. Cliquer pour de vrai (`element.click()` ou un clic sur la référence), et lire
  l'attribut `onclick` rendu quand on doute.
- **Une transition CSS sur un fond en `color-mix(…, transparent)`** ne s'anime pas dans Chrome et
  reste bloquée sur sa valeur de départ : le fond n'apparaît jamais. Ne pas animer ce fond.
- **`grid-column: span N` dans une grille repliée sur une colonne** crée une colonne implicite et
  écrase le champ voisin (mesuré à 7 px de large, impossible à remplir).
- **Une règle CSS ajoutée en fin de feuille passe devant les media queries** écrites plus haut.
  Passer par une variable plutôt que réécrire une valeur responsive.
- **LES CHAMPS À 16 px SUR ÉCRAN TACTILE N'ONT JAMAIS MARCHÉ, de juillet au 26/10/2026** — le piège
  juste au-dessus, payé pour de vrai. `base.css` déclarait `.input { font-size: 16px }` dans son bloc
  `@media (pointer: coarse)` en HAUT de la feuille ; la règle générale des champs, 400 lignes plus
  bas, la redéclarait à `var(--fs-sm)` avec la même spécificité. Mesuré en émulation tactile :
  13,76 px sur TOUS les champs de l'ERP (sauf le Mode Terrain, qui avait sa propre règle), donc
  Safari iOS zoomait la page à chaque champ touché. Rien ne le signalait : un navigateur de bureau
  ne déclenche jamais `pointer: coarse`.
  La taille vit maintenant dans un jeton, **`--fs-champ`** (`tokens.css`), surchargé à 16 px dans la
  même feuille, juste sous sa valeur par défaut. **Un composant qui retaille ses champs écrit
  `font-size: var(--fs-champ)`, jamais `var(--fs-sm)`** — le planning, les RDV, les échanges et
  l'édition d'une note le faisaient, et refaisaient zoomer l'iPhone sur leurs propres champs — puis
  s'inscrit dans `COMPOSANTS` de `tests/tactile.test.html`.
  ⚠️ 16 px, c'est 16 % de texte en plus dans des boîtes qui ne grandissent pas : sur téléphone, un
  menu étroit se met à couper son libellé (« Journé », « Tri : récents d'abo »). Rien ne DÉBORDE,
  donc aucune mesure de débordement ne le voit. Comparer la largeur du libellé à
  `clientWidth − padding − 20 px` (la flèche du menu natif) — avec un canevas créé DANS la page
  mesurée, sinon il mesure avec la police de repli et se trompe de 10 %. La flèche garde sa propre
  marge : c'est le `padding-right` d'un menu qu'on rend au texte en premier.
- **Sur mobile, mesurer `element.scrollWidth > element.clientWidth`**, pas seulement le débordement
  de la page : `body { overflow-x: hidden }` masque le symptôme.
- **Les photos** partent vers R2 ; si l'envoi échoue elles restent en clair dans le devis. Ce repli
  était silencieux et un devis a atteint 1,69 Mo. Un bandeau « Alléger » existe sur le tableau de
  bord. La signature du client n'est jamais déportée : elle s'affiche sur la page publique, qui n'a
  pas accès au stockage.

## Comment vérifier son travail

1. **Les 58 tests du moteur** — obligatoire dès qu'on touche à `calc.js` : ouvrir
   `solariscreenv2/tests/calc.test.html` dans un navigateur, exiger « 58/58 ».
   Idem pour `planning.js` : `tests/planning.test.html`, exiger « 121/121 » — et dès qu'on touche à
   `app/planning.html` : `tests/planning-page.test.html`, exiger « 53/53 », par le serveur. Pour `attente.js` :
   `tests/attente.test.html`, exiger « 100/100 ».
   Et dès qu'on touche à une COULEUR de thème, ou au défaut de thème de la société :
   `tests/themes.test.html`, exiger « 77/77 ». ⚠️ **Par le serveur de test**, pas en `file://` :
   quatre de ses cas chargent `tests/amorce-theme.html` en iframe pour mesurer le premier rendu.
   Et dès qu'on touche à `remuneration.js` ou au tarif de pose :
   `tests/remuneration.test.html`, exiger « 140/140 » — c'est de l'argent réel.
   Et dès qu'on touche au configurateur VR150 (`volet.js`, `VR_CHAMPS`, les listes `VR_*`) :
   `tests/volet.test.html`, exiger « 135/135 » — ça remplit un bon de commande fournisseur.
   ⚠️ Celui-là doit être ouvert **par le serveur de test**, pas en `file://` : deux de ses cas
   lisent le fichier du serveur pour vérifier que sa liste blanche n'a pas divergé de la spec.
   Et dès qu'on touche au signal des champs manquants : `tests/signal.test.html`, exiger « 58/58 ».
   Et dès qu'on touche au menu (`nav.js`) : `tests/nav.test.html`, exiger « 92/92 », par le serveur.
   Et dès qu'on touche au bac à sable (`tests/bac-a-sable.*`, `tests/banc-serveur.js`) ou à une route qu'il emprunte :
   `tests/bac-a-sable.test.html`, exiger « 30/30 », par le serveur (il charge sql.js depuis cdnjs).
   Et dès qu'on touche à l'outillage (`app/outillage.html`, `outillage.js`, `/api/outillage`, `/api/kits`) :
   `tests/outillage.test.html`, exiger « 58/58 », par le serveur — ET `bac-a-sable.test.html`.
   Et dès qu'on touche au SAV (`app/sav.html`, `sav.js`, la carte SAV de `vue.html`, la route `/api/devis/:id/sav`) :
   `tests/sav.test.html`, exiger « 66/66 », par le serveur — ET `attente.test.html` et `bac-a-sable.test.html`.
   Et dès qu'on touche au tableau de bord : `tests/dashboard.test.html`, exiger « 77/77 », par le serveur.
   Et dès qu'on touche à l'assistant, à `actions.js` ou à `/api/assistant` : `tests/assistant.test.html`,
   exiger « 128/128 », par le serveur — ET `dashboard.test.html`, puisque le module est partagé.
   Et dès qu'on touche à la carte (`app/carte.html`, `carte.js`) : `tests/carte.test.html`, exiger « 44/44 », par le serveur.
   Et dès qu'on touche au portfolio (`app/portfolio.html`, `vitrine.js`) : `tests/portfolio.test.html`, exiger « 46/46 »,
   par le serveur — ET `carte.test.html`, puisque la mémoire des adresses est partagée.
   Et dès qu'on touche à l'envoi des mails, à la fenêtre de relance ou à `/api/mail/*` :
   `tests/mails.test.html`, exiger « 61/61 », par le serveur.
   Et dès qu'on touche à la page Clients, à `bilanDevis` ou au statut des factures :
   `tests/clients.test.html`, exiger « 51/51 », par le serveur.
   Et dès qu'on touche aux notes de frais : `tests/depenses.test.html`, exiger « 53/53 ». Les dates s'y
   manipulent en chaînes `YYYY-MM-DD` — jamais `toISOString().slice(0,10)`, qui renvoie une date
   UTC et donc LA VEILLE entre minuit et 2 h du matin en heure d'été belge.
   Et dès qu'on touche à la taille d'un champ (`--fs-champ`, `.input`/`.select`/`.textarea`, un
   composant qui retaille les siens) ou à un bloc `pointer: coarse` : `tests/tactile.test.html`,
   exiger « 77/77 » au bureau, « 121/121 » en émulation tactile, par le serveur.
2. **Les gestionnaires générés** — dès qu'on touche à un `onclick="…"` construit dans du JS.
   Charger la page AVEC des données dont le nom de client porte une apostrophe (« L'Hoest »), puis
   coller ceci dans la console : il compile chaque attribut `on*` réellement présent dans le DOM et
   dit lesquels sont cassés, sans avoir à cliquer sur quoi que ce soit.
   ```js
   [...document.querySelectorAll('*')].flatMap(e => [...e.attributes]
     .filter(a => a.name.startsWith('on') && a.name.length > 2)
     .map(a => { try { new Function(a.value); return null; }
                 catch (err) { return { el: e.tagName + '.' + e.className, err: err.message, code: a.value }; } })
     .filter(Boolean))
   ```
   Un tableau vide = tous les gestionnaires de la page compilent. C'est le seul contrôle qui attrape
   cette famille sans attendre qu'un client au nom apostrophé la déclenche en production.
3. **Mobile** — recharger chaque page modifiée à 390 px de large, vérifier qu'aucun élément ne
   déborde de sa boîte.
4. **Non-régression bureau** — comparer l'avant/après à 1500 px sur les pages non concernées.
5. **Rejouer un écran sur des données RÉELLES, pas seulement vides.** Un écran qui s'affiche
   sans données n'est pas un écran vérifié : les boucles ne s'exécutent pas, donc la moitié du
   code n'est jamais atteinte. `signeDateOf` a été supprimée par accident et la page passait au
   vert en local — avec zéro devis, la boucle du podium ne l'appelait jamais. C'est la production
   qui l'a trouvée. Charger quelques devis d'essai AVANT de conclure.
   ⚠️ Corollaire : **remplacer un BLOC entier par position** (du marqueur A au marqueur B), c'est
   emporter ce qu'on n'avait pas lu. Lister ce que le bloc contenait avant de le remplacer, et
   vérifier après coup que chaque nom qu'il définissait existe encore.
6. **Rejouer un écran sur des données DÉGRADÉES**, pas seulement sur des données propres : un
   devis sans `calculs`, sans `client`, sans `items`, un item sans type, une quantité à zéro ou
   négative, un dossier archivé, un dépannage sans ouverture. C'est comme ça qu'ont été trouvés,
   d'un coup, le « −150 € invisible » de la quantité négative, un dépannage annoncé
   « sous-traitée » alors que rien ne le disait, et des euros dans une colonne de pourcentages.
   Aucun des trois ne se voyait en relisant le code, ni en ouvrant la page avec de vraies données.
7. **Toujours mesurer, jamais supposer** — et regarder l'écran. Plusieurs défauts réels ont été
   trouvés sur une capture d'écran alors que les mesures disaient « tout va bien ».

## La facturation en plusieurs fois — vérifié, ne pas « corriger »

Trois types coexistent et se recomposent EXACTEMENT, sans perdre un centime :
**acompte** (% du total, plafonné au restant), **partielle** (la part POSÉE moins ce qui est déjà
facturé) et **solde** (tout le restant). Rejoué sur le cas réel de l'École du Bonheur — 33 screens,
acompte de 30 %, 28 posés : 8 768,79 + 16 031,82 + 4 428,68 = 29 229,29 €, **écart nul**.
⚠️ `computeAmounts()` renvoie `total_ttc` = le montant de LA FACTURE, et `ttc` = le total du DEVIS.
Les confondre fait croire à un bug qui n'existe pas.
Pour un chantier partiellement posé, c'est une facture **partielle** qu'il faut, pas un « solde » :
le solde facturerait aussi les ouvertures non encore posées.

## Contexte métier

- **La comptabilité officielle passe par SysCore**, pas par l'ERP. SolariScreen facture sous la
  société **SysCore** (Avenue de la Gare 60, 1401 Nivelles, **BE 1016.367.186**) : la pièce qui part
  au client, celle qui porte le numéro de TVA, est établie dans le logiciel comptable **Falco**, avec
  sa propre série de numéros. Les factures F2026-xxx d'ici sont un **suivi interne** : elles disent
  COMBIEN facturer et suivent l'encaissement, elles ne remplacent jamais la pièce Falco.
  Chaque facture porte donc un champ **`ref_externe`** (« Référence SysCore / Falco »), saisissable
  à tout moment — le numéro n'est connu qu'APRÈS — par une route d'écriture ciblée, et cherchable.
  Une ligne d'ici = une pièce là-bas. Toute question de conformité (TVA, facture électronique,
  Peppol) concerne SysCore, jamais cet ERP.
- Deux utilisateurs : **Nicolas** et **Yannick**. L'identité vient de Cloudflare Access, et le
  serveur signe les notes tout seul — il n'y a jamais de liste déroulante « qui écrit ? ».
- Vocabulaire : *devis*, *ouverture* (une baie), *pose*, *relance*, *acompte*, *solde*.

## Conventions

- **Commentaires en français, et ils expliquent le POURQUOI**, pas le comment. Un commentaire qui
  paraphrase le code est du bruit ; un commentaire qui dit « ceci a cassé en production le 3 août
  parce que… » évite la prochaine panne.
- Messages de commit : le symptôme, la cause, le correctif, la vérification.
- Pas d'emoji comme icônes : elles viennent toutes de `SSUI.icon()`.
- Thème sombre **et** clair, les deux. Toute couleur passe par les variables de `tokens.css`.
- Ce dépôt est **public** : ne jamais y committer de mot de passe, de jeton, ni de donnée client.
