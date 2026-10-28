from django.urls import path

from . import views

urlpatterns = [
    path("recommendations/", views.RecommendationListView.as_view(), name="recommendations"),
    path(
        "recommendations/<int:course_id>/<str:action>/",
        views.RecommendationFeedbackView.as_view(),
        name="recommendation-feedback",
    ),
    path("courses/<slug:slug>/similar/", views.SimilarCoursesView.as_view(), name="similar-courses"),
    path("ml/overview/", views.MLOverviewView.as_view(), name="ml-overview"),
    path("ml/train/", views.TrainView.as_view(), name="ml-train"),
    path("ml/runs/<int:pk>/", views.TrainingRunView.as_view(), name="ml-run"),
]
