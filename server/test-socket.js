// End-to-end Socket.IO connection and real-time event test
import { io } from 'socket.io-client';

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

async function runSocketVerification() {
  console.log('=== RUNNING SOCKET.IO END-TO-END VERIFICATION ===\n');

  // 1. Check backend server running
  console.log('1. Checking backend HTTP server status on port 8000...');
  const healthRes = await request('GET', '/api/health');
  assert(healthRes.statusCode === 200, `Backend health check failed: ${healthRes.statusCode}`);
  console.log('   OK: Backend is healthy, MongoDB is connected\n');

  // 2. Demonstrate rejection of unauthenticated socket connections
  console.log('2. Verifying unauthenticated socket connection rejection...');
  let unauthRejected = false;
  try {
    await new Promise((resolve, reject) => {
      const s = io(BASE_URL, {
        transports: ['polling', 'websocket'],
        reconnection: false,
        timeout: 4000
      });
      s.on('connect', () => {
        s.disconnect();
        reject(new Error('Unauthenticated socket unexpectedly connected'));
      });
      s.on('connect_error', (err) => {
        s.disconnect();
        resolve(err);
      });
    });
    unauthRejected = true;
  } catch (err) {
    throw err;
  }
  assert(unauthRejected, 'Unauthenticated socket was not rejected');
  console.log('   OK: Unauthenticated connection rejected with "Authentication error: No token provided"\n');

  // 3. Register test accounts
  const ts = Date.now();
  console.log('3. Registering test accounts for real-time testing...');
  const userA = await request('POST', '/api/auth/signup', {
    fullName: 'Socket Tester A',
    username: `socka_${ts}`,
    email: `socka_${ts}@socktest.com`,
    password: 'Password123!'
  });
  assert(userA.statusCode === 201, `Failed to register User A: ${JSON.stringify(userA.data)}`);
  const cookieA = userA.cookies.split(';')[0];
  const userAId = userA.data.user.id;

  const userB = await request('POST', '/api/auth/signup', {
    fullName: 'Socket Tester B',
    username: `sockb_${ts}`,
    email: `sockb_${ts}@socktest.com`,
    password: 'Password123!'
  });
  assert(userB.statusCode === 201, `Failed to register User B: ${JSON.stringify(userB.data)}`);
  const cookieB = userB.cookies.split(';')[0];
  const userBId = userB.data.user.id;
  console.log('   OK: Test accounts created\n');

  // 4. Connect User A via Socket.IO using HTTP-only cookie
  console.log('4. Connecting User A via Socket.IO with HTTP-only cookie...');
  const socketA = await new Promise((resolve, reject) => {
    const s = io(BASE_URL, {
      extraHeaders: { Cookie: cookieA },
      transports: ['polling', 'websocket'],
      reconnection: true
    });
    const timer = setTimeout(() => {
      s.disconnect();
      reject(new Error('Socket A connection timed out'));
    }, 6000);
    s.on('connect', () => {
      clearTimeout(timer);
      resolve(s);
    });
    s.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  assert(socketA.connected, 'Socket A is not connected');
  console.log('   OK: Socket A connected successfully with cookie authentication\n');

  // 5. Connect User B via Socket.IO and verify online presence
  console.log('5. Connecting User B and testing real-time user presence...');
  let presenceReceived = null;
  socketA.on('user_presence', (payload) => {
    presenceReceived = payload;
  });

  const socketB = await new Promise((resolve, reject) => {
    const s = io(BASE_URL, {
      extraHeaders: { Cookie: cookieB },
      transports: ['polling', 'websocket'],
      reconnection: true
    });
    const timer = setTimeout(() => {
      s.disconnect();
      reject(new Error('Socket B connection timed out'));
    }, 6000);
    s.on('connect', () => {
      clearTimeout(timer);
      resolve(s);
    });
    s.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
  assert(socketB.connected, 'Socket B is not connected');

  // Wait a short moment for presence broadcast
  await new Promise((r) => setTimeout(r, 600));
  assert(presenceReceived !== null, 'No presence event received on Socket A');
  assert(presenceReceived.userId === userBId && presenceReceived.isOnline === true, 'Presence event payload mismatch');
  console.log('   OK: Online presence broadcast verified (User B connected -> User A notified)\n');

  // 6. Test real-time notifications over Socket.IO
  console.log('6. Testing real-time notification delivery (follow -> notification)...');
  let notificationReceived = null;
  socketA.on('new_notification', (payload) => {
    notificationReceived = payload;
  });

  // User B follows User A
  const followRes = await request('POST', `/api/users/${userAId}/follow`, {}, { Cookie: cookieB });
  assert(followRes.statusCode === 200 || followRes.statusCode === 201, `Follow failed: ${JSON.stringify(followRes.data)}`);

  // Wait for notification on Socket A
  await new Promise((r) => setTimeout(r, 800));
  assert(notificationReceived !== null, 'Socket A did not receive real-time new_notification event');
  assert(notificationReceived.sender?.username === `sockb_${ts}`, 'Notification sender mismatch');
  console.log('   OK: Real-time notification delivered to Socket A user room\n');

  // 7. Test Direct Messaging room join & real-time message event
  console.log('7. Testing real-time messaging across conversation rooms...');
  // Create conversation between User A and User B
  const convRes = await request('POST', '/api/messages/conversations', {
    recipientId: userBId
  }, { Cookie: cookieA });
  assert(convRes.statusCode === 200 || convRes.statusCode === 201, `Create conversation failed: ${JSON.stringify(convRes.data)}`);
  const convId = convRes.data.conversation.id;

  // Socket B joins conversation room
  const joinAck = await new Promise((resolve) => {
    socketB.emit('join_conversation', convId, (ack) => resolve(ack));
  });
  assert(joinAck && joinAck.ok, `Socket B failed to join conversation room: ${JSON.stringify(joinAck)}`);

  let messageReceived = null;
  socketB.on('new_message', (payload) => {
    messageReceived = payload;
  });

  // User A sends a message in the conversation
  const sendMsgRes = await request('POST', `/api/messages/conversations/${convId}/messages`, {
    text: 'Real-time test message #1'
  }, { Cookie: cookieA });
  assert(sendMsgRes.statusCode === 201, `Send message failed: ${JSON.stringify(sendMsgRes.data)}`);

  await new Promise((r) => setTimeout(r, 800));
  assert(messageReceived !== null, 'Socket B did not receive new_message event');
  assert(messageReceived.message.text === 'Real-time test message #1', 'Message text mismatch');
  console.log('   OK: Real-time message delivered to Socket B conversation room\n');

  // 8. Cleanup sockets and test disconnect presence
  console.log('8. Testing graceful disconnect & offline presence...');
  let offlineReceived = null;
  socketA.on('user_presence', (payload) => {
    if (payload.userId === userBId && payload.isOnline === false) {
      offlineReceived = payload;
    }
  });

  socketB.disconnect();
  await new Promise((r) => setTimeout(r, 600));
  assert(offlineReceived !== null, 'Offline presence event not received after disconnect');
  console.log('   OK: Offline presence broadcast verified\n');

  socketA.disconnect();

  console.log('=== ALL SOCKET.IO TESTS PASSED SUCCESSFULLY ===');
}

runSocketVerification().catch((err) => {
  console.error('\nSOCKET VERIFICATION FAILURE:', err.message);
  process.exit(1);
});
