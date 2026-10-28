"""Déclare l'authentification par cookie JWT dans la documentation OpenAPI (/api/docs/)."""
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class CookieJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.authentication.CookieJWTAuthentication"
    name = "cookieJWT"

    def get_security_definition(self, auto_schema):
        return {"type": "apiKey", "in": "cookie", "name": "ld_access"}
