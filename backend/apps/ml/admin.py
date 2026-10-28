from django.contrib import admin

from .models import DropoutPrediction, LearnerSegment, ModelVersion, Recommendation, TrainingRun


@admin.register(ModelVersion)
class ModelVersionAdmin(admin.ModelAdmin):
    list_display = ["kind", "version", "is_active", "trained_at", "n_samples"]
    list_filter = ["kind", "is_active"]


@admin.register(TrainingRun)
class TrainingRunAdmin(admin.ModelAdmin):
    list_display = ["id", "status", "trigger", "started_at", "finished_at"]


@admin.register(Recommendation)
class RecommendationAdmin(admin.ModelAdmin):
    list_display = ["user", "course", "score", "rank"]
    raw_id_fields = ["user", "course"]


@admin.register(DropoutPrediction)
class DropoutPredictionAdmin(admin.ModelAdmin):
    list_display = ["user", "course", "score", "level", "predicted_at"]
    list_filter = ["level"]
    raw_id_fields = ["user", "course", "enrollment"]


@admin.register(LearnerSegment)
class LearnerSegmentAdmin(admin.ModelAdmin):
    list_display = ["user", "segment", "updated_at"]
    list_filter = ["segment"]
    raw_id_fields = ["user"]
