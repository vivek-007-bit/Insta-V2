// End-to-end integration tests for Node.js <-> Redis/Memory Cache <-> Django ML Service <-> MongoDB Fallback
import './config/env.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ML_DIR = path.resolve(__dirname, '../ml-service');

const BASE_URL = 'http://localhost:8000';
const ML_PORT = 8001;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
const SAMPLE_IMAGE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/insta_v2/posts/rec_test.jpg`;
const SAMPLE_VIDEO_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/insta_v2/reels/rec_test.mp4`;
const SAMPLE_THUMB_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/insta_v2/reels/rec_test.jpg`;

async function request(method, reqPath, body = null, headers = {}) {
  const res = await fetch(`${BASE_URL}${reqPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return {
    statusCode: res.status,
    data,
    cookies: res.headers.get('set-cookie') || ''
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

async function waitForMlHealth(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${ML_PORT}/api/ml/health`);
      if (res.ok) return true;
    } catch {
      // Wait for Django startup
    }
    await new Promise((r) => setTimeout(r, 350));
  }
  throw new Error('Django ML service did not become healthy in time');
}

function startDjangoServer() {
  const pyExe =
    process.platform === 'win32'
      ? path.join(ML_DIR, '.venv', 'Scripts', 'python.exe')
      : path.join(ML_DIR, '.venv', 'bin', 'python');

  const proc = spawn(pyExe, ['manage.py', 'runserver', `127.0.0.1:${ML_PORT}`, '--noreload'], {
    cwd: ML_DIR,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: 'pipe'
  });
  proc.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Quit the server with') || s.includes('Django version')) {
      // ready
    }
  });
  proc.stderr.on('data', (d) => {
    console.error('[Django Stderr]:', d.toString().trim());
  });
  return proc;
}

function startNodeServer() {
  const serverPath = path.join(__dirname, 'server.js');
  return spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env: { ...process.env, PORT: '8000' },
    stdio: 'ignore'
  });
}

async function waitForNodeHealth(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function stopServer(proc, port) {
  if (process.platform === 'win32') {
    try {
      const { execSync } = await import('child_process');
      if (proc && proc.pid) {
        try { execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: 'ignore' }); } catch {}
      }
      if (port) {
        try {
          const netstatOut = execSync(`netstat -ano | findstr /C:":${port} " | findstr /I "LISTENING"`).toString();
          const pids = [...new Set(netstatOut.split('\n').map((l) => l.trim().split(/\s+/).pop()).filter((p) => p && /^\d+$/.test(p) && p !== '0'))];
          for (const p of pids) {
            try { execSync(`taskkill /pid ${p} /f /t`, { stdio: 'ignore' }); } catch {}
          }
        } catch {}
      }
    } catch {
      try { if (proc) proc.kill(); } catch {}
    }
  } else {
    try { if (proc) proc.kill('SIGTERM'); } catch {}
  }
}

async function runTests() {
  console.log('=== RUNNING ML RECOMMENDATION SYSTEM INTEGRATION TESTS ===');
  const ts = Date.now();
  let djangoProc = null;
  let nodeProc = null;

  try {
    // Ensure Node.js server is running
    const nodeHealthy = await waitForNodeHealth(1500);
    if (!nodeHealthy) {
      console.log('\n0a. Starting Node.js server on port 8000...');
      nodeProc = startNodeServer();
      const ready = await waitForNodeHealth(25000);
      assert(ready, 'Node.js server failed to become healthy on port 8000');
      console.log('   OK: Node.js server is healthy');
    }

    // Ensure Django ML service is running for live ML tests
    console.log('\n0b. Starting Django ML service on port 8001...');
    djangoProc = startDjangoServer();
    await waitForMlHealth();
    console.log('   OK: Django ML service is healthy');

    // Test root endpoint (http://127.0.0.1:8001/)
    const rootRes = await fetch(`http://127.0.0.1:${ML_PORT}/`);
    assert(rootRes.status === 200, `Expected 200 from root http://127.0.0.1:${ML_PORT}/, got ${rootRes.status}`);
    const rootData = await rootRes.json();
    assert(rootData.success && rootData.status === 'online', 'Root endpoint json response invalid');
    console.log('   OK: GET http://127.0.0.1:8001/ returned 200 OK with service info');

    // Test health endpoint (http://127.0.0.1:8001/health/)
    const slashHealthRes = await fetch(`http://127.0.0.1:${ML_PORT}/health/`);
    assert(slashHealthRes.status === 200, `Expected 200 from /health/, got ${slashHealthRes.status}`);
    console.log('   OK: GET http://127.0.0.1:8001/health/ returned 200 OK');

    // Test Markdown docs endpoint (http://127.0.0.1:8001/docs/recommendation-engine/)
    const docsRes = await fetch(`http://127.0.0.1:${ML_PORT}/docs/recommendation-engine/`);
    assert(docsRes.status === 200, `Expected 200 from docs endpoint, got ${docsRes.status}`);
    const contentType = docsRes.headers.get('content-type') || '';
    assert(contentType.includes('text/markdown'), `Expected text/markdown content-type, got ${contentType}`);
    const docsMd = await docsRes.text();
    assert(docsMd.includes('# Insta-V2 Recommendation Engine Architecture'), 'Missing Markdown title in docs');
    assert(docsMd.includes('Recommended Users Engine'), 'Missing Users engine in docs');
    assert(docsMd.includes('Recommended Posts Engine'), 'Missing Posts engine in docs');
    assert(docsMd.includes('Recommended Reels Engine'), 'Missing Reels engine in docs');
    console.log('   OK: GET http://127.0.0.1:8001/docs/recommendation-engine/ returned 200 OK with text/markdown');

    // 1. Unauthenticated & invalid input checks
    console.log('\n1. Verifying auth protection & validation across all 3 recommendation pipelines...');
    const unauthUsers = await request('GET', '/api/recommendations/users');
    const unauthPosts = await request('GET', '/api/recommendations/posts');
    const unauthReels = await request('GET', '/api/recommendations/reels');
    const unauthEvents = await request('POST', '/api/recommendations/events', {
      contentType: 'reel',
      contentId: 'invalid'
    });
    assert(
      unauthUsers.statusCode === 401 &&
        unauthPosts.statusCode === 401 &&
        unauthReels.statusCode === 401 &&
        unauthEvents.statusCode === 401,
      'Unauthenticated recommendation requests must return 401 for users, posts, and reels'
    );

    // 2. Register test users (User A, User B, Private User P)
    console.log('\n2. Creating test users and real MongoDB posts/reels...');
    const userA = await request('POST', '/api/auth/signup', {
      fullName: `Rec User A ${ts}`,
      username: `reca_${ts}`,
      email: `reca_${ts}@rectest.com`,
      password: 'Password123!'
    });
    const userB = await request('POST', '/api/auth/signup', {
      fullName: `Rec User B ${ts}`,
      username: `recb_${ts}`,
      email: `recb_${ts}@rectest.com`,
      password: 'Password123!'
    });
    const userP = await request('POST', '/api/auth/signup', {
      fullName: `Rec Private P ${ts}`,
      username: `recp_${ts}`,
      email: `recp_${ts}@rectest.com`,
      password: 'Password123!'
    });
    assert(
      userA.statusCode === 201 && userB.statusCode === 201 && userP.statusCode === 201,
      'Test user signup failed'
    );

    const cookieA = userA.cookies.split(';')[0];
    const cookieB = userB.cookies.split(';')[0];
    const cookieP = userP.cookies.split(';')[0];

    await request('PATCH', '/api/users/me/privacy', { isPrivate: true }, { Cookie: cookieP });

    // Create public & private posts/reels
    const pubPost1 = await request(
      'POST',
      '/api/media/posts',
      {
        mediaUrl: SAMPLE_IMAGE_URL,
        publicId: `insta_v2/posts/rec_pub1_${ts}`,
        mediaType: 'image',
        caption: `Minimalist concrete architecture #recarch_${ts}`,
        location: 'Tokyo'
      },
      { Cookie: cookieB }
    );
    const pubPost2 = await request(
      'POST',
      '/api/media/posts',
      {
        mediaUrl: SAMPLE_IMAGE_URL,
        publicId: `insta_v2/posts/rec_pub2_${ts}`,
        mediaType: 'image',
        caption: `Timber gallery architecture #recarch_${ts}`,
        location: 'Kyoto'
      },
      { Cookie: cookieB }
    );
    const privPost = await request(
      'POST',
      '/api/media/posts',
      {
        mediaUrl: SAMPLE_IMAGE_URL,
        publicId: `insta_v2/posts/rec_priv_${ts}`,
        mediaType: 'image',
        caption: `Private secret post #recpriv_${ts}`,
        location: 'Hidden'
      },
      { Cookie: cookieP }
    );
    const pubReel = await request(
      'POST',
      '/api/reels',
      {
        videoUrl: SAMPLE_VIDEO_URL,
        publicId: `insta_v2/reels/rec_pub_${ts}`,
        thumbnailUrl: SAMPLE_THUMB_URL,
        caption: `Sunset drone travel #rectravel_${ts}`,
        audioTrack: 'Sunset Audio'
      },
      { Cookie: cookieB }
    );
    const privReel = await request(
      'POST',
      '/api/reels',
      {
        videoUrl: SAMPLE_VIDEO_URL,
        publicId: `insta_v2/reels/rec_priv_${ts}`,
        thumbnailUrl: SAMPLE_THUMB_URL,
        caption: `Private hidden reel #recpriv_${ts}`,
        audioTrack: 'Private Audio'
      },
      { Cookie: cookieP }
    );

    assert(
      pubPost1.statusCode === 201 &&
        pubPost2.statusCode === 201 &&
        privPost.statusCode === 201 &&
        pubReel.statusCode === 201 &&
        privReel.statusCode === 201,
      'Failed creating test posts/reels'
    );

    const pubPost1Id = pubPost1.data.post.id;
    const privPostId = privPost.data.post.id;
    const pubReelId = pubReel.data.reel.id;
    const privReelId = privReel.data.reel.id;

    // Invalid event & private event rejection
    const badEvent = await request(
      'POST',
      '/api/recommendations/events',
      { contentType: 'invalid', contentId: pubReelId, eventType: 'watch' },
      { Cookie: cookieA }
    );
    assert(badEvent.statusCode === 400, `Expected 400 for invalid event, got ${badEvent.statusCode}`);

    const privEvent = await request(
      'POST',
      '/api/recommendations/events',
      { contentType: 'reel', contentId: privReelId, eventType: 'watch', watchDurationSec: 5 },
      { Cookie: cookieA }
    );
    assert(privEvent.statusCode === 403, `Expected 403 for private reel event, got ${privEvent.statusCode}`);

    // 3. Live Django ML generation & per-user caching across all 3 pipelines
    console.log('\n3. Testing live Django ML generation & per-user caching (Users, Posts, Reels)...');

    // --- Users Pipeline ---
    const usersA1 = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieA
    });
    assert(usersA1.statusCode === 200 && usersA1.data.success, 'usersA1 failed');
    assert(usersA1.data.source === 'ml-django', `Expected users source=ml-django, got ${usersA1.data.source}`);
    assert(!usersA1.data.users.some((u) => u.id === userA.data.user.id), 'Self included in recommended users!');
    assert(usersA1.data.users.length > 0, 'Expected recommended users returned');
    assert(usersA1.data.users[0].subtitle !== undefined, 'User recommendation subtitle missing');

    const usersA2 = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieA
    });
    assert(usersA2.statusCode === 200 && usersA2.data.source === 'cache', `Expected users cache hit, got ${usersA2.data.source}`);

    // Per-user isolation for users pipeline: User B must not get User A's cache
    const usersB1 = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieB
    });
    assert(usersB1.statusCode === 200 && usersB1.data.source === 'ml-django', `Expected User B users miss -> ml-django, got ${usersB1.data.source}`);

    // --- Posts Pipeline ---
    const recA1 = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieA
    });
    assert(recA1.statusCode === 200 && recA1.data.success, 'recA1 failed');
    assert(recA1.data.source === 'ml-django', `Expected posts source=ml-django, got ${recA1.data.source}`);
    assert(!recA1.data.posts.some((p) => p.id === privPostId), 'Private post leaked in ML recs!');

    const recA2 = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieA
    });
    assert(recA2.statusCode === 200 && recA2.data.source === 'cache', `Expected posts cache hit, got ${recA2.data.source}`);

    // Per-user isolation for posts pipeline: User B must NOT get User A's cache on first call
    const recB1 = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieB
    });
    assert(recB1.statusCode === 200 && recB1.data.source === 'ml-django', `Expected User B cache miss -> ml-django, got ${recB1.data.source}`);

    // --- Reels Pipeline ---
    const reelA1 = await request('GET', '/api/recommendations/reels?page=1&limit=8', null, {
      Cookie: cookieA
    });
    assert(reelA1.statusCode === 200 && reelA1.data.source === 'ml-django', `Expected reels ml-django, got ${reelA1.data.source}`);
    assert(!reelA1.data.reels.some((r) => r.id === privReelId), 'Private reel leaked in ML recs!');

    const reelA_cached = await request('GET', '/api/recommendations/reels?page=1&limit=8', null, {
      Cookie: cookieA
    });
    assert(reelA_cached.statusCode === 200 && reelA_cached.data.source === 'cache', `Expected reels cache hit, got ${reelA_cached.data.source}`);

    // 4. Targeted Interaction Invalidation (pipeline separation verified)
    console.log('\n4. Testing targeted cache invalidation on meaningful interactions...');
    await new Promise((r) => setTimeout(r, 2100)); // clear default 2s invalidation cooldown

    // User A follows User B -> invalidates 'users' pipeline (and 'posts'), but leaves 'reels' intact!
    const followRes = await request('POST', `/api/users/${userB.data.user.id}/follow`, {}, { Cookie: cookieA });
    assert(followRes.statusCode === 201 && followRes.data.isFollowing, 'Follow public user failed');

    const usersA3 = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieA
    });
    assert(usersA3.data.source === 'ml-django', `Expected users cache invalidated after follow, got ${usersA3.data.source}`);
    assert(!usersA3.data.users.some((u) => u.id === userB.data.user.id), 'Already followed user must be excluded from recommendations!');

    // Follow request to private user P -> status requested, excluded from recommendations
    const reqPrivRes = await request('POST', `/api/users/${userP.data.user.id}/follow`, {}, { Cookie: cookieA });
    assert(reqPrivRes.statusCode === 201 && reqPrivRes.data.isPending, 'Follow request to private user failed');

    // Post like -> invalidates 'posts' pipeline
    await new Promise((r) => setTimeout(r, 2100));
    const likeRes = await request('POST', `/api/posts/${pubPost1Id}/like`, {}, { Cookie: cookieA });
    assert(likeRes.statusCode === 201, 'Like failed');
    const recA3 = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieA
    });
    assert(recA3.data.source === 'ml-django', `Expected post cache invalidated after like, got ${recA3.data.source}`);

    // Reel watch -> invalidates 'reels' pipeline
    const watchRes = await request(
      'POST',
      '/api/recommendations/events',
      { contentType: 'reel', contentId: pubReelId, eventType: 'watch', watchDurationSec: 6, completionRate: 0.8 },
      { Cookie: cookieA }
    );
    assert(watchRes.statusCode === 200 && watchRes.data.recorded, 'Watch event failed');
    const reelA2 = await request('GET', '/api/recommendations/reels?page=1&limit=8', null, {
      Cookie: cookieA
    });
    assert(reelA2.data.source === 'ml-django', `Expected reel cache invalidated after watch, got ${reelA2.data.source}`);
    console.log('   OK: Live generation, caching, per-user isolation, and targeted invalidation verified for all 3 pipelines');

    // 5. Stop Django ML service and verify fault-tolerant stale-cache + MongoDB fallback across all 3 pipelines
    console.log('\n5. Stopping Django ML service to verify stale-cache & MongoDB fallback (Users, Posts, Reels)...');
    await stopServer(djangoProc, ML_PORT);
    djangoProc = null;
    await new Promise((r) => setTimeout(r, 800));

    // Register User C (cold cache, zero cached entries) while Django is DOWN
    const userC = await request('POST', '/api/auth/signup', {
      fullName: `Rec Fallback C ${ts}`,
      username: `recc_${ts}`,
      email: `recc_${ts}@rectest.com`,
      password: 'Password123!'
    });
    const cookieC = userC.cookies.split(';')[0];

    // Cold User C Fallbacks:
    const fallbackUsersC = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieC
    });
    assert(
      fallbackUsersC.statusCode === 200 &&
        fallbackUsersC.data.success &&
        fallbackUsersC.data.source === 'mongodb-fallback' &&
        fallbackUsersC.data.users.length > 0,
      `Expected mongodb-fallback for uncached users when Django down, got ${fallbackUsersC.data.source}`
    );

    const fallbackPostsC = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieC
    });
    assert(
      fallbackPostsC.statusCode === 200 &&
        fallbackPostsC.data.success &&
        fallbackPostsC.data.source === 'mongodb-fallback' &&
        fallbackPostsC.data.posts.length > 0,
      `Expected mongodb-fallback for uncached posts when Django down, got ${fallbackPostsC.data.source}`
    );
    assert(!fallbackPostsC.data.posts.some((p) => p.id === privPostId), 'Private post leaked in MongoDB fallback!');

    const fallbackReelsC = await request('GET', '/api/recommendations/reels?page=1&limit=8', null, {
      Cookie: cookieC
    });
    assert(
      fallbackReelsC.statusCode === 200 &&
        fallbackReelsC.data.success &&
        fallbackReelsC.data.source === 'mongodb-fallback' &&
        fallbackReelsC.data.reels.length > 0,
      `Expected mongodb-fallback for uncached reels when Django down, got ${fallbackReelsC.data.source}`
    );
    assert(!fallbackReelsC.data.reels.some((r) => r.id === privReelId), 'Private reel leaked in MongoDB fallback!');

    // User A had warm stale copies stored when ml-django succeeded.
    // Invalidate fresh caches (post unlike for posts, unfollow for users), and verify User A gets stale-cache fallback gracefully!
    await new Promise((r) => setTimeout(r, 2100));
    await request('DELETE', `/api/posts/${pubPost1Id}/like`, null, { Cookie: cookieA });
    await request('DELETE', `/api/users/${userB.data.user.id}/follow`, null, { Cookie: cookieA });

    const stalePostsA = await request('GET', '/api/recommendations/posts?page=1&limit=15', null, {
      Cookie: cookieA
    });
    assert(
      stalePostsA.statusCode === 200 &&
        stalePostsA.data.success &&
        (stalePostsA.data.source === 'stale-cache' || stalePostsA.data.source === 'mongodb-fallback'),
      `Expected stale-cache/mongodb-fallback when Django down, got ${stalePostsA.data.source}`
    );
    assert(!stalePostsA.data.posts.some((p) => p.id === privPostId), 'Private post leaked in stale-cache fallback!');

    const staleUsersA = await request('GET', '/api/recommendations/users?page=1&limit=10', null, {
      Cookie: cookieA
    });
    assert(
      staleUsersA.statusCode === 200 &&
        staleUsersA.data.success &&
        (staleUsersA.data.source === 'stale-cache' || staleUsersA.data.source === 'mongodb-fallback'),
      `Expected stale-cache/mongodb-fallback for users when Django down, got ${staleUsersA.data.source}`
    );

    console.log('   OK: Stale-cache & MongoDB fallbacks work seamlessly across Users, Posts, and Reels when Django is down');

    // 6. Test cache TTL expiration + Redis failure graceful degradation via unit check
    console.log('\n6. Verifying cache TTL expiration...');
    const { setCachedRecommendations, getCachedRecommendations } = await import(
      './services/recommendationCacheService.js'
    );
    await setCachedRecommendations(`ttl_user_${ts}`, 'posts', { items: [{ id: 'x', score: 1 }] }, 1);
    const beforeExp = await getCachedRecommendations(`ttl_user_${ts}`, 'posts');
    assert(beforeExp && beforeExp.items.length === 1, 'Expected cached item before TTL');
    await new Promise((r) => setTimeout(r, 1200));
    const afterExp = await getCachedRecommendations(`ttl_user_${ts}`, 'posts');
    assert(afterExp === null, 'Expected null after 1s TTL expiration');
    console.log('   OK: Cache TTL expiration verified');

    console.log('\n=== ALL ML RECOMMENDATION INTEGRATION TESTS PASSED SUCCESSFULLY ===');
  } finally {
    if (djangoProc) {
      await stopServer(djangoProc, ML_PORT);
    }
    if (nodeProc) {
      await stopServer(nodeProc, 8000);
    }
  }
}

runTests().catch((err) => {
  console.error('\nTEST FAILURE:', err.message);
  process.exit(1);
});
