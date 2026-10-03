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
| `assets/js/planning.js` | **Moteur du temps.** Fonctions pures, protégé par 74 tests (`window.SSPlanning`) |
| `assets/js/attente.js` | **Qui doit agir.** Réunit demandes, planning, SAV et échanges. 70 tests (`window.SSAttente`) |
| `functions/api/[[catchall]].js` | **Tout le backend**, dans un seul fichier (Cloudflare Pages Function + base D1) |
| `tests/calc.test.html` | Les 41 tests du moteur de prix. À ouvrir dans un navigateur. |
| `tests/planning.test.html` | Les 74 tests du planning. Même principe. |
| `tests/attente.test.html` | Les 70 tests du « qui doit agir ». Même principe. |

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
pendant que le badge du menu, lui, les comptait. La bande « Aujourd'hui » en tire désormais ses
pastilles SAV et Échanges, donc les chiffres ne peuvent plus diverger d'un écran à l'autre.
⚠️ Les pastilles DEVIS de cette bande (relances, acompte, solde, devis expiré, lien jamais ouvert)
ne sont PAS des copies : `attente.js` ne couvre ni les relances ni l'argent. Les deux sources sont
COMPLÉMENTAIRES — ne pas les « dédoublonner » en croyant bien faire, on perdrait la moitié du brief.
Les seuils métier (4 h / 24 h sur un lead, 2 j, 3 j, 7 j) vivent dans `SSAttente.SEUILS` : ils
étaient dans `rdv.html`, ils n'y sont plus.

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
été fait. Signée et horodatée par le serveur, conservée si le ticket rouvre.
Les NOTES du ticket ont leur propre route (`/api/devis/:id/sav/:tid/note`), en écriture ciblée.
⚠️ Le serveur reconstruit un ticket CHAMP PAR CHAMP : tout appelant de `saveSavTicket` doit renvoyer
le ticket ENTIER (`pour`, `echeance`, `cause`, `resolution`, `notes`…), sinon il les efface.
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
⚠️ Quatre pages (`vue`, `portfolio`, `outillage`, `devis-review`) portent ENCORE leur propre
visionneuse en copie locale — leur STYLE, lui, était déjà dédoublonné dans `base.css`. Le helper
partagé utilise donc l’identifiant `ssLightbox` et non `lightbox` : deux éléments de même id dans
un document, c’est le genre de collision qu’on ne voit qu’un jour de malchance. Toute nouvelle page
passe par le helper ; les quatre copies restent à ramener dessus, quand on y touchera pour autre chose.
Le clic sur le fond suit la règle des modales : il ne ferme que si le geste a COMMENCÉ sur le fond.

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
⚠️ **Un décor posé DANS le rail doit être hors du flux.** La citrouille de pied, en flux, ajoutait
30 px à la colonne : le rail passait en défilement dès 820 px de haut, et la barre lui volait 10 px
de largeur — « Outillage & références » se faisait tronquer. Ancrée par le bas, elle n'allonge plus
le contenu. Mesurer `scrollHeight > clientHeight` ET `clientWidth` du rail après tout ajout.
⚠️ L'hôte d'un décor se choisit sur la PLACE DISPONIBLE (`260 × 130` px), pas sur une liste noire
qui n'aurait jamais fini de grandir. Les tuiles de chiffres s'écrivent `class="kpi ticked"` et les
modales `class="modal ticked"` : sans ça, une toile de 58 px atterrissait sur un carré de 150, et
une autre sur une fenêtre de saisie masquée, prête à surgir.

## Pièges déjà payés — ne pas les repayer

- **Le défilement est INERTE dans le panneau d'automatisation** : `window.scrollTo`,
  `body.scrollTop` et `documentElement.scrollTop` laissent tous `scrollY` à 0 sur une page pourtant
  défilable (`scrollHeight` 2042 pour un `clientHeight` de 800). Un `scrollIntoView` qui « ne marche
  pas » n'y prouve donc rien : vérifier d'abord qu'un `scrollTo` manuel bouge, sinon c'est l'outil.
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
- **Un backtick dans un commentaire à l'intérieur d'un `template literal`** le termine : citer un
  nom de champ entre backticks au milieu de la requête SQL de `/api/devis` a cassé tout le fichier,
  et **le déploiement Cloudflare a échoué** sans que rien ne le montre en local. Écrire « _plan »
  avec des guillemets dans ces commentaires-là.
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
- **Sur mobile, mesurer `element.scrollWidth > element.clientWidth`**, pas seulement le débordement
  de la page : `body { overflow-x: hidden }` masque le symptôme.
- **Les photos** partent vers R2 ; si l'envoi échoue elles restent en clair dans le devis. Ce repli
  était silencieux et un devis a atteint 1,69 Mo. Un bandeau « Alléger » existe sur le tableau de
  bord. La signature du client n'est jamais déportée : elle s'affiche sur la page publique, qui n'a
  pas accès au stockage.

## Comment vérifier son travail

1. **Les 41 tests du moteur** — obligatoire dès qu'on touche à `calc.js` : ouvrir
   `solariscreenv2/tests/calc.test.html` dans un navigateur, exiger « 41/41 ».
   Idem pour `planning.js` : `tests/planning.test.html`, exiger « 74/74 ». Les dates s'y
   manipulent en chaînes `YYYY-MM-DD` — jamais `toISOString().slice(0,10)`, qui renvoie une date
   UTC et donc LA VEILLE entre minuit et 2 h du matin en heure d'été belge.
2. **Mobile** — recharger chaque page modifiée à 390 px de large, vérifier qu'aucun élément ne
   déborde de sa boîte.
3. **Non-régression bureau** — comparer l'avant/après à 1500 px sur les pages non concernées.
4. **Toujours mesurer, jamais supposer** — et regarder l'écran. Plusieurs défauts réels ont été
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
