from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.courses.urls")),
    path("api/", include("apps.tracking.urls")),
    path("api/", include("apps.ml.urls")),
    path("api/", include("apps.analytics.urls")),
    path("api/", include("apps.engagement.urls")),
    path("api/admin/", include("apps.administration.urls")),
    # Documentation interactive de l'API
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="api-docs"),
]
