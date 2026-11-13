from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        cleaned = value.strip()
        if cleaned.endswith("Z"):
            cleaned = cleaned[:-1] + "+00:00"
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _normalize_array(arr: np.ndarray) -> np.ndarray:
    if arr.size == 0:
        return arr
    max_val = float(np.max(arr))
    if max_val <= 1e-9:
        return np.zeros_like(arr, dtype=np.float64)
    min_val = float(np.min(arr))
    if min_val >= 0.0:
        return arr / max_val
    if max_val - min_val <= 1e-9:
        return np.zeros_like(arr, dtype=np.float64)
    return (arr - min_val) / (max_val - min_val)


def _build_document_text(item: dict[str, Any]) -> str:
    caption = str(item.get("caption") or "").strip()
    hashtags = [str(t).strip().lstrip("#").lower() for t in (item.get("hashtags") or []) if t]
    location = str(item.get("location") or "").strip().lower()
    audio_track = str(item.get("audio_track") or "").strip().lower()
    media_type = str(item.get("media_type") or "").strip().lower()

    # Boost hashtags and location terms for stronger topical matching
    tag_tokens = " ".join(f"tag_{t} {t}" for t in hashtags)
    loc_tokens = f"loc_{location.replace(' ', '_')} {location}" if location else ""
    audio_tokens = f"audio_{audio_track.replace(' ', '_')} {audio_track}" if audio_track else ""
    parts = [caption, tag_tokens, loc_tokens, audio_tokens, media_type]
    return " ".join(p for p in parts if p).strip()


def _compute_content_scores(
    candidates: list[dict[str, Any]],
    user_weights: dict[str, float],
    followed_authors: set[str],
) -> np.ndarray:
    n = len(candidates)
    if n == 0:
        return np.zeros(0, dtype=np.float64)

    docs = [_build_document_text(c) for c in candidates]
    if not any(docs):
        return np.zeros(n, dtype=np.float64)

    # Build weighted user interest vector from interacted items and followed creators
    item_weights = np.zeros(n, dtype=np.float64)
    for idx, item in enumerate(candidates):
        cid = str(item.get("id") or "")
        author_id = str(item.get("author_id") or "")
        w = float(user_weights.get(cid, 0.0))
        if author_id in followed_authors:
            w += 1.2
        item_weights[idx] = w

    if float(np.sum(item_weights)) <= 0.0:
        return np.zeros(n, dtype=np.float64)

    try:
        vectorizer = TfidfVectorizer(
            max_features=1500,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
        )
        tfidf_matrix = vectorizer.fit_transform(docs)
        profile_vec = np.asarray(tfidf_matrix.T.dot(item_weights)).ravel()
        norm = float(np.linalg.norm(profile_vec))
        if norm <= 1e-9:
            return np.zeros(n, dtype=np.float64)
        profile_vec = (profile_vec / norm).reshape(1, -1)
        sims = cosine_similarity(tfidf_matrix, profile_vec).ravel()
        return _normalize_array(np.clip(sims, 0.0, 1.0))
    except ValueError:
        return np.zeros(n, dtype=np.float64)


def _compute_collaborative_scores(
    candidates: list[dict[str, Any]],
    user_weights: dict[str, float],
    peer_interactions: list[dict[str, Any]],
) -> np.ndarray:
    n = len(candidates)
    if n == 0 or not user_weights or not peer_interactions:
        return np.zeros(n, dtype=np.float64)

    target_items = set(user_weights.keys())
    target_norm = math.sqrt(sum(v * v for v in user_weights.values()))
    if target_norm <= 1e-9:
        return np.zeros(n, dtype=np.float64)

    candidate_idx = {str(c.get("id")): idx for idx, c in enumerate(candidates)}
    cf_scores = np.zeros(n, dtype=np.float64)

    for peer in peer_interactions:
        p_weights = peer.get("item_weights") or {}
        if not isinstance(p_weights, dict) or not p_weights:
            continue

        overlap = target_items.intersection(p_weights.keys())
        if not overlap:
            continue

        dot = sum(float(user_weights[k]) * float(p_weights[k]) for k in overlap)
        peer_norm = math.sqrt(sum(float(v) * float(v) for v in p_weights.values()))
        if peer_norm <= 1e-9:
            continue

        sim = dot / (target_norm * peer_norm)
        if sim <= 0.05:
            continue

        for cid, weight in p_weights.items():
            idx = candidate_idx.get(str(cid))
            if idx is not None:
                cf_scores[idx] += sim * float(weight)

    return _normalize_array(cf_scores)


def _compute_popularity_and_recency(
    candidates: list[dict[str, Any]],
    content_type: str,
) -> tuple[np.ndarray, np.ndarray]:
    n = len(candidates)
    if n == 0:
        return np.zeros(0, dtype=np.float64), np.zeros(0, dtype=np.float64)

    now = datetime.now(timezone.utc)
    half_life_hours = 48.0 if content_type == "reels" else 72.0

    pop_raw = np.zeros(n, dtype=np.float64)
    rec_raw = np.zeros(n, dtype=np.float64)

    for idx, item in enumerate(candidates):
        likes = max(0, int(item.get("likes_count") or 0))
        comments = max(0, int(item.get("comments_count") or 0))
        shares = max(0, int(item.get("shares_count") or 0))
        pop_raw[idx] = math.log1p(likes + 2.0 * comments + 2.0 * shares)

        created_dt = _parse_iso_datetime(item.get("created_at"))
        if created_dt is not None:
            age_hours = max(0.0, (now - created_dt).total_seconds() / 3600.0)
            rec_raw[idx] = math.exp(-age_hours / half_life_hours)
        else:
            rec_raw[idx] = 0.5

    return _normalize_array(pop_raw), _normalize_array(rec_raw)


def generate_hybrid_recommendations(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Hybrid CPU-friendly recommender combining:
      1. Content-based TF-IDF + cosine similarity (captions, hashtags, locations, audio, media type)
      2. Collaborative filtering via user-user cosine similarity over interaction weights
      3. Popularity + exponential time-decay recency signals (cold-start safe)
      4. Creator & hashtag diversity reranking
    """
    user_id = str(payload.get("user_id") or "").strip()
    content_type = str(payload.get("content_type") or "posts").strip().lower()
    candidates = payload.get("candidates") or []
    user_profile = payload.get("user_profile") or {}
    peer_interactions = payload.get("peer_interactions") or []
    limit = max(1, min(int(payload.get("limit") or 30), 100))

    if not candidates:
        return {
            "user_id": user_id,
            "content_type": content_type,
            "engine": "hybrid-tfidf-cf-v1",
            "cold_start": True,
            "recommendations": [],
        }

    liked_ids = {str(x) for x in (user_profile.get("liked_ids") or []) if x}
    commented_ids = {str(x) for x in (user_profile.get("commented_ids") or []) if x}
    followed_authors = {str(x) for x in (user_profile.get("followed_author_ids") or []) if x}
    watch_history = user_profile.get("watch_history") or {}

    # Build combined user-item interaction weights
    user_weights: dict[str, float] = {}
    for cid in liked_ids:
        user_weights[cid] = user_weights.get(cid, 0.0) + 2.5
    for cid in commented_ids:
        user_weights[cid] = user_weights.get(cid, 0.0) + 3.5
    if isinstance(watch_history, dict):
        for cid, meta in watch_history.items():
            if not isinstance(meta, dict):
                continue
            completion = max(0.0, min(1.0, float(meta.get("completion_rate") or 0.0)))
            duration_sec = max(0.0, float(meta.get("duration_sec") or 0.0))
            if duration_sec >= 2.0 or completion >= 0.25:
                watch_weight = 0.5 + 2.5 * completion
                user_weights[str(cid)] = user_weights.get(str(cid), 0.0) + watch_weight

    is_cold_start = len(user_weights) < 2 and len(followed_authors) == 0

    content_scores = _compute_content_scores(candidates, user_weights, followed_authors)
    cf_scores = _compute_collaborative_scores(candidates, user_weights, peer_interactions)
    pop_scores, recency_scores = _compute_popularity_and_recency(candidates, content_type)

    # Creator affinity signal
    interacted_authors = {
        str(c.get("author_id") or "")
        for c in candidates
        if str(c.get("id") or "") in user_weights
    }
    creator_scores = np.zeros(len(candidates), dtype=np.float64)
    for idx, item in enumerate(candidates):
        aid = str(item.get("author_id") or "")
        if aid in followed_authors:
            creator_scores[idx] = 1.0
        elif aid in interacted_authors:
            creator_scores[idx] = 0.5

    if is_cold_start:
        base_scores = 0.45 * pop_scores + 0.45 * recency_scores + 0.10 * content_scores
    else:
        base_scores = (
            0.32 * content_scores
            + 0.25 * cf_scores
            + 0.20 * creator_scores
            + 0.13 * pop_scores
            + 0.10 * recency_scores
        )

    # Demote already liked/commented items so unseen recommendations surface first
    for idx, item in enumerate(candidates):
        cid = str(item.get("id") or "")
        if cid in liked_ids or cid in commented_ids:
            base_scores[idx] *= 0.40

    # Iterative diversity reranking (creator repetition & overlapping hashtag damping)
    remaining = list(range(len(candidates)))
    selected: list[dict[str, Any]] = []
    creator_counts: dict[str, int] = {}
    seen_tags: dict[str, int] = {}

    target_count = min(limit, len(candidates))
    while remaining and len(selected) < target_count:
        best_pos = 0
        best_score = -1.0

        for pos, idx in enumerate(remaining):
            item = candidates[idx]
            aid = str(item.get("author_id") or "")
            tags = [str(t).strip().lstrip("#").lower() for t in (item.get("hashtags") or []) if t]

            creator_penalty = 0.55 ** creator_counts.get(aid, 0)
            tag_overlap = sum(seen_tags.get(t, 0) for t in tags[:3])
            tag_penalty = 1.0 / (1.0 + 0.15 * tag_overlap)

            adjusted = (float(base_scores[idx]) + 0.15) * creator_penalty * tag_penalty
            if adjusted > best_score:
                best_score = adjusted
                best_pos = pos

        chosen_idx = remaining.pop(best_pos)
        chosen = candidates[chosen_idx]
        aid = str(chosen.get("author_id") or "")
        creator_counts[aid] = creator_counts.get(aid, 0) + 1
        for t in (chosen.get("hashtags") or [])[:3]:
            clean_t = str(t).strip().lstrip("#").lower()
            if clean_t:
                seen_tags[clean_t] = seen_tags.get(clean_t, 0) + 1

        # Determine dominant reason label
        reason = "popular"
        if is_cold_start:
            reason = "trending" if pop_scores[chosen_idx] >= recency_scores[chosen_idx] else "recent"
        elif cf_scores[chosen_idx] >= max(content_scores[chosen_idx], creator_scores[chosen_idx]):
            reason = "collaborative"
        elif content_scores[chosen_idx] >= creator_scores[chosen_idx]:
            reason = "interests"
        elif aid in followed_authors:
            reason = "following"

        selected.append(
            {
                "id": str(chosen.get("id")),
                "score": round(float(best_score), 6),
                "reason": reason,
            }
        )

    return {
        "user_id": user_id,
        "content_type": content_type,
        "engine": "hybrid-tfidf-cf-v1",
        "cold_start": is_cold_start,
        "recommendations": selected,
    }


def generate_user_recommendations(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Dedicated user recommendation engine combining:
      1. Graph-based mutual followers & shared followed connections
      2. Bio & interest TF-IDF cosine similarity
      3. Past cross-content interaction affinity (likes, comments, watches)
      4. Account popularity and activity
      5. Reason attribution: mutual_followers, shared_interests, interacted_recently, popular, suggested_for_you
    """
    user_id = str(payload.get("user_id") or "").strip()
    candidates = payload.get("candidates") or []
    user_profile = payload.get("user_profile") or {}
    limit = max(1, min(int(payload.get("limit") or 15), 50))

    if not candidates:
        return {
            "user_id": user_id,
            "content_type": "users",
            "engine": "user-graph-interest-v1",
            "cold_start": True,
            "recommendations": [],
        }

    n = len(candidates)
    following_ids = {str(x) for x in (user_profile.get("following_ids") or []) if x}
    interacted_author_map = {
        str(k): float(v)
        for k, v in (user_profile.get("interacted_author_ids") or {}).items()
        if k
    }
    target_bio = str(user_profile.get("bio") or "").strip()
    target_interests = [
        str(t).strip().lstrip("#").lower()
        for t in (user_profile.get("top_hashtags") or user_profile.get("interests") or [])
        if t
    ]
    target_doc = f"{target_bio} {' '.join(target_interests)}".strip()

    is_cold_start = len(following_ids) == 0 and len(interacted_author_map) == 0

    # 1. Mutual follower graph score
    mutual_scores = np.zeros(n, dtype=np.float64)
    for idx, c in enumerate(candidates):
        mutuals = c.get("mutual_follower_ids") or []
        m_count = len(mutuals)
        if m_count > 0:
            mutual_scores[idx] = min(1.0, 0.40 + 0.20 * math.log2(1 + m_count))

    # 2. Bio & Interest TF-IDF similarity
    content_scores = np.zeros(n, dtype=np.float64)
    cand_docs = []
    for c in candidates:
        cbio = str(c.get("bio") or "").strip()
        ctags = [str(t).strip().lstrip("#").lower() for t in (c.get("top_hashtags") or []) if t]
        cand_docs.append(f"{cbio} {' '.join(ctags)}".strip())

    if target_doc and any(cand_docs):
        all_docs = [target_doc] + cand_docs
        try:
            vectorizer = TfidfVectorizer(max_features=1000, stop_words="english", ngram_range=(1, 2))
            mat = vectorizer.fit_transform(all_docs)
            target_vec = mat[0:1]
            cand_vecs = mat[1:]
            sims = cosine_similarity(cand_vecs, target_vec).ravel()
            content_scores = _normalize_array(np.clip(sims, 0.0, 1.0))
        except ValueError:
            content_scores = np.zeros(n, dtype=np.float64)

    # 3. Prior interaction affinity score
    affinity_scores = np.zeros(n, dtype=np.float64)
    for idx, c in enumerate(candidates):
        cid = str(c.get("id") or "")
        raw_aff = float(interacted_author_map.get(cid, 0.0)) + float(c.get("interaction_score", 0.0))
        if raw_aff > 0.0:
            affinity_scores[idx] = math.log1p(raw_aff)
    affinity_scores = _normalize_array(affinity_scores)

    # 4. Popularity score (followers & activity)
    pop_scores = np.zeros(n, dtype=np.float64)
    for idx, c in enumerate(candidates):
        f_count = max(0, int(c.get("followers_count") or 0))
        p_count = max(0, int(c.get("posts_count") or 0))
        pop_scores[idx] = math.log1p(f_count + 1.5 * p_count)
    pop_scores = _normalize_array(pop_scores)

    # 5. Composite score
    if is_cold_start:
        final_scores = 0.55 * pop_scores + 0.35 * content_scores + 0.10 * affinity_scores
    else:
        final_scores = (
            0.35 * mutual_scores
            + 0.25 * content_scores
            + 0.20 * affinity_scores
            + 0.20 * pop_scores
        )

    # Rank indices
    ranked_indices = sorted(range(n), key=lambda i: float(final_scores[i]), reverse=True)[:limit]

    results: list[dict[str, Any]] = []
    for idx in ranked_indices:
        c = candidates[idx]
        cid = str(c.get("id"))
        mutual_ids = c.get("mutual_follower_ids") or []
        mutual_names = c.get("mutual_follower_usernames") or []

        # Determine dominant human-readable reason
        if len(mutual_ids) > 0:
            reason = "mutual_followers"
        elif affinity_scores[idx] >= 0.25:
            reason = "interacted_recently"
        elif content_scores[idx] >= 0.20:
            reason = "shared_interests"
        elif pop_scores[idx] >= 0.40 or int(c.get("followers_count") or 0) >= 10:
            reason = "popular"
        else:
            reason = "suggested_for_you"

        results.append({
            "id": cid,
            "score": round(float(final_scores[idx]), 6),
            "reason": reason,
            "mutual_count": len(mutual_ids),
            "mutual_sample": mutual_names[:2],
        })

    return {
        "user_id": user_id,
        "content_type": "users",
        "engine": "user-graph-interest-v1",
        "cold_start": is_cold_start,
        "recommendations": results,
    }
