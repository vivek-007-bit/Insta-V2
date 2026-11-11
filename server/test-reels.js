// Reels Backend Integration Test Suite
import http from 'http';

const BASE_URL = 'http://localhost:8000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createTestUser(prefix, isPrivate = false) {
  const ts = Date.now() + Math.floor(Math.random() * 10000);
  const payload = {
    fullName: `${prefix} Creator`,
    username: `${prefix.toLowerCase()}_${ts}`,
    email: `${prefix.toLowerCase()}_${ts}@reelstest.com`,
    password: 'password123'
  };

  const res = await request('POST', '/api/auth/signup', payload);
  if (res.statusCode !== 201) {
    throw new Error(`Signup failed for ${prefix}: ${JSON.stringify(res.data)}`);
  }

  const cookie = res.headers['set-cookie'][0].split(';')[0];
  const user = res.data.user;

  if (isPrivate) {
    await request('PATCH', '/api/users/me/privacy', { isPrivate: true }, { Cookie: cookie });
    user.isPrivate = true;
  }

  return { user, cookie };
}

async function runReelsTests() {
  console.log('=== RUNNING REELS BACKEND INTEGRATION TESTS ===\n');

  // Setup: Public User A, Private User B, Observer User C (follows B)
  console.log('1. Creating test users...');
  const userA = await createTestUser('ReelPub', false);
  const userB = await createTestUser('ReelPriv', true);
  const userC = await createTestUser('ReelObs', false);

  // C requests to follow Private B, B accepts
  const reqRes = await request('POST', `/api/users/${userB.user.id}/follow`, {}, { Cookie: userC.cookie });
  await request('POST', `/api/follow-requests/${reqRes.data.requestId}/accept`, {}, { Cookie: userB.cookie });
  console.log(`Setup complete: Public @${userA.user.username}, Private @${userB.user.username}, Follower @${userC.user.username}`);

  // 2. Upload Signature
  console.log('\n2. Testing POST /api/reels/upload-signature...');
  const sigRes = await request('POST', '/api/reels/upload-signature', {}, { Cookie: userA.cookie });
  console.log('Status:', sigRes.statusCode, 'ResourceType:', sigRes.data.resourceType, 'Folder:', sigRes.data.folder);
  if (sigRes.statusCode !== 200 || !sigRes.data.signature || sigRes.data.resourceType !== 'video') {
    throw new Error('Reel upload signature failed');
  }

  // 3. Invalid URL validation
  console.log('\n3. Testing invalid video URL rejection...');
  const badReelRes = await request('POST', '/api/reels', {
    videoUrl: 'https://evil.example.com/video.mp4',
    publicId: 'fake_id',
    caption: 'Bad URL'
  }, { Cookie: userA.cookie });
  console.log('Status:', badReelRes.statusCode, 'Message:', badReelRes.data.message);
  if (badReelRes.statusCode !== 400) {
    throw new Error('Invalid Cloudinary video URL was not rejected');
  }

  // 4. Create Public Reel (User A) and Private Reel (User B)
  console.log('\n4. Creating Public Reel (User A) and Private Reel (User B)...');
  const createARes = await request('POST', '/api/reels', {
    videoUrl: 'https://res.cloudinary.com/dbybguptm/video/upload/v123456/insta_v2/reels/pub_sample.mp4',
    publicId: 'insta_v2/reels/pub_sample',
    caption: 'Public sunset timelapse #nature',
    duration: 14.5,
    aspectRatio: '9:16',
    audioTrack: 'Chill Waves'
  }, { Cookie: userA.cookie });
  if (createARes.statusCode !== 201) throw new Error(`Create public reel failed: ${JSON.stringify(createARes.data)}`);
  const pubReelId = createARes.data.reel.id;
  console.log('Public Reel ID:', pubReelId, 'Thumbnail:', createARes.data.reel.thumbnailUrl);

  const createBRes = await request('POST', '/api/reels', {
    videoUrl: 'https://res.cloudinary.com/dbybguptm/video/upload/v123456/insta_v2/reels/priv_sample.mp4',
    publicId: 'insta_v2/reels/priv_sample',
    caption: 'Private behind the scenes',
    duration: 9.2,
    aspectRatio: '9:16'
  }, { Cookie: userB.cookie });
  if (createBRes.statusCode !== 201) throw new Error('Create private reel failed');
  const privReelId = createBRes.data.reel.id;
  console.log('Private Reel ID:', privReelId);

  // 5. Privacy Enforcement on Feed & Direct Access
  console.log('\n5. Testing Privacy Enforcement on GET /api/reels and GET /api/reels/:reelId...');
  const feedARes = await request('GET', '/api/reels?page=1&limit=20', null, { Cookie: userA.cookie });
  const aSeesPriv = feedARes.data.reels.some((r) => r.id === privReelId);
  console.log('Non-follower A sees Private Reel in feed?', aSeesPriv);
  if (aSeesPriv) throw new Error('Private reel leaked into non-follower feed!');

  const feedCRes = await request('GET', '/api/reels?page=1&limit=20', null, { Cookie: userC.cookie });
  const cSeesPriv = feedCRes.data.reels.some((r) => r.id === privReelId);
  console.log('Approved follower C sees Private Reel in feed?', cSeesPriv);
  if (!cSeesPriv) throw new Error('Approved follower did not see private reel in feed!');

  const directPrivByA = await request('GET', `/api/reels/${privReelId}`, null, { Cookie: userA.cookie });
  console.log('Non-follower direct access Status:', directPrivByA.statusCode);
  if (directPrivByA.statusCode !== 403 || directPrivByA.data.reel?.videoUrl) {
    throw new Error('Private reel was directly accessible to non-follower!');
  }

  const directPrivByC = await request('GET', `/api/reels/${privReelId}`, null, { Cookie: userC.cookie });
  console.log('Approved follower direct access Status:', directPrivByC.statusCode);
  if (directPrivByC.statusCode !== 200) {
    throw new Error('Approved follower could not view private reel directly');
  }

  // 6. Pagination test
  console.log('\n6. Testing Pagination (limit=1)...');
  const page1 = await request('GET', '/api/reels?page=1&limit=1', null, { Cookie: userC.cookie });
  console.log('Page 1 count:', page1.data.reels.length, 'hasMore:', page1.data.hasMore);
  if (page1.data.reels.length !== 1 || !page1.data.hasMore) {
    throw new Error('Reels pagination failed');
  }

  // 7. Likes & Duplicate prevention
  console.log('\n7. Testing Reel Likes & Unlikes...');
  const unauthLike = await request('POST', `/api/reels/${privReelId}/like`, {}, { Cookie: userA.cookie });
  if (unauthLike.statusCode !== 403) throw new Error('Non-follower allowed to like private reel');

  const likeRes = await request('POST', `/api/reels/${privReelId}/like`, {}, { Cookie: userC.cookie });
  console.log('Like Status:', likeRes.statusCode, 'Count:', likeRes.data.likesCount);
  if (likeRes.statusCode !== 201 || likeRes.data.likesCount !== 1) throw new Error('Like reel failed');

  const dupLike = await request('POST', `/api/reels/${privReelId}/like`, {}, { Cookie: userC.cookie });
  if (dupLike.statusCode !== 400) throw new Error('Duplicate reel like was not rejected');

  const unlikeRes = await request('DELETE', `/api/reels/${privReelId}/like`, null, { Cookie: userC.cookie });
  console.log('Unlike Status:', unlikeRes.statusCode, 'Count:', unlikeRes.data.likesCount);
  if (unlikeRes.statusCode !== 200 || unlikeRes.data.likesCount !== 0) throw new Error('Unlike reel failed');

  // 8. Comments & Deletion permissions
  console.log('\n8. Testing Reel Comments...');
  const unauthComm = await request('POST', `/api/reels/${privReelId}/comments`, { text: 'Hi' }, { Cookie: userA.cookie });
  if (unauthComm.statusCode !== 403) throw new Error('Non-follower allowed to comment on private reel');

  const emptyComm = await request('POST', `/api/reels/${privReelId}/comments`, { text: '   ' }, { Cookie: userC.cookie });
  if (emptyComm.statusCode !== 400) throw new Error('Empty reel comment was not rejected');

  const commRes = await request('POST', `/api/reels/${privReelId}/comments`, { text: 'Amazing reel!' }, { Cookie: userC.cookie });
  const commId = commRes.data.comment.id;
  console.log('Added Comment ID:', commId);

  const getCommsRes = await request('GET', `/api/reels/${privReelId}/comments`, null, { Cookie: userC.cookie });
  if (getCommsRes.data.comments.length !== 1) throw new Error('Fetch reel comments failed');

  // Non-owner A cannot delete C's comment
  const unauthDel = await request('DELETE', `/api/reels/comments/${commId}`, null, { Cookie: userA.cookie });
  if (unauthDel.statusCode !== 403) throw new Error('Unauthorized comment deletion was not blocked');

  // Reel owner B CAN delete C's comment
  const ownerDel = await request('DELETE', `/api/reels/comments/${commId}`, null, { Cookie: userB.cookie });
  console.log('Reel owner delete comment Status:', ownerDel.statusCode);
  if (ownerDel.statusCode !== 200) throw new Error('Reel owner could not delete comment');

  // 9. Share endpoint & privacy
  console.log('\n9. Testing Reel Sharing...');
  const privShareByA = await request('GET', `/api/reels/${privReelId}/share`, null, { Cookie: userA.cookie });
  if (privShareByA.statusCode !== 403 || privShareByA.data.canView) {
    throw new Error('Private reel share leaked to non-follower');
  }

  const pubShare = await request('GET', `/api/reels/${pubReelId}/share`, null, { Cookie: userC.cookie });
  console.log('Public share URL:', pubShare.data.shareUrl);
  if (pubShare.statusCode !== 200 || !pubShare.data.shareUrl.includes(pubReelId)) {
    throw new Error('Public reel share failed');
  }

  // 10. Reel Deletion & Ownership enforcement
  console.log('\n10. Testing Reel Deletion...');
  const unauthDelReel = await request('DELETE', `/api/reels/${pubReelId}`, null, { Cookie: userC.cookie });
  console.log('Non-owner delete attempt Status:', unauthDelReel.statusCode);
  if (unauthDelReel.statusCode !== 403) throw new Error('Non-owner allowed to delete reel!');

  const ownerDelReel = await request('DELETE', `/api/reels/${pubReelId}`, null, { Cookie: userA.cookie });
  console.log('Owner delete reel Status:', ownerDelReel.statusCode, 'Message:', ownerDelReel.data.message);
  if (ownerDelReel.statusCode !== 200) throw new Error('Owner failed to delete reel');

  const afterDelGet = await request('GET', `/api/reels/${pubReelId}`, null, { Cookie: userA.cookie });
  if (afterDelGet.statusCode !== 404) throw new Error('Deleted reel still exists in DB!');

  // Clean up remaining test reel B
  await request('DELETE', `/api/reels/${privReelId}`, null, { Cookie: userB.cookie });

  console.log('\n=== ALL 10 REELS BACKEND TESTS PASSED SUCCESSFULLY! ===');
}

runReelsTests().catch((err) => {
  console.error('\n❌ Reels test failed:', err.message);
  process.exit(1);
});
