from django.urls import path

from .views import EventIngestView, RecentEventsView

urlpatterns = [
    path("events/", EventIngestView.as_view(), name="events-ingest"),
    path("events/recent/", RecentEventsView.as_view(), name="events-recent"),
]
