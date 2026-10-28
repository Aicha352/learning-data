#!/bin/sh
set -e

echo "Attente de PostgreSQL…"
python - <<'PY'
import os, time, psycopg
for attempt in range(60):
    try:
        psycopg.connect(
            dbname=os.environ["POSTGRES_DB"], user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"], host=os.environ.get("POSTGRES_HOST", "db"),
            port=os.environ.get("POSTGRES_PORT", "5432"),
        ).close()
        break
    except psycopg.OperationalError:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL ne répond pas.")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput >/dev/null

# Première installation : données de démonstration + entraînement des modèles.
if [ "${SEED_DEMO:-0}" = "1" ]; then
  python manage.py shell -c "from apps.accounts.models import User; import sys; sys.exit(0 if User.objects.exists() else 1)" \
    || python manage.py seed_demo --learners "${SEED_LEARNERS:-450}"
fi

exec "$@"
