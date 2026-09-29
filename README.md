# Mutiplayer Browser Game Mono-repo

## Development

### Frontend

> In game-client/

```bash
bun i
bun dev
```

### Backend

> In game-server/

```bash
bun i
bun dev
```

---

### Important Notices

Though for development purposes you will need to add the certificate found at _/game-server/dev-root-ca.cert_ to your browser of choice.
For Brave on linux (kubuntu): see _game-server/Certificates.md_

### Présentation

Echoes of the Fractured Core est un jeu d’action multijoueur stratégique situé sur des archipels flottants ravagés par l’effondrement d’Erebus. Si deux factions rivales s’affrontent pour contrôler les ressources rares et dominer l'espace, elles ne sont pas les seules forces en jeu : une troisième entité a également pris place dans ce monde brisé.

Le projet met en avant la gestion de ressources limitées, le positionnement tactique des défenses et les interactions en temps réel entre joueurs, dans un univers de science-fiction sombre où chaque décision peut faire basculer le combat.

### Objectifs du projet

Ce projet a été conçu comme une application de jeu en deux parties : un frontend public et un backend dédié. Le frontend est développé avec Vite, HTML, CSS, TypeScript et Phaser, tandis que la connexion au serveur passe uniquement par WebTransport.

Le backend, hébergé séparément, est indispensable au lancement d’une partie puisque son URL est nécessaire au client pour se connecter. Il est développé avec Bun, webtransport-bun et Zod afin de gérer les échanges, valider les données et garantir la cohérence de la partie.

Le jeu repose sur une architecture **server authoritative** : le client se contente de recevoir les mises à jour, d’interpoler l’affichage et d’envoyer les actions du joueur, tandis que le serveur exécute toute la simulation et reste l’unique source de vérité.

### Démonstration

La démonstration vidéo du projet est disponible ici :
[Voir la vidéo](https://www.youtube.com/watch?v=F-mwlYk8Mtc)

La vidéo présente :

- Les principales actions possibles sur le site.
- Les interactions entre utilisateurs.
- Des tentatives d’actions bloquées par le système.
- Le fonctionnement général de l’application.

### Diagrammes d’architecture

diagramme architecture backend/client (not up to date) dans _/diagrams_
