from rest_framework import serializers

from .models import LearningEvent

# Types que le navigateur a le droit d'envoyer directement.
CLIENT_EVENT_TYPES = [
    LearningEvent.Type.COURSE_VIEW,
    LearningEvent.Type.LESSON_OPEN,
    LearningEvent.Type.LESSON_TIME,
    LearningEvent.Type.VIDEO_PLAY,
    LearningEvent.Type.VIDEO_PAUSE,
    LearningEvent.Type.VIDEO_SEEK,
    LearningEvent.Type.VIDEO_PROGRESS,
    LearningEvent.Type.VIDEO_COMPLETE,
    LearningEvent.Type.QUIZ_START,
    LearningEvent.Type.HINT_USED,
    LearningEvent.Type.SEARCH,
    LearningEvent.Type.RECO_CLICK,
]


class IncomingEventSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(choices=CLIENT_EVENT_TYPES)
    course = serializers.IntegerField(required=False, allow_null=True)
    lesson = serializers.IntegerField(required=False, allow_null=True)
    value = serializers.FloatField(required=False, allow_null=True, min_value=-100000, max_value=100000)
    metadata = serializers.DictField(required=False, default=dict)
    session_id = serializers.CharField(required=False, allow_blank=True, max_length=64, default="")

    def validate_metadata(self, value):
        if len(str(value)) > 2000:
            raise serializers.ValidationError("Métadonnées trop volumineuses.")
        return value


class EventBatchSerializer(serializers.Serializer):
    events = IncomingEventSerializer(many=True, allow_empty=False, max_length=50)


class LearningEventSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="get_event_type_display", read_only=True)

    class Meta:
        model = LearningEvent
        fields = ["id", "event_type", "label", "course", "lesson", "value", "metadata", "created_at"]
