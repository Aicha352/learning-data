from django.urls import path

from . import views

urlpatterns = [
    path("me/dashboard/", views.LearnerDashboardView.as_view(), name="learner-dashboard"),
    path("me/progress/", views.LearnerProgressView.as_view(), name="learner-progress"),
    path("instructor/overview/", views.InstructorOverviewView.as_view(), name="instructor-overview"),
    path("instructor/at-risk/", views.AtRiskListView.as_view(), name="instructor-at-risk"),
    path("instructor/learners/<int:pk>/", views.LearnerFileView.as_view(), name="instructor-learner"),
    path("instructor/learners/<int:pk>/interventions/", views.InterventionCreateView.as_view(), name="instructor-intervention"),
    path("instructor/analytics/", views.CourseAnalyticsView.as_view(), name="instructor-analytics"),
]
