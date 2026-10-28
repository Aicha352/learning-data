"""Format d'erreur uniforme pour toute l'API.

Chaque erreur renvoie : {"detail": "message lisible", "errors": {champ: [messages]}}
"""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _first_message(data) -> str:
    if isinstance(data, str):
        return data
    if isinstance(data, list) and data:
        return _first_message(data[0])
    if isinstance(data, dict) and data:
        if "detail" in data:
            return _first_message(data["detail"])
        key, value = next(iter(data.items()))
        return _first_message(value)
    return "Une erreur est survenue."


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
    if isinstance(exc, Http404):
        exc = exceptions.NotFound("Élément introuvable.")

    response = exception_handler(exc, context)
    if response is None:
        return None

    data = response.data
    if isinstance(exc, exceptions.ValidationError):
        errors = data if isinstance(data, dict) else {"non_field_errors": data}
        detail = _first_message(errors.get("non_field_errors") or errors)
        response.data = {"detail": detail, "errors": errors}
    else:
        response.data = {"detail": _first_message(data), "errors": {}}
    if response.status_code == status.HTTP_401_UNAUTHORIZED and "detail" in response.data:
        response.data["code"] = "not_authenticated"
    return response
