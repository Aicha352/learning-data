"""Petites fonctions utilitaires réutilisées dans tout le backend."""
import csv
import hashlib
from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify

AVATAR_COLORS = ["#2D5BE3", "#7C3AED", "#F59E0B", "#16A34A", "#DC2626", "#0EA5E9", "#DB2777", "#0F766E", "#B45309"]


def avatar_color(seed: str) -> str:
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    return AVATAR_COLORS[int(digest, 16) % len(AVATAR_COLORS)]


def unique_slug(model, value: str, instance_pk=None, field: str = "slug", max_length: int = 80) -> str:
    base = slugify(value)[:max_length] or "element"
    slug, index = base, 2
    qs = model.objects.all()
    if instance_pk:
        qs = qs.exclude(pk=instance_pk)
    while qs.filter(**{field: slug}).exists():
        suffix = f"-{index}"
        slug = f"{base[: max_length - len(suffix)]}{suffix}"
        index += 1
    return slug


def client_ip(request) -> str | None:
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def period_start(period: str):
    """Convertit un code de période ('7d', '30d', '90d', '365d', 'all') en date de début."""
    days = {"7d": 7, "30d": 30, "90d": 90, "365d": 365}.get(period)
    if days is None:
        return None
    return timezone.now() - timedelta(days=days)


def csv_response(filename: str, header: list[str], rows) -> HttpResponse:
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    response.write("﻿")  # BOM : ouverture correcte dans Excel
    writer = csv.writer(response, delimiter=";")
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return response


def pct(part: float, total: float) -> float:
    return round(100 * part / total, 1) if total else 0.0
