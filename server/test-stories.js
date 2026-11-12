// Integration tests for Insta-V2 Stories backend APIs
import './config/env.js';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import Story from './models/Story.js';

const BASE_URL = 'http://localhost:8000';

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
  console.log('=== RUNNING STORIES BACKEND INTEGRATION TESTS ===');
  const ts = Date.now();

  // 1. Register Public Owner (A), Private Owner (B), and Follower/Observer (C)
  console.log('\n1. Creating test users...');
  const userA = await request('POST', '/api/auth/signup', {
    fullName: 'Story Pub Owner',
    username: `storypub_${ts}`,
    email: `storypub_${ts}@storiestest.com`,
    password: 'Password123!'
  });
  const userB = await request('POST', '/api/auth/signup', {
    fullName: 'Story Priv Owner',
    username: `storypriv_${ts}`,
    email: `storypriv_${ts}@storiestest.com`,
    password: 'Password123!'
  });
  const userC = await request('POST', '/api/auth/signup', {
    fullName: 'Story Observer',
    username: `storyobs_${ts}`,
    email: `storyobs_${ts}@storiestest.com`,
    password: 'Password123!'
  });

  assert(userA.statusCode === 201 && userB.statusCode === 201 && userC.statusCode === 201, 'Test signup failed');
  const cookieA = userA.cookies.split(';')[0];
  const cookieB = userB.cookies.split(';')[0];
  const cookieC = userC.cookies.split(';')[0];
  const idA = userA.data.user.id;
  const idB = userB.data.user.id;
  const idC = userC.data.user.id;

  // Set B to private
  const privRes = await request('PATCH', '/api/users/me/privacy', { isPrivate: true }, { Cookie: cookieB });
  assert(privRes.statusCode === 200, 'Set private failed');
  console.log(`Setup OK: Public ${userA.data.user.username}, Private ${userB.data.user.username}, Observer ${userC.data.user.username}`);

  // 2. Test upload signature & validation
  console.log('\n2. Testing POST /api/stories/upload-signature & validation...');
  const sigImgRes = await request(
    'POST',
    '/api/stories/upload-signature',
    { resourceType: 'image', fileSize: 1024 * 500, mimeType: 'image/jpeg' },
    { Cookie: cookieA }
  );
  assert(sigImgRes.statusCode === 200 && Boolean(sigImgRes.data.signature) && sigImgRes.data.folder === 'insta_v2/stories', 'Valid story signature failed');

  const badTypeRes = await request(
    'POST',
    '/api/stories/upload-signature',
    { resourceType: 'image', fileSize: 1024, mimeType: 'application/pdf' },
    { Cookie: cookieA }
  );
  assert(badTypeRes.statusCode === 400, 'Invalid MIME type must be rejected');

  const tooLargeRes = await request(
    'POST',
    '/api/stories/upload-signature',
    { resourceType: 'image', fileSize: 20 * 1024 * 1024, mimeType: 'image/png' },
    { Cookie: cookieA }
  );
  assert(tooLargeRes.statusCode === 400, 'Oversized image (>15MB) must be rejected');
  console.log('Signature + file validation passed.');

  // 3. Test Story creation (image + video + bad URL rejection)
  console.log('\n3. Creating stories & testing URL validation...');
  const cloudName = sigImgRes.data.cloudName;
  const badUrlRes = await request(
    'POST',
    '/api/stories',
    { mediaUrl: 'https://evil.example/fake.jpg', publicId: 'fake', mediaType: 'image' },
    { Cookie: cookieA }
  );
  assert(badUrlRes.statusCode === 400, 'Non-Cloudinary URL must be rejected');

  const storyARes = await request(
    'POST',
    '/api/stories',
    {
      mediaUrl: `https://res.cloudinary.com/${cloudName}/image/upload/v12345/insta_v2/stories/pub.jpg`,
      publicId: 'insta_v2/stories/pub',
      mediaType: 'image',
      caption: 'Public image story #test'
    },
    { Cookie: cookieA }
  );
  const storyBRes = await request(
    'POST',
    '/api/stories',
    {
      mediaUrl: `https://res.cloudinary.com/${cloudName}/video/upload/v12345/insta_v2/stories/priv.mp4`,
      publicId: 'insta_v2/stories/priv',
      mediaType: 'video',
      caption: 'Private video story'
    },
    { Cookie: cookieB }
  );
  assert(storyARes.statusCode === 201 && storyBRes.statusCode === 201, 'Story creation failed');
  const storyAId = storyARes.data.story.id;
  const storyBId = storyBRes.data.story.id;
  console.log('Created story A (image):', storyAId, 'and story B (video):', storyBId);

  // 4. Test Privacy enforcement before follow
  console.log('\n4. Testing private story access restrictions...');
  const privDeniedGet = await request('GET', `/api/stories/${storyBId}`, null, { Cookie: cookieC });
  assert(privDeniedGet.statusCode === 403, 'Non-follower GET private story must return 403');

  const privDeniedView = await request('POST', `/api/stories/${storyBId}/view`, {}, { Cookie: cookieC });
  assert(privDeniedView.statusCode === 403, 'Non-follower POST view on private story must return 403');

  // Observer C follows A (public) and requests B (private)
  await request('POST', `/api/users/${idA}/follow`, {}, { Cookie: cookieC });
  const reqB = await request('POST', `/api/users/${idB}/follow`, {}, { Cookie: cookieC });
  assert(reqB.data.isPending === true, 'Follow to private B should be pending');

  // Before B accepts, C's stories feed includes A but NOT B
  const feedBeforeAccept = await request('GET', '/api/stories/feed', null, { Cookie: cookieC });
  assert(feedBeforeAccept.statusCode === 200, 'Feed failed');
  const ownersBefore = feedBeforeAccept.data.storyGroups.map((g) => g.userId);
  assert(ownersBefore.includes(idA) && !ownersBefore.includes(idB), 'Feed must exclude unaccepted private account B');

  // B accepts C
  await request('POST', `/api/follow-requests/${reqB.data.requestId}/accept`, {}, { Cookie: cookieB });
  const feedAfterAccept = await request('GET', '/api/stories/feed', null, { Cookie: cookieC });
  const ownersAfter = feedAfterAccept.data.storyGroups.map((g) => g.userId);
  assert(ownersAfter.includes(idB), 'Feed must include private account B after acceptance');
  console.log('Privacy enforcement verified (403 before accept, visible after accept).');

  // 5. Test duplicate-free view recording & ring state (hasUnseen -> false)
  console.log('\n5. Testing view recording & ring state updates...');
  const groupABefore = feedAfterAccept.data.storyGroups.find((g) => g.userId === idA);
  assert(groupABefore && groupABefore.hasUnseen === true, 'Story A should initially be unseen for C');

  await request('POST', `/api/stories/${storyAId}/view`, {}, { Cookie: cookieC });
  await request('POST', `/api/stories/${storyAId}/view`, {}, { Cookie: cookieC }); // duplicate attempt

  const feedAfterView = await request('GET', '/api/stories/feed', null, { Cookie: cookieC });
  const groupAAfter = feedAfterView.data.storyGroups.find((g) => g.userId === idA);
  assert(groupAAfter && groupAAfter.hasUnseen === false, 'Story A should become seen (hasUnseen=false) after view');

  // Owner checks viewers -> must show C exactly once
  const viewersRes = await request('GET', `/api/stories/${storyAId}/viewers`, null, { Cookie: cookieA });
  assert(viewersRes.statusCode === 200 && viewersRes.data.viewersCount === 1 && viewersRes.data.viewers[0].id === idC, 'Owner viewers list failed or duplicated');

  // Non-owner cannot inspect viewers
  const nonOwnerViewers = await request('GET', `/api/stories/${storyAId}/viewers`, null, { Cookie: cookieC });
  assert(nonOwnerViewers.statusCode === 403, 'Non-owner must get 403 on /viewers');
  console.log('View deduplication, ring state, and viewers privacy verified.');

  // 6. Test 24h expiration query filtering
  console.log('\n6. Testing expired story exclusion...');
  await connectDB();
  await Story.updateOne({ _id: storyBId }, { $set: { expiresAt: new Date(Date.now() - 60000) } });
  const expiredGet = await request('GET', `/api/stories/${storyBId}`, null, { Cookie: cookieC });
  assert(expiredGet.statusCode === 404, 'Expired story must return 404');
  const feedAfterExpire = await request('GET', '/api/stories/feed', null, { Cookie: cookieC });
  assert(!feedAfterExpire.data.storyGroups.some((g) => g.userId === idB), 'Expired story must be filtered from feed');
  await mongoose.disconnect();
  console.log('Expired story filtering verified (404 + omitted from feed).');

  // 7. Test owner delete & non-owner protection
  console.log('\n7. Testing story deletion & ownership checks...');
  const nonOwnerDel = await request('DELETE', `/api/stories/${storyAId}`, null, { Cookie: cookieC });
  assert(nonOwnerDel.statusCode === 403, 'Non-owner delete must return 403');

  const ownerDel = await request('DELETE', `/api/stories/${storyAId}`, null, { Cookie: cookieA });
  assert(ownerDel.statusCode === 200, 'Owner delete failed');

  const deletedGet = await request('GET', `/api/stories/${storyAId}`, null, { Cookie: cookieA });
  assert(deletedGet.statusCode === 404, 'Deleted story must return 404');
  console.log('Story deletion verified.');

  console.log('\n=== ALL STORIES BACKEND INTEGRATION TESTS PASSED! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Stories test error:', err);
  process.exit(1);
});
