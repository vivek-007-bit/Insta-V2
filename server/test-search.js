// Comprehensive Search & Discovery backend integration tests
import './config/env.js';

const BASE_URL = 'http://localhost:8000';
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
const SAMPLE_IMAGE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/insta_v2/posts/test_sample.jpg`;
const SAMPLE_VIDEO_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/insta_v2/reels/test_sample.mp4`;
const SAMPLE_THUMB_URL = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/v1/insta_v2/reels/test_sample.jpg`;

async function request(method, path, body = null, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
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

async function runTests() {
  console.log('=== RUNNING SEARCH & DISCOVERY BACKEND TESTS ===');
  const ts = Date.now();

  // 0. Unauthenticated check
  console.log('\n0. Verifying auth protection on /api/search...');
  const unauth = await request('GET', '/api/search?q=maya');
  assert(unauth.statusCode === 401, `Expected 401 unauthenticated, got ${unauth.statusCode}`);
  console.log('   OK: Unauthenticated search returns 401');

  // 1. Register test users
  console.log('\n1. Registering public, private, and observer test accounts...');
  const pub1 = await request('POST', '/api/auth/signup', {
    fullName: `Search Alpha ${ts}`,
    username: `searchpub1_${ts}`,
    email: `searchpub1_${ts}@searchtest.com`,
    password: 'Password123!'
  });
  const priv = await request('POST', '/api/auth/signup', {
    fullName: `Search Private ${ts}`,
    username: `searchpriv_${ts}`,
    email: `searchpriv_${ts}@searchtest.com`,
    password: 'Password123!'
  });
  const obs = await request('POST', '/api/auth/signup', {
    fullName: `Search Observer ${ts}`,
    username: `searchobs_${ts}`,
    email: `searchobs_${ts}@searchtest.com`,
    password: 'Password123!'
  });
  assert(
    pub1.statusCode === 201 && priv.statusCode === 201 && obs.statusCode === 201,
    'Signup for test users failed'
  );

  const cookiePub1 = pub1.cookies.split(';')[0];
  const cookiePriv = priv.cookies.split(';')[0];
  const cookieObs = obs.cookies.split(';')[0];
  const idPub1 = pub1.data.user.id;
  const idPriv = priv.data.user.id;
  const idObs = obs.data.user.id;

  // Set priv account to private
  const privToggle = await request(
    'PATCH',
    '/api/users/me/privacy',
    { isPrivate: true },
    { Cookie: cookiePriv }
  );
  assert(privToggle.statusCode === 200 && privToggle.data.isPrivate === true, 'Failed to set private');

  // 2. Create public & private posts and reels with hashtags and locations
  console.log('\n2. Creating test posts and reels with hashtags & places...');
  const publicTag = `testtag${ts}`;
  const privateTag = `privtag${ts}`;
  const publicPlace = `YosemiteSearch_${ts}`;
  const privatePlace = `SecretVault_${ts}`;

  const pubPost = await request(
    'POST',
    '/api/media/posts',
    {
      mediaUrl: SAMPLE_IMAGE_URL,
      publicId: `insta_v2/posts/test_pub_${ts}`,
      mediaType: 'image',
      caption: `Golden sunrise over #${publicTag} canyon trails`,
      location: publicPlace
    },
    { Cookie: cookiePub1 }
  );
  assert(pubPost.statusCode === 201, `Public post failed: ${JSON.stringify(pubPost.data)}`);

  const pubReel = await request(
    'POST',
    '/api/reels',
    {
      videoUrl: SAMPLE_VIDEO_URL,
      publicId: `insta_v2/reels/test_pub_${ts}`,
      thumbnailUrl: SAMPLE_THUMB_URL,
      caption: `Cinematic reel for #${publicTag} creators`,
      audioTrack: `Original Audio - ${ts}`
    },
    { Cookie: cookiePub1 }
  );
  assert(pubReel.statusCode === 201, `Public reel failed: ${JSON.stringify(pubReel.data)}`);

  const privPost = await request(
    'POST',
    '/api/media/posts',
    {
      mediaUrl: SAMPLE_IMAGE_URL,
      publicId: `insta_v2/posts/test_priv_${ts}`,
      mediaType: 'image',
      caption: `Confidential alpine view #${privateTag} hidden note`,
      location: privatePlace
    },
    { Cookie: cookiePriv }
  );
  assert(privPost.statusCode === 201, `Private post failed: ${JSON.stringify(privPost.data)}`);

  const privReel = await request(
    'POST',
    '/api/reels',
    {
      videoUrl: SAMPLE_VIDEO_URL,
      publicId: `insta_v2/reels/test_priv_${ts}`,
      thumbnailUrl: SAMPLE_THUMB_URL,
      caption: `Locked private clip #${privateTag}`,
      audioTrack: 'Locked Audio'
    },
    { Cookie: cookiePriv }
  );
  assert(privReel.statusCode === 201, `Private reel failed: ${JSON.stringify(privReel.data)}`);

  // 3. Test username, fullName & regex-safe searching
  console.log('\n3. Testing account & regex-safe search...');
  const userSearch = await request(
    'GET',
    `/api/search/users?q=${encodeURIComponent(`Search Alpha ${ts}`)}`,
    null,
    { Cookie: cookieObs }
  );
  assert(userSearch.statusCode === 200, 'User search failed');
  assert(
    userSearch.data.users.some((u) => u.id === idPub1),
    'Expected pub1 in display name search results'
  );

  const regexBomb = await request(
    'GET',
    `/api/search?q=${encodeURIComponent('([a+b?*.\\')}`,
    null,
    { Cookie: cookieObs }
  );
  assert(regexBomb.statusCode === 200, `Regex metacharacters broke search: ${regexBomb.statusCode}`);
  console.log('   OK: Full name search & regex escaping work cleanly');

  // 4. Test hashtag, place, post caption & reel search + privacy filtering
  console.log('\n4. Testing hashtags, places, posts, reels & private content isolation...');
  const tagRes = await request(
    'GET',
    `/api/search/hashtags?q=${publicTag}`,
    null,
    { Cookie: cookieObs }
  );
  assert(tagRes.statusCode === 200, 'Hashtag search failed');
  const foundPublicTag = tagRes.data.hashtags.find((h) => h.tag === publicTag);
  assert(
    foundPublicTag && foundPublicTag.postsCount === 2,
    `Expected #${publicTag} count=2 (1 post + 1 reel), got ${JSON.stringify(tagRes.data.hashtags)}`
  );

  const placeRes = await request(
    'GET',
    `/api/search/places?q=${encodeURIComponent(publicPlace)}`,
    null,
    { Cookie: cookieObs }
  );
  assert(placeRes.statusCode === 200, 'Places search failed');
  assert(
    placeRes.data.places.some((p) => p.name === publicPlace && p.postsCount === 1),
    'Expected public place with postsCount=1'
  );

  // Private content MUST NOT leak to non-follower observer
  const privTagCheck = await request(
    'GET',
    `/api/search/hashtags?q=${privateTag}`,
    null,
    { Cookie: cookieObs }
  );
  assert(
    privTagCheck.statusCode === 200 && privTagCheck.data.hashtags.length === 0,
    'Private hashtag leaked to non-follower!'
  );

  const privPlaceCheck = await request(
    'GET',
    `/api/search/places?q=${encodeURIComponent(privatePlace)}`,
    null,
    { Cookie: cookieObs }
  );
  assert(
    privPlaceCheck.statusCode === 200 && privPlaceCheck.data.places.length === 0,
    'Private place leaked to non-follower!'
  );

  const privGlobalCheck = await request(
    'GET',
    `/api/search?q=${encodeURIComponent(privateTag)}`,
    null,
    { Cookie: cookieObs }
  );
  assert(
    privGlobalCheck.statusCode === 200 &&
      privGlobalCheck.data.posts.length === 0 &&
      privGlobalCheck.data.reels.length === 0,
    'Private post or reel leaked in global search to non-follower!'
  );
  console.log('   OK: Private posts, reels, hashtags, and places strictly hidden from non-followers');

  // 5. Follow private user -> approve -> verify private content now visible
  console.log('\n5. Testing private content visibility after accepted follow...');
  const followReqRes = await request(
    'POST',
    `/api/users/${idPriv}/follow`,
    {},
    { Cookie: cookieObs }
  );
  assert(
    (followReqRes.statusCode === 200 || followReqRes.statusCode === 201) &&
      (followReqRes.data.isPending === true || followReqRes.data.status === 'pending' || Boolean(followReqRes.data.requestId)),
    `Expected pending follow request, got ${followReqRes.statusCode}: ${JSON.stringify(followReqRes.data)}`
  );
  const reqId = followReqRes.data.requestId;
  const acceptRes = await request(
    'POST',
    `/api/follow-requests/${reqId}/accept`,
    {},
    { Cookie: cookiePriv }
  );
  assert(acceptRes.statusCode === 200, `Accept follow request failed: ${JSON.stringify(acceptRes.data)}`);

  const privGlobalAllowed = await request(
    'GET',
    `/api/search?q=${encodeURIComponent(privateTag)}`,
    null,
    { Cookie: cookieObs }
  );
  assert(
    privGlobalAllowed.data.posts.length === 1 && privGlobalAllowed.data.reels.length === 1,
    'Approved follower should see private posts & reels in search'
  );
  console.log('   OK: Approved follower sees private posts & reels');

  // 6. Test suggestions (excludes self)
  console.log('\n6. Testing personalized search suggestions...');
  const sugRes = await request('GET', '/api/search/suggestions?limit=10', null, { Cookie: cookieObs });
  assert(sugRes.statusCode === 200 && Array.isArray(sugRes.data.users), 'Suggestions failed');
  assert(!sugRes.data.users.some((u) => u.id === idObs), 'Suggestions must exclude current user');
  assert(
    sugRes.data.users.every((u) => typeof u.subtitle === 'string' && u.subtitle.length > 0),
    'Every suggestion should include subtitle context'
  );
  console.log(`   OK: Suggestions returned ${sugRes.data.users.length} users excluding self`);

  // 7. Test Recent Searches persistence, deduplication, 20-item cap, and cross-user isolation
  console.log('\n7. Testing recent searches CRUD, deduplication, cap=20, and cross-user isolation...');
  const addUser1 = await request(
    'POST',
    '/api/search/recent',
    { type: 'user', targetUserId: idPub1 },
    { Cookie: cookieObs }
  );
  assert(
    (addUser1.statusCode === 200 || addUser1.statusCode === 201) && addUser1.data.item?.targetUser?.id === idPub1,
    `Add recent user failed: ${addUser1.statusCode} ${JSON.stringify(addUser1.data)}`
  );

  // Add duplicate user -> should remain 1 entry
  await request('POST', '/api/search/recent', { type: 'user', targetUserId: idPub1 }, { Cookie: cookieObs });
  await request('POST', '/api/search/recent', { type: 'hashtag', hashtag: `#${publicTag}` }, { Cookie: cookieObs });
  await request('POST', '/api/search/recent', { type: 'place', location: publicPlace }, { Cookie: cookieObs });

  const recentAfter4 = await request('GET', '/api/search/recent', null, { Cookie: cookieObs });
  assert(recentAfter4.statusCode === 200, 'Get recent failed');
  assert(recentAfter4.data.recent.length === 3, `Expected 3 deduplicated recent items, got ${recentAfter4.data.recent.length}`);

  // Cross-user delete must fail (404)
  const sampleId = recentAfter4.data.recent[0].id;
  const crossDelete = await request('DELETE', `/api/search/recent/${sampleId}`, null, { Cookie: cookiePub1 });
  assert(crossDelete.statusCode === 404, `Cross-user delete should return 404, got ${crossDelete.statusCode}`);

  // Test 20-item cap
  for (let i = 0; i < 22; i += 1) {
    await request('POST', '/api/search/recent', { type: 'query', query: `capquery_${i}_${ts}` }, { Cookie: cookieObs });
  }
  const cappedRecent = await request('GET', '/api/search/recent', null, { Cookie: cookieObs });
  assert(cappedRecent.data.recent.length === 20, `Expected max 20 recent items, got ${cappedRecent.data.recent.length}`);

  // Single item delete
  const delOneId = cappedRecent.data.recent[0].id;
  const delOne = await request('DELETE', `/api/search/recent/${delOneId}`, null, { Cookie: cookieObs });
  assert(delOne.statusCode === 200, 'Delete single recent failed');
  const afterDelOne = await request('GET', '/api/search/recent', null, { Cookie: cookieObs });
  assert(afterDelOne.data.recent.length === 19, 'Expected 19 items after single delete');

  // Clear all
  const clearAll = await request('DELETE', '/api/search/recent', null, { Cookie: cookieObs });
  assert(clearAll.statusCode === 200, 'Clear all recent failed');
  const afterClearAll = await request('GET', '/api/search/recent', null, { Cookie: cookieObs });
  assert(afterClearAll.data.recent.length === 0, 'Expected 0 items after clear all');
  console.log('   OK: Recent searches deduplication, cap=20, isolation & clear-all verified');

  console.log('\n=== ALL SEARCH & DISCOVERY TESTS PASSED SUCCESSFULLY ===');
}

runTests().catch((err) => {
  console.error('\nTEST FAILURE:', err.message);
  process.exit(1);
});
