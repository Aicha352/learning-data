from django.contrib import admin

from .models import Intervention, Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["user", "kind", "title", "is_read", "created_at"]
    list_filter = ["kind", "is_read"]
    raw_id_fields = ["user"]


@admin.register(Intervention)
class InterventionAdmin(admin.ModelAdmin):
    list_display = ["instructor", "learner", "kind", "created_at"]
    list_filter = ["kind"]
    raw_id_fields = ["instructor", "learner", "course", "suggested_course", "notification"]
