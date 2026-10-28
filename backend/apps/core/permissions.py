"""Permissions basées sur le rôle de l'utilisateur."""
from rest_framework.permissions import BasePermission


def _role(request) -> str | None:
    user = getattr(request, "user", None)
    if not user or not user.is_authenticated:
        return None
    return user.role


class IsLearner(BasePermission):
    message = "Cette action est réservée aux apprenants."

    def has_permission(self, request, view):
        return _role(request) == "learner"


class IsInstructor(BasePermission):
    message = "Cette action est réservée aux formateurs."

    def has_permission(self, request, view):
        return _role(request) == "instructor"


class IsAdminRole(BasePermission):
    message = "Cette action est réservée aux administrateurs."

    def has_permission(self, request, view):
        return _role(request) == "admin"


class IsInstructorOrAdmin(BasePermission):
    message = "Cette action est réservée aux formateurs et administrateurs."

    def has_permission(self, request, view):
        return _role(request) in {"instructor", "admin"}
