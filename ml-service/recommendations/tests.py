from django.test import TestCase, override_settings
from rest_framework.test import APIClient


TEST_SERVICE_KEY = "test_internal_ml_key_123456"


@override_settings(ML_INTERNAL_API_KEY=TEST_SERVICE_KEY)
class RecommendationServiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_root_index_endpoint(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["success"])
        self.assertIn("running", res.data["message"].lower())
        self.assertEqual(res.data["status"], "online")

    def test_health_endpoint_is_accessible(self):
        res = self.client.get("/api/ml/health")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["success"])
        self.assertEqual(res.data["status"], "ok")
        self.assertIn("users", res.data.get("pipelines", []))

        # Root Render health check
        res_root = self.client.get("/health/")
        self.assertEqual(res_root.status_code, 200)
        self.assertEqual(res_root.data["status"], "ok")

    def test_recommendation_engine_docs_endpoint_returns_markdown(self):
        # Test trailing slash
        res = self.client.get("/docs/recommendation-engine/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("text/markdown", res.headers.get("Content-Type", ""))
        self.assertIn("utf-8", res.headers.get("Content-Type", "").lower())
        content = res.content.decode("utf-8")
        self.assertIn("# Insta-V2 Recommendation Engine Architecture", content)
        self.assertIn("Recommended Users Engine", content)
        self.assertIn("Recommended Posts Engine", content)
        self.assertIn("Recommended Reels Engine", content)
        self.assertIn("TF-IDF", content)
        self.assertIn("Cosine Similarity", content)
        self.assertIn("user-graph-interest-v1", content)
        self.assertIn("hybrid-tfidf-cf-v1", content)

        # Test without trailing slash
        res_noslash = self.client.get("/docs/recommendation-engine")
        self.assertEqual(res_noslash.status_code, 200)
        self.assertIn("text/markdown", res_noslash.headers.get("Content-Type", ""))

    def test_recommend_requires_valid_internal_service_key(self):
        payload = {"user_id": "u1", "candidates": []}
        res_missing = self.client.post("/api/ml/recommend/posts", payload, format="json")
        self.assertEqual(res_missing.status_code, 401)

        res_wrong = self.client.post(
            "/api/ml/recommend/posts",
            payload,
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY="wrong_key",
        )
        self.assertEqual(res_wrong.status_code, 401)

    def test_hybrid_post_recommendation_ranks_relevant_and_collaborative_items_higher(self):
        payload = {
            "user_id": "u_target",
            "limit": 4,
            "user_profile": {
                "liked_ids": ["p_arch_1"],
                "commented_ids": [],
                "followed_author_ids": ["author_arch"],
                "watch_history": {},
            },
            "peer_interactions": [
                {
                    "user_id": "u_peer_1",
                    "item_weights": {"p_arch_1": 2.5, "p_arch_2": 3.5},
                }
            ],
            "candidates": [
                {
                    "id": "p_arch_1",
                    "author_id": "author_arch",
                    "caption": "Concrete pavilion at sunrise",
                    "hashtags": ["architecture", "minimalism"],
                    "location": "Tokyo",
                    "media_type": "image",
                    "likes_count": 10,
                    "comments_count": 2,
                    "created_at": "2026-11-12T10:00:00Z",
                },
                {
                    "id": "p_arch_2",
                    "author_id": "author_design",
                    "caption": "Timber architecture gallery",
                    "hashtags": ["architecture", "timber"],
                    "location": "Kyoto",
                    "media_type": "image",
                    "likes_count": 12,
                    "comments_count": 3,
                    "created_at": "2026-11-12T12:00:00Z",
                },
                {
                    "id": "p_food_1",
                    "author_id": "author_food",
                    "caption": "Homemade pasta dinner",
                    "hashtags": ["cooking", "pasta"],
                    "location": "Rome",
                    "media_type": "image",
                    "likes_count": 15,
                    "comments_count": 1,
                    "created_at": "2026-11-12T11:00:00Z",
                },
            ],
        }

        res = self.client.post(
            "/api/ml/recommend/posts",
            payload,
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["success"])
        self.assertFalse(res.data["cold_start"])
        ranked_ids = [item["id"] for item in res.data["recommendations"]]
        self.assertEqual(ranked_ids[0], "p_arch_2")

    def test_cold_start_reel_recommendation_handles_empty_history(self):
        payload = {
            "user_id": "u_new",
            "limit": 3,
            "user_profile": {
                "liked_ids": [],
                "commented_ids": [],
                "followed_author_ids": [],
                "watch_history": {},
            },
            "peer_interactions": [],
            "candidates": [
                {
                    "id": "r_old_low",
                    "author_id": "a1",
                    "caption": "Morning walk",
                    "hashtags": ["walk"],
                    "audio_track": "Original",
                    "likes_count": 1,
                    "comments_count": 0,
                    "shares_count": 0,
                    "created_at": "2026-10-01T10:00:00Z",
                },
                {
                    "id": "r_hot_new",
                    "author_id": "a2",
                    "caption": "Drone sunset over Kyoto",
                    "hashtags": ["travel", "kyoto"],
                    "audio_track": "Ambient Sunset",
                    "likes_count": 200,
                    "comments_count": 30,
                    "shares_count": 15,
                    "created_at": "2026-11-12T14:00:00Z",
                },
            ],
        }

        res = self.client.post(
            "/api/ml/recommend/reels",
            payload,
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["cold_start"])
        self.assertEqual(res.data["recommendations"][0]["id"], "r_hot_new")

    def test_creator_diversity_prevents_monopolizing_top_slots(self):
        candidates = [
            {
                "id": f"p_same_{i}",
                "author_id": "author_spammer",
                "caption": f"Travel photo #{i}",
                "hashtags": ["travel"],
                "likes_count": 50 - i,
                "comments_count": 5,
                "created_at": "2026-11-12T14:00:00Z",
            }
            for i in range(4)
        ] + [
            {
                "id": "p_other",
                "author_id": "author_other",
                "caption": "Travel landscape view",
                "hashtags": ["travel"],
                "likes_count": 44,
                "comments_count": 5,
                "created_at": "2026-11-12T14:00:00Z",
            }
        ]

        res = self.client.post(
            "/api/ml/recommend/posts",
            {"user_id": "u_cold", "limit": 5, "candidates": candidates},
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 200)
        top_two = [item["id"] for item in res.data["recommendations"][:2]]
        self.assertIn("p_other", top_two)

    def test_validation_rejects_invalid_payload(self):
        res = self.client.post(
            "/api/ml/recommend/posts",
            {"user_id": "", "candidates": "not-a-list"},
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 400)

    def test_recommend_users_ranks_mutual_and_similar_interest_users_higher(self):
        payload = {
            "user_id": "u_target",
            "limit": 3,
            "user_profile": {
                "bio": "Landscape photographer and traveler",
                "top_hashtags": ["photography", "travel"],
                "following_ids": ["f1", "f2"],
                "interacted_author_ids": {"u_cand_interacted": 3.0},
            },
            "candidates": [
                {
                    "id": "u_cand_mutual",
                    "username": "alex_photo",
                    "full_name": "Alex Visuals",
                    "bio": "Travel and architecture photography",
                    "top_hashtags": ["photography", "travel"],
                    "followers_count": 80,
                    "posts_count": 15,
                    "mutual_follower_ids": ["f1", "f2"],
                    "mutual_follower_usernames": ["user_f1", "user_f2"],
                    "interaction_score": 0.0,
                },
                {
                    "id": "u_cand_unrelated",
                    "username": "crypto_trader",
                    "full_name": "Bob Trader",
                    "bio": "Finance and stock market analysis",
                    "top_hashtags": ["crypto", "finance"],
                    "followers_count": 5,
                    "posts_count": 2,
                    "mutual_follower_ids": [],
                    "mutual_follower_usernames": [],
                    "interaction_score": 0.0,
                },
                {
                    "id": "u_cand_interacted",
                    "username": "sara_cook",
                    "full_name": "Sara Chef",
                    "bio": "Baking cookies and sourdough",
                    "top_hashtags": ["food"],
                    "followers_count": 20,
                    "posts_count": 5,
                    "mutual_follower_ids": [],
                    "mutual_follower_usernames": [],
                    "interaction_score": 3.0,
                },
            ],
        }

        res = self.client.post(
            "/api/ml/recommend/users",
            payload,
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["success"])
        recs = res.data["recommendations"]
        self.assertGreaterEqual(len(recs), 2)
        # u_cand_mutual has 2 mutuals and matching bio/hashtags, so should rank #1
        self.assertEqual(recs[0]["id"], "u_cand_mutual")
        self.assertEqual(recs[0]["reason"], "mutual_followers")
        self.assertEqual(recs[0]["mutual_count"], 2)
        self.assertIn("user_f1", recs[0]["mutual_sample"])

    def test_recommend_users_cold_start_falls_back_to_popularity_and_activity(self):
        payload = {
            "user_id": "u_brand_new",
            "limit": 2,
            "user_profile": {
                "bio": "",
                "top_hashtags": [],
                "following_ids": [],
                "interacted_author_ids": {},
            },
            "candidates": [
                {
                    "id": "u_dormant",
                    "username": "dormant_user",
                    "full_name": "Dormant",
                    "bio": "Inactive account",
                    "followers_count": 1,
                    "posts_count": 0,
                    "mutual_follower_ids": [],
                },
                {
                    "id": "u_popular",
                    "username": "popular_creator",
                    "full_name": "Popular Creator",
                    "bio": "Daily creative content",
                    "followers_count": 500,
                    "posts_count": 40,
                    "mutual_follower_ids": [],
                },
            ],
        }

        res = self.client.post(
            "/api/ml/recommend/users",
            payload,
            format="json",
            HTTP_X_INTERNAL_SERVICE_KEY=TEST_SERVICE_KEY,
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["cold_start"])
        recs = res.data["recommendations"]
        self.assertEqual(recs[0]["id"], "u_popular")
        self.assertEqual(recs[0]["reason"], "popular")
