"""Sauvegarde et chargement des modèles entraînés (fichiers joblib)."""
from __future__ import annotations

import threading
from pathlib import Path

import joblib
from django.conf import settings

_cache: dict[str, tuple[float, object]] = {}
_lock = threading.Lock()


def _path(name: str) -> Path:
    directory = Path(settings.ML_ARTIFACTS_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{name}.joblib"


def save(name: str, obj) -> Path:
    path = _path(name)
    tmp = path.with_suffix(".tmp")
    joblib.dump(obj, tmp)
    tmp.replace(path)
    with _lock:
        _cache.pop(name, None)
    return path


def load(name: str):
    """Charge un artefact (avec cache mémoire invalidé quand le fichier change)."""
    path = _path(name)
    if not path.exists():
        return None
    mtime = path.stat().st_mtime
    with _lock:
        cached = _cache.get(name)
        if cached and cached[0] == mtime:
            return cached[1]
    obj = joblib.load(path)
    with _lock:
        _cache[name] = (mtime, obj)
    return obj


def clear_cache():
    with _lock:
        _cache.clear()
