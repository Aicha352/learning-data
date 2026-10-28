# Learning Data

Plateforme de formation en ligne avec **système de recommandation** de cours et **détection du risque d'abandon**.

- **Apprenants** : catalogue, cours (vidéos, leçons, quiz), progression, certificats et recommandations personnalisées *expliquées* (« 45 % des apprenants de ce cours ont aussi suivi… »).
- **Formateurs** : création de cours (modules, leçons, quiz), apprenants à risque avec les raisons du risque, learning analytics (entonnoir, points d'abandon, profils), contact des apprenants.
- **Administrateurs** : utilisateurs et rôles, validation des cours, paramètres de la plateforme, journal d'activité, suivi et réentraînement des modèles.

| Partie | Technologies |
|---|---|
| Backend | Python 3.11+, Django 5.2, Django REST Framework, JWT en cookies httpOnly |
| Base de données | **PostgreSQL 16** |
| Machine learning | scikit-learn, pandas, numpy |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Recharts |

---

## 1. Installation (Windows, macOS ou Linux)

### Prérequis

1. **Python 3.11 à 3.13** — [python.org](https://www.python.org/downloads/) (sous Windows, coche *Add Python to PATH*).
2. **Node.js 20.9 ou plus récent** (22 LTS conseillé) — [nodejs.org](https://nodejs.org/).
3. **PostgreSQL 16** — [postgresql.org/download](https://www.postgresql.org/download/). Note le mot de passe de l'utilisateur `postgres` choisi pendant l'installation.

### Créer la base de données

Ouvre **SQL Shell (psql)** (Windows) ou un terminal, connecte-toi en tant que `postgres`, puis :

```sql
CREATE USER learning_data WITH PASSWORD 'learning_data' CREATEDB;
CREATE DATABASE learning_data OWNER learning_data;
```

> `CREATEDB` permet à Django de créer la base de test quand tu lances `pytest`.

### Backend (terminal n°1)

```bash
cd backend
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements-dev.txt
copy .env.example .env        # Windows   (macOS/Linux : cp .env.example .env)

python manage.py migrate
python manage.py seed_demo    # données de démonstration + entraînement des modèles (≈ 20 s)
python manage.py runserver
```

L'API tourne sur http://127.0.0.1:8000 — documentation interactive : http://127.0.0.1:8000/api/docs/

> Si PowerShell refuse d'activer l'environnement : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### Frontend (terminal n°2)

```bash
cd frontend
npm install
copy .env.example .env.local  # Windows   (macOS/Linux : cp .env.example .env.local)
npm run dev
```

Ouvre **http://localhost:3000**.

### Comptes de démonstration

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Apprenante | aminata@learningdata.app | Demo1234! |
| Formateur | issa.traore@learningdata.app | Demo1234! |
| Administratrice | admin@learningdata.app | Admin1234! |

Ces boutons sont aussi proposés directement sur la page de connexion. Tous les autres apprenants générés ont le mot de passe `Demo1234!`.

### Avec Docker (alternative)

```bash
docker compose up --build
```

PostgreSQL, l'API (gunicorn), le frontend et une tâche quotidienne (réentraînement + relances) démarrent ensemble ; les données de démonstration sont créées au premier lancement. Ouvre http://localhost:3000.

---

## 2. Commandes utiles

| Commande (dans `backend/`) | Rôle |
|---|---|
| `python manage.py seed_demo --reset --learners 500` | Régénère toutes les données (options : `--seed 42`, `--no-train`) |
| `python manage.py train_models` | Exécute le pipeline : collecte → nettoyage → entraînement → évaluation → déploiement |
| `python manage.py send_reminders` | Envoie les relances d'inactivité, alertes formateurs et résumés |
| `python manage.py createsuperuser` | Crée un compte administrateur (accès à /admin et à /django-admin/) |
| `pytest` | Lance les 33 tests du backend |

| Commande (dans `frontend/`) | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` puis `npm start` | Version de production |
| `npm run lint` / `npm run typecheck` | Vérifications du code |

**En production**, planifie chaque nuit `train_models` puis `send_reminders` (cron sous Linux, Planificateur de tâches sous Windows). L'administrateur peut aussi relancer l'entraînement depuis *Modèles ML*.

Les e-mails sont affichés dans la console du backend en développement. Pour de vrais envois, renseigne les variables `EMAIL_*` du fichier `.env`.

---

## 3. Architecture

```
learning-data/
├── backend/                     API Django
│   ├── config/                  réglages (lus depuis .env), URL racine
│   ├── apps/
│   │   ├── accounts/            utilisateurs, rôles, profil apprenant, authentification JWT
│   │   ├── courses/             catalogue, cours, modules, leçons, quiz, inscriptions, avis
│   │   ├── tracking/            collecte des événements d'apprentissage
│   │   ├── ml/                  recommandation, risque d'abandon, profils, pipeline
│   │   ├── analytics/           tableaux de bord apprenant et formateur
│   │   ├── engagement/          notifications, interventions, relances
│   │   ├── administration/      paramètres, journal d'activité, validation des cours
│   │   └── core/                utilitaires, permissions, données de démonstration
│   └── tests/                   tests pytest
├── frontend/                    application Next.js
│   └── src/
│       ├── app/                 pages : (public), (auth), bienvenue, apprenant, formateur, admin
│       ├── components/          ui/ (boutons, formulaires…), layout/, course/, learning/, charts/
│       ├── lib/                 client API, authentification, types, formatage
│       └── proxy.ts             redirige vers la connexion les pages protégées
└── docker-compose.yml
```

**Circulation des données**

1. Le navigateur envoie les événements d'apprentissage (lecture vidéo, temps passé, leçon terminée, quiz…) par lots à `POST /api/events/`.
2. `train_models` nettoie les données, entraîne les modèles, les évalue, puis enregistre les recommandations et les prédictions en base.
3. L'API sert ces résultats : `/api/recommendations/`, `/api/instructor/at-risk/`, `/api/ml/overview/`.

Le frontend appelle toujours `/api/...` sur sa propre adresse ; Next.js transmet ces requêtes à Django (`BACKEND_URL`). Les jetons JWT restent donc dans des cookies httpOnly, invisibles pour le JavaScript.

---

## 4. Les modèles

| Modèle | Méthode | Rôle |
|---|---|---|
| Popularité | cours les plus suivis | référence de comparaison |
| Filtrage collaboratif | similarité cosinus item-item | « les apprenants comme toi ont aussi suivi… » |
| Embeddings de contenu | TF-IDF + SVD (+ carte 2D t-SNE) | cours proches par le sujet |
| Profil | objectif, niveau, centres d'intérêt | démarrage à froid des nouveaux inscrits |
| **Hybride** | combinaison pondérée des trois | recommandation finale, poids appris automatiquement |
| Risque d'abandon | régression logistique (gradient boosting en comparaison) | probabilité d'abandon + raisons lisibles |
| Profils d'apprenants | K-means | Réguliers, Week-end, Pressés, Décrocheurs potentiels |

**Évaluation** : chaque apprenant cache son dernier cours suivi (*leave-last-out*), puis on mesure si chaque système le retrouve dans son top 5 (Précision@5, Rappel@5, NDCG@5). Le risque d'abandon est évalué par AUC, précision, rappel et F1 sur des apprenants jamais vus à l'entraînement. Toutes les métriques sont visibles dans *Modèles ML*.

Sur les données simulées, le filtrage collaboratif et le modèle hybride arrivent au même niveau (NDCG@5 ≈ 0,60, contre ≈ 0,38 pour la popularité). L'hybride se distingue surtout pour les nouveaux apprenants, qui n'ont pas encore d'historique. La détection d'abandon atteint une AUC d'environ 0,85.

---

## 5. Données réelles ou simulées

`seed_demo` simule environ 450 apprenants avec des comportements réalistes (rythme, notes aux quiz, baisse d'activité progressive avant un abandon) afin que les modèles aient de quoi apprendre dès le départ. Avec de vrais utilisateurs, rien ne change dans le code : les événements collectés remplacent la simulation à chaque entraînement.

---

## 6. Mise en production (résumé)

1. `DJANGO_DEBUG=False`, une `DJANGO_SECRET_KEY` longue et aléatoire, `DJANGO_ALLOWED_HOSTS` avec ton domaine.
2. Site en HTTPS : `AUTH_COOKIE_SECURE=True`, `DJANGO_SECURE_SSL_REDIRECT=True`.
3. Backend : `gunicorn config.wsgi:application` (les fichiers statiques de l'admin sont servis par WhiteNoise).
4. Frontend : `npm run build` puis `npm start`, avec `BACKEND_URL` qui pointe vers l'API.
5. Planifie `train_models` et `send_reminders` chaque nuit.

## 7. Dépannage

| Problème | Solution |
|---|---|
| `connection refused` / `password authentication failed` | PostgreSQL est-il démarré ? Vérifie `POSTGRES_*` dans `backend/.env`. |
| Le frontend affiche « Le serveur ne répond pas » | Le backend doit tourner sur le port 8000 (ou adapte `BACKEND_URL` dans `.env.local`). |
| Connexion impossible alors que le mot de passe est bon | En HTTP local, `AUTH_COOKIE_SECURE` doit valoir `False`. |
| Les recommandations sont vides | Lance `python manage.py train_models`. |
| `permission denied to create database` avec pytest | Ajoute le droit : `ALTER USER learning_data CREATEDB;` |
