from django.urls import path

from .views import HealthView, PublicStatsView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("stats/", PublicStatsView.as_view(), name="public-stats"),
]
