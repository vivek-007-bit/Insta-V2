// Comprehensive Social Networking Features Integration Test
import http from 'http';

const BASE_URL = 'http://localhost:8000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
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

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Helper to signup and get user info + cookie
async function createTestAccount(prefix, isPrivate = false) {
  const ts = Date.now() + Math.floor(Math.random() * 10000);
  const userPayload = {
    fullName: `${prefix} User`,
    username: `${prefix.toLowerCase()}_${ts}`,
    email: `${prefix.toLowerCase()}_${ts}@socialtest.com`,
    password: 'password123'
  };

  const res = await request('POST', '/api/auth/signup', userPayload);
  if (res.statusCode !== 201) {
    throw new Error(`Failed to create test user ${prefix}: ${JSON.stringify(res.data)}`);
  }

  const cookie = res.headers['set-cookie'][0].split(';')[0];
  const user = res.data.user;

  if (isPrivate) {
    const privRes = await request('PATCH', '/api/users/me/privacy', { isPrivate: true }, { Cookie: cookie });
    if (privRes.statusCode !== 200) {
      throw new Error(`Failed to set private for ${prefix}`);
    }
    user.isPrivate = true;
  }

  return { user, cookie };
}

async function runSocialTests() {
  console.log('=== RUNNING SOCIAL FEATURES TEST SUITE ===\n');

  // Create test users: User A (Public), User B (Private), User C (Observer)
  console.log('1. Setting up Test Users (Public User A, Private User B, Observer User C)...');
  const userA = await createTestAccount('UserA', false);
  const userB = await createTestAccount('UserB', true);
  const userC = await createTestAccount('UserC', false);
  console.log(`Created:`);
  console.log(`- User A: @${userA.user.username} (Public)`);
  console.log(`- User B: @${userB.user.username} (Private)`);
  console.log(`- User C: @${userC.user.username} (Public Observer)`);

  // 2. Test Following Public User A
  console.log('\n2. Testing Follow Public Account (User C -> User A)...');
  const followARes = await request('POST', `/api/users/${userA.user.id}/follow`, {}, { Cookie: userC.cookie });
  console.log('Status:', followARes.statusCode, 'Data:', followARes.data);
  if (followARes.statusCode !== 201 || !followARes.data.isFollowing) {
    throw new Error('Following public account failed');
  }

  // 3. Test Duplicate Follow Prevention
  console.log('\n3. Testing Duplicate Follow Prevention...');
  const dupFollowRes = await request('POST', `/api/users/${userA.user.id}/follow`, {}, { Cookie: userC.cookie });
  console.log('Status:', dupFollowRes.statusCode, 'Message:', dupFollowRes.data.message);
  if (dupFollowRes.statusCode !== 400) {
    throw new Error('Duplicate follow was not rejected!');
  }

  // 4. Test Self-Follow Prevention
  console.log('\n4. Testing Self-Follow Prevention...');
  const selfFollowRes = await request('POST', `/api/users/${userC.user.id}/follow`, {}, { Cookie: userC.cookie });
  console.log('Status:', selfFollowRes.statusCode, 'Message:', selfFollowRes.data.message);
  if (selfFollowRes.statusCode !== 400) {
    throw new Error('Self follow was not rejected!');
  }

  // 5. Test Followers & Following Lists
  console.log('\n5. Testing Followers & Following Lists for User A...');
  const aFollowersRes = await request('GET', `/api/users/${userA.user.id}/followers`, null, { Cookie: userC.cookie });
  console.log('User A Followers count:', aFollowersRes.data.followers?.length);
  if (aFollowersRes.statusCode !== 200 || aFollowersRes.data.followers.length !== 1) {
    throw new Error('Followers list failed');
  }

  const cFollowingRes = await request('GET', `/api/users/${userC.user.id}/following`, null, { Cookie: userC.cookie });
  console.log('User C Following count:', cFollowingRes.data.following?.length);
  if (cFollowingRes.statusCode !== 200 || cFollowingRes.data.following.length !== 1) {
    throw new Error('Following list failed');
  }

  // 6. Test Unfollow Public Account
  console.log('\n6. Testing Unfollow (User C -> User A)...');
  const unfollowRes = await request('DELETE', `/api/users/${userA.user.id}/follow`, null, { Cookie: userC.cookie });
  console.log('Status:', unfollowRes.statusCode, 'Message:', unfollowRes.data.message);
  if (unfollowRes.statusCode !== 200 || unfollowRes.data.isFollowing !== false) {
    throw new Error('Unfollow failed');
  }

  // Follow back User A so C follows A
  await request('POST', `/api/users/${userA.user.id}/follow`, {}, { Cookie: userC.cookie });

  // 7. Test Follow Request to Private Account (User C -> User B)
  console.log('\n7. Testing Follow Request to Private Account (User C -> User B)...');
  const followBRes = await request('POST', `/api/users/${userB.user.id}/follow`, {}, { Cookie: userC.cookie });
  console.log('Status:', followBRes.statusCode, 'Status Field:', followBRes.data.status, 'isPending:', followBRes.data.isPending);
  if (followBRes.statusCode !== 201 || !followBRes.data.isPending || followBRes.data.isFollowing) {
    throw new Error('Private follow request failed');
  }
  const requestId = followBRes.data.requestId;

  // 8. Test Cancel Outgoing Request
  console.log('\n8. Testing Cancel Outgoing Follow Request...');
  const cancelRes = await request('DELETE', `/api/follow-requests/${requestId}`, null, { Cookie: userC.cookie });
  console.log('Status:', cancelRes.statusCode, 'Message:', cancelRes.data.message);
  if (cancelRes.statusCode !== 200) {
    throw new Error('Cancel request failed');
  }

  // Re-request User B
  const reReqRes = await request('POST', `/api/users/${userB.user.id}/follow`, {}, { Cookie: userC.cookie });
  const newReqId = reReqRes.data.requestId;

  // 9. Test View Incoming Requests for User B
  console.log('\n9. Testing Incoming Follow Requests List for User B...');
  const inReqRes = await request('GET', '/api/follow-requests', null, { Cookie: userB.cookie });
  console.log('Status:', inReqRes.statusCode, 'Incoming requests count:', inReqRes.data.requests?.length);
  if (inReqRes.statusCode !== 200 || inReqRes.data.requests.length !== 1) {
    throw new Error('Incoming requests fetch failed');
  }

  // 10. Test Accept Follow Request (User B accepts User C)
  console.log('\n10. Testing Accept Follow Request (User B accepts User C)...');
  const acceptRes = await request('POST', `/api/follow-requests/${newReqId}/accept`, {}, { Cookie: userB.cookie });
  console.log('Status:', acceptRes.statusCode, 'Message:', acceptRes.data.message);
  if (acceptRes.statusCode !== 200) {
    throw new Error('Accept request failed');
  }

  // Verify User C is now an approved follower of User B
  const statusAfterAccept = await request('GET', `/api/users/${userB.user.id}/follow-status`, null, { Cookie: userC.cookie });
  console.log('User C status with User B:', statusAfterAccept.data);
  if (!statusAfterAccept.data.isFollowing) {
    throw new Error('User C was not established as follower after accept');
  }

  // 11. Test Reject Follow Request with another user (User A requests User B, User B rejects)
  console.log('\n11. Testing Reject Follow Request...');
  const aReqBRes = await request('POST', `/api/users/${userB.user.id}/follow`, {}, { Cookie: userA.cookie });
  const aReqId = aReqBRes.data.requestId;
  const rejectRes = await request('POST', `/api/follow-requests/${aReqId}/reject`, {}, { Cookie: userB.cookie });
  console.log('Status:', rejectRes.statusCode, 'Message:', rejectRes.data.message);
  if (rejectRes.statusCode !== 200) {
    throw new Error('Reject request failed');
  }
  const statusAfterReject = await request('GET', `/api/users/${userB.user.id}/follow-status`, null, { Cookie: userA.cookie });
  if (statusAfterReject.data.isFollowing || statusAfterReject.data.isPending) {
    throw new Error('Follow relationship was incorrectly created or pending after rejection');
  }

  // 12. Post Creation and Privacy Restrictions
  console.log('\n12. Testing Post Creation & Privacy Enforcement...');
  // User B (Private) creates a post
  const postBRes = await request('POST', '/api/media/posts', {
    mediaUrl: 'https://res.cloudinary.com/dbybguptm/image/upload/v12345/insta_v2/posts/private_post.jpg',
    publicId: 'insta_v2/posts/private_post',
    mediaType: 'image',
    caption: 'Secret private post by User B #private',
    location: 'Encrypted Lair',
    mediaAspect: 'square'
  }, { Cookie: userB.cookie });
  const postBId = postBRes.data.post.id;
  console.log('Created Private Post ID:', postBId);

  // User A (Non-follower of Private B) attempts to get post -> MUST FAIL WITH 403
  console.log('\nChecking Non-Follower Access to Private Post (User A -> Post B)...');
  const unauthPostRes = await request('GET', `/api/posts/${postBId}`, null, { Cookie: userA.cookie });
  console.log('Status:', unauthPostRes.statusCode, 'Message:', unauthPostRes.data.message);
  if (unauthPostRes.statusCode !== 403) {
    throw new Error('Private post was accessible to non-follower!');
  }

  // User C (Approved Follower of Private B) attempts to get post -> MUST SUCCEED (200)
  console.log('Checking Approved Follower Access to Private Post (User C -> Post B)...');
  const authPostRes = await request('GET', `/api/posts/${postBId}`, null, { Cookie: userC.cookie });
  console.log('Status:', authPostRes.statusCode, 'Caption:', authPostRes.data.post?.caption);
  if (authPostRes.statusCode !== 200) {
    throw new Error('Approved follower could not access private post');
  }

  // Non-follower User A attempts to view Private User B posts list -> MUST FAIL (403)
  console.log('Checking Non-Follower Access to Private User Posts List...');
  const userBPostsRes = await request('GET', `/api/users/${userB.user.id}/posts`, null, { Cookie: userA.cookie });
  console.log('Status:', userBPostsRes.statusCode, 'Message:', userBPostsRes.data.message);
  if (userBPostsRes.statusCode !== 403) {
    throw new Error('Private user posts list was accessible to non-follower!');
  }

  // 13. Test Likes
  console.log('\n13. Testing Like and Unlike System...');
  // Non-follower User A attempts to like Private Post B -> MUST FAIL (403)
  const unauthLikeRes = await request('POST', `/api/posts/${postBId}/like`, {}, { Cookie: userA.cookie });
  console.log('Non-follower like attempt Status:', unauthLikeRes.statusCode);
  if (unauthLikeRes.statusCode !== 403) {
    throw new Error('Non-follower was allowed to like private post!');
  }

  // Follower User C likes Private Post B -> SUCCEEDS (201)
  const likeRes = await request('POST', `/api/posts/${postBId}/like`, {}, { Cookie: userC.cookie });
  console.log('Follower like Status:', likeRes.statusCode, 'Liked:', likeRes.data.liked, 'Count:', likeRes.data.likesCount);
  if (likeRes.statusCode !== 201 || likeRes.data.likesCount !== 1) {
    throw new Error('Like post failed');
  }

  // Duplicate like -> MUST BE REJECTED (400)
  const dupLikeRes = await request('POST', `/api/posts/${postBId}/like`, {}, { Cookie: userC.cookie });
  console.log('Duplicate like Status:', dupLikeRes.statusCode, 'Message:', dupLikeRes.data.message);
  if (dupLikeRes.statusCode !== 400) {
    throw new Error('Duplicate like was not rejected');
  }

  // Unlike post -> SUCCEEDS (200)
  const unlikeRes = await request('DELETE', `/api/posts/${postBId}/like`, null, { Cookie: userC.cookie });
  console.log('Unlike Status:', unlikeRes.statusCode, 'Liked:', unlikeRes.data.liked, 'Count:', unlikeRes.data.likesCount);
  if (unlikeRes.statusCode !== 200 || unlikeRes.data.likesCount !== 0) {
    throw new Error('Unlike post failed');
  }

  // Like it again for feed tests
  await request('POST', `/api/posts/${postBId}/like`, {}, { Cookie: userC.cookie });

  // 14. Test Comments
  console.log('\n14. Testing Comment System...');
  // Non-follower User A attempts to comment on Private Post B -> MUST FAIL (403)
  const unauthCommentRes = await request('POST', `/api/posts/${postBId}/comments`, { text: 'Sneaky comment' }, { Cookie: userA.cookie });
  console.log('Non-follower comment Status:', unauthCommentRes.statusCode);
  if (unauthCommentRes.statusCode !== 403) {
    throw new Error('Non-follower was allowed to comment on private post!');
  }

  // Empty comment validation -> MUST FAIL (400)
  const emptyCommentRes = await request('POST', `/api/posts/${postBId}/comments`, { text: '   ' }, { Cookie: userC.cookie });
  console.log('Empty comment Status:', emptyCommentRes.statusCode);
  if (emptyCommentRes.statusCode !== 400) {
    throw new Error('Empty comment was not rejected!');
  }

  // Follower User C adds comment
  const addCommRes = await request('POST', `/api/posts/${postBId}/comments`, { text: 'Awesome photo!' }, { Cookie: userC.cookie });
  console.log('Comment added Status:', addCommRes.statusCode, 'Comment ID:', addCommRes.data.comment?.id);
  if (addCommRes.statusCode !== 201) {
    throw new Error('Adding comment failed');
  }
  const commentId = addCommRes.data.comment.id;

  // Non-owner User A attempts to delete comment -> MUST FAIL (403)
  const unauthDelCommRes = await request('DELETE', `/api/comments/${commentId}`, null, { Cookie: userA.cookie });
  console.log('Unauthorized comment delete Status:', unauthDelCommRes.statusCode);
  if (unauthDelCommRes.statusCode !== 403) {
    throw new Error('Unauthorized comment delete was not blocked!');
  }

  // Post owner User B deletes comment -> SUCCEEDS (200)
  const postOwnerDelCommRes = await request('DELETE', `/api/comments/${commentId}`, null, { Cookie: userB.cookie });
  console.log('Post owner comment delete Status:', postOwnerDelCommRes.statusCode);
  if (postOwnerDelCommRes.statusCode !== 200) {
    throw new Error('Post owner could not delete comment on their post');
  }

  // Author User C posts another comment and deletes own comment -> SUCCEEDS (200)
  const addComm2Res = await request('POST', `/api/posts/${postBId}/comments`, { text: 'My own comment to delete' }, { Cookie: userC.cookie });
  const comment2Id = addComm2Res.data.comment.id;
  const authorDelRes = await request('DELETE', `/api/comments/${comment2Id}`, null, { Cookie: userC.cookie });
  console.log('Author delete own comment Status:', authorDelRes.statusCode);
  if (authorDelRes.statusCode !== 200) {
    throw new Error('Author could not delete own comment');
  }

  // 15. Test Sharing Endpoint & Privacy
  console.log('\n15. Testing Share Endpoint & Privacy Enforcement...');
  // User A (Public) creates a post
  const postARes = await request('POST', '/api/media/posts', {
    mediaUrl: 'https://res.cloudinary.com/dbybguptm/image/upload/v12345/insta_v2/posts/public_post.jpg',
    publicId: 'insta_v2/posts/public_post',
    mediaType: 'image',
    caption: 'Public sunset photo #public',
    location: 'Golden Gate Bridge',
    mediaAspect: 'landscape'
  }, { Cookie: userA.cookie });
  const postAId = postARes.data.post.id;

  // Share public post A -> SUCCEEDS (200)
  const sharePublicRes = await request('GET', `/api/posts/${postAId}/share`, null, { Cookie: userC.cookie });
  console.log('Public share Status:', sharePublicRes.statusCode, 'Share URL:', sharePublicRes.data.shareUrl);
  if (sharePublicRes.statusCode !== 200 || !sharePublicRes.data.canView) {
    throw new Error('Public post share failed');
  }

  // Non-follower User A requests share info for Private Post B -> MUST FAIL (403) and hide mediaUrl
  const sharePrivateRes = await request('GET', `/api/posts/${postBId}/share`, null, { Cookie: userA.cookie });
  console.log('Non-follower private share Status:', sharePrivateRes.statusCode, 'canView:', sharePrivateRes.data.canView);
  if (sharePrivateRes.statusCode !== 403 || sharePrivateRes.data.canView === true || sharePrivateRes.data.post?.mediaUrl) {
    throw new Error('Private post share leaked content to non-follower!');
  }

  // 16. Test Feed Endpoint
  console.log('\n16. Testing Feed Endpoint...');
  const feedRes = await request('GET', '/api/posts/feed', null, { Cookie: userC.cookie });
  console.log('Feed Status:', feedRes.statusCode, 'Feed Posts count:', feedRes.data.posts?.length);
  if (feedRes.statusCode !== 200 || feedRes.data.posts.length < 2) {
    throw new Error('Feed retrieval failed');
  }

  console.log('\n=== ALL 16 SOCIAL NETWORKING FEATURE TESTS PASSED! ===');
}

runSocialTests().catch((err) => {
  console.error('\n❌ Test execution error:', err.message);
  process.exit(1);
});
