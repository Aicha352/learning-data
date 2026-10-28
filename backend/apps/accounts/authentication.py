"""Authentification JWT lue depuis un cookie httpOnly (ou l'en-tête Authorization)."""
from django.conf import settings
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
        else:
            raw_token = request.COOKIES.get(settings.AUTH_COOKIE_ACCESS)
        if not raw_token:
            return None
        validated = self.get_validated_token(raw_token)
        user = self.get_user(validated)
        if user.status != user.Status.ACTIVE:
            raise exceptions.AuthenticationFailed("Ce compte n'est pas actif.")
        return user, validated


SESSION_HINT_COOKIE = "ld_session"


def _cookie_kwargs(max_age: int, httponly: bool = True) -> dict:
    return {
        "max_age": max_age,
        "httponly": httponly,
        "secure": settings.AUTH_COOKIE_SECURE,
        "samesite": settings.AUTH_COOKIE_SAMESITE,
        "path": "/",
    }


def set_auth_cookies(response, refresh: RefreshToken):
    jwt = settings.SIMPLE_JWT
    response.set_cookie(
        settings.AUTH_COOKIE_ACCESS,
        str(refresh.access_token),
        **_cookie_kwargs(int(jwt["ACCESS_TOKEN_LIFETIME"].total_seconds())),
    )
    response.set_cookie(
        settings.AUTH_COOKIE_REFRESH,
        str(refresh),
        **_cookie_kwargs(int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds())),
    )
    # Indice lisible par le navigateur (sans aucun secret) : évite d'appeler /me pour un visiteur anonyme.
    response.set_cookie(SESSION_HINT_COOKIE, "1", **_cookie_kwargs(int(jwt["REFRESH_TOKEN_LIFETIME"].total_seconds()), httponly=False))
    return response


def clear_auth_cookies(response):
    for name in (settings.AUTH_COOKIE_ACCESS, settings.AUTH_COOKIE_REFRESH, SESSION_HINT_COOKIE):
        response.delete_cookie(name, path="/", samesite=settings.AUTH_COOKIE_SAMESITE)
    return response
