# -*- coding: utf-8 -*-
"""
SOLARISCREEN — Serveur de test local
════════════════════════════════════════════════════════════════════════════════

À QUOI ÇA SERT
    Servir `solariscreenv2/` en local pour vérifier une modification dans un vrai
    navigateur, avant de pousser.

        python solariscreenv2/tests/serveur-test.py
        → http://127.0.0.1:8732/app/dashboard.html

    Le port se change en argument (voir plus bas pourquoi c'est important) :

        python solariscreenv2/tests/serveur-test.py 8733

POURQUOI PAS `python -m http.server`
    Parce qu'il ne renvoie PAS `Cache-Control: no-store`. Sans cet en-tête, le
    navigateur ressert un `ui.js` d'il y a dix minutes et les vérifications
    portent sur du code déjà remplacé — on corrige un défaut qui n'existe plus,
    ou on croit avoir cassé quelque chose qui va très bien. C'est un piège déjà
    payé : voir CLAUDE.md, « Le serveur de test doit envoyer Cache-Control:
    no-store ».

CE QUI EST NORMAL EN LOCAL
    Les 404 sur `/api/*` : il n'y a pas de Worker ici, donc pas de base. Les
    pages retombent sur leur cache `localStorage` et affichent « hors-ligne ».
    C'est voulu, et c'est une sécurité : on ne peut pas abîmer les vraies
    données depuis un serveur de test.

    Pour qu'une page ait quand même des données à afficher, on remplit ce cache
    depuis la console du navigateur (`ss_devis_cache`, `ss_clients_cache`,
    `ss_factures_cache`, `ss_rdv_cache`, `ss_sujets_cache`, `ss_outillage_cache`).
    Pense à y mettre un nom de client avec une apostrophe — « L'Hoest » — c'est
    ce qui révèle les gestionnaires `onclick` cassés (voir CLAUDE.md, « Les
    gestionnaires générés »).

SI LE PORT EST DÉJÀ PRIS
    Sous Windows, un `pkill` ne tue pas toujours le serveur précédent : il
    continue de servir d'anciens fichiers, et le scénario qu'on croit tester
    n'existe pas. Le script le détecte et refuse de démarrer plutôt que de
    laisser croire que tout va bien — relancer sur un NOUVEAU port.
"""
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Racine servie : le dossier parent de `tests/`, c'est-à-dire `solariscreenv2/`.
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT_DEFAUT = 8732


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # L'en-tête qui justifie à lui seul l'existence de ce fichier.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        SimpleHTTPRequestHandler.end_headers(self)

    def log_message(self, fmt, *args):
        # Journal compact sur stderr : les 404 /api/* attendus restent lisibles.
        sys.stderr.write('%s\n' % (fmt % args))


class Serveur(ThreadingHTTPServer):
    # ⚠️ `HTTPServer` met `allow_reuse_address = 1`, donc SO_REUSEADDR. Sous
    # Windows, cette option ne sert pas à recycler un port qui se libère (comme
    # sous Linux) : elle autorise carrément DEUX serveurs à se lier au MÊME port.
    # Le second démarre sans broncher, et c'est l'ANCIEN qui continue de répondre
    # — on teste alors du code qu'on vient de remplacer sans aucun signe.
    # C'est le piège « un pkill ne tue pas toujours le serveur de test sous
    # Windows » de CLAUDE.md. On le neutralise ici : le démarrage doit ÉCHOUER.
    allow_reuse_address = False


def main():
    try:
        port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT_DEFAUT
    except ValueError:
        sys.exit('Port invalide : %r - attendu un nombre, ex. 8733' % sys.argv[1])

    try:
        serveur = Serveur(
            ('127.0.0.1', port), functools.partial(Handler, directory=RACINE))
    except OSError as err:
        sys.exit(
            "Impossible d'ouvrir le port %d (%s).\n"
            "Un serveur de test tourne probablement encore. Relance sur un NOUVEAU port :\n"
            "    python %s %d" % (port, err.strerror or err, sys.argv[0], port + 1))

    # Ce qui est AFFICHÉ reste en ASCII pur : sous Windows, une sortie redirigée
    # part en cp1252 et les accents deviennent illisibles dans un journal. Les
    # commentaires et la documentation gardent les leurs — ils ne sont jamais
    # imprimés.
    # flush=True : sans lui, ces lignes restent dans le tampon quand la sortie
    # est redirigée (lancement en arrière-plan) et on croit que rien n'a démarré.
    print('SolariScreen - serveur de test', flush=True)
    print('  racine : %s' % RACINE, flush=True)
    print('  adresse: http://127.0.0.1:%d/app/dashboard.html' % port, flush=True)
    print('  cache  : no-store (obligatoire - voir CLAUDE.md)', flush=True)
    print('  stop   : Ctrl+C', flush=True)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print('\narrete.')


if __name__ == '__main__':
    main()
