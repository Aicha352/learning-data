from rest_framework import serializers

from .models import ActivityLog, PlatformSettings


class PlatformSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSettings
        fields = [
            "platform_name", "contact_email", "default_language", "timezone", "risk_threshold",
            "medium_risk_threshold", "recommendations_count", "active_recommender", "training_schedule",
            "inactivity_days", "email_inactivity_reminder", "email_instructor_alert", "email_weekly_digest",
            "email_completion_congrats", "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_risk_threshold(self, value):
        if not 0.5 <= value <= 0.95:
            raise serializers.ValidationError("Le seuil doit être compris entre 50 % et 95 %.")
        return value

    def validate_recommendations_count(self, value):
        if not 3 <= value <= 30:
            raise serializers.ValidationError("Choisis entre 3 et 30 recommandations.")
        return value

    def validate_inactivity_days(self, value):
        if not 1 <= value <= 60:
            raise serializers.ValidationError("Choisis entre 1 et 60 jours.")
        return value

    def validate(self, attrs):
        high = attrs.get("risk_threshold", self.instance.risk_threshold if self.instance else 0.7)
        medium = attrs.get("medium_risk_threshold", self.instance.medium_risk_threshold if self.instance else 0.45)
        if medium >= high:
            raise serializers.ValidationError({"medium_risk_threshold": "Le seuil moyen doit être inférieur au seuil élevé."})
        return attrs


class ActivityLogSerializer(serializers.ModelSerializer):
    action_label = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = ActivityLog
        fields = ["id", "actor", "actor_label", "action", "action_label", "description", "ip_address", "created_at"]


class CourseReviewDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "request_changes", "reject"])
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def validate(self, attrs):
        if attrs["decision"] != "approve" and not attrs.get("comment", "").strip():
            raise serializers.ValidationError({"comment": "Explique au formateur ce qu'il doit changer."})
        return attrs
