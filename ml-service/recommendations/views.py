from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .auth import verify_internal_service_request
from .engine import generate_hybrid_recommendations, generate_user_recommendations
from .docs import RECOMMENDATION_ENGINE_DOCS_MARKDOWN


def recommendation_engine_docs(request):
    """
    Returns the comprehensive technical documentation for the Insta-V2
    recommendation engine formatted directly as raw Markdown (text/markdown).
    """
    if request.method != "GET":
        return HttpResponse("Method Not Allowed", status=405)
    return HttpResponse(
        RECOMMENDATION_ENGINE_DOCS_MARKDOWN,
        content_type="text/markdown; charset=utf-8",
        status=200,
    )


@api_view(["GET"])
def root_index(request):
    return Response(
        {
            "success": True,
            "message": "Insta-V2 Machine Learning Recommendation Service is running",
            "service": "insta-v2-ml-service",
            "status": "online",
            "documentation": "/docs/recommendation-engine/",
            "endpoints": {
                "health": "/health/",
                "docs": "/docs/recommendation-engine/",
                "recommend_users": "/api/ml/recommend/users",
                "recommend_posts": "/api/ml/recommend/posts",
                "recommend_reels": "/api/ml/recommend/reels",
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
def health_check(request):
    return Response(
        {
            "success": True,
            "status": "ok",
            "service": "insta-v2-ml-service",
            "engine": "hybrid-tfidf-cf-v1",
            "pipelines": ["users", "posts", "reels"],
        },
        status=status.HTTP_200_OK,
    )


def _handle_recommend(request, content_type: str):
    is_valid, err_msg = verify_internal_service_request(request)
    if not is_valid:
        return Response(
            {"success": False, "message": err_msg},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    data = request.data if isinstance(request.data, dict) else {}
    user_id = str(data.get("user_id") or "").strip()
    candidates = data.get("candidates")

    if not user_id:
        return Response(
            {"success": False, "message": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(candidates, list):
        return Response(
            {"success": False, "message": "candidates must be a list"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = {
        "user_id": user_id,
        "content_type": content_type,
        "candidates": candidates,
        "user_profile": data.get("user_profile") or {},
        "peer_interactions": data.get("peer_interactions") or [],
        "limit": data.get("limit") or 30,
    }

    result = generate_hybrid_recommendations(payload)
    return Response({"success": True, **result}, status=status.HTTP_200_OK)


@api_view(["POST"])
def recommend_posts(request):
    return _handle_recommend(request, "posts")


@api_view(["POST"])
def recommend_reels(request):
    return _handle_recommend(request, "reels")


@api_view(["POST"])
def recommend_users(request):
    is_valid, err_msg = verify_internal_service_request(request)
    if not is_valid:
        return Response(
            {"success": False, "message": err_msg},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    data = request.data if isinstance(request.data, dict) else {}
    user_id = str(data.get("user_id") or "").strip()
    candidates = data.get("candidates")

    if not user_id:
        return Response(
            {"success": False, "message": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(candidates, list):
        return Response(
            {"success": False, "message": "candidates must be a list"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = {
        "user_id": user_id,
        "candidates": candidates,
        "user_profile": data.get("user_profile") or {},
        "limit": data.get("limit") or 15,
    }

    result = generate_user_recommendations(payload)
    return Response({"success": True, **result}, status=status.HTTP_200_OK)
