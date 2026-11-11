// Comprehensive Notifications & Real-Time Socket.IO Integration Tests
import http from 'http';
import { io } from 'socket.io-client';

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
    fullName: `${prefix} User`,
    username: `${prefix.toLowerCase()}_${ts}`,
    email: `${prefix.toLowerCase()}_${ts}@notiftest.com`,
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

function connectSocket(cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      transports: ['websocket'],
      reconnection: false
    };
    if (cookie) {
      options.extraHeaders = { Cookie: cookie };
    }
    const socket = io(BASE_URL, options);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Socket connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err);
    });
  });
}

async function runNotificationTests() {
  console.log('=== RUNNING NOTIFICATIONS & REAL-TIME INTEGRATION TESTS ===\n');

  // 1. Setup Users: User A (Actor), User B (Public Target), User C (Private Target)
  console.log('1. Creating test users...');
  const userA = await createTestUser('NotifA', false);
  const userB = await createTestUser('NotifB', false);
  const userC = await createTestUser('NotifC', true);
  console.log(`Users: A=@${userA.user.username}, B=@${userB.user.username}, C=@${userC.user.username}`);

  // 2. Test Unauthenticated Socket Rejection
  console.log('\n2. Verifying unauthenticated Socket.IO rejection...');
  let unauthRejected = false;
  try {
    await connectSocket(null);
  } catch (err) {
    unauthRejected = true;
    console.log('Unauthenticated socket rejected as expected:', err.message);
  }
  if (!unauthRejected) throw new Error('Unauthenticated socket was allowed to connect!');

  // 3. Connect Authenticated Sockets for User A and User B
  console.log('\n3. Connecting authenticated Socket.IO clients for User A & User B...');
  const socketA = await connectSocket(userA.cookie);
  const socketB = await connectSocket(userB.cookie);

  const receivedByA = [];
  const receivedByB = [];
  const unreadUpdatesB = [];

  socketA.on('new_notification', (n) => receivedByA.push(n));
  socketB.on('new_notification', (n) => receivedByB.push(n));
  socketB.on('unread_count_updated', (u) => unreadUpdatesB.push(u.unreadCount));
  console.log('Sockets connected and listening.');

  // 4. User A follows public User B -> User B receives real-time 'follow' notification
  console.log('\n4. Testing follow notification (A -> public B)...');
  await request('POST', `/api/users/${userB.user.id}/follow`, {}, { Cookie: userA.cookie });
  await new Promise((r) => setTimeout(r, 300));

  const followNotif = receivedByB.find((n) => n.type === 'follow');
  if (!followNotif) throw new Error('User B did not receive real-time follow notification');
  if (receivedByA.some((n) => n.type === 'follow')) {
    throw new Error('User A received notification meant only for User B!');
  }
  console.log('User B received real-time follow notification ID:', followNotif.id);

  // 5. User A requests to follow private User C -> User C gets 'follow_request'
  console.log('\n5. Testing follow_request notification (A -> private C)...');
  const reqRes = await request('POST', `/api/users/${userC.user.id}/follow`, {}, { Cookie: userA.cookie });
  const requestId = reqRes.data.requestId;

  const cNotifsRes = await request('GET', '/api/notifications', null, { Cookie: userC.cookie });
  const followReqNotif = cNotifsRes.data.notifications.find((n) => n.type === 'follow_request');
  if (!followReqNotif) throw new Error('User C did not receive follow_request notification');
  console.log('User C received follow_request notification:', followReqNotif.id);

  // 6. User C accepts User A's follow request -> User A receives 'follow_request_accepted'
  console.log('\n6. Testing follow_request_accepted notification (C accepts A)...');
  await request('POST', `/api/follow-requests/${requestId}/accept`, {}, { Cookie: userC.cookie });
  await new Promise((r) => setTimeout(r, 300));

  const acceptedNotif = receivedByA.find((n) => n.type === 'follow_request_accepted');
  if (!acceptedNotif) throw new Error('User A did not receive real-time follow_request_accepted notification');
  console.log('User A received follow_request_accepted notification:', acceptedNotif.id);

  // 7. Rejection should NOT create notification
  console.log('\n7. Testing follow request rejection generates NO notification...');
  const reqBToC = await request('POST', `/api/users/${userC.user.id}/follow`, {}, { Cookie: userB.cookie });
  await request('POST', `/api/follow-requests/${reqBToC.data.requestId}/reject`, {}, { Cookie: userC.cookie });
  await new Promise((r) => setTimeout(r, 200));
  if (receivedByB.some((n) => n.sender?.id === userC.user.id)) {
    throw new Error('Rejection incorrectly generated a notification!');
  }
  console.log('Confirmed: No notification created on rejection.');

  // 8. User B creates Post & Reel; User A likes & comments on both
  console.log('\n8. Testing Post & Reel like/comment notifications...');
  const postRes = await request('POST', '/api/media/posts', {
    mediaUrl: 'https://res.cloudinary.com/dbybguptm/image/upload/v123/insta_v2/posts/test_notif.jpg',
    publicId: 'insta_v2/posts/test_notif',
    mediaType: 'image',
    caption: 'Notification test post'
  }, { Cookie: userB.cookie });
  const postId = postRes.data.post.id;

  const reelRes = await request('POST', '/api/reels', {
    videoUrl: 'https://res.cloudinary.com/dbybguptm/video/upload/v123/insta_v2/reels/test_notif.mp4',
    publicId: 'insta_v2/reels/test_notif',
    caption: 'Notification test reel'
  }, { Cookie: userB.cookie });
  const reelId = reelRes.data.reel.id;

  // Self-action test: B likes & comments on B's own post -> NO notification
  await request('POST', `/api/posts/${postId}/like`, {}, { Cookie: userB.cookie });
  await request('POST', `/api/posts/${postId}/comments`, { text: 'My own comment' }, { Cookie: userB.cookie });
  await new Promise((r) => setTimeout(r, 200));
  if (receivedByB.some((n) => n.sender?.id === userB.user.id)) {
    throw new Error('Self-action generated a notification!');
  }
  console.log('Confirmed: Self-actions do not generate notifications.');

  // User A likes & comments on Post B, and likes & comments on Reel B
  await request('POST', `/api/posts/${postId}/like`, {}, { Cookie: userA.cookie });
  await request('POST', `/api/posts/${postId}/comments`, { text: 'Great shot!' }, { Cookie: userA.cookie });
  await request('POST', `/api/reels/${reelId}/like`, {}, { Cookie: userA.cookie });
  await request('POST', `/api/reels/${reelId}/comments`, { text: 'Cool reel!' }, { Cookie: userA.cookie });
  await new Promise((r) => setTimeout(r, 400));

  const typesB = new Set(receivedByB.map((n) => n.type));
  console.log('Notification types received in real-time by User B:', Array.from(typesB));
  for (const expected of ['follow', 'like', 'comment', 'reel_like', 'reel_comment']) {
    if (!typesB.has(expected)) {
      throw new Error(`Missing real-time notification type: ${expected}`);
    }
  }

  // 9. Duplicate like should NOT generate duplicate notification
  console.log('\n9. Testing duplicate like prevention...');
  const dupLikeRes = await request('POST', `/api/posts/${postId}/like`, {}, { Cookie: userA.cookie });
  if (dupLikeRes.statusCode !== 400) throw new Error('Duplicate like was not rejected');
  const likeCountB = receivedByB.filter((n) => n.type === 'like' && n.entityId === postId).length;
  if (likeCountB !== 1) throw new Error(`Expected 1 like notification, got ${likeCountB}`);
  console.log('Confirmed: No duplicate like notification generated.');

  // 10. Unread count & endpoints check
  console.log('\n10. Testing unread count & read endpoints...');
  const unreadCountRes = await request('GET', '/api/notifications/unread-count', null, { Cookie: userB.cookie });
  console.log('User B unread count:', unreadCountRes.data.unreadCount);
  if (unreadCountRes.data.unreadCount !== 5) {
    throw new Error(`Expected 5 unread notifications, got ${unreadCountRes.data.unreadCount}`);
  }

  const unreadListRes = await request('GET', '/api/notifications/unread', null, { Cookie: userB.cookie });
  if (unreadListRes.data.notifications.length !== 5) {
    throw new Error('GET /api/notifications/unread mismatch');
  }

  // 11. Authorization check: User A tries to mark User B's notification as read or delete it
  console.log('\n11. Testing cross-user notification authorization...');
  const unauthRead = await request('PATCH', `/api/notifications/${followNotif.id}/read`, {}, { Cookie: userA.cookie });
  const unauthDel = await request('DELETE', `/api/notifications/${followNotif.id}`, null, { Cookie: userA.cookie });
  if (unauthRead.statusCode !== 403 || unauthDel.statusCode !== 403) {
    throw new Error('Cross-user notification access was not blocked!');
  }
  console.log('Confirmed: Cross-user read/delete blocked with 403.');

  // 12. Mark single as read & mark all as read
  console.log('\n12. Testing mark single as read & mark all as read...');
  const markOneRes = await request('PATCH', `/api/notifications/${followNotif.id}/read`, {}, { Cookie: userB.cookie });
  if (markOneRes.statusCode !== 200 || markOneRes.data.unreadCount !== 4) {
    throw new Error('Mark single notification read failed');
  }

  const markAllRes = await request('PATCH', '/api/notifications/read-all', {}, { Cookie: userB.cookie });
  if (markAllRes.statusCode !== 200 || markAllRes.data.unreadCount !== 0) {
    throw new Error('Mark all read failed');
  }

  // 13. Delete referenced Reel -> notifications still render safely without crashing!
  console.log('\n13. Testing graceful handling when referenced Reel is deleted...');
  await request('DELETE', `/api/reels/${reelId}`, null, { Cookie: userB.cookie });
  const afterReelDelNotifs = await request('GET', '/api/notifications', null, { Cookie: userB.cookie });
  const deletedReelNotif = afterReelDelNotifs.data.notifications.find((n) => n.entityId === reelId);
  if (!deletedReelNotif || deletedReelNotif.entityExists !== false) {
    throw new Error('Deleted reel notification did not handle missing entity gracefully');
  }
  console.log('Confirmed: Notification safely marks entityExists=false when Reel is deleted.');

  // 14. Delete single notification & clear all
  console.log('\n14. Testing delete notification & clear all...');
  const delOneRes = await request('DELETE', `/api/notifications/${followNotif.id}`, null, { Cookie: userB.cookie });
  if (delOneRes.statusCode !== 200) throw new Error('Delete single notification failed');

  const clearRes = await request('DELETE', '/api/notifications/clear-all', null, { Cookie: userB.cookie });
  if (clearRes.statusCode !== 200) throw new Error('Clear all notifications failed');

  const finalCheck = await request('GET', '/api/notifications', null, { Cookie: userB.cookie });
  if (finalCheck.data.notifications.length !== 0) {
    throw new Error('Clear all did not empty notifications');
  }

  // 15. Clean disconnect sockets
  socketA.disconnect();
  socketB.disconnect();
  console.log('\n=== ALL 15 NOTIFICATION & REAL-TIME TESTS PASSED SUCCESSFULLY! ===');
}

runNotificationTests().catch((err) => {
  console.error('\n❌ Notifications test failed:', err.message);
  process.exit(1);
});
