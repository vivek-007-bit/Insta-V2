# Insta-V2 — Production-Grade Full-Stack Social Platform & ML Recommendation System

Insta-V2 is an end-to-end, full-featured Instagram engineering reproduction built with a modern decoupled architecture: a reactive **React 19 + Vite** frontend, a high-throughput **Node.js + Express** core API with real-time **Socket.IO** capabilities, and a dedicated **Python + Django** Machine Learning microservice powering a hybrid Content-Based & Collaborative-Filtering recommendation engine.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Project Structure](#project-structure)
5. [Feature Tour](#feature-tour)
6. [Recommendation Engine & Shuffling Architecture](#recommendation-engine--shuffling-architecture)
   - [Algorithmic & Mathematical Summary of the Three Recommendation Engines](#algorithmic--mathematical-summary-of-the-three-recommendation-engines)
7. [Environment Variables](#environment-variables)
8. [Installation & Local Setup](#installation--local-setup)
9. [Running the Application Locally](#running-the-application-locally)
10. [API Documentation](#api-documentation)
11. [Deployment Guide](#deployment-guide)
12. [Security & Privacy Model](#security--privacy-model)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Automated Verification & Test Suites](#automated-verification--test-suites)

---

## Project Overview

Insta-V2 provides a complete, polished social media platform designed for scale, resilience, and realistic user engagement:
- **Core Social Experience:** Authenticated user profiles, public and private accounts, two-way follow graph, follow requests, photo feed, 24-hour expiring Stories, vertical full-screen Reels, likes, comments, post sharing, and instant search across users, tags, and places.
- **Real-Time Communication:** Direct 1-on-1 messaging, online presence indicators, and live notification badges via Socket.IO connected over private user/conversation rooms.
- **Triple-Engine ML Recommendations:** Independent pipelines generating personalized candidates for **Recommended Users**, **Recommended Posts**, and **Recommended Reels** using TF-IDF text vectorization, cosine similarity, user-user collaborative filtering, recency decay, and video completion rate telemetry.
- **Dynamic Content Freshness:** In-memory Fisher-Yates shuffling of cached recommendation candidate pools (50–80 items), session-scoped pagination preventing duplicate content, and smart deprioritization of previously displayed items on refresh without triggering unnecessary ML model computations.
- **Fault-Tolerant Resilience:** Multi-tier fallback hierarchy (Django ML $\to$ Stale Cache $\to$ MongoDB Popularity/Recency) with circuit breaker protection and automatic Redis-to-LRU memory caching fallback.

---

## Technology Stack

### Client (`client/`)
- **Core Framework:** React 19, Vite 6
- **Routing & Navigation:** React Router DOM v7
- **HTTP Client:** Axios (configured with `withCredentials: true` for HTTP-only cookie authentication)
- **Real-Time Networking:** Socket.IO Client v4
- **UI & Icons:** Lucide React, Custom CSS Variables, Responsive Grid/Flexbox Layouts, Instagram-matching Navigation Icons

### Core Backend API (`server/`)
- **Runtime:** Node.js (v18+)
- **Server Framework:** Express.js 4
- **Database & ODM:** MongoDB Atlas with Mongoose 8
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `cookie-parser`, `express-rate-limit`, `cors`
- **Real-Time Engine:** Socket.IO 4 (integrated with Express HTTP server)
- **Media Asset Storage:** Cloudinary SDK v2 (backend-generated cryptographic upload signatures for direct-to-cloud signed uploads)
- **Caching & Shuffling:** Redis Client v6 with built-in in-memory LRU + TTL cache fallback and Fisher-Yates shuffling engine

### ML Microservice (`ml-service/`)
- **Runtime:** Python 3.10+
- **Web Framework:** Django 5+ (lightweight WSGI microservice mode)
- **Machine Learning & Math:** `scikit-learn` (TF-IDF Vectorizer, Cosine Similarity), `numpy`
- **Production Server:** Gunicorn (WSGI HTTP server for Render deployment)
- **Inter-Service Authentication:** Shared-secret HMAC verification via `X-Internal-Service-Key` header

---

## System Architecture

Insta-V2 implements a decoupled three-tier architecture ensuring strict isolation between user-facing web traffic, business operations, media pipelines, and CPU-intensive machine learning algorithms.

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Layer (Netlify / Browser)"]
        UI["React 19 + Vite SPA<br/>(Port 5173 / Netlify CDN)"]
        WS_Client["Socket.IO Client<br/>(Real-Time Engine)"]
    end

    subgraph Core_Backend ["Core Backend Layer (Render Web Service)"]
        Express["Express.js API Server<br/>(Port 8000)"]
        SocketServer["Socket.IO Server<br/>(Attached to HTTP Server)"]
        AuthMiddleware["JWT Cookie Auth<br/>& Privacy Guard"]
        ShuffleService["In-Memory Shuffle Service<br/>(Fisher-Yates + Session Tracker)"]
        CacheLayer["Recommendation Cache<br/>(Redis or LRU Fallback)"]
        CircuitBreaker["Circuit Breaker & Fallback<br/>(MongoDB Query Engine)"]
    end

    subgraph ML_Microservice ["ML Microservice (Render Web Service)"]
        Django["Django 5 ML Service<br/>(Port 8001 / Gunicorn)"]
        AuthFilter["X-Internal-Service-Key<br/>Header Guard"]
        HybridEngine["Hybrid Recommendation Engine<br/>(TF-IDF + CF + Recency)"]
    end

    subgraph External_Storage ["External Cloud Infrastructure"]
        MongoDB[("MongoDB Atlas<br/>Users, Posts, Reels, Follows,<br/>Stories, Messages, Notifications")]
        Cloudinary["Cloudinary CDN<br/>Signed Video & Image Storage"]
    end

    %% Client Interactions
    UI -->|"1. HTTPS API Requests<br/>(with HTTP-Only Cookie)"| Express
    UI -->|"2. Direct Signed Media Uploads"| Cloudinary
    WS_Client <-->|"3. WSS Bi-directional Events"| SocketServer

    %% Backend Operations
    Express --> AuthMiddleware
    AuthMiddleware -->|"Read / Write State"| MongoDB
    Express -->|"Generate Signed Upload Preset"| Cloudinary
    SocketServer -->|"Broadcast Real-Time Events"| UI

    %% ML Recommendation Flow
    Express -->|"4. Fetch Recs (Cache Hit)"| CacheLayer
    CacheLayer --> ShuffleService
    ShuffleService -->|"5. Return Shuffled Page"| UI
    Express -->|"6. Cache Miss (Internal HMAC Call)"| AuthFilter
    AuthFilter --> Django
    Django --> HybridEngine
    HybridEngine -->|"7. Ranked Candidate IDs"| Express
    Express -->|"Store Pool (50-80 Items)"| CacheLayer
    Express -.->|"8. If Django Down (Fallback)"| CircuitBreaker
    CircuitBreaker -->|"Heuristic Recs"| MongoDB
```

### Communication Flow & Lifecycle
1. **Frontend to Core API:** All user requests pass through `http://localhost:8000/api` (or Netlify `/api` proxy). Authentication state is managed via secure, HTTP-only JWT cookies automatically attached by the browser.
2. **Media Ingestion Pipeline:** To eliminate server bandwidth bottlenecks, the client requests a signed cryptographic upload token (`/api/media/signature` or `/api/reels/upload-signature`). The browser uploads binary media directly to Cloudinary CDN, receiving a verified secure URL. The client then persists metadata back to MongoDB through Express.
3. **Internal Recommendation Pipeline:** Express serves recommendation requests. On a cache hit, Node.js shuffles the cached pool in memory and returns paginated candidates without invoking Django. On a cache miss, Express queries MongoDB candidate contexts and makes an authenticated HTTP `POST` request to Django on `http://127.0.0.1:8001` passing the internal header `X-Internal-Service-Key`.
4. **Resilience & Circuit Breaking:** If the Django service fails or times out (3500ms threshold), a circuit breaker records the fault. After 3 consecutive failures, the circuit opens for 30 seconds, immediately falling back to warm stale caches or MongoDB engagement queries to preserve zero-latency user experiences.

---

## Project Structure

```text
Instagram/
├── client/                               # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/                   # UI components, modals, layout guards
│   │   │   ├── auth/                     # ProtectedRoute, AuthLayout
│   │   │   ├── comments/                 # Comment list, comment input modal
│   │   │   ├── feed/                     # PostCard, StoriesBar, PostModal
│   │   │   ├── navigation/               # Sidebar, SearchPanel, NotificationsPanel, RightPanel
│   │   │   ├── profile/                  # ProfileHeader, ProfileTabs, FollowListModal
│   │   │   ├── reels/                    # ReelPlayer, ReelCommentsModal, ReelShareModal
│   │   │   └── stories/                  # StoryViewer, StoryUploadModal
│   │   ├── context/                      # AppContext (Auth, Notifications, Sockets, Unread counts)
│   │   ├── pages/                        # Home, Profile, Reels, Explore, Messages, Login, Signup
│   │   ├── services/                     # Centralized Axios API client, authService, recommendationService
│   │   ├── App.jsx                       # Master route definitions
│   │   ├── index.css                     # Design tokens, CSS variables, dark/light styling
│   │   └── main.jsx                      # App root mount
│   ├── netlify.toml                      # Netlify SPA redirects and /api proxy configuration
│   ├── vite.config.js                    # Vite bundler configuration
│   ├── .env.example                      # Client environment template
│   └── package.json
│
├── server/                               # Core Express + MongoDB + Cloudinary backend
│   ├── config/                           # Database connector (db.js), Cloudinary SDK (cloudinary.js), Socket.IO (socket.js)
│   ├── controllers/                      # Request handlers for auth, media, posts, reels, stories, messages, search
│   ├── middleware/                       # authMiddleware (JWT verify), errorMiddleware, privacyMiddleware
│   ├── models/                           # User, Post, Reel, Story, Comment, Follow, FollowRequest, Message, Notification, ReelWatch
│   ├── routes/                           # Express route definitions for all 12 API modules
│   ├── services/                         # ML service client, Redis/LRU cache service, Fisher-Yates shuffle service
│   ├── utils/                            # Token generator, error helpers
│   ├── server.js                         # Application entrypoint & HTTP server lifecycle
│   ├── test-endpoints.js                 # Core API & auth test suite
│   ├── test-social.js                    # Follows, privacy, and post test suite
│   ├── test-reels.js                     # Reels feed & Cloudinary signature test suite
│   ├── test-notifications.js             # Notification lifecycle test suite
│   ├── test-messages.js                  # Direct messaging test suite
│   ├── test-search.js                    # Search functionality test suite
│   ├── test-socket.js                    # Socket.IO real-time verification suite
│   ├── test-recommendations.js           # 3-pipeline ML integration & fallback test suite
│   ├── test-shuffle-recommendations.js   # Freshness shuffling & pagination test suite
│   ├── .env.example                      # Server environment template
│   └── package.json
│
├── ml-service/                           # Independent Django ML Recommendation Engine
│   ├── ml_project/                       # Django project root (settings.py, urls.py, wsgi.py)
│   ├── recommendations/                  # Recommendation engine, hybrid rankers, views, test suite
│   │   ├── engine.py                     # TF-IDF, Collaborative Filtering, Cosine Similarity, Damping algorithms
│   │   ├── views.py                      # /api/ml/recommend/{users,posts,reels} handlers + health probes
│   │   └── tests.py                      # Django ML unit tests
│   ├── manage.py                         # Django CLI runner
│   ├── Procfile                          # Gunicorn start definition for Render
│   ├── render.yaml                       # Render blueprint definition
│   ├── requirements.txt                  # Python dependencies (django, scikit-learn, numpy, gunicorn)
│   └── .env.example                      # ML service environment template
│
├── .gitignore                            # Unified Git ignore rules
├── package.json                          # Workspace convenience scripts
└── README.md                             # Central project documentation
```

---

## Feature Tour

### 1. Authentication & Session Security
- **Signup & Login:** Multi-field validation supporting either username or email with secure bcrypt password hashing.
- **HTTP-Only JWT Cookies:** Sessions are secured with JWTs signed on the backend and transmitted strictly inside HTTP-only, SameSite-compliant cookies, eliminating XSS token theft vectors.
- **Session Hydration:** Instant `/api/auth/me` bootstrap verifying cookies on page load and populating profile context.

### 2. User Profiles & Follow Graph
- **Dynamic Profile Management:** Editable full name, bio, website link, and Cloudinary-stored avatar.
- **Privacy Toggle:** Users can switch between **Public** and **Private** mode at any time.
- **Relationship Matrix:** Full support for `isFollowing`, `isPending`, `requestId`, and `isSelf`.
- **Follow Request Lifecycle:** Following a private account automatically issues a pending follow request; the recipient can accept or reject requests via the notifications or profile panel.

### 3. Posts, Feed & Engagement
- **Post Creation:** Signed direct upload to Cloudinary supporting images, customized captions, extracted hashtags, and geographic locations.
- **Timeline Feed:** Chronological, paginated feed aggregating posts from followed accounts, public accounts, and personal content.
- **Engagement:** Double-tap/button liking with optimistic UI updates and atomic duplicate prevention, paginated comment threads with owner-level moderation rights, and direct post sharing.

### 4. 24-Hour Ephemeral Stories
- **Story Creation:** Direct image/video uploads with a hard 24-hour expiration window stored in MongoDB.
- **Story Tray:** Gradient-ringed story tray sorted by active following accounts with unviewed stories prioritized.
- **Viewer Telemetry:** Story owners can inspect exactly who viewed each story in real time.

### 5. Vertical Reels Experience
- **Mobile-Responsive Reels Feed:** Full-viewport vertical video feed featuring auto-play, mute/unmute toggles, and seamless infinite scrolling.
- **Signed Cloudinary Ingestion:** Direct video uploads with automatic first-frame thumbnail generation.
- **Interactions:** Video likes, slide-out comments drawer, share links, and background watch-duration event logging.

### 6. Real-Time Messaging & Direct Chat
- **1-on-1 Conversations:** Instant chat threads with automatic conversation creation and unread message counters.
- **Socket.IO Delivery:** Live incoming message dispatching, conversation room joins, and online/offline presence broadcasts.

### 7. Real-Time Notification System
- **Comprehensive Triggers:** Instant alerts for likes, comments, follows, and incoming follow requests.
- **Live Dispatch:** Connected clients receive immediate socket notifications (`new_notification`) and badge counter updates (`unread_count_updated`).
- **Batch Actions:** Mark single as read, mark all as read, and clear notifications.

### 8. Discovery & Search
- **Multi-Tab Exploration:** Global search bar offering dedicated tabs for **All**, **Accounts**, **Tags**, and **Places**.
- **Recent Search History:** Persistent user search history with individual delete and bulk clear operations.
- **Debounced Autocomplete:** Live suggestion lookup preventing network congestion.

---

## Recommendation Engine & Shuffling Architecture

Insta-V2 integrates a dedicated Python / Django machine learning microservice that powers three independent recommendation pipelines.

### 1. High-Level Recommendation Pipelines Overview

| Pipeline | Target Data | ML Algorithm & Core Signals |
| :--- | :--- | :--- |
| **Recommended Users** | Accounts to follow (`user-graph-interest-v1`) | Mutual follower graph count, bio/interest TF-IDF cosine similarity, interaction frequency, and account popularity. Excludes self, existing follows, pending requests, and blocked accounts. |
| **Recommended Posts** | Photo feed exploration (`hybrid-tfidf-cf-v1`, `posts`) | Content-based TF-IDF vectorization across captions, hashtags, and locations combined with user-user collaborative filtering over weighted engagements (likes=2.5, comments=3.5, followed authors=1.2 boost) and 72h exponential recency time decay. |
| **Recommended Reels** | Short-form video feed (`hybrid-tfidf-cf-v1`, `reels`) | Hybrid audio track affinity (`audio_{track}`), caption TF-IDF vectors, creator affinity, implicit video watch telemetry ($W_{\text{watch}} = 0.5 + 2.5 \cdot \text{CompletionRate}$), and accelerated 48h recency decay. |

<a id="algorithmic--mathematical-summary-of-the-three-recommendation-engines"></a>
### 2. Algorithmic & Mathematical Summary of the Three Recommendation Engines

The Insta-V2 recommendation microservice (`ml-service/`) runs three dedicated recommendation engines implemented in `recommendations/engine.py`. Each engine consumes pre-filtered candidate sets retrieved from MongoDB by the Express API, evaluates personalized mathematical scoring functions, and yields an ordered sequence of candidates with transparent attribution reasons.

---

#### Engine 1: Recommended Users (`user-graph-interest-v1`)

The user recommendation engine identifies accounts that the active user $u$ is most likely to follow by combining second-degree social graph topology, NLP interest similarity, historical interaction patterns, and creator popularity.

##### 1. Input Signals and Candidate Filtering
* **Candidate Set Discovery:** Node.js executes pre-flight exclusions directly in MongoDB before passing candidates $C = \{c_1, c_2, \dots, c_N\}$ to the ML service.
* **Exclusion Constraints:**
  * Self-exclusion: $c \neq u$
  * Existing relationships: $c \notin \operatorname{Following}(u)$
  * Pending requests: $c \notin \operatorname{PendingOut}(u) \land c \notin \operatorname{PendingIn}(u)$
  * Privacy blocks: $c \notin \operatorname{Blocked}(u) \land u \notin \operatorname{Blocked}(c)$
* **Feature Inputs:**
  * Profile textual metadata: cleaned biographies ($\text{bio}_u, \text{bio}_c$) and hashtag interest tokens ($\text{tags}_u, \text{tags}_c$).
  * Social graph topology: mutual follower sets $\operatorname{MutualFollowers}(u, c) = \operatorname{Followers}(u) \cap \operatorname{Followers}(c)$ with count $m_c = |\operatorname{MutualFollowers}(u, c)|$.
  * Interaction telemetry: cumulative direct engagements $\operatorname{Interactions}(u, c)$ aggregating historical post likes, post comments, and reel watch events.
  * Account statistics: total follower count $\operatorname{FollowersCount}(c)$ and post volume $\operatorname{PostsCount}(c)$.

##### 2. Individual Mathematical Scoring Components

###### A. Mutual Follower Graph Affinity ($S_{\text{mutual}}$)

**Mutual Follower Graph Affinity Formula**

$$
S_{\text{mutual}}(u,c)=
\begin{cases}
\min\left(1.0,\ 0.40 + 0.20 \cdot \log_2(1 + m_c)\right), & \text{if } m_c > 0 \\
0.0, & \text{if } m_c = 0
\end{cases}
$$

This formula quantifies second-degree topological proximity over the social follow graph. If the active user $u$ and candidate $c$ share at least one mutual follower ($m_c > 0$), a base affinity score of $0.40$ is awarded immediately ($m_c = 1 \implies 0.40 + 0.20 \cdot \log_2(2) = 0.60$). Each subsequent doubling of mutual connections contributes an additional $+0.20$, saturating at an upper ceiling of $1.0$ when $m_c \ge 7$. If no mutual followers exist ($m_c = 0$), the graph affinity evaluates to $0.0$.

###### B. Bio and Interest TF-IDF Cosine Similarity ($S_{\text{content}}$)

**Unconstrained Profile Cosine Similarity Formula**

$$
\operatorname{sim}_{\cos}(v_c, v_u) = \frac{v_c \cdot v_u}{\|v_c\|_2 \|v_u\|_2}
$$

**Content Similarity Normalization Formula**

$$
S_{\text{content}}(u, c) = \operatorname{Normalize}\left(\operatorname{clip}\left(\operatorname{sim}_{\cos}(v_c, v_u), 0.0, 1.0\right)\right)
$$

This component evaluates topical alignment between user profiles. Text documents $D_u = \text{bio}_u \Vert \text{tags}_u$ and $D_c = \text{bio}_c \Vert \text{tags}_c$ are vectorized into unigram and bigram feature vectors $v_u, v_c \in \mathbb{R}^K$ using `TfidfVectorizer(max_features=1000, stop_words="english", ngram_range=(1, 2))`. The inner product normalized by Euclidean $L_2$ norms produces the cosine similarity $\operatorname{sim}_{\cos}(v_c, v_u)$, which is bounded to $[0.0, 1.0]$ and normalized across the candidate batch. If either profile lacks bio and tag text, the component evaluates to $0.0$.

###### C. Prior Interaction Affinity ($S_{\text{affinity}}$)

**Raw Interaction Affinity Formula**

$$
A_{\text{raw}}(u,c) = \ln\left(1 + \operatorname{Interactions}(u,c)\right)
$$

**Normalized Interaction Affinity Formula**

$$
S_{\text{affinity}}(u,c) = \operatorname{Normalize}\left(A_{\text{raw}}(u,c)\right)
$$

This component captures direct historical interactions between user $u$ and creator $c$, including post likes, comments, and reel watch sessions. Logarithmic scaling $\ln(1 + x)$ prevents users with disproportionately high interaction counts from skewing the candidate distribution while penalizing zero-interaction pairs with an initial raw score of $0.0$.

###### D. Account Popularity and Activity ($S_{\text{pop}}$)

**Raw Account Popularity Formula**

$$
P_{\text{raw}}(c) = \ln\left(1 + \operatorname{FollowersCount}(c) + 1.5 \cdot \operatorname{PostsCount}(c)\right)
$$

**Normalized Account Popularity Formula**

$$
S_{\text{pop}}(c) = \operatorname{Normalize}\left(P_{\text{raw}}(c)\right)
$$

This component reflects account reach and publishing consistency. The follower count is augmented with creator activity by weighting total published posts at $1.5\times$, rewarding creators who consistently publish high-effort content. The sum is transformed logarithmically to dampen extreme follower outliers.

##### 3. Definitions of Variables
* $u$: Active authenticated user.
* $c$: Candidate user account being evaluated.
* $m_c$: Count of mutual followers between user $u$ and candidate $c$ ($|\operatorname{Followers}(u) \cap \operatorname{Followers}(c)|$).
* $v_u, v_c$: $L_2$-normalized TF-IDF interest vectors for user $u$ and candidate $c$.
* $\operatorname{Interactions}(u, c)$: Total direct interaction occurrences between $u$ and $c$.
* $\operatorname{FollowersCount}(c)$: Total count of followers for candidate $c$.
* $\operatorname{PostsCount}(c)$: Total count of feed posts authored by candidate $c$.
* $\operatorname{Normalize}(\cdot)$: Batch min-max scaling mapping raw scores to the unit interval $[0.0, 1.0]$.

##### 4. Normalization and Weighting
Each sub-score vector across the candidate pool is normalized using the microservice feature scaler:
$$
\operatorname{Normalize}(A)_k = \frac{A_k}{\max_{j} A_j} \quad \text{for } A_j \ge 0, \max_j A_j > 0
$$
This ensures all individual components ($S_{\text{mutual}}, S_{\text{content}}, S_{\text{affinity}}, S_{\text{pop}}$) operate on the uniform scale $[0.0, 1.0]$ before entering the linear combination equations.

##### 5. Final Composite Scoring Equation (Warm User)

**Warm User Composite Scoring Formula**

$$
S_{\text{user}}(u,c)=
0.35S_{\text{mutual}}+
0.25S_{\text{content}}+
0.20S_{\text{affinity}}+
0.20S_{\text{pop}}
$$

For warm users (defined as users who follow at least one account or have recorded prior interactions), the recommendation engine prioritizes mutual social graph connectivity ($35\%$), topical content relevance ($25\%$), direct historical affinity ($20\%$), and baseline account popularity ($20\%$).

##### 6. Cold-Start Behavior

**Cold-Start Detection Condition**

$$
\operatorname{IsColdStart}(u) \iff |\operatorname{Following}(u)| = 0 \;\land\; |\operatorname{InteractedAuthors}(u)| = 0
$$

**Cold-Start User Composite Scoring Formula**

$$
S_{\text{user}}(u,c)=
0.55S_{\text{pop}}+
0.35S_{\text{content}}+
0.10S_{\text{affinity}}
$$

When a brand-new user has zero following connections and no interaction history, mutual graph connectivity cannot be evaluated ($S_{\text{mutual}} = 0$). The system transitions to an exploration model where creator popularity drives $55\%$ of the score, textual interest alignment (if bio/tags were provided during onboarding) accounts for $35\%$, and any sparse interactions contribute $10\%$.

##### 7. Demotion and Diversity Adjustments
In user recommendations, candidates already followed or pending are pruned in the candidate filtering phase. Candidates are directly ranked by descending $S_{\text{user}}(u,c)$.

##### 8. Final Ranking and Recommendation Attribution
Candidates are sorted descending by $S_{\text{user}}(u,c)$ and sliced to `limit` (default: 15, max: 50). Each returned recommendation is annotated with an explicit human-readable attribution reason evaluated by rule priority:
1. `mutual_followers`: Assigned when mutual follower count $m_c > 0$.
2. `interacted_recently`: Assigned when $S_{\text{affinity}} \ge 0.25$.
3. `shared_interests`: Assigned when $S_{\text{content}} \ge 0.20$.
4. `popular`: Assigned when $S_{\text{pop}} \ge 0.40$ or $\operatorname{FollowersCount}(c) \ge 10$.
5. `suggested_for_you`: Default discovery fallback when general exploration criteria are met.

---

#### Engine 2: Recommended Posts (`hybrid-tfidf-cf-v1`, `content_type="posts"`)

The post recommendation engine implements a hybrid scoring pipeline that integrates content-based natural language processing, user-user collaborative filtering, creator affinity, public engagement velocity, exponential recency decay, already-seen item demotion, and iterative creator/hashtag diversity reranking.

##### 1. Input Signals and Candidate Filtering
* **Candidate Set Discovery:** Express pulls candidate posts $I = \{i_1, i_2, \dots, i_N\}$ from MongoDB, excluding posts authored by blocked users and private accounts unless followed.
* **User Engagement History:**
  * Liked post ID set: $\operatorname{Liked}(u)$.
  * Commented post ID set: $\operatorname{Commented}(u)$.
  * Followed creator set: $\operatorname{FollowedAuthors}(u)$.
* **Candidate Metadata:** Item ID, author ID, caption text, hashtag list, location name, media type, like count, comment count, share count, and creation timestamp.

##### 2. Individual Mathematical Scoring Components

###### A. Interaction Weighting & User Preference Vector

**Item Interaction Weight Formula**

$$
W(u, j) = 2.5 \cdot \mathbb{I}\left(j \in \operatorname{Liked}(u)\right) + 3.5 \cdot \mathbb{I}\left(j \in \operatorname{Commented}(u)\right) + 1.2 \cdot \mathbb{I}\left(\operatorname{Author}(j) \in \operatorname{FollowedAuthors}(u)\right)
$$

Each candidate item $j$ receives an interaction weight $W(u, j)$ reflecting historical engagement from user $u$, where $\mathbb{I}(\cdot)$ is the binary indicator function. Comments signify deeper engagement than likes and are weighted at $+3.5$ versus $+2.5$. Items authored by creators the user follows receive a $+1.2$ affinity boost.

**User Preference Profile Vector Formulation**

$$
u = X^T w_{\text{item}}
$$

**Unit Euclidean Vector Normalization**

$$
u_{\text{norm}} = \frac{u}{\|u\|_2}
$$

Candidate documents are tokenized with boosted hashtags (`tag_{tag} {tag}`), location markers (`loc_{loc} {loc}`), and media type into a 1500-feature TF-IDF matrix $X \in \mathbb{R}^{N \times M}$ (`max_features=1500, stop_words="english", ngram_range=(1, 2), min_df=1`). The user profile vector $u$ is formed as the linear combination of candidate feature vectors weighted by the interaction vector $w_{\text{item}} = [W(u, j)]_{j=1}^N$. Normalizing by its Euclidean norm $\|u\|_2$ produces $u_{\text{norm}}$.

###### B. Content-Based Cosine Similarity ($S_{\text{content}}$)

**Content Similarity Scoring Formula**

$$
S_{\text{content}}(u, i) = \operatorname{Normalize}\left(\operatorname{clip}\left(X_i \cdot u_{\text{norm}}^T,\ 0.0,\ 1.0\right)\right)
$$

This evaluates how closely candidate post $i$'s caption, hashtags, location, and media type match user $u$'s aggregated preference profile $u_{\text{norm}}$, normalized to $[0.0, 1.0]$.

###### C. User-User Collaborative Filtering ($S_{\text{CF}}$)

**Peer Cosine Similarity Formula**

$$
\operatorname{sim}_{\text{peer}}(u, p) = \frac{\sum_{j \in I_u \cap I_p} W(u, j) \cdot W(p, j)}{\|w_u\|_2 \cdot \|w_p\|_2}
$$

**Collaborative Filtering Accumulation Formula**

$$
CF_i = \sum_{p : \operatorname{sim}_{\text{peer}}(u, p) > 0.05} \operatorname{sim}_{\text{peer}}(u, p) \cdot W(p, i)
$$

**Normalized Collaborative Filtering Score**

$$
S_{\text{CF}}(i) = \operatorname{Normalize}(CF_i)
$$

Peer user similarity $\operatorname{sim}_{\text{peer}}(u, p)$ measures interaction overlap between active user $u$ and peer user $p$. Only peers with similarity strictly exceeding the threshold $\operatorname{sim}_{\text{peer}}(u, p) > 0.05$ contribute to candidate scoring. Candidate item score $CF_i$ accumulates the peer's interaction weight on item $i$, scaled by peer similarity, and normalized across candidates.

###### D. Creator Relationship Affinity ($S_{\text{creator}}$)

**Creator Affinity Formula**

$$
S_{\text{creator}}(i) =
\begin{cases}
1.0, & \text{if } \operatorname{Author}(i) \in \operatorname{FollowedAuthors}(u) \\
0.5, & \text{if } \operatorname{Author}(i) \in \operatorname{InteractedAuthors}(u) \setminus \operatorname{FollowedAuthors}(u) \\
0.0, & \text{otherwise}
\end{cases}
$$

This signal grants maximum affinity ($1.0$) to items by creators the user actively follows, moderate affinity ($0.5$) to creators the user has previously interacted with, and $0.0$ to creators with no prior relationship.

###### E. Engagement Popularity ($S_{\text{pop}}$)

**Raw Engagement Popularity Formula**

$$
P_{\text{raw}}(i) = \ln\left(1 + \operatorname{Likes}(i) + 2.0 \cdot \operatorname{Comments}(i) + 2.0 \cdot \operatorname{Shares}(i)\right)
$$

**Normalized Engagement Popularity Score**

$$
S_{\text{pop}}(i) = \operatorname{Normalize}(P_{\text{raw}}(i))
$$

This measures public engagement velocity across the platform. Comments and shares are weighted double ($2.0\times$) relative to likes to reflect active conversation and distribution.

###### F. Exponential Recency Time Decay ($S_{\text{recency}}$)

**72-Hour Half-Life Recency Decay Formula**

$$
R_{\text{raw}}(i) = \exp\left(-\frac{\Delta t_{\text{hours}}}{72.0}\right)
$$

**Normalized Recency Score**

$$
S_{\text{recency}}(i) = \operatorname{Normalize}(R_{\text{raw}}(i))
$$

Post relevance decays continuously according to an exponential decay model with a **72-hour half-life** ($T_{1/2} = 72.0$ hours), where $\Delta t_{\text{hours}} = \max\left(0,\ \frac{t_{\text{now}} - t_{\text{created}}}{3600}\right)$ is the elapsed time since publication. At 72 hours, the raw recency score drops to $0.50$; at 144 hours (6 days), it drops to $0.25$.

##### 3. Definitions of Variables
* $u$: Active authenticated user.
* $i, j$: Candidate post item identifiers.
* $p$: Peer user in the collaborative filtering cohort.
* $w_{\text{item}}$: Weight vector representing user $u$'s historical interactions with items.
* $X$: 1500-column TF-IDF matrix representing textual and categorical features of candidates.
* $u_{\text{norm}}$: Unit-normalized user preference vector in TF-IDF space.
* $\operatorname{sim}_{\text{peer}}(u, p)$: Cosine similarity between interaction histories of user $u$ and peer $p$.
* $I_u, I_p$: Sets of items interacted with by user $u$ and peer $p$.
* $\Delta t_{\text{hours}}$: Elapsed age of candidate item in decimal hours.
* $S_{\text{base}}$: Pre-damping composite recommendation score.
* $S_{\text{adjusted}}$: Post-damping score after diversity and penalty reranking.

##### 4. Normalization and Weighting
All components ($S_{\text{content}}, S_{\text{CF}}, S_{\text{creator}}, S_{\text{pop}}, S_{\text{recency}}$) are normalized to $[0.0, 1.0]$ via `_normalize_array` before entering the linear combination equations.

##### 5. Final Composite Scoring Equation (Base Score)

**Warm User Base Composite Scoring Formula**

$$
S_{\text{base}}(i)=
0.32S_{\text{content}}(i)+
0.25S_{\text{CF}}(i)+
0.20S_{\text{creator}}(i)+
0.13S_{\text{pop}}(i)+
0.10S_{\text{recency}}(i)
$$

For warm users, content matching ($32\%$) and peer collaborative filtering ($25\%$) form the core personalization signals ($57\%$ combined), supported by creator affinity ($20\%$), platform engagement ($13\%$), and recency decay ($10\%$).

##### 6. Cold-Start Behavior

**Cold-Start Detection Condition**

$$
\operatorname{IsColdStart}(u) \iff |w_{\text{item}}| < 2 \;\land\; |\operatorname{FollowedAuthors}(u)| = 0
$$

**Cold-Start Base Composite Scoring Formula**

$$
S_{\text{base}}(i)=
0.45S_{\text{pop}}(i)+
0.45S_{\text{recency}}(i)+
0.10S_{\text{content}}(i)
$$

When a user has interacted with fewer than 2 items and follows zero creators, personalized collaborative filtering and creator affinity are omitted. Recommendation relies on high-velocity trending content ($45\%$) and fresh content ($45\%$), with a $10\%$ exploratory content component.

##### 7. Demotion and Diversity Adjustments

###### A. Already-Interacted Item Demotion

**Already-Interacted Item Penalty Formula**

$$
S_{\text{base}}(i) \leftarrow S_{\text{base}}(i) \cdot 0.40 \quad \text{if } i \in (\operatorname{Liked}(u) \cup \operatorname{Commented}(u))
$$

To guarantee feed freshness and prevent recommendation loops, any post the user has previously liked or commented on incurs a $60\%$ score reduction (multiplier $0.40$), pushing unseen posts to the top while preserving high-relevance items if inventory is low.

###### B. Iterative Diversity and Damping Reranking

**Iterative Creator and Hashtag Diversity Reranking Formula**

$$
S_{\text{adjusted}}(i)=
(S_{\text{base}}(i)+0.15)
\cdot 0.55^{C(\operatorname{Author}(i))}
\cdot
\frac{1}{
1.0+0.15\cdot
\sum_{t\in\operatorname{tags}_i[:3]}H(t)
}
$$

**Why a two-stage scoring model is applied:** A greedy sort on $S_{\text{base}}$ alone frequently clusters multiple posts from the single most prolific author or creates feeds dominated by a single trending hashtag. The reranker operates greedily in an iterative loop:
1. Candidate $i$ with the highest current $S_{\text{adjusted}}(i)$ is chosen for the next slot.
2. The author frequency count $C(\operatorname{Author}(i))$ increments, applying a geometric decay of $0.55^C$ ($45\%$ penalty per already-selected post from the same creator).
3. The selected item's top-3 hashtags increment their global frequency $H(t)$, penalizing subsequent posts sharing those tags via $\frac{1}{1 + 0.15 \sum H(t)}$.
4. The $+0.15$ baseline offset prevents low-scoring diverse items from collapsing to zero, preserving variety across the full recommendation batch.

##### 8. Final Ranking and Recommendation Attribution
Items are ordered by selection sequence from the iterative reranker. Each item receives an attribution reason:
* Cold-start: `trending` (if $S_{\text{pop}} \ge S_{\text{recency}}$) or `recent`.
* Warm:
  * `collaborative`: if $S_{\text{CF}} \ge \max(S_{\text{content}}, S_{\text{creator}})$.
  * `interests`: if $S_{\text{content}} \ge S_{\text{creator}}$.
  * `following`: if $\operatorname{Author}(i) \in \operatorname{FollowedAuthors}(u)$.
  * `popular`: default fallback.

---

#### Engine 3: Recommended Reels (`hybrid-tfidf-cf-v1`, `content_type="reels"`)

The reel recommendation engine extends the hybrid model to vertical short-form video by integrating implicit video watch telemetry, acoustic track affinity, and accelerated 48-hour recency decay.

##### 1. Input Signals and Candidate Filtering
* **Candidate Set Discovery:** Express retrieves candidate reels $R = \{r_1, r_2, \dots, r_N\}$ from MongoDB, excluding reels from blocked creators and private accounts unless followed.
* **Implicit Video Telemetry Input:** The client dispatches periodic watch beacon events recording total watch duration $\operatorname{WatchDurationSeconds}(u, r)$ and video duration $\operatorname{VideoDurationSeconds}(r)$.
* **Candidate Metadata:** Reel ID, author ID, video URL, thumbnail URL, caption, hashtags, audio track name (`audio_track`), engagement metrics, duration, and creation timestamp.

##### 2. Individual Mathematical Scoring Components

###### A. Continuous Video Completion Rate & Telemetry Weighting

**Video Completion Rate Formula**

$$
\operatorname{CompletionRate}(u, r) = \min\left(1.0,\ \frac{\operatorname{WatchDurationSeconds}(u, r)}{\operatorname{VideoDurationSeconds}(r)}\right)
$$

**Telemetry Qualification Condition**

$$
\operatorname{Qualifies}(u, r) \iff \operatorname{WatchDurationSeconds}(u, r) \ge 2.0 \;\lor\; \operatorname{CompletionRate}(u, r) \ge 0.25
$$

**Implicit Watch Weight Formula**

$$
W_{\text{watch}}(u, r) = 0.5 + 2.5 \cdot \operatorname{CompletionRate}(u, r)
$$

Reels incorporate continuous video watch behavior into the interaction weight matrix. If a user watches a reel for at least $2.0$ seconds OR completes at least $25\%$ of its total duration, the watch session qualifies as an intentional view. Qualified watches generate an implicit weight ranging from $+0.5$ (low completion) up to $+3.0$ (full video completion). This watch weight is accumulated directly into the user-item interaction weight vector alongside explicit likes ($+2.5$) and comments ($+3.5$):
$$
W(u, r) \leftarrow W(u, r) + W_{\text{watch}}(u, r)
$$

###### B. Acoustic and Audio Track Affinity ($S_{\text{content}}$)
Short-form video engagement is heavily driven by audio trends. The engine tokenizes audio metadata into boosted tokens:
$$
\text{audio\_tokens} = \text{"audio\_" + audio\_track.replace(' ', '\_') + " " + audio\_track}
$$
These tokens are embedded into the TF-IDF feature space alongside captions, boosted hashtags (`tag_{tag}`), and location markers, allowing the content similarity equation $S_{\text{content}}(u, r)$ to match users with recurring musical tracks, original voice clips, and trending sounds.

###### C. Accelerated Exponential Recency Decay ($S_{\text{recency}}$)

**48-Hour Half-Life Accelerated Recency Decay Formula**

$$
R_{\text{raw}}(r) = \exp\left(-\frac{\Delta t_{\text{hours}}}{48.0}\right)
$$

**Normalized Reels Recency Score**

$$
S_{\text{recency}}(r) = \operatorname{Normalize}(R_{\text{raw}}(r))
$$

**Explicit Distinction Between Reels and Posts Recency Decay:**
* **Posts Half-Life ($T_{1/2} = 72.0\text{ hours}$):** Static photos maintain conversational engagement over a 3-day cycle.
* **Reels Half-Life ($T_{1/2} = 48.0\text{ hours}$):** Short-form video consumption is fast-moving and viral. At 48 hours, a reel's raw recency score halves to $0.50$; at 96 hours (4 days), it drops to $0.25$. This accelerated decay actively prevents stale video feeds and accelerates discovery of rapidly trending content.

###### D. Collaborative Filtering, Creator Affinity, & Popularity
The remaining scoring components follow the hybrid posts engine:
* $S_{\text{CF}}(r)$: User-user collaborative filtering over accumulated explicit and watch weights ($\operatorname{sim}_{\text{peer}} > 0.05$).
* $S_{\text{creator}}(r)$: Creator affinity ($1.0$ followed, $0.5$ interacted, $0.0$ default).
* $S_{\text{pop}}(r)$: Engagement velocity $\operatorname{Normalize}(\ln(1 + \operatorname{Likes} + 2.0\cdot\operatorname{Comments} + 2.0\cdot\operatorname{Shares}))$.

##### 3. Definitions of Variables
* $u$: Active authenticated user.
* $r$: Candidate reel video identifier.
* $\operatorname{WatchDurationSeconds}(u, r)$: Total elapsed playback time logged by the client video player.
* $\operatorname{VideoDurationSeconds}(r)$: Total length of the candidate video file.
* $\operatorname{CompletionRate}(u, r)$: Fraction of the video watched, capped at $1.0$.
* $W_{\text{watch}}(u, r)$: Implicit telemetry interaction weight ($0.5$ to $3.0$).
* $T_{1/2}$: Half-life decay constant ($48.0$ hours for reels vs $72.0$ hours for posts).
* $S_{\text{base}}$: Base composite reel recommendation score.
* $S_{\text{adjusted}}$: Final reranked reel score after diversity damping.

##### 4. Normalization and Weighting
All five scoring signals ($S_{\text{content}}, S_{\text{CF}}, S_{\text{creator}}, S_{\text{pop}}, S_{\text{recency}}$) are normalized to $[0.0, 1.0]$ via `_normalize_array`.

##### 5. Final Composite Scoring Equation (Base Score)

**Warm User Reels Base Composite Scoring Formula**

$$
S_{\text{base}}(r)=
0.32S_{\text{content}}(r)+
0.25S_{\text{CF}}(r)+
0.20S_{\text{creator}}(r)+
0.13S_{\text{pop}}(r)+
0.10S_{\text{recency}}(r)
$$

Evaluates the linear combination of content/audio similarity ($32\%$), collaborative filtering ($25\%$), creator relationship ($20\%$), popularity ($13\%$), and accelerated recency decay ($10\%$).

##### 6. Cold-Start Behavior

**Cold-Start Reels Base Composite Scoring Formula**

$$
S_{\text{base}}(r)=
0.45S_{\text{pop}}(r)+
0.45S_{\text{recency}}(r)+
0.10S_{\text{content}}(r)
$$

Triggered when the user has interacted with fewer than 2 items and follows zero creators. Viral engagement velocity ($45\%$) and fresh 48-hour recency ($45\%$) dominate the recommendations.

##### 7. Demotion and Diversity Adjustments
* **Already-Interacted Demotion:** Reels the user has liked or commented on receive a $0.40\times$ multiplier.
* **Iterative Diversity Reranking:** Applies the identical geometric creator damping ($0.55^{C(\text{Author})}$) and hashtag damping ($\frac{1}{1 + 0.15 \sum H(t)}$) to prevent video feed repetition:

**Reels Diversity Reranking Formula**

$$
S_{\text{adjusted}}(r)=
(S_{\text{base}}(r)+0.15)
\cdot 0.55^{C(\operatorname{Author}(r))}
\cdot
\frac{1}{
1.0+0.15\cdot
\sum_{t\in\operatorname{tags}_r[:3]}H(t)
}
$$

##### 8. Final Ranking and Recommendation Attribution
Candidates are ranked in order of selection from the iterative reranker and assigned attribution reasons: `following`, `interests`, `collaborative`, `trending`, `recent`, or `popular`.

---

#### Mathematical Notation Reference Table

The following table summarizes all mathematical symbols, variable identifiers, and scoring metrics utilized across the three recommendation engines:

| Symbol / Variable | Domain / Type | Implementation Definition in `recommendations/engine.py` |
| :--- | :--- | :--- |
| $u$ | String / ID | Active authenticated user requesting recommendations. |
| $c$ | String / ID | Candidate user account under evaluation for follow recommendation. |
| $p$ | String / ID | Peer user in the collaborative filtering cohort sharing interacted items with $u$. |
| $i$ | String / ID | Candidate post item under evaluation. |
| $r$ | String / ID | Candidate reel video item under evaluation. |
| $j$ | String / ID | Arbitrary item index in interaction histories ($j \in I_u$ or $j \in I_p$). |
| $m_c$ | Integer $\ge 0$ | Count of mutual followers between active user $u$ and candidate account $c$. |
| $S_{\text{mutual}}$ | Float $[0.0, 1.0]$ | Normalized second-degree graph affinity score based on mutual follower count $m_c$. |
| $S_{\text{content}}$ | Float $[0.0, 1.0]$ | Normalized cosine similarity between candidate feature vector and user interest profile. |
| $S_{\text{affinity}}$ | Float $[0.0, 1.0]$ | Normalized historical direct interaction affinity score between user $u$ and candidate $c$. |
| $S_{\text{pop}}$ | Float $[0.0, 1.0]$ | Normalized logarithmic engagement popularity score across followers, likes, comments, and shares. |
| $S_{\text{CF}}$ | Float $[0.0, 1.0]$ | Normalized user-user collaborative filtering score aggregated from similar peers. |
| $S_{\text{creator}}$ | Float $\{0.0, 0.5, 1.0\}$ | Discrete affinity weight based on whether the candidate item's author is followed ($1.0$), interacted with ($0.5$), or neither ($0.0$). |
| $S_{\text{recency}}$ | Float $[0.0, 1.0]$ | Normalized exponential time decay score based on item age and half-life ($T_{1/2}$). |
| $W(u, j)$ | Float $\ge 0.0$ | Cumulative interaction weight assigned by user $u$ to item $j$ (likes=2.5, comments=3.5, author=1.2, watch=0.5–3.0). |
| $I_u, I_p$ | Set of IDs | Set of item IDs with recorded engagements by user $u$ and peer $p$, respectively. |
| $X$ | Matrix $\mathbb{R}^{N \times M}$ | 1500-column TF-IDF feature matrix encoding captions, boosted hashtags, locations, audio, and media types. |
| $w_{\text{item}}$ | Vector $\mathbb{R}^N$ | Dense vector of interaction weights $[W(u, j)]_{j=1}^N$ used to project user profile $u = X^T w_{\text{item}}$. |
| $C(\operatorname{Author})$ | Integer $\ge 0$ | Count of items authored by a given creator that have already been chosen in the current recommendation session. |
| $H(t)$ | Integer $\ge 0$ | Cumulative selection frequency of hashtag $t$ in the top-3 hashtag positions across previously chosen items. |
| $\Delta t_{\text{hours}}$ | Float $\ge 0.0$ | Elapsed age of a candidate item from its creation timestamp to the current time, in decimal hours. |

---

### 3. Large Candidate Pool Caching
To maintain sub-20ms response times and prevent expensive model recalculations on every page request, Node.js queries and caches a large candidate pool:
- **Users Pool:** 50 candidates (`RECOMMENDATION_POOL_SIZE_USERS=50`)
- **Posts Pool:** 80 candidates (`RECOMMENDATION_POOL_SIZE_POSTS=80`)
- **Reels Pool:** 60 candidates (`RECOMMENDATION_POOL_SIZE_REELS=60`)

The pool is persisted in **Redis** (or the in-memory LRU fallback) with a default 5-minute TTL (`RECOMMENDATION_CACHE_TTL_SEC=300`).

### 4. Fisher-Yates Shuffling & In-Memory Freshness
When the user refreshes the page (`page=1` or `refresh=true`), the system produces a fresh, varied experience **without invoking Django**:
1. **Unbiased Fisher-Yates Shuffle:** Executed in Node.js on a shallow clone (`[...cachedPool]`) of the cached candidate array, ensuring the underlying cache is never mutated.
2. **Session Sequence Tracking:** Node.js maintains a sliding session sequence per `${userId}:${contentType}`:
   - Slices sequentially for pagination (`page=2, 3...`) so that page 1 and page 2 contain **zero duplicate items**.
   - On `page=1` / refresh, fresh, unseen items are partitioned to the beginning of the sequence, while previously displayed items are deprioritized to the tail.
3. **Safe Reshuffle on Pool Exhaustion:** If a user scrolls past all 80 cached items, the session safely reshuffles the pool in memory, preventing empty pages, UI crashes, or redundant external API calls.

### 5. Multi-Tier Fault-Tolerant Resilience
If the Django microservice is undergoing redeployment, experiencing high CPU load, or network downtime, the system fails over seamlessly:
```
Tier 1: Live Django ML Service (Normal operation)
   │
   ▼ (On timeout > 3500ms or connection error)
Tier 2: Stale Recommendation Cache (Serves last-known good candidates)
   │
   ▼ (If cache is empty / cold user)
Tier 3: Heuristic MongoDB Fallback (Engagement rate & exponential recency queries)
```
A built-in **Circuit Breaker** tracks failure counts. When 3 consecutive failures occur, the circuit breaker opens for 30 seconds (`ML_CIRCUIT_COOLDOWN_MS=30000`), immediately serving fallback content without blocking incoming user requests.

---

## Environment Configuration Structure

Insta-V2 strictly maintains **exactly two environment configuration files per service: `.env` and `.env.example`**:

```text
Insta-V2/
├── client/
│   ├── .env                    # Local development configuration (Vite, untracked)
│   └── .env.example            # Tracked template for frontend variables
├── server/
│   ├── .env                    # Local development configuration (Express, untracked)
│   └── .env.example            # Tracked template for backend variables
└── ml-service/
    ├── .env                    # Local development configuration (Django, untracked)
    └── .env.example            # Tracked template for ML service variables
```

> **Security & Deployment Rule:** Actual `.env` files are strictly excluded from version control via `.gitignore`. In cloud environments (Netlify and Render), environment variables must be entered manually into the platform dashboards; cloud platforms do not rely on local `.env` files.

---

## Environment Variables Reference

### 1. Frontend (`client/.env`)
*Loaded automatically by Vite.*

| Variable | Description | Safe Example Value |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Base API URL. Use `/api` on Netlify (proxy), or full backend URL locally. | `http://localhost:8000/api` |
| `VITE_SOCKET_URL` | Socket.IO connection URL. Must be `http://` locally and `https://` in prod. | `http://localhost:8000` |
| `VITE_CLOUDINARY_CLOUD_NAME` | Public Cloudinary cloud identifier for client asset generation. | `demo_cloud` |

**Manual Dashboard Variables for Netlify:**
- `VITE_API_BASE_URL`: `/api` (uses Netlify's `netlify.toml` proxy to keep auth cookies first-party)
- `VITE_SOCKET_URL`: `https://your-backend-host.onrender.com`
- `VITE_CLOUDINARY_CLOUD_NAME`: `your_cloudinary_cloud_name`

### 2. Core Backend API (`server/.env`)
*Loaded by `server/config/env.js` via `dotenv.config()`.*

| Variable | Description | Safe Example Value |
| :--- | :--- | :--- |
| `PORT` | Listening port for the Express HTTP and Socket.IO server. | `8000` |
| `NODE_ENV` | Environment mode (`development` or `production`). | `development` |
| `CLIENT_URL` | Comma-separated list of allowed frontend origins for CORS. | `http://localhost:5173` |
| `MONGO_URI` | MongoDB Atlas connection string with replica set parameters. | `mongodb+srv://user:pass@cluster.mongodb.net/instaV2db?retryWrites=true&w=majority` |
| `JWT_SECRET` | Cryptographic secret key used to sign and verify session JWTs. | `your_super_secret_jwt_key_at_least_32_characters_long` |
| `JWT_EXPIRES_IN` | Token expiration duration string. | `7d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier for media uploads. | `your_cloudinary_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key for backend upload signature generation. | `123456789012345` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret. Keep secure; never expose to frontend. | `your_cloudinary_api_secret` |
| `CLOUDINARY_UPLOAD_PRESET` | Configured Cloudinary signed upload preset name. | `insta_v2` |
| `ML_SERVICE_URL` | Base URL of the independent Django ML recommendation service. | `http://127.0.0.1:8001` |
| `ML_SERVICE_SECRET` | Shared secret header matching Django's `INTERNAL_SERVICE_SECRET`. | `your_shared_internal_service_secret` |
| `ML_INTERNAL_API_KEY` | Secondary alias for internal service authentication. | `your_shared_internal_service_secret` |
| `ML_TIMEOUT_MS` | Maximum milliseconds to wait for a Django response before fallback. | `3500` |
| `ML_MAX_RETRIES` | Number of retry attempts on transient network failures. | `1` |
| `ML_CIRCUIT_FAILURE_THRESHOLD`| Consecutive failure count to trip the recommendation circuit breaker. | `3` |
| `ML_CIRCUIT_COOLDOWN_MS` | Milliseconds circuit breaker remains open before probing health. | `30000` |
| `REDIS_URL` | Optional Redis connection URI. If omitted, in-memory LRU is used. | `redis://localhost:6379` |
| `RECOMMENDATION_CACHE_TTL_SEC` | Recommendation candidate cache lifetime in seconds. | `300` |
| `RECOMMENDATION_MEMORY_CACHE_MAX` | Max users stored in memory LRU cache when Redis is omitted. | `500` |
| `RECOMMENDATION_INVALIDATION_COOLDOWN_MS` | Debounce window for cache invalidation events. | `2000` |
| `RECOMMENDATION_POOL_SIZE_USERS` | Target candidate pool size for user recommendations. | `50` |
| `RECOMMENDATION_POOL_SIZE_POSTS` | Target candidate pool size for post recommendations. | `80` |
| `RECOMMENDATION_POOL_SIZE_REELS` | Target candidate pool size for reel recommendations. | `60` |

**Manual Dashboard Variables for Render Backend Web Service:**
- `NODE_ENV`: `production`
- `CLIENT_URL`: `https://your-site.netlify.app`
- `MONGO_URI`: `mongodb+srv://...`
- `JWT_SECRET`: `your_production_jwt_secret_32_chars`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`
- `ML_SERVICE_URL`: `https://your-django-ml-service.onrender.com`
- `ML_SERVICE_SECRET`: `your_shared_internal_secret`
- `ML_INTERNAL_API_KEY`: `your_shared_internal_secret`
- `RECOMMENDATION_POOL_SIZE_USERS`: `50`
- `RECOMMENDATION_POOL_SIZE_POSTS`: `80`
- `RECOMMENDATION_POOL_SIZE_REELS`: `60`

### 3. Django ML Service (`ml-service/.env`)
*Loaded by `ml-service/ml_project/settings.py` via `load_dotenv()`.*

| Variable | Description | Safe Example Value |
| :--- | :--- | :--- |
| `DJANGO_SECRET_KEY` | Cryptographic secret key used by Django. | `your_secure_random_django_secret_key` |
| `DEBUG` | Django debug flag (must be `false` in production). | `false` |
| `DJANGO_DEBUG` | Secondary debug flag alias. | `false` |
| `ALLOWED_HOSTS` | Comma-separated domain names permitted to reach Django. | `localhost,127.0.0.1,.onrender.com` |
| `DJANGO_ALLOWED_HOSTS` | Secondary allowed hosts alias. | `localhost,127.0.0.1,.onrender.com` |
| `PORT` | Listening port for the Django service (defaults to 8001). | `8001` |
| `DISABLE_COLLECTSTATIC` | Prevents static collection errors on API microservice. | `1` |
| `INTERNAL_SERVICE_SECRET`| Shared secret for internal service authentication. Must match Node. | `your_shared_internal_service_secret` |
| `ML_INTERNAL_API_KEY` | Secondary shared secret alias matching Node's `ML_INTERNAL_API_KEY`. | `your_shared_internal_service_secret` |

**Manual Dashboard Variables for Render Django ML Web Service:**
- `PYTHON_VERSION`: `3.11.9`
- `DEBUG`: `false`
- `DJANGO_DEBUG`: `false`
- `ALLOWED_HOSTS`: `localhost,127.0.0.1,.onrender.com`
- `DISABLE_COLLECTSTATIC`: `1`
- `DJANGO_SECRET_KEY`: `your_secure_random_django_secret`
- `INTERNAL_SERVICE_SECRET`: `your_shared_internal_secret` (must match backend)
- `ML_INTERNAL_API_KEY`: `your_shared_internal_secret`

---

## Installation & Local Setup

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **Python:** v3.10 or higher
- **MongoDB:** Active MongoDB Atlas URI or local MongoDB server
- **Cloudinary Account:** For signed media uploads

### 2. Dependency Installation

```bash
# 1. Setup ML Service Virtual Environment & Dependencies
cd ml-service
python -m venv .venv

# On Windows:
.\.venv\Scripts\activate
# On macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate

# 2. Setup Node.js Backend Dependencies
cd ../server
npm install

# 3. Setup React Frontend Dependencies
cd ../client
npm install
```

### 3. Initialize Environment Files
Create `.env` files in each service directory by copying their respective templates:
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
cp ml-service/.env.example ml-service/.env
```
Update each `.env` file with your credentials according to the [Environment Variables](#environment-variables) section.

### 4. Seed Demo Data (Optional)
To populate the database with realistic demo users, avatars, posts, reels, stories, and interactions:
```bash
cd server
npm run seed:demo
```
*Note: All demo accounts use the standard password `DemoUser@2026`.*

---

## Running the Application Locally

Run each service in a separate terminal:

### Terminal 1: Django ML Service (Port 8001)
```bash
cd ml-service

# Windows:
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8001 --noreload
# macOS / Linux:
# python manage.py runserver 127.0.0.1:8001 --noreload
```
*Verify Health: [http://127.0.0.1:8001/api/ml/health](http://127.0.0.1:8001/api/ml/health) or [http://127.0.0.1:8001/](http://127.0.0.1:8001/)*

### Terminal 2: Node.js Express & Socket.IO Server (Port 8000)
```bash
cd server
npm run dev
```
*Verify Health: [http://localhost:8000/api/health](http://localhost:8000/api/health)*

### Terminal 3: React Frontend Client (Port 5173)
```bash
cd client
npm run dev
```
*Access UI: [http://localhost:5173](http://localhost:5173)*

---

## API Documentation

All routes (except public auth and health endpoints) require an authenticated session managed via the HTTP-only JWT cookie.

### Health Endpoints
- `GET /api/health` — Core Express server health probe and database connection status.
- `GET http://127.0.0.1:8001/` — Django ML microservice root index and routing table.
- `GET http://127.0.0.1:8001/api/ml/health` — Django ML health and model engine status.

### Authentication (`/api/auth`)
- `POST /api/auth/signup` — Registers new account (`fullName`, `username`, `email`, `password`), sets HTTP-only cookie.
- `POST /api/auth/login` — Authenticates credentials (`username` or `email`, `password`), sets HTTP-only cookie.
- `POST /api/auth/logout` — Clears authentication cookie.
- `GET /api/auth/me` — Returns the current authenticated user's profile.

### Media & Direct Uploads (`/api/media`)
- `POST /api/media/signature` — Generates cryptographic Cloudinary upload signature for posts.
- `POST /api/media/posts` — Persists post metadata (`mediaUrl`, `publicId`, `caption`, `location`, `mediaAspect`).
- `POST /api/media/stories` — Persists story metadata (`mediaUrl`, `publicId`, `mediaType`, `caption`) with 24h expiration.

### Users & Privacy (`/api/users`)
- `GET /api/users/search?q=...` — Searches users by username or full name.
- `GET /api/users/suggestions` — Retrieves basic user suggestions.
- `PATCH /api/users/me/privacy` — Toggles account privacy (`isPrivate: true | false`).
- `PATCH /api/users/me/profile` — Updates profile info (`fullName`, `bio`, `website`, `avatar`).
- `GET /api/users/:userId/profile` — Retrieves profile data, stats, and visibility permissions.
- `GET /api/users/:userId/posts` — Retrieves user's posts (enforces private account restrictions).
- `POST /api/users/:userId/follow` — Follows public user or issues follow request for private user.
- `DELETE /api/users/:userId/follow` — Unfollows user.
- `GET /api/users/:userId/followers` — Paginated list of followers.
- `GET /api/users/:userId/following` — Paginated list of following accounts.
- `GET /api/users/:userId/follow-status` — Relationship status check (`isFollowing`, `isPending`, etc.).

### Follow Requests (`/api/follow-requests`)
- `GET /api/follow-requests` — Retrieves incoming pending follow requests.
- `GET /api/follow-requests/sent` — Retrieves outgoing pending requests.
- `POST /api/follow-requests/:requestId/accept` — Accepts incoming request and creates follow relationship.
- `POST /api/follow-requests/:requestId/reject` — Rejects incoming request.
- `DELETE /api/follow-requests/:requestId` — Cancels outgoing pending request.

### Posts, Likes & Comments (`/api/posts` & `/api/comments`)
- `GET /api/posts/feed?page=1&limit=10` — Paginated timeline feed of authorized posts.
- `GET /api/posts/:postId` — Single post details (enforces privacy).
- `GET /api/posts/:postId/share` — Shareable post metadata and clean URL.
- `POST /api/posts/:postId/like` — Likes post (atomic duplicate prevention).
- `DELETE /api/posts/:postId/like` — Unlikes post.
- `GET /api/posts/:postId/likes` — Paginated list of users who liked post.
- `POST /api/posts/:postId/comments` — Adds comment (`content`).
- `GET /api/posts/:postId/comments` — Paginated comments for post.
- `DELETE /api/comments/:commentId` — Deletes comment (author or post owner).

### Reels Feed & Videos (`/api/reels`)
- `POST /api/reels/upload-signature` — Generates signed video upload token for Cloudinary (`insta_v2/reels`).
- `POST /api/reels` — Persists Reel metadata (`videoUrl`, `publicId`, `caption`, `thumbnailUrl`, `duration`).
- `GET /api/reels?cursor=...&limit=5` — Paginated vertical Reels feed.
- `GET /api/reels/:reelId` — Single Reel details (enforces privacy).
- `DELETE /api/reels/:reelId` — Deletes Reel from MongoDB and Cloudinary.
- `POST /api/reels/:reelId/like` & `DELETE /api/reels/:reelId/like` — Like/unlike Reel.
- `GET /api/reels/:reelId/comments` & `POST /api/reels/:reelId/comments` — Reel comments.
- `DELETE /api/reels/comments/:commentId` — Deletes Reel comment.
- `GET /api/reels/:reelId/share` — Shareable Reel metadata.

### 24-Hour Stories (`/api/stories`)
- `POST /api/stories/upload-signature` — Cloudinary signed upload token for stories.
- `POST /api/stories` — Persists story with 24-hour TTL expiration.
- `GET /api/stories/feed` — Aggregated story feed grouped by user.
- `GET /api/stories/:storyId` — Single story item.
- `POST /api/stories/:storyId/view` — Records viewer telemetry.
- `GET /api/stories/:storyId/viewers` — Story viewers list (story author only).
- `DELETE /api/stories/:storyId` — Deletes story.

### Real-Time Messaging (`/api/messages`)
- `GET /api/messages/conversations` — Retrieves conversation list with latest messages.
- `POST /api/messages/conversations` — Creates or returns existing 1-on-1 conversation (`recipientId`).
- `GET /api/messages/conversations/:conversationId` — Conversation details.
- `GET /api/messages/conversations/:conversationId/messages` — Paginated message history.
- `POST /api/messages/conversations/:conversationId/messages` — Sends message (`content`).
- `PATCH /api/messages/conversations/:conversationId/read` — Marks conversation messages as read.
- `DELETE /api/messages/:messageId` — Deletes message (sender only).

### Notifications (`/api/notifications`)
- `GET /api/notifications` — Paginated notifications list.
- `GET /api/notifications/unread` — Unread notifications list.
- `GET /api/notifications/unread-count` — Unread count badge value.
- `PATCH /api/notifications/:notificationId/read` — Marks single notification as read.
- `PATCH /api/notifications/read-all` — Marks all notifications as read.
- `DELETE /api/notifications/:notificationId` — Deletes notification.
- `DELETE /api/notifications/clear-all` — Clears all notifications.

### Global Search (`/api/search`)
- `GET /api/search?q=...&type=all` — Multi-tab global search (`all`, `users`, `hashtags`, `posts`, `reels`, `places`).
- `GET /api/search/suggestions?q=...` — Debounced autocomplete suggestions.
- `GET /api/search/recent` — User's recent search queries.
- `POST /api/search/recent` — Records recent search item.
- `DELETE /api/search/recent/:id` — Deletes recent search item.
- `DELETE /api/search/recent` — Clears all recent searches.

### Recommendations (`/api/recommendations`)
- `GET /api/recommendations/users?page=1&limit=10&refresh=false` — Shuffled, cached user recommendations.
- `GET /api/recommendations/posts?page=1&limit=15&refresh=false` — Shuffled, cached hybrid post recommendations.
- `GET /api/recommendations/reels?page=1&limit=8&refresh=false` — Shuffled, cached hybrid Reel recommendations.
- `POST /api/recommendations/events` — Logs implicit engagement telemetry (`watchDurationSec`, `completionRate`).

### Django ML Service Endpoints (`ml-service/`)
- `GET /` — Root index endpoint returning JSON service metadata, version, and endpoints map (`status: "online"`).
- `GET /health/` or `GET /api/ml/health` — Service health probe and algorithm engine status.
- `GET /docs/recommendation-engine/` — **Human-readable technical documentation** returned as raw Markdown (`text/markdown; charset=utf-8`) detailing all algorithms, mathematical formulas, scoring methods, and pipeline architecture.
- `POST /api/ml/recommend/users` — Ranks candidate users using mutual followers and interest vectors (internal HMAC/shared-secret authenticated).
- `POST /api/ml/recommend/posts` — Ranks candidate posts using TF-IDF and collaborative filtering (internal HMAC/shared-secret authenticated).
- `POST /api/ml/recommend/reels` — Ranks candidate reels using audio affinity, TF-IDF, and video telemetry (internal HMAC/shared-secret authenticated).

---

## Deployment Guide

Insta-V2 is configured for deployment across **Netlify** (Frontend) and **Render** (Core Backend and Django ML Service).

### 1. Frontend Deployment (Netlify)
- **Repository Root:** Point to repository root.
- **Base Directory:** `client`
- **Build Command:** `npm run build`
- **Publish Directory:** `client/dist`
- **Netlify Configuration:** The bundled [`client/netlify.toml`](client/netlify.toml) manages routing:
  - Proxies `/api/*` requests directly to your backend host (`https://YOUR_BACKEND_HOST/api/:splat`) so requests remain same-origin, preserving HTTP-only authentication cookies across all browsers.
  - SPA Fallback routing all routes `/*` to `/index.html`.
- **Environment Variables:**
  - `VITE_API_BASE_URL=/api` (uses the Netlify first-party proxy)
  - `VITE_SOCKET_URL=https://your-backend-host.onrender.com`
  - `VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name`

### 2. Core Backend Deployment (Render Web Service)
- **Environment:** Node.js
- **Root Directory:** `server`
- **Build Command:** `npm install`
- **Start Command:** `npm start` (or `node server.js`)
- **Health Check Path:** `/api/health`
- **Environment Variables:**
  - `NODE_ENV=production`
  - `CLIENT_URL=https://your-site.netlify.app`
  - `MONGO_URI=mongodb+srv://...`
  - `JWT_SECRET=strong_production_secret`
  - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`
  - `ML_SERVICE_URL=https://your-django-ml-service.onrender.com`
  - `ML_SERVICE_SECRET=shared_secret_matching_django`
  - `ML_INTERNAL_API_KEY=shared_secret_matching_django`
  - `RECOMMENDATION_POOL_SIZE_POSTS=80`
  - `RECOMMENDATION_POOL_SIZE_REELS=60`
  - `RECOMMENDATION_POOL_SIZE_USERS=50`

### 3. Django ML Service Deployment (Render Web Service)
- **Environment:** Python 3
- **Root Directory:** `ml-service`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn ml_project.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 30`
- **Health Check Path:** `/health/` or `/`
- **Environment Variables:**
  - `DJANGO_SECRET_KEY=strong_random_django_secret`
  - `DEBUG=false`
  - `DJANGO_DEBUG=false`
  - `ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1`
  - `DJANGO_ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1`
  - `INTERNAL_SERVICE_SECRET=shared_secret_matching_node`
  - `ML_INTERNAL_API_KEY=shared_secret_matching_node`

---

## Security & Privacy Model

1. **HTTP-Only Cookie Isolation:** Authentication JWTs are stored in cookies marked `httpOnly: true`. In production, cookies enforce `secure: true` and `sameSite: 'none'` (for cross-domain deployments) or `sameSite: 'lax'` (for proxy deployments). Client JavaScript has zero access to raw JWT strings.
2. **CORS Allowlist Parsing:** The backend constructs an explicit origin allowlist from `CLIENT_URL` and `FRONTEND_URL`. Wildcards (`*`) are strictly prohibited with credentialed requests.
3. **Private Account Privacy Middleware:** The `canViewUserContent` middleware intercepts content requests. If the requested account is private, non-approved followers receive a strict `403 Forbidden` response. Private posts, reels, and stories are filtered out of feeds and recommendations.
4. **Inter-Service Security:** The Django microservice rejects any request lacking an `X-Internal-Service-Key` header matching `ML_INTERNAL_API_KEY`. The ML service never accepts direct browser traffic.
5. **Signed Media Uploads:** Media files are uploaded directly to Cloudinary using single-use cryptographic signatures generated on the backend with timestamps and folder restrictions.

---

## Troubleshooting Guide

### 1. Production Authentication Cookies & 401 Unauthorized
- **Symptom:** Login succeeds, but subsequent requests to `/api/auth/me` return `401 Unauthorized`.
- **Cause:** Third-party cookie blocking in modern browsers (Chrome, Safari, iOS) when frontend (`netlify.app`) and backend (`onrender.com`) are on different domains.
- **Resolution:**
  1. Ensure `withCredentials: true` is enabled in Axios (implemented in `client/src/services/api.js`).
  2. Use the Netlify first-party proxy in `client/netlify.toml` (`/api/* -> backend/api/:splat`) and set `VITE_API_BASE_URL=/api`. Requests stay on `netlify.app`, making the cookie first-party.
  3. If connecting cross-domain directly, ensure `NODE_ENV=production` so cookies set `SameSite=none; Secure`.

### 2. WebSocket & Socket.IO Connection Failures
- **Symptom:** Console error `WebSocket connection to 'wss://localhost:8000/socket.io/' failed`.
- **Cause:** Local development was incorrectly configured with `https://` or `wss://` on an unencrypted HTTP port.
- **Resolution:** In `client/.env`, configure `VITE_SOCKET_URL=http://localhost:8000` for local development. Only use `https://` for production deployments.

### 3. Stray Reload Script Error
- **Symptom:** Console error `reload.js:22 WebSocket connection to 'ws://127.0.0.1:5500/ws' failed`.
- **Cause:** A VS Code Live Server browser extension is active in your browser trying to connect to port 5500.
- **Resolution:** This is not generated by Insta-V2; disable the VS Code Live Server extension or test in an Incognito window.

### 4. Django Service Returns 400 Bad Request
- **Symptom:** Calling `http://127.0.0.1:8001/` returns `400 Bad Request`.
- **Cause:** `ALLOWED_HOSTS` in Django included URL schemes or ports (e.g., `http://` or `:8001`), or loopback was missing.
- **Resolution:** Django requires clean hostnames. In `ml-service/ml_project/settings.py`, loopback hosts (`127.0.0.1`, `localhost`) are automatically guaranteed, and schemes/ports are sanitized.

### 5. Redis Unreachable
- **Symptom:** Redis server is not running locally.
- **Resolution:** No action required. Insta-V2 automatically detects Redis connection errors and seamlessly falls back to an in-memory LRU cache with identical TTL and key semantics.

---

## Automated Verification & Test Suites

Insta-V2 features a suite of automated end-to-end integration tests that verify database transactions, privacy gates, real-time messaging, and recommendation freshness.

### Running Backend Integration Tests
Ensure MongoDB Atlas credentials are set in `server/.env`, then run:

```bash
cd server

# 1. Recommendation Shuffling, Freshness on Refresh & Duplicate Prevention
node test-shuffle-recommendations.js

# 2. Triple-Engine ML Recommendations, Caching & Fault-Tolerant Fallbacks
npm run test:recommendations

# 3. Socket.IO Real-Time Connection, Presence & Notification Dispatch
npm run test:socket

# 4. Social Networking Features, Follow Requests & Privacy Enforcement
npm run test:social

# 5. Reels Feed, Upload Signatures, Likes & Moderation
npm run test:reels

# 6. Real-Time Notifications Lifecycle
npm run test:notifications

# 7. Direct Messaging & Conversation Threads
npm run test:messages

# 8. Multi-Tab Global Search & Recent Search History
npm run test:search

# 9. Core Auth & Basic Endpoints
npm test
```

### Running Django ML Unit Tests
```bash
cd ml-service
.\.venv\Scripts\python.exe manage.py test
```

### Verifying Frontend Production Build
```bash
cd client
npm run build
```

---

## License

This project is developed for educational and portfolio demonstration purposes as an advanced full-stack software engineering project. All trademarks and design inspirations belong to their respective owners.
