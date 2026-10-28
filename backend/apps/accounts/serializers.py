from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.courses.models import Tag

from .models import LearnerProfile, User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    initials = serializers.CharField(read_only=True)
    avatar_color = serializers.CharField(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    onboarding_completed = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name", "initials", "avatar_color",
            "role", "role_label", "status", "status_label", "headline", "date_joined", "last_login",
            "onboarding_completed",
        ]
        read_only_fields = fields

    def get_onboarding_completed(self, obj) -> bool | None:
        if obj.role != User.Role.LEARNER:
            return None
        profile = getattr(obj, "profile", None)
        return bool(profile and profile.onboarding_completed)


class MeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "headline"]
        extra_kwargs = {"first_name": {"required": True}, "last_name": {"required": True}}


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    role = serializers.ChoiceField(choices=[User.Role.LEARNER, User.Role.INSTRUCTOR], default=User.Role.LEARNER)
    headline = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return value

    def validate(self, attrs):
        user = User(email=attrs["email"], first_name=attrs["first_name"], last_name=attrs["last_name"])
        try:
            password_validation.validate_password(attrs["password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        role = validated_data.pop("role")
        status = User.Status.PENDING if role == User.Role.INSTRUCTOR else User.Status.ACTIVE
        return User.objects.create_user(role=role, status=status, **validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return value

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


class TagMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class LearnerProfileSerializer(serializers.ModelSerializer):
    goal_label = serializers.CharField(source="get_goal_display", read_only=True)
    level_label = serializers.CharField(source="get_level_display", read_only=True)
    weekly_hours_label = serializers.CharField(source="get_weekly_hours_display", read_only=True)
    interests = TagMiniSerializer(many=True, read_only=True)
    interest_ids = serializers.PrimaryKeyRelatedField(
        queryset=Tag.objects.all(), many=True, write_only=True, source="interests", required=False
    )

    class Meta:
        model = LearnerProfile
        fields = [
            "goal", "goal_label", "level", "level_label", "weekly_hours", "weekly_hours_label",
            "interests", "interest_ids", "onboarding_completed", "updated_at",
        ]
        read_only_fields = ["onboarding_completed", "updated_at"]

    def validate(self, attrs):
        if not self.partial:
            if not attrs.get("goal"):
                raise serializers.ValidationError({"goal": "Choisis ton objectif principal."})
            if not attrs.get("weekly_hours"):
                raise serializers.ValidationError({"weekly_hours": "Indique ton temps disponible."})
        return attrs


# --- Administration des comptes ------------------------------------------

class AdminUserSerializer(UserSerializer):
    enrollments_count = serializers.IntegerField(read_only=True, default=0)
    courses_count = serializers.IntegerField(read_only=True, default=0)

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ["enrollments_count", "courses_count"]
        read_only_fields = fields


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["first_name", "last_name", "headline", "role", "status"]

    def validate(self, attrs):
        request = self.context["request"]
        if self.instance == request.user:
            if attrs.get("role", self.instance.role) != User.Role.ADMIN:
                raise serializers.ValidationError({"role": "Tu ne peux pas retirer ton propre rôle d'administrateur."})
            if attrs.get("status", self.instance.status) != User.Status.ACTIVE:
                raise serializers.ValidationError({"status": "Tu ne peux pas suspendre ton propre compte."})
        return attrs


class AdminUserCreateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=User.Role.choices)
    headline = serializers.CharField(max_length=120, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un compte existe déjà avec cette adresse e-mail.")
        return value
