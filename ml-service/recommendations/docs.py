# Insta-V2 Machine Learning Recommendation Engine Technical Documentation

RECOMMENDATION_ENGINE_DOCS_MARKDOWN = """# Insta-V2 Recommendation Engine Architecture & Mathematical Specification

Welcome to the technical documentation for the **Insta-V2 Machine Learning Recommendation Engine**.

This document outlines the algorithms, mathematical models, scoring equations, caching strategies, and end-to-end data pipeline powering personalized discovery across **Recommended Users**, **Recommended Posts**, and **Recommended Reels**.

---

## 1. System Architecture & End-to-End Pipeline

Insta-V2 employs a decoupled, multi-tiered microservice architecture designed to isolate heavy mathematical computation and feature vectorization from user-facing web operations.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 19 + Vite Frontend                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1. GET /api/recommendations/{users,posts,reels}
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Node.js / Express Core Backend API                     │
│  - Privacy & Permission Guards (canViewUserContent)                    │
│  - Single-Flight Request Deduplication                                 │
│  - In-Memory Fisher-Yates Shuffling (recommendationShuffleService.js)  │
│  - Session Sequence Tracker (Zero duplicate items across pages)        │
└──────────────┬──────────────────────────────────────────▲──────────────┘
               │ 2. Check Candidate Cache                 │ 5. Populate Docs
               ▼                                          │    & Attach Meta
┌──────────────────────────────┐              ┌───────────┴──────────────┐
│  Redis / LRU In-Memory Cache │              │      MongoDB Atlas       │
│  - 300s TTL per User/Type    │              │  Users, Posts, Reels,    │
│  - Pool: 50 Users, 80 Posts, │              │  Follows, Likes, Watches │
│         60 Reels             │              └──────────────────────────┘
└──────────────┬───────────────┘
               │ 3. On Cache Miss: Query Candidate Metadata (2x Pool)
               │    + Internal HMAC Auth Request (X-Internal-Service-Key)
               ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Python / Django ML Microservice (Port 8001)               │
│  - Endpoint Router (recommendations/views.py)                          │
│  - HMAC Shared-Secret Security Guard (recommendations/auth.py)         │
│  - Hybrid Recommendation Engine (recommendations/engine.py)            │
│    • TF-IDF Vectorization & Cosine Similarity                          │
│    • User-User Collaborative Filtering                                 │
│    • Watch-Time & Completion Rate Video Telemetry                      │
│    • Exponential Recency Time-Decay                                    │
│    • Iterative Diversity & Repetition Damping Reranking                │
└────────────────────────────────────────────────────────────────────────┘
```

### Complete Request Lifecycle
1. **Frontend Request:** The React client requests a page of recommendations via `/api/recommendations/{posts|reels|users}?page=1&limit=15`.
2. **Cache Verification:** Node.js checks Redis (or the in-memory LRU fallback) for an unexpired candidate pool for `${userId}:${contentType}`.
3. **Cache Hit & Fisher-Yates Shuffling:** If a warm candidate pool exists, Node.js uses `recommendationShuffleService.js` to shuffle an array clone, track displayed IDs in a session sequence, prioritize unseen candidates on refresh (`page=1`), and return paginated results **without invoking the Django ML engine**.
4. **Cache Miss & Feature Extraction:** If the cache is cold, Node.js gathers candidate contexts (up to $2 \times \text{poolSize}$) and past user interactions from MongoDB Atlas. It sends a structured payload to the Django ML microservice via HTTP `POST` authenticated with `X-Internal-Service-Key`.
5. **Django ML Scoring:** Django calculates multi-signal scores (TF-IDF content similarity, collaborative filtering, creator affinity, engagement popularity, and recency decay), applies diversity reranking, and returns sorted candidate IDs with score metadata and reason labels.
6. **Cache Storage & Population:** Node.js caches the ranked candidate IDs (50–80 items) with a 300-second TTL, retrieves the corresponding MongoDB documents, filters out any private content unauthorized for the viewer, and returns the enriched response to React.

---

## 2. Multi-Tier Resilience & Fault Tolerance

To guarantee zero downtime and low latency, the system implements a 4-tier fallback hierarchy:

1. **Tier 1 — Active Django ML Service:** Primary hybrid scoring pipeline executing live vectorization and collaborative ranking.
2. **Tier 2 — Stale Cache Serving:** If Django times out ($>3500\\text{ms}$) or throws a $5\\text{xx}$ error, Node.js serves candidates from the previous cache cycle.
3. **Tier 3 — Heuristic MongoDB Fallback:** If the cache is empty (cold user) and Django is down, Node.js computes heuristic scores directly in MongoDB:
   $$\\text{Score}_{\\text{fallback}} = 0.45 \\cdot e^{-\\Delta t / 72} + 0.35 \\cdot \\frac{\\ln(1 + \\text{likes} + 2\\text{comments} + 2\\text{shares})}{6} + 0.35 \\cdot \\mathbb{I}_{\\text{following}} + \\epsilon$$
   where $\\epsilon \\sim \\mathcal{U}(0, 0.25)$ introduces non-repeating shuffle variety.
4. **Tier 4 — Circuit Breaker:** After 3 consecutive ML service failures, a circuit breaker trips to `OPEN` for a 30-second cooldown period (`ML_CIRCUIT_COOLDOWN_MS=30000`), immediately serving Tier 2 or 3 without blocking Node.js event loops.

---

## 3. Recommended Users Engine (`user-graph-interest-v1`)

- **Implementation Function:** `generate_user_recommendations(payload)` in `recommendations/engine.py`.
- **Purpose:** Discovers accounts the authenticated user is likely to follow based on graph connectivity, mutual friends, shared interests, and historical engagement.

### Mathematical Formulation & Scoring Signals

The final ranking score $S_{\\text{user}}(u, c)$ for candidate $c$ and target user $u$ is a weighted composite of four normalized signals:

#### Signal 1: Mutual Follower Graph Affinity ($S_{\\text{mutual}}$)
Let $m_c = |\\text{MutualFollowers}(u, c)|$ be the count of mutual followers.
$$S_{\\text{mutual}}(u, c) = \\begin{cases} \\min\\left(1.0, 0.40 + 0.20 \\cdot \\log_2(1 + m_c)\\right) & \\text{if } m_c > 0 \\\\ 0.0 & \\text{if } m_c = 0 \\end{cases}$$
*Properties:* Gives an immediate baseline boost ($0.40$) for any shared connection, scaling logarithmically with diminishing returns as mutual connections increase.

#### Signal 2: Profile Bio & Interest TF-IDF Cosine Similarity ($S_{\\text{content}}$)
User interest documents are constructed by concatenating biography text with normalized hashtag tokens:
$$D = \\text{bio} \\mathbin{\\Vert} \\text{tags}$$
Features are extracted using unigram and bigram TF-IDF vectorization:
$$\\operatorname{TF-IDF}(t, D) = \\operatorname{TF}(t, D) \\cdot \\left(\\ln\\left(\\frac{1 + N}{1 + \\operatorname{DF}(t)}\\right) + 1\\right)$$
Cosine similarity between candidate vector $\\mathbf{v}_c$ and target profile vector $\\mathbf{v}_u$:
$$\\operatorname{sim}_{\\text{cos}}(\\mathbf{v}_c, \\mathbf{v}_u) = \\frac{\\mathbf{v}_c \\cdot \\mathbf{v}_u}{\\|\\mathbf{v}_c\\|_2 \\|\\mathbf{v}_u\\|_2}$$
$$S_{\\text{content}}(u, c) = \\operatorname{Normalize}\\left(\\operatorname{clip}\\left(\\operatorname{sim}_{\\text{cos}}(\\mathbf{v}_c, \\mathbf{v}_u), 0.0, 1.0\\right)\\right)$$

#### Signal 3: Prior Cross-Content Interaction Affinity ($S_{\\text{affinity}}$)
Measures historical direct engagements (likes, comments, Reel watches) by user $u$ on candidate $c$'s published content:
$$A_c = \\text{Interactions}(u, c) + \\text{DirectScore}(c)$$
$$S_{\\text{affinity}}^{\\text{raw}}(u, c) = \\ln(1 + A_c)$$
$$S_{\\text{affinity}}(u, c) = \\operatorname{Normalize}\\left(S_{\\text{affinity}}^{\\text{raw}}\\right)$$

#### Signal 4: Account Popularity & Platform Activity ($S_{\\text{pop}}$)
$$S_{\\text{pop}}^{\\text{raw}}(c) = \\ln(1 + \\text{FollowersCount}(c) + 1.5 \\cdot \\text{PostsCount}(c))$$
$$S_{\\text{pop}}(c) = \\operatorname{Normalize}\\left(S_{\\text{pop}}^{\\text{raw}}\\right)$$

### Composite User Scoring Equation

$$\\boxed{S_{\\text{user}}(u, c) = \\begin{cases} 
0.35 \\cdot S_{\\text{mutual}} + 0.25 \\cdot S_{\\text{content}} + 0.20 \\cdot S_{\\text{affinity}} + 0.20 \\cdot S_{\\text{pop}} & \\text{(Warm User)} \\\\[6pt]
0.55 \\cdot S_{\\text{pop}} + 0.35 \\cdot S_{\\text{content}} + 0.10 \\cdot S_{\\text{affinity}} & \\text{(Cold-Start User)} 
\\end{cases}}$$

*Cold-Start Definition:* A user with $0$ following relationships and $0$ logged author interactions.

### Attribution Reason Logic
- `mutual_followers`: Assigned when $m_c > 0$.
- `interacted_recently`: Assigned when $S_{\\text{affinity}} \\ge 0.25$.
- `shared_interests`: Assigned when $S_{\\text{content}} \\ge 0.20$.
- `popular`: Assigned when $S_{\\text{pop}} \\ge 0.40$ or $\\text{FollowersCount}(c) \\ge 10$.
- `suggested_for_you`: Fallback assignment.

---

## 4. Recommended Posts Engine (`hybrid-tfidf-cf-v1`)

- **Implementation Function:** `generate_hybrid_recommendations(payload)` with `content_type="posts"`.
- **Purpose:** Surfaces relevant, engaging, and topically aligned photo posts tailored to the viewer's explicit and implicit interests.

### 1. Interaction Weight Construction
User-item interactions are mapped into a scalar interest weight dictionary $W(u, i)$:
$$W(u, i) = \\sum_{a \\in \\text{Actions}(u, i)} w_a$$
- **Like:** $w_{\\text{like}} = +2.5$
- **Comment:** $w_{\\text{comment}} = +3.5$
- **Followed Author Boost:** Items by creators the user already follows receive an additional $+1.2$ during TF-IDF profile projection.

### 2. Multi-Signal Scoring Equations

#### A. Content-Based TF-IDF Profile Matching ($S_{\\text{content}}$)
Each post document aggregates caption text, boosted hashtag tokens, location markers, and media metadata:
$$D_i = \\text{caption} \\mathbin{\\Vert} \\left(\\bigcup_{t \\in \\text{tags}} \\text{tag\\_}t \\mathbin{\\Vert} t\\right) \\mathbin{\\Vert} \\text{loc\\_}l \\mathbin{\\Vert} \\text{media\\_type}$$
The target user's preference vector $\\mathbf{u}$ is calculated by the matrix-vector dot product of the candidate TF-IDF matrix $\\mathbf{X} \\in \\mathbb{R}^{N \\times V}$ and the interaction weight vector $\\mathbf{w}$:
$$\\mathbf{u} = \\mathbf{X}^T \\mathbf{w}, \\quad \\mathbf{u}_{\\text{norm}} = \\frac{\\mathbf{u}}{\\|\\mathbf{u}\\|_2}$$
The content similarity for candidate $i$ is:
$$S_{\\text{content}}(u, i) = \\operatorname{Normalize}\\left(\\operatorname{clip}\\left(\\mathbf{X}_i \\cdot \\mathbf{u}_{\\text{norm}}^T, 0.0, 1.0\\right)\\right)$$

#### B. User-User Collaborative Filtering ($S_{\\text{CF}}$)
Peers $p \\in P$ who have interacted with items overlapping user $u$'s history are evaluated using interaction weight cosine similarity:
$$\\operatorname{sim}_{\\text{peer}}(u, p) = \\frac{\\sum_{j \\in I_u \\cap I_p} W(u, j) \\cdot W(p, j)}{\\sqrt{\\sum_{j \\in I_u} W(u, j)^2} \\cdot \\sqrt{\\sum_{k \\in I_p} W(p, k)^2}}$$
For all peers exceeding the significance threshold $\\operatorname{sim}_{\\text{peer}}(u, p) > 0.05$:
$$\\text{CF}_{i} = \\sum_{p : \\operatorname{sim}(u, p) > 0.05} \\operatorname{sim}_{\\text{peer}}(u, p) \\cdot W(p, i)$$
$$S_{\\text{CF}}(u, i) = \\operatorname{Normalize}(\\text{CF}_{i})$$

#### C. Creator Affinity Signal ($S_{\\text{creator}}$)
$$S_{\\text{creator}}(u, i) = \\begin{cases} 
1.0 & \\text{if Author}(i) \\in \\text{Following}(u) \\\\ 
0.5 & \\text{if Author}(i) \\in \\text{InteractedAuthors}(u) \\\\ 
0.0 & \\text{otherwise} 
\\end{cases}$$

#### D. Engagement Popularity ($S_{\\text{pop}}$)
$$\\text{Pop}_i = \\ln(1 + \\text{Likes}_i + 2.0 \\cdot \\text{Comments}_i + 2.0 \\cdot \\text{Shares}_i)$$
$$S_{\\text{pop}}(i) = \\operatorname{Normalize}(\\text{Pop}_i)$$

#### E. Exponential Recency Time-Decay ($S_{\\text{recency}}$)
Posts decay according to a **72-hour half-life parameter** ($T_{1/2} = 72.0\\text{ hours}$):
$$\\lambda = \\frac{1}{T_{1/2}} = \\frac{1}{72.0}$$
$$\\text{Recency}_i = \\exp\\left(-\\frac{\\Delta t_{\\text{hours}}}{72.0}\\right)$$
$$S_{\\text{recency}}(i) = \\operatorname{Normalize}(\\text{Recency}_i)$$

### 3. Base Composite Score
$$\\boxed{S_{\\text{base}}(u, i) = \\begin{cases} 
0.32 \\cdot S_{\\text{content}} + 0.25 \\cdot S_{\\text{CF}} + 0.20 \\cdot S_{\\text{creator}} + 0.13 \\cdot S_{\\text{pop}} + 0.10 \\cdot S_{\\text{recency}} & \\text{(Warm User)} \\\\[6pt]
0.45 \\cdot S_{\\text{pop}} + 0.45 \\cdot S_{\\text{recency}} + 0.10 \\cdot S_{\\text{content}} & \\text{(Cold-Start User)} 
\\end{cases}}$$

#### Previously Consumed Demotion
If candidate item $i$ has already been liked or commented on by user $u$:
$$S_{\\text{base}}(u, i) \\leftarrow S_{\\text{base}}(u, i) \\cdot 0.40$$

### 4. Iterative Diversity & Repetition Damping Reranking
To prevent single-creator dominance and repetitive hashtag echo chambers, candidates are reranked greedily using dynamic penalties:
$$S_{\\text{adjusted}}(i) = \\left(S_{\\text{base}}(i) + 0.15\\right) \\cdot P_{\\text{creator}}(i) \\cdot P_{\\text{tag}}(i)$$
- **Creator Saturation Penalty:**
  $$P_{\\text{creator}}(i) = 0.55^{C(\\text{Author}(i))}$$
  where $C(a)$ is the count of items by author $a$ already selected in the current recommendation set.
- **Hashtag Overlap Penalty:**
  $$P_{\\text{tag}}(i) = \\frac{1}{1.0 + 0.15 \\cdot \\sum_{t \\in \\text{tags}_i[:3]} H(t)}$$
  where $H(t)$ is the frequency of hashtag $t$ among already selected items.

---

## 5. Recommended Reels Engine (`hybrid-tfidf-cf-v1`)

- **Implementation Function:** `generate_hybrid_recommendations(payload)` with `content_type="reels"`.
- **Purpose:** Optimizes vertical short-form video discovery using implicit watch telemetry and audio-visual affinity signals.

### 1. Watch-Time & Video Completion Telemetry
Unlike static posts, Reels incorporate passive consumption signals transmitted by the frontend video player:

$$\\text{CompletionRate} = \\min\\left(1.0, \\frac{\\text{WatchDurationSeconds}}{\\text{VideoDurationSeconds}}\\right)$$

When $\\text{WatchDuration} \\ge 2.0\\text{s}$ or $\\text{CompletionRate} \\ge 0.25$, the item receives an implicit watch weight:
$$\\boxed{W_{\\text{watch}}(u, r) = 0.5 + 2.5 \\cdot \\text{CompletionRate}}$$

This weight is combined with explicit interactions:
$$W(u, r) = 2.5 \\cdot \\mathbb{I}_{\\text{liked}} + 3.5 \\cdot \\mathbb{I}_{\\text{commented}} + W_{\\text{watch}}(u, r)$$

### 2. Audio Track & Acoustic Affinity
Reel documents include normalized audio track markers:
$$D_r = \\text{caption} \\mathbin{\\Vert} \\text{tags} \\mathbin{\\Vert} \\text{audio\\_}a \\mathbin{\\Vert} \\text{media\\_video}$$
Users who repeatedly complete Reels with shared audio tracks develop strong cosine affinity toward candidate videos sharing the same acoustic signature.

### 3. Accelerated Recency Decay
Short-form video trends evolve rapidly. The Reels pipeline uses an accelerated **48-hour half-life** ($T_{1/2} = 48.0\\text{ hours}$):
$$\\text{Recency}_r = \\exp\\left(-\\frac{\\Delta t_{\\text{hours}}}{48.0}\\right)$$

---

## 6. Algorithmic Reference & Complexity Matrix

| Component | Target Pipeline | Complexity | Primary Input Signals | Normalization Method |
| :--- | :--- | :--- | :--- | :--- |
| **Mutual Graph** | Users | $\\mathcal{O}(|C|)$ | Bidirectional follow table intersections | $\\min(1.0, 0.40 + 0.20 \\log_2(1+m))$ |
| **TF-IDF Profile** | Posts, Reels, Users | $\\mathcal{O}(N \\cdot V)$ | Captions, hashtags, audio tracks, locations, bio | Unit $\\ell_2$ norm + Min-Max scaling |
| **User-User CF** | Posts, Reels | $\\mathcal{O}(|P| \\cdot |I_p|)$ | Historical interaction matrices ($W(u, i)$) | Dot product over $\\ell_2$ norms + Min-Max |
| **Popularity** | Posts, Reels, Users | $\\mathcal{O}(|C|)$ | Likes, comments, shares, follower counts | $\\ln(1 + x)$ + Min-Max scaling |
| **Recency Decay** | Posts, Reels | $\\mathcal{O}(|C|)$ | ISO 8601 creation timestamp | $\\exp(-\\Delta t / T_{1/2})$ |
| **Diversity Rerank** | Posts, Reels | $\\mathcal{O}(K \\cdot |C|)$ | Creator selection frequency & hashtag overlap | Exponential decay ($0.55^C$) & Harmonic damper |

---

## 7. Python Implementation Map

The recommendation engine is implemented across the following modules:

```text
ml-service/
├── ml_project/
│   ├── settings.py           # Allowed hosts, proxy headers, environment variables
│   └── urls.py               # Routes /docs/recommendation-engine/ and /api/ml/
└── recommendations/
    ├── engine.py             # Mathematical ranking, TF-IDF vectorization, CF, and damping
    │   ├── _normalize_array()
    │   ├── _build_document_text()
    │   ├── _compute_content_scores()
    │   ├── _compute_collaborative_scores()
    │   ├── _compute_popularity_and_recency()
    │   ├── generate_hybrid_recommendations()
    │   └── generate_user_recommendations()
    ├── views.py              # Endpoint dispatchers: /recommend/users, /posts, /reels
    ├── auth.py               # Constant-time HMAC comparison (verify_internal_service_request)
    └── docs.py               # Markdown technical specification source
```

### Core Dependencies
- **`scikit-learn` (v1.5+):** Powers `TfidfVectorizer` (sublinear term frequency, English stop-word filtering, n-gram extraction) and `cosine_similarity`.
- **`numpy` (v2.0+):** Vectorized mathematical array operations, $\\ell_2$ norm evaluations, clipping, and Min-Max array scaling.
- **`django` (v5.1+):** Microservice request routing, URL management, and WSGI execution.
- **`gunicorn` (v22.0+):** High-throughput WSGI HTTP server binding `0.0.0.0:$PORT` in production.

---

## 8. Summary of Future Directions

While the current engine delivers CPU-friendly, low-latency hybrid scoring with diversity reranking, planned future improvements include:
- **Two-Tower Neural Embeddings:** Replacing TF-IDF vectors with dual-encoder PyTorch / ONNX representations for semantic text and visual embeddings.
- **Approximate Nearest Neighbors (ANN):** Integrating HNSW / FAISS indexing for million-scale candidate retrieval.
- **Real-Time Contextual Bandits:** Reinforcement learning balancing exploration versus exploitation based on real-time scroll velocity and bounce rates.
"""
