from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.administration.models import ActivityLog
from apps.administration.services import log_activity
from apps.core.permissions import IsLearner

from .authentication import clear_auth_cookies, set_auth_cookies
from .models import LearnerProfile, User
from .serializers import (
    ChangePasswordSerializer,
    LearnerProfileSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class RegisterView(AuthThrottleMixin, APIView):
    """Inscription. Un apprenant est connecté directement ; un formateur attend la validation d'un admin."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = serializer.save()
        log_activity(user, ActivityLog.Action.CREATE, f"Création du compte {user.get_role_display().lower()} {user.email}", request, user)

        if user.status == User.Status.PENDING:
            return Response(
                {
                    "user": UserSerializer(user).data,
                    "pending": True,
                    "detail": "Ton compte formateur a été créé. Un administrateur doit le valider avant ta première connexion.",
                },
                status=status.HTTP_201_CREATED,
            )
        update_last_login(None, user)
        response = Response({"user": UserSerializer(user).data, "pending": False}, status=status.HTTP_201_CREATED)
        return set_auth_cookies(response, RefreshToken.for_user(user))


class LoginView(AuthThrottleMixin, APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        user = authenticate(request, email=email, password=password)
        if user is None:
            # Un compte en attente ou suspendu ne passe pas authenticate() si is_active=False ;
            # on vérifie donc le mot de passe à la main pour donner un message précis.
            candidate = User.objects.filter(email__iexact=email).first()
            if candidate and candidate.check_password(password):
                user = candidate
            else:
                log_activity(None, ActivityLog.Action.LOGIN, f"Tentative de connexion échouée sur {email}", request)
                return Response(
                    {"detail": "E-mail ou mot de passe incorrect.", "errors": {}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if user.status == User.Status.PENDING:
            return Response(
                {"detail": "Ton compte formateur est en attente de validation par un administrateur.", "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if user.status == User.Status.SUSPENDED or not user.is_active:
            return Response(
                {"detail": "Ce compte est suspendu. Contacte l'administrateur de la plateforme.", "errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )

        update_last_login(None, user)
        log_activity(user, ActivityLog.Action.LOGIN, "Connexion réussie", request, user)
        from apps.tracking.services import record_event  # import local : évite une dépendance circulaire

        record_event(user, "login")
        response = Response({"user": UserSerializer(user).data})
        return set_auth_cookies(response, RefreshToken.for_user(user))


class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH) or request.data.get("refresh")
        if not raw:
            return Response({"detail": "Session expirée.", "errors": {}}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(pk=old["user_id"])
            if user.status != User.Status.ACTIVE:
                raise TokenError("inactive")
            old.blacklist()
            new = RefreshToken.for_user(user)
        except (TokenError, User.DoesNotExist, KeyError):
            response = Response({"detail": "Session expirée.", "errors": {}}, status=status.HTTP_401_UNAUTHORIZED)
            return clear_auth_cookies(response)
        response = Response({"user": UserSerializer(user).data})
        return set_auth_cookies(response, new)


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        return clear_auth_cookies(response)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save(update_fields=["password"])
        log_activity(request.user, ActivityLog.Action.UPDATE, "Mot de passe modifié", request, request.user)
        # Nouveaux jetons : les anciens restent valides jusqu'à expiration mais la session courante est conservée.
        response = Response({"detail": "Mot de passe modifié."})
        return set_auth_cookies(response, RefreshToken.for_user(request.user))


class LearnerProfileView(APIView):
    """Questionnaire d'accueil et préférences d'apprentissage."""

    permission_classes = [IsLearner]

    def get_profile(self, user) -> LearnerProfile:
        profile, _ = LearnerProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        return Response(LearnerProfileSerializer(self.get_profile(request.user)).data)

    def put(self, request):
        return self._save(request, partial=False)

    def patch(self, request):
        return self._save(request, partial=True)

    def _save(self, request, partial):
        profile = self.get_profile(request.user)
        serializer = LearnerProfileSerializer(profile, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save(onboarding_completed=True)
        from apps.ml.services import refresh_user_recommendations

        refresh_user_recommendations(request.user)
        return Response(LearnerProfileSerializer(profile).data)
