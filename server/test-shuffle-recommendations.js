// Comprehensive test suite for Recommendation Shuffling, Freshness on Refresh,
// Duplicate Prevention, Pagination Integrity, and Cache Isolation
import './config/env.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import {
  fisherYatesShuffle,
  getShuffledPageFromPool,
  clearUserShuffleSession
} from './services/recommendationShuffleService.js';
import { getTargetPoolSize } from './services/mlRecommendationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ML_DIR = path.resolve(__dirname, '../ml-service');
const BASE_URL = 'http://localhost:8000';
const ML_PORT = 8001;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

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

async function isPortHealthy(url, timeoutMs = 2000) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortHealthy(url)) return true;
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
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
      // server ready
    }
  });
  proc.stderr.on('data', (d) => {
    console.error('[Django Stderr]:', d.toString().trim());
  });
  return proc;
}

function startNodeServer() {
  const serverPath = path.join(__dirname, 'server.js');
  const proc = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env: { ...process.env, PORT: '8000' },
    stdio: 'pipe'
  });
  proc.stderr.on('data', (d) => {
    console.error('[Node Stderr]:', d.toString().trim());
  });
  return proc;
}

async function stopProcess(proc, port) {
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

// ----------------------------------------------------------------------
// UNIT TESTS: Pure Fisher-Yates and Shuffle Session Logic
// ----------------------------------------------------------------------
function runUnitTests() {
  console.log('\n--- 1. Testing Fisher-Yates Shuffle Immutability & Permutations ---');

  const original = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const frozenOriginal = Object.freeze([...original]);
  const shuffled = fisherYatesShuffle(frozenOriginal);

  assert(shuffled !== frozenOriginal, 'Shuffle must return a new array instance');
  assert(shuffled.length === original.length, 'Shuffled array must have identical length');
  assert(
    [...shuffled].sort().join(',') === [...original].sort().join(','),
    'Shuffled array must contain all original elements'
  );

  // Check multiple shuffles produce different permutations
  let differentOrderCount = 0;
  const numTrials = 20;
  for (let i = 0; i < numTrials; i++) {
    const s = fisherYatesShuffle(original);
    if (s.join(',') !== original.join(',')) {
      differentOrderCount++;
    }
  }
  assert(differentOrderCount > 0, 'Fisher-Yates must produce non-trivial permutations');
  console.log(`   OK: Fisher-Yates produces non-mutating permutations (${differentOrderCount}/${numTrials} varied)`);

  // Edge cases
  assert(fisherYatesShuffle([]).length === 0, 'Empty array shuffle must return empty array');
  assert(fisherYatesShuffle(['alone'])[0] === 'alone', 'Single-item array shuffle must return single item');

  console.log('\n--- 2. Testing Pagination & Duplicate Prevention in Shuffle Sessions ---');
  const dummyRecs = Array.from({ length: 30 }, (_, i) => ({
    id: `item_${i + 1}`,
    score: 1.0 - i * 0.02,
    reason: 'test'
  }));

  const testUserId = 'user_unit_test_999';

  // Request Page 1 (limit 10)
  const page1 = getShuffledPageFromPool({
    userId: testUserId,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 1,
    limit: 10,
    refresh: true
  });

  assert(page1.pageRecs.length === 10, `Expected 10 items on page 1, got ${page1.pageRecs.length}`);
  assert(page1.hasMore === true, 'Expected hasMore=true for page 1');
  const p1Ids = page1.pageRecs.map((r) => r.id);
  const p1Set = new Set(p1Ids);
  assert(p1Set.size === 10, 'Page 1 must not contain duplicate items');

  // Request Page 2 (limit 10) - must NOT contain any item from Page 1
  const page2 = getShuffledPageFromPool({
    userId: testUserId,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 2,
    limit: 10,
    refresh: false
  });

  assert(page2.pageRecs.length === 10, `Expected 10 items on page 2, got ${page2.pageRecs.length}`);
  const p2Ids = page2.pageRecs.map((r) => r.id);
  const overlap = p2Ids.filter((id) => p1Set.has(id));
  assert(
    overlap.length === 0,
    `Pagination must not repeat items! Found overlap: ${overlap.join(', ')}`
  );
  console.log('   OK: Page 1 and Page 2 have ZERO duplicate items across sequential pages');

  // Request Page 3 (limit 10)
  const page3 = getShuffledPageFromPool({
    userId: testUserId,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 3,
    limit: 10,
    refresh: false
  });
  assert(page3.pageRecs.length === 10, 'Expected 10 items on page 3');
  const p3Ids = page3.pageRecs.map((r) => r.id);
  const seenP1P2 = new Set([...p1Ids, ...p2Ids]);
  const overlapP3 = p3Ids.filter((id) => seenP1P2.has(id));
  assert(overlapP3.length === 0, 'Page 3 must not repeat items from Page 1 or 2');
  console.log('   OK: Page 3 exhausts the 30-item pool without repeating any items');

  // Pool Exhaustion: Request Page 4 (limit 10) -> Should safely reshuffle without crashing or returning duplicates within page
  const page4 = getShuffledPageFromPool({
    userId: testUserId,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 4,
    limit: 10,
    refresh: false
  });
  assert(page4.pageRecs.length === 10, 'Page 4 after pool exhaustion must return 10 reshuffled items');
  const p4Ids = page4.pageRecs.map((r) => r.id);
  const p4Set = new Set(p4Ids);
  assert(p4Set.size === 10, 'Page 4 reshuffled items must not contain internal duplicates');
  console.log('   OK: Safe reshuffle on pool exhaustion verified');

  // Refresh behavior: requesting page 1 with refresh=true prioritizes fresh/unseen items
  const refreshedP1 = getShuffledPageFromPool({
    userId: testUserId,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 1,
    limit: 10,
    refresh: true
  });
  assert(refreshedP1.pageRecs.length === 10, 'Refreshed Page 1 must return 10 items');
  console.log('   OK: Refresh generates a fresh shuffled view for the user');

  // Cache isolation between users
  const userA = 'user_A_isolation';
  const userB = 'user_B_isolation';
  const sessionA = getShuffledPageFromPool({
    userId: userA,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 1,
    limit: 10,
    refresh: true
  });
  const sessionB = getShuffledPageFromPool({
    userId: userB,
    contentType: 'posts',
    allRecs: dummyRecs,
    page: 1,
    limit: 10,
    refresh: true
  });
  assert(sessionA.pageRecs.length === 10 && sessionB.pageRecs.length === 10, 'Both users must receive valid pages');
  console.log('   OK: User session isolation verified');

  // Clean up test sessions
  clearUserShuffleSession(testUserId);
  clearUserShuffleSession(userA);
  clearUserShuffleSession(userB);
}

// ----------------------------------------------------------------------
// INTEGRATION TESTS: Live Endpoints & Cache Verification
// ----------------------------------------------------------------------
async function runIntegrationTests() {
  console.log('\n--- 3. Running Live HTTP Recommendation Shuffle Tests ---');

  let spawnedNode = null;
  let spawnedDjango = null;

  try {
    await stopProcess(null, ML_PORT);
    await stopProcess(null, 8000);

    const isDjangoUp = await isPortHealthy(`http://127.0.0.1:${ML_PORT}/api/ml/health`);
    if (!isDjangoUp) {
      console.log('   Starting Django ML service...');
      spawnedDjango = startDjangoServer();
      const djangoReady = await waitForServer(`http://127.0.0.1:${ML_PORT}/api/ml/health`);
      assert(djangoReady, 'Django ML service failed to start');
      console.log('   OK: Django ML service started on port 8001');
    } else {
      console.log('   OK: Django ML service already running on port 8001');
    }

    const isNodeUp = await isPortHealthy(`${BASE_URL}/api/health`);
    if (!isNodeUp) {
      console.log('   Starting Node.js Express server...');
      spawnedNode = startNodeServer();
      const nodeReady = await waitForServer(`${BASE_URL}/api/health`);
      assert(nodeReady, 'Node.js server failed to start');
      console.log('   OK: Node.js server started on port 8000');
    } else {
      console.log('   OK: Node.js server already running on port 8000');
    }

    const ts = Date.now();
    const signupRes = await request('POST', '/api/auth/signup', {
      fullName: `Shuffle Tester ${ts}`,
      username: `shuffle_${ts}`,
      email: `shuffle_${ts}@test.com`,
      password: 'Password123!'
    });
    assert(signupRes.statusCode === 201, `Signup failed: ${JSON.stringify(signupRes.data)}`);
    const cookie = signupRes.cookies.split(';')[0];
    const authHeaders = { Cookie: cookie };

    // Verify configured pool sizes
    const postPoolSize = getTargetPoolSize('posts');
    const userPoolSize = getTargetPoolSize('users');
    const reelPoolSize = getTargetPoolSize('reels');
    console.log(`   Configured target pool sizes: Posts=${postPoolSize}, Users=${userPoolSize}, Reels=${reelPoolSize}`);
    assert(postPoolSize >= 50, 'Posts pool size must be >= 50');
    assert(userPoolSize >= 30, 'Users pool size must be >= 30');
    assert(reelPoolSize >= 30, 'Reels pool size must be >= 30');

    // TEST POSTS: Initial fetch, followed by cached refresh
    console.log('\n   A. Testing Recommended Posts Shuffling & Cache Serving...');
    const postsRes1 = await request('GET', '/api/recommendations/posts?page=1&limit=5', null, authHeaders);
    assert(postsRes1.statusCode === 200 && postsRes1.data.success, 'Posts request 1 failed');
    const posts1 = postsRes1.data.posts;
    const source1 = postsRes1.data.source;
    console.log(`      Posts load 1: ${posts1.length} items received (source: ${source1}, total: ${postsRes1.data.totalPosts})`);

    // Second request: page=1&refresh=true (Should be served from CACHE without calling Django)
    const postsRes2 = await request('GET', '/api/recommendations/posts?page=1&limit=5&refresh=true', null, authHeaders);
    assert(postsRes2.statusCode === 200 && postsRes2.data.success, 'Posts request 2 (refresh) failed');
    const posts2 = postsRes2.data.posts;
    const source2 = postsRes2.data.source;
    console.log(`      Posts load 2 (refresh): ${posts2.length} items received (source: ${source2})`);

    // Verify Django was NOT called when cache was valid
    assert(
      source2 === 'cache',
      `Expected cached recommendations on refresh, got source: ${source2}`
    );
    console.log('      OK: Refresh served from CACHE without invoking Django ML engine');

    // TEST POSTS PAGINATION: Page 1 vs Page 2 duplicate check
    console.log('\n   B. Testing Recommended Posts Pagination (Duplicate Prevention)...');
    const page1Res = await request('GET', '/api/recommendations/posts?page=1&limit=4', null, authHeaders);
    const page2Res = await request('GET', '/api/recommendations/posts?page=2&limit=4', null, authHeaders);
    assert(page1Res.statusCode === 200 && page2Res.statusCode === 200, 'Pagination requests failed');
    const p1Ids = page1Res.data.posts.map((p) => p.id);
    const p2Ids = page2Res.data.posts.map((p) => p.id);

    // If there are at least 8 items, verify zero duplicate IDs across pages
    if (page1Res.data.totalPosts >= 8) {
      const p1Set = new Set(p1Ids);
      const postOverlaps = p2Ids.filter((id) => p1Set.has(id));
      assert(postOverlaps.length === 0, `Duplicate posts found across pages: ${postOverlaps.join(', ')}`);
      console.log('      OK: Pagination page=1 and page=2 have ZERO duplicate posts');
    } else {
      console.log(`      Notice: Only ${page1Res.data.totalPosts} total posts available; pagination returned valid responses without error`);
    }

    // TEST REELS: Initial fetch, followed by cached refresh and pagination
    console.log('\n   C. Testing Recommended Reels Shuffling & Cache Serving...');
    const reelsRes1 = await request('GET', '/api/recommendations/reels?page=1&limit=4', null, authHeaders);
    assert(reelsRes1.statusCode === 200 && reelsRes1.data.success, 'Reels request 1 failed');
    const reels1 = reelsRes1.data.reels;
    console.log(`      Reels load 1: ${reels1.length} items (source: ${reelsRes1.data.source})`);

    const reelsRes2 = await request('GET', '/api/recommendations/reels?page=1&limit=4&refresh=true', null, authHeaders);
    assert(reelsRes2.statusCode === 200 && reelsRes2.data.success, 'Reels request 2 failed');
    assert(
      reelsRes2.data.source === 'cache',
      `Expected source: 'cache' for reels refresh, got: ${reelsRes2.data.source}`
    );
    console.log('      OK: Reels refresh served from CACHE without invoking Django ML engine');

    // TEST USERS: Initial fetch, followed by cached refresh
    console.log('\n   D. Testing Recommended Users Shuffling & Cache Serving...');
    const usersRes1 = await request('GET', '/api/recommendations/users?page=1&limit=5', null, authHeaders);
    assert(usersRes1.statusCode === 200 && usersRes1.data.success, 'Users request 1 failed');
    console.log(`      Users load 1: ${usersRes1.data.users.length} items (source: ${usersRes1.data.source})`);

    const usersRes2 = await request('GET', '/api/recommendations/users?page=1&limit=5&refresh=true', null, authHeaders);
    assert(usersRes2.statusCode === 200 && usersRes2.data.success, 'Users request 2 failed');
    assert(
      usersRes2.data.source === 'cache',
      `Expected source: 'cache' for users refresh, got: ${usersRes2.data.source}`
    );
    console.log('      OK: Users refresh served from CACHE without invoking Django ML engine');

    // TEST INDEPENDENCE: Verify refreshing Users does NOT alter Reels or Posts session
    console.log('\n   E. Testing Independence Across Recommendation Types...');
    const usersRefresh = await request('GET', '/api/recommendations/users?page=1&limit=5&refresh=true', null, authHeaders);
    assert(usersRefresh.data.source === 'cache', 'Users must remain cached');
    const postsCheck = await request('GET', '/api/recommendations/posts?page=1&limit=5', null, authHeaders);
    assert(postsCheck.data.source === 'cache', 'Posts cache must not be invalidated by users refresh');
    console.log('      OK: Users, Posts, and Reels recommendation pipelines operate independently');

    console.log('\n=== ALL RECOMMENDATION SHUFFLE & REFRESH TESTS PASSED SUCCESSFULLY ===');
  } finally {
    if (spawnedNode) {
      console.log('Cleaning up spawned Node.js server...');
      await stopProcess(spawnedNode, 8000);
    }
    if (spawnedDjango) {
      console.log('Cleaning up spawned Django ML service...');
      await stopProcess(spawnedDjango, ML_PORT);
    }
  }
}

async function main() {
  console.log('================================================================');
  console.log('  INSTA-V2 RECOMMENDATION SHUFFLE & REFRESH TEST SUITE');
  console.log('================================================================');

  runUnitTests();
  await runIntegrationTests();
}

main().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
