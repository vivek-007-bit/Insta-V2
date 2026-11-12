// Real-time Direct Messaging backend + Socket.IO integration tests
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

function connectSocket(cookie) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      extraHeaders: { Cookie: cookie },
      transports: ['websocket']
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out'));
    }, 6000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('=== RUNNING DIRECT MESSAGING & REAL-TIME TESTS ===');
  const ts = Date.now();

  // 1. Register User A, User B, and Unauthorized User C
  console.log('\n1. Registering test accounts...');
  const userA = await request('POST', '/api/auth/signup', {
    fullName: 'Msg User A',
    username: `msga_${ts}`,
    email: `msga_${ts}@msgtest.com`,
    password: 'Password123!'
  });
  const userB = await request('POST', '/api/auth/signup', {
    fullName: 'Msg User B',
    username: `msgb_${ts}`,
    email: `msgb_${ts}@msgtest.com`,
    password: 'Password123!'
  });
  const userC = await request('POST', '/api/auth/signup', {
    fullName: 'Msg Intruder C',
    username: `msgc_${ts}`,
    email: `msgc_${ts}@msgtest.com`,
    password: 'Password123!'
  });
  assert(userA.statusCode === 201 && userB.statusCode === 201 && userC.statusCode === 201, 'Signup failed');

  const cookieA = userA.cookies.split(';')[0];
  const cookieB = userB.cookies.split(';')[0];
  const cookieC = userC.cookies.split(';')[0];
  const idA = userA.data.user.id;
  const idB = userB.data.user.id;

  // 2. Test Conversation Uniqueness (A->B vs B->A)
  console.log('\n2. Testing 1-to-1 conversation deduplication...');
  const convAB = await request('POST', '/api/messages/conversations', { recipientId: idB }, { Cookie: cookieA });
  assert(convAB.statusCode === 201 && convAB.data.created === true, 'Failed creating conversation A->B');
  const convId = convAB.data.conversation.id;

  const convBA = await request('POST', '/api/messages/conversations', { recipientId: idA }, { Cookie: cookieB });
  assert(convBA.statusCode === 200 && convBA.data.conversation.id === convId && convBA.data.created === false, 'Duplicate conversation created for B->A!');
  console.log('Unique conversation verified:', convId);

  // 3. Test Socket.IO auth, room authorization & real-time events
  console.log('\n3. Testing Socket.IO connections & room security...');
  const [sockA, sockB, sockC] = await Promise.all([
    connectSocket(cookieA),
    connectSocket(cookieB),
    connectSocket(cookieC)
  ]);

  const joinARes = await new Promise((resolve) => sockA.emit('join_conversation', convId, resolve));
  const joinBRes = await new Promise((resolve) => sockB.emit('join_conversation', convId, resolve));
  const joinCRes = await new Promise((resolve) => sockC.emit('join_conversation', convId, resolve));
  assert(joinARes.ok === true && joinBRes.ok === true, 'Authorized users failed join_conversation');
  assert(joinCRes.ok === false, 'Unauthorized User C must be rejected from join_conversation');
  console.log('Socket room authorization verified.');

  // 4. Test unauthorized HTTP access & validation rules
  console.log('\n4. Testing unauthorized HTTP access & message validation...');
  const unauthGet = await request('GET', `/api/messages/conversations/${convId}`, null, { Cookie: cookieC });
  const unauthMsgs = await request('GET', `/api/messages/conversations/${convId}/messages`, null, { Cookie: cookieC });
  const unauthPost = await request('POST', `/api/messages/conversations/${convId}/messages`, { text: 'Hack' }, { Cookie: cookieC });
  assert(unauthGet.statusCode === 403 && unauthMsgs.statusCode === 403 && unauthPost.statusCode === 403, 'Non-participant must get 403');

  const emptyPost = await request('POST', `/api/messages/conversations/${convId}/messages`, { text: '   \n  ' }, { Cookie: cookieA });
  assert(emptyPost.statusCode === 400, 'Whitespace message must return 400');

  const longPost = await request('POST', `/api/messages/conversations/${convId}/messages`, { text: 'a'.repeat(5001) }, { Cookie: cookieA });
  assert(longPost.statusCode === 400, 'Message > 5000 chars must return 400');
  console.log('Security & validation rules verified.');

  // 5. Real-time delivery A -> B & sender derivation check
  console.log('\n5. Testing real-time message delivery & spoof protection...');
  const receivedByBPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('B did not receive new_message via Socket.IO')), 5000);
    sockB.once('new_message', (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

  const sendARes = await request(
    'POST',
    `/api/messages/conversations/${convId}/messages`,
    { text: 'Hello User B in real time!', senderId: idB }, // attempt to spoof senderId
    { Cookie: cookieA }
  );
  assert(sendARes.statusCode === 201 && sendARes.data.message.senderId === idA, 'Sender must derive strictly from req.user._id');
  const firstMsgId = sendARes.data.message.id;

  const rtPayload = await receivedByBPromise;
  assert(rtPayload.conversationId === convId && rtPayload.message.id === firstMsgId, 'Real-time payload mismatch on B');

  const listB = await request('GET', '/api/messages/conversations', null, { Cookie: cookieB });
  const convEntryB = listB.data.conversations.find((c) => c.id === convId);
  assert(convEntryB && convEntryB.unreadCount === 1 && convEntryB.lastMessage.id === firstMsgId, 'B unreadCount should be 1 before opening');
  console.log('Real-time delivery & unread count verified.');

  // 6. Real-time read receipts (B marks read -> A receives messages_read)
  console.log('\n6. Testing read receipts & persistence...');
  const readByAPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('A did not receive messages_read')), 5000);
    sockA.once('messages_read', (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

  const markRes = await request('PATCH', `/api/messages/conversations/${convId}/read`, {}, { Cookie: cookieB });
  assert(markRes.statusCode === 200 && markRes.data.markedCount === 1, 'markAsRead failed');
  const readPayload = await readByAPromise;
  assert(readPayload.readerId === idB && readPayload.messageIds.includes(firstMsgId), 'Real-time read receipt mismatch');

  const listBAfterRead = await request('GET', '/api/messages/conversations', null, { Cookie: cookieB });
  assert(listBAfterRead.data.conversations.find((c) => c.id === convId).unreadCount === 0, 'Unread count should persist as 0');
  console.log('Read receipts verified.');

  // 7. Pagination & message deletion
  console.log('\n7. Testing cursor pagination & sender-only message deletion...');
  for (let i = 1; i <= 14; i++) {
    const r = await request('POST', `/api/messages/conversations/${convId}/messages`, { text: `Paginated msg #${i}` }, { Cookie: cookieB });
    assert(r.statusCode === 201, `Seeded msg ${i} failed`);
  }

  const page1 = await request('GET', `/api/messages/conversations/${convId}/messages?limit=10`, null, { Cookie: cookieA });
  assert(page1.statusCode === 200 && page1.data.messages.length === 10 && page1.data.hasMore === true && page1.data.nextCursor, 'Page 1 pagination invalid');
  assert(page1.data.messages[9].text === 'Paginated msg #14', 'Newest message should be last chronologically');

  const page2 = await request('GET', `/api/messages/conversations/${convId}/messages?limit=10&before=${page1.data.nextCursor}`, null, { Cookie: cookieA });
  assert(page2.statusCode === 200 && page2.data.messages.length === 5 && page2.data.hasMore === false, 'Page 2 pagination invalid');
  const overlap = page1.data.messages.filter((m1) => page2.data.messages.some((m2) => m2.id === m1.id));
  assert(overlap.length === 0, 'Pagination returned duplicate messages');

  const nonOwnerDel = await request('DELETE', `/api/messages/${firstMsgId}`, null, { Cookie: cookieB });
  assert(nonOwnerDel.statusCode === 403, 'Non-sender must get 403 on delete');
  const ownerDel = await request('DELETE', `/api/messages/${firstMsgId}`, null, { Cookie: cookieA });
  assert(ownerDel.statusCode === 200, 'Sender delete failed');
  console.log('Pagination & message deletion verified.');

  sockA.disconnect();
  sockB.disconnect();
  sockC.disconnect();

  console.log('\n=== ALL DIRECT MESSAGING & REAL-TIME TESTS PASSED! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Messages test error:', err);
  process.exit(1);
});
