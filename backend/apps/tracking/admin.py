from django.contrib import admin

from .models import LearningEvent


@admin.register(LearningEvent)
class LearningEventAdmin(admin.ModelAdmin):
    list_display = ["created_at", "user", "event_type", "course", "lesson", "value"]
    list_filter = ["event_type"]
    search_fields = ["user__email"]
    raw_id_fields = ["user", "course", "lesson"]
    date_hierarchy = "created_at"
