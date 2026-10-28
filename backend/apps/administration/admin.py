from django.contrib import admin

from .models import ActivityLog, PlatformSettings


@admin.register(PlatformSettings)
class PlatformSettingsAdmin(admin.ModelAdmin):
    list_display = ["platform_name", "risk_threshold", "active_recommender", "updated_at"]


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ["created_at", "actor_label", "action", "description", "ip_address"]
    list_filter = ["action"]
    search_fields = ["actor_label", "description"]
