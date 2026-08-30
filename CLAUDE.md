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
| `functions/`, `api.js`, `_routes.json` (à la racine) | Vestiges de l'ancien Worker. Plus rien ne tourne dessus. |

Le dossier `solariscreen/` (ERP version 1) a été **supprimé le 09/08/2026**. Il reste consultable
dans l'historique git. Un audit externe a perdu des heures à l'analyser parce que rien n'indiquait
qu'il était mort — d'où ce tableau.

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

L'aperçu **n'est pas derrière Cloudflare Access et n'a aucune base liée** : il affiche « 0 devis ».
C'est normal, et c'est une sécurité — on ne peut pas abîmer les vraies données depuis un aperçu.

## Architecture

Pages HTML autonomes, JavaScript **classique** — jamais de modules ES, l'application doit pouvoir
s'ouvrir en double-cliquant un fichier. Tout est exposé sur `window.*`.

| Fichier | Rôle |
|---|---|
| `assets/js/calc.js` | **Moteur de prix.** Fonctions pures, protégé par 41 tests. |
| `assets/js/api.js` | Client API, cache local, file d'envoi hors-ligne (`window.SS`) |
| `assets/js/ui.js` | Helpers partagés, icônes SVG, rendu des notes (`window.SSUI`) |
| `assets/js/config.js` | Réglages de l'ERP et **valeurs par défaut de référence** (`window.SSConf`) |
| `assets/js/nav.js` | Menu, identité, recherche globale (`window.SSNav`) |
| `functions/api/[[catchall]].js` | **Tout le backend**, dans un seul fichier (Cloudflare Pages Function + base D1) |
| `tests/calc.test.html` | Les 41 tests du moteur. À ouvrir dans un navigateur. |

Stockage : base **D1** (une table par entité, avec un gros blob JSON dans la colonne `data`),
photos et documents dans **R2**.

## Règles qui ne se devinent pas

**1. Les réglages ne sont JAMAIS rétroactifs.** Un devis enregistre les taux avec lesquels il a été
calculé (`pricing_v2.rates`). À la réouverture on relit *ceux-là*, jamais les réglages du jour ; un
devis ancien sans taux stockés retombe sur les taux historiques (0,77 / 0,23 / 2,5). Modifier une
marge ne doit jamais changer un montant déjà annoncé à un client ni une facture émise.

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

**9. Un BON D'INTERVENTION ne se relance pas.** Les relances font ACCEPTER une offre ; sur des
travaux déjà faits il n'y a plus rien à accepter, et ce qu'on chasse c'est le paiement (factures,
alerte « acompte non payé »). `relanceEtat` sort donc immédiatement quand
`depannage_mode === 'realise'`. Une PROPOSITION de dépannage se relance normalement.

**10. Ce que le client écrit finit dans une page authentifiée.** Toute valeur venant de
`devis-review.html` (raison de refus, question) doit être échappée avant affichage.

## Pièges déjà payés — ne pas les repayer

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
- **Une transition CSS sur un fond en `color-mix(…, transparent)`** ne s'anime pas dans Chrome et
  reste bloquée sur sa valeur de départ : le fond n'apparaît jamais. Ne pas animer ce fond.
- **`grid-column: span N` dans une grille repliée sur une colonne** crée une colonne implicite et
  écrase le champ voisin (mesuré à 7 px de large, impossible à remplir).
- **Une règle CSS ajoutée en fin de feuille passe devant les media queries** écrites plus haut.
  Passer par une variable plutôt que réécrire une valeur responsive.
- **Sur mobile, mesurer `element.scrollWidth > element.clientWidth`**, pas seulement le débordement
  de la page : `body { overflow-x: hidden }` masque le symptôme.
- **Les photos** partent vers R2 ; si l'envoi échoue elles restent en clair dans le devis. Ce repli
  était silencieux et un devis a atteint 1,69 Mo. Un bandeau « Alléger » existe sur le tableau de
  bord. La signature du client n'est jamais déportée : elle s'affiche sur la page publique, qui n'a
  pas accès au stockage.

## Comment vérifier son travail

1. **Les 41 tests du moteur** — obligatoire dès qu'on touche à `calc.js` : ouvrir
   `solariscreenv2/tests/calc.test.html` dans un navigateur, exiger « 41/41 ».
2. **Mobile** — recharger chaque page modifiée à 390 px de large, vérifier qu'aucun élément ne
   déborde de sa boîte.
3. **Non-régression bureau** — comparer l'avant/après à 1500 px sur les pages non concernées.
4. **Toujours mesurer, jamais supposer** — et regarder l'écran. Plusieurs défauts réels ont été
   trouvés sur une capture d'écran alors que les mesures disaient « tout va bien ».

## Contexte métier

- **La comptabilité officielle passe par SysCore**, pas par l'ERP. Les factures F2026-xxx d'ici sont
  un suivi interne. Toute question de conformité (facture électronique, Peppol) concerne SysCore.
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
