from django.urls import path
from . import views

urlpatterns = [
    path("health", views.health_check, name="ml-health"),
    path("docs/recommendation-engine/", views.recommendation_engine_docs, name="ml-docs-slash"),
    path("docs/recommendation-engine", views.recommendation_engine_docs, name="ml-docs"),
    path("recommend/users", views.recommend_users, name="ml-recommend-users"),
    path("recommend/posts", views.recommend_posts, name="ml-recommend-posts"),
    path("recommend/reels", views.recommend_reels, name="ml-recommend-reels"),
]
