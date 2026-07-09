# Simulateur d'événements — version en ligne

Le simulateur TradingLab en une page web : tu choisis un actif (pétrole, gaz,
or, blé), une somme fictive, un levier… et tu vois ce que « acheter après la
grosse news » aurait donné sur 16 ans de données réelles. Tout se calcule dans
le navigateur : **aucun serveur, aucun compte, aucun cookie**.

## Les deux fichiers

| Fichier | Rôle |
|---------|------|
| `index.html` | Toute l'application (interface + calculs + graphiques). |
| `donnees.js` | Les prix historiques, générés par `../exporter_donnees.py`. |

## Utiliser en local

Double-clique simplement sur `index.html` — ça marche hors ligne.

## Déployer sur GitHub Pages (gratuit)

1. Sur github.com : **New repository** → nom par ex. `tradinglab-simulateur`,
   public, sans rien cocher d'autre → **Create repository**.
2. Sur la page du dépôt : **Add file → Upload files** → glisse `index.html`
   et `donnees.js` → **Commit changes**.
3. **Settings → Pages** → dans « Branch » choisis `main` et `/ (root)` → **Save**.
4. Attends 1-2 minutes : ton simulateur est en ligne sur
   `https://TON-PSEUDO.github.io/tradinglab-simulateur/`

## Rafraîchir les données (de temps en temps)

```powershell
cd "C:\Users\Nicolas\Desktop\CODAGE CLAUDE\TradingLab"
python exporter_donnees.py
```

Puis re-téléverse le nouveau `donnees.js` sur GitHub (Upload files → il
remplace l'ancien). Les données ne bougent pas en temps réel : c'est un
simulateur historique, pas un outil de trading en direct.

## Rappels

Argent fictif, données du passé, pas un conseil en investissement. Les CFD à
levier sont interdits de commercialisation aux particuliers en Belgique (FSMA) —
la colonne « levier » du simulateur montre pourquoi c'est une protection.
