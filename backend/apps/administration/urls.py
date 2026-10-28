from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("users", views.AdminUserViewSet, basename="admin-users")

urlpatterns = [
    path("dashboard/", views.AdminDashboardView.as_view(), name="admin-dashboard"),
    path("roles/", views.RolesView.as_view(), name="admin-roles"),
    path("course-reviews/", views.CourseReviewListView.as_view(), name="admin-course-reviews"),
    path("course-reviews/<int:pk>/", views.CourseReviewDetailView.as_view(), name="admin-course-review"),
    path("settings/", views.PlatformSettingsView.as_view(), name="admin-settings"),
    path("activity/", views.ActivityLogView.as_view(), name="admin-activity"),
    path("", include(router.urls)),
]
