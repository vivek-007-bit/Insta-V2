from django.urls import path, include
from recommendations.views import root_index, health_check, recommendation_engine_docs

urlpatterns = [
    path("", root_index, name="root-index"),
    path("health/", health_check, name="root-health-slash"),
    path("health", health_check, name="root-health"),
    path("docs/recommendation-engine/", recommendation_engine_docs, name="docs-recommendation-engine-slash"),
    path("docs/recommendation-engine", recommendation_engine_docs, name="docs-recommendation-engine"),
    path("api/ml/", include("recommendations.urls")),
]
