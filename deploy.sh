#!/usr/bin/env bash
# Learning Data — installation et mise à jour sur le VPS.
# Utilisation, dans le dossier du projet sur le serveur :   bash deploy.sh
#  - 1re fois : crée le fichier .env (secrets générés automatiquement) puis lance le site.
#  - ensuite  : récupère les dernières modifications depuis GitHub et relance le site.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE="docker compose -f docker-compose.prod.yml"

if [ ! -f .env ]; then
  echo "=== Première installation ==="
  read -rp "Ton nom de domaine (ex. learningdata.com), ou appuie sur Entrée pour utiliser l'adresse IP : " DOMAIN
  if [ -z "$DOMAIN" ]; then
    DOMAIN=$(curl -4 -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    SITE_URL="http://$DOMAIN"
    SECURE=False
    echo "→ Sans domaine, le site sera en HTTP (sans cadenas) : $SITE_URL"
  else
    SITE_URL="https://$DOMAIN"
    SECURE=True
  fi
  cat > .env <<EOF
SITE_URL=$SITE_URL
DOMAIN=$DOMAIN
AUTH_COOKIE_SECURE=$SECURE
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
SEED_DEMO=1
EOF
  chmod 600 .env
  echo "→ Fichier .env créé (clé secrète et mot de passe générés)."
else
  echo "=== Mise à jour ==="
  git pull --ff-only
fi

echo "Construction et démarrage (5 à 10 minutes la première fois)…"
$COMPOSE up -d --build
$COMPOSE ps

SITE_URL=$(grep '^SITE_URL=' .env | cut -d= -f2)
echo
echo "Terminé ! Ouvre $SITE_URL dans ton navigateur."
echo "Au tout premier démarrage, attends 2 à 3 minutes : les données de démo et les modèles se préparent."
