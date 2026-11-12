# Insta-V2 — Full-Stack Instagram Clone

Insta-V2 is a modern social media application built with a **React 19 + Vite** frontend and a **Node.js + Express + MongoDB + Cloudinary** backend.

## Architecture & Tech Stack

### Frontend (`client/`)
- **React 19** + **Vite**
- **React Router DOM**
- **Axios** (with HTTP-only cookie credentials support)
- **Lucide React** icons & custom CSS variables/responsive styling

### Backend (`server/`)
- **Node.js** & **Express.js**
- **MongoDB** with **Mongoose** ODM
- **JWT Authentication** stored securely in **HTTP-only cookies**
- **bcryptjs** for password hashing
- **Cloudinary** for **signed direct-to-cloud media uploads**
- **express-rate-limit** & **cors** for security

---

## Project Structure

```text
Instagram/
├── client/                     # React 19 + Vite frontend
│   ├── src/
│   │   ├── components/         # UI components, modals, auth guards
│   │   ├── context/            # AppContext with real backend auth & media
│   │   ├── pages/              # Login, Signup, Home, Profile, etc.
│   │   └── services/           # Centralized Axios API, authService, mediaService
│   ├── .env.example
│   └── package.json
├── server/                     # Express + MongoDB + Cloudinary backend
│   ├── config/                 # db.js, cloudinary.js
│   ├── controllers/            # authController.js, mediaController.js
│   ├── middleware/             # authMiddleware.js, errorMiddleware.js
│   ├── models/                 # User.js, Post.js, Story.js
│   ├── routes/                 # authRoutes.js, mediaRoutes.js
│   ├── utils/                  # generateToken.js
│   ├── .env.example
│   ├── server.js
│   ├── test-endpoints.js       # End-to-end API verification suite
│   └── package.json
├── .gitignore
├── package.json
└── README.md
```

---

## Setup Instructions

### 1. Prerequisites
- **Node.js** (v18+ recommended)
- **MongoDB** (MongoDB Atlas cluster or local MongoDB instance)
- **Cloudinary Account** (for signed media storage)

### 2. Environment Configuration

#### Backend (`server/.env`)
Copy `server/.env.example` to `server/.env` and configure your credentials:

```env
PORT=8000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/instaV2db?retryWrites=true&w=majority
JWT_SECRET=your_secure_random_jwt_secret_at_least_32_chars
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=insta_v2
```

#### Frontend (`client/.env`)
Copy `client/.env.example` to `client/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
```

> **Security Notice:** Never expose `MONGO_URI`, `JWT_SECRET`, or `CLOUDINARY_API_SECRET` to the frontend (`VITE_*` variables).

### 3. Cloudinary Setup (Signed Uploads)
1. Log in to your [Cloudinary Console](https://cloudinary.com/console).
2. Copy your **Cloud Name**, **API Key**, and **API Secret** into `server/.env`.
3. Go to **Settings -> Upload -> Upload Presets**.
4. Create or configure an upload preset (e.g., `insta_v2`) with **Signing Mode** set to **Signed**.
5. Set `CLOUDINARY_UPLOAD_PRESET=insta_v2` in `server/.env`.

### 4. Installation

Install dependencies for both backend and frontend:

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

---

## Running the Application

Run the backend and frontend development servers in two separate terminals:

**Terminal 1 — Backend Server (Port 8000):**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend Client (Port 5173):**
```bash
cd client
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/signup` — Register a new user, hash password, issue HTTP-only JWT cookie.
- `POST /api/auth/login` — Authenticate via username or email + password, issue HTTP-only JWT cookie.
- `POST /api/auth/logout` — Clear authentication cookie.
- `GET /api/auth/me` — Verify active session and return current user profile (Protected).

### Media Uploads (`/api/media`)
- `POST /api/media/signature` — Generate cryptographic Cloudinary upload signature (Protected).
- `POST /api/media/posts` — Save uploaded post metadata (`mediaUrl`, `publicId`, `caption`, `location`, `mediaAspect`) to MongoDB (Protected).
- `POST /api/media/stories` — Save uploaded story metadata (`mediaUrl`, `publicId`, `mediaType`, `caption`) with 24h TTL expiration to MongoDB (Protected).

### Users, Profiles, Follow & Privacy (`/api/users`)
- `GET /api/users/search?q=...` — Search users by username or full name (Protected).
- `GET /api/users/suggestions` — Fetch suggested users (Protected).
- `PATCH /api/users/me/privacy` — Toggle account privacy between Public (`false`) and Private (`true`) (Protected).
- `PATCH /api/users/me/profile` — Update current user's profile info (Protected).
- `GET /api/users/:userId/profile` — Get user profile, stats, follow status, and content visibility (Protected).
- `GET /api/users/:userId/posts` — Get user's posts; enforces private account follower restrictions (Protected).
- `POST /api/users/:userId/follow` — Follow a public user or send a follow request to a private user (Protected).
- `DELETE /api/users/:userId/follow` — Unfollow a user (Protected).
- `GET /api/users/:userId/followers` — Paginated followers list; enforces account privacy (Protected).
- `GET /api/users/:userId/following` — Paginated following list; enforces account privacy (Protected).
- `GET /api/users/:userId/follow-status` — Check relationship status (`isFollowing`, `isPending`, `requestId`, `isSelf`) (Protected).

### Follow Requests (`/api/follow-requests`)
- `GET /api/follow-requests` — Get incoming pending follow requests (Protected).
- `GET /api/follow-requests/sent` — Get outgoing pending follow requests (Protected).
- `POST /api/follow-requests/:requestId/accept` — Accept an incoming follow request (Protected).
- `POST /api/follow-requests/:requestId/reject` — Reject an incoming follow request (Protected).
- `DELETE /api/follow-requests/:requestId` — Cancel an outgoing follow request (Protected).

### Posts, Likes, Comments & Sharing (`/api/posts` & `/api/comments`)
- `GET /api/posts/feed` — Paginated feed of authorized posts (own, following, and public accounts) (Protected).
- `GET /api/posts/:postId` — Get a single post; enforces privacy (Protected).
- `GET /api/posts/:postId/share` — Get shareable URL & metadata; enforces privacy (Protected).
- `POST /api/posts/:postId/like` — Like a post with duplicate prevention (Protected).
- `DELETE /api/posts/:postId/like` — Unlike a post (Protected).
- `GET /api/posts/:postId/likes` — Paginated list of users who liked the post (Protected).
- `POST /api/posts/:postId/comments` — Add a comment to an authorized post (Protected).
- `GET /api/posts/:postId/comments` — Paginated comments for an authorized post (Protected).
- `DELETE /api/comments/:commentId` — Delete own comment or any comment on own post (Protected).

### Reels (`/api/reels`)
- `POST /api/reels/upload-signature` — Generate signed Cloudinary video upload signature (`insta_v2/reels`) (Protected).
- `POST /api/reels` — Save uploaded Reel metadata (`videoUrl`, `publicId`, `caption`, `thumbnailUrl`, `duration`, `aspectRatio`) to MongoDB (Protected).
- `GET /api/reels` — Paginated/cursor-based Reels feed respecting private account authorization (Protected).
- `GET /api/reels/:reelId` — Get a single Reel; enforces private account restrictions (Protected).
- `DELETE /api/reels/:reelId` — Delete Reel metadata from MongoDB and video asset from Cloudinary (Owner only).
- `POST /api/reels/:reelId/like` & `DELETE /api/reels/:reelId/like` — Like / unlike a Reel with duplicate prevention (Protected).
- `GET /api/reels/:reelId/comments` & `POST /api/reels/:reelId/comments` — Paginated comments on a Reel (Protected).
- `DELETE /api/reels/comments/:commentId` — Delete own comment or any comment on own Reel (Protected).
- `GET /api/reels/:reelId/share` — Get shareable URL & metadata; enforces privacy (Protected).

### Notifications & Real-Time (`/api/notifications` + Socket.IO)
- `GET /api/notifications` — Paginated/cursor-based notifications for the authenticated user (Protected).
- `GET /api/notifications/unread` — Paginated unread notifications (Protected).
- `GET /api/notifications/unread-count` — Get total unread notification count (Protected).
- `PATCH /api/notifications/:notificationId/read` — Mark a single notification as read (Owner only).
- `PATCH /api/notifications/read-all` — Mark all notifications as read (Protected).
- `DELETE /api/notifications/:notificationId` — Delete a single notification (Owner only).
- `DELETE /api/notifications/clear-all` — Clear all notifications for the authenticated user (Protected).

#### Real-Time Socket.IO & Deployment Notes
- Real-time notification delivery (`new_notification`, `unread_count_updated`) uses **Socket.IO** authenticated via the HTTP-only JWT cookie and scoped to private `user:<userId>` rooms.
- **Frontend Deployment (Netlify):** Configured exclusively via [client/netlify.toml](client/netlify.toml) (`/* -> /index.html` SPA fallback plus `/api/* -> https://YOUR_BACKEND_HOST/api/:splat` proxy rule). Replace `YOUR_BACKEND_HOST` in `client/netlify.toml` with your deployed backend host and set `VITE_API_BASE_URL=/api` in Netlify's environment variables so API requests stay same-origin (preserving HTTP-only authentication cookies across browsers). If instead calling the backend directly (`VITE_API_BASE_URL=https://<your-backend-host>/api`), set `CLIENT_URL` on the backend to your Netlify origin.
- **Backend Deployment Consideration:** [server/vercel.json](server/vercel.json) provides independent serverless routing for the backend API. Because WebSockets/Socket.IO require persistent server connections, deploy the backend on a persistent Node.js host (e.g., Render, Railway, Fly.io, or a VPS) for live Socket.IO; in stateless/serverless environments (e.g., Vercel Serverless Functions), the client automatically falls back to periodic polling (`GET /api/notifications/unread-count`).

---

## Demo Data Seeding (Development Only)

Populate MongoDB Atlas and Cloudinary with fictional demo accounts, Cloudinary-hosted avatars/posts/Reels, follow relationships, pending follow requests, likes, and comments:

```bash
cd server
npm run seed:demo
```

- **Idempotent & Non-Destructive:** Existing users (including your personal accounts) and previously seeded assets are preserved and reused without duplicates.
- **Production Safety Guard:** Refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true` is explicitly provided.
- **Demo Account Password:** All seeded demo users share the development password `DemoUser@2026` (hashed with bcrypt).
- **Sample Demo Usernames:** `maya.lin`, `alex.rivera`, `liam.oconnor`, `sophia.patel` (public), and `chloe.dubois`, `elena.rostova`, `ethan.brooks` (private).

---

## Testing

To verify MongoDB connectivity, authentication flows, media metadata endpoints, social networking features, Reels, and real-time notifications:

```bash
# Terminal 1: Start server
cd server
npm run dev

# Terminal 2: Run test suites
cd server
npm test
npm run test:social
npm run test:reels
npm run test:notifications
```
