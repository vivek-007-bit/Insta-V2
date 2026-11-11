// Comprehensive API integration test script
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

async function runTests() {
  console.log('=== STARTING INTEGRATION TESTS ===\n');
  let cookie = '';

  // 1. Health check
  console.log('1. Testing Health Endpoint...');
  const healthRes = await request('GET', '/api/health');
  console.log('Status:', healthRes.statusCode, healthRes.data);
  if (healthRes.statusCode !== 200) throw new Error('Health check failed');

  // Test credentials
  const testUser = {
    fullName: 'Test User',
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'password123'
  };

  // 2. User registration
  console.log('\n2. Testing User Registration...');
  const signupRes = await request('POST', '/api/auth/signup', testUser);
  console.log('Status:', signupRes.statusCode, 'User:', signupRes.data.user?.username);
  if (signupRes.statusCode !== 201) throw new Error(`Signup failed: ${JSON.stringify(signupRes.data)}`);

  // Extract set-cookie header
  const setCookie = signupRes.headers['set-cookie'];
  if (setCookie) {
    cookie = setCookie[0].split(';')[0];
    console.log('Received HTTP-only cookie:', cookie.substring(0, 20) + '...');
  } else {
    throw new Error('No cookie received on signup');
  }

  // 3. Duplicate username rejection
  console.log('\n3. Testing Duplicate Username Rejection...');
  const dupUserRes = await request('POST', '/api/auth/signup', {
    fullName: 'Another User',
    username: testUser.username,
    email: `different_${Date.now()}@example.com`,
    password: 'password123'
  });
  console.log('Status:', dupUserRes.statusCode, 'Message:', dupUserRes.data.message);
  if (dupUserRes.statusCode !== 400) throw new Error('Duplicate username was not rejected!');

  // 4. Duplicate email rejection
  console.log('\n4. Testing Duplicate Email Rejection...');
  const dupEmailRes = await request('POST', '/api/auth/signup', {
    fullName: 'Another User',
    username: `diff_${Date.now()}`,
    email: testUser.email,
    password: 'password123'
  });
  console.log('Status:', dupEmailRes.statusCode, 'Message:', dupEmailRes.data.message);
  if (dupEmailRes.statusCode !== 400) throw new Error('Duplicate email was not rejected!');

  // 5. Test Incorrect Password
  console.log('\n5. Testing Incorrect Password Handling...');
  const badLoginRes = await request('POST', '/api/auth/login', {
    identifier: testUser.username,
    password: 'wrong_password_here'
  });
  console.log('Status:', badLoginRes.statusCode, 'Message:', badLoginRes.data.message);
  if (badLoginRes.statusCode !== 401) throw new Error('Bad password was not rejected!');

  // 6. Test Login with Email
  console.log('\n6. Testing Login with Email...');
  const emailLoginRes = await request('POST', '/api/auth/login', {
    identifier: testUser.email,
    password: testUser.password
  });
  console.log('Status:', emailLoginRes.statusCode, 'Message:', emailLoginRes.data.message);
  if (emailLoginRes.statusCode !== 200) throw new Error('Login with email failed!');

  // 7. Test Login with Username
  console.log('\n7. Testing Login with Username...');
  const userLoginRes = await request('POST', '/api/auth/login', {
    identifier: testUser.username,
    password: testUser.password
  });
  console.log('Status:', userLoginRes.statusCode, 'User:', userLoginRes.data.user?.username);
  if (userLoginRes.statusCode !== 200) throw new Error('Login with username failed!');

  const loginCookie = userLoginRes.headers['set-cookie'][0].split(';')[0];

  // 8. Test Persistent Session (/api/auth/me) with Cookie
  console.log('\n8. Testing Persistent Session (/api/auth/me)...');
  const meRes = await request('GET', '/api/auth/me', null, { Cookie: loginCookie });
  console.log('Status:', meRes.statusCode, 'Current User:', meRes.data.user?.username);
  if (meRes.statusCode !== 200) throw new Error('Session verification failed!');

  // 9. Test Cloudinary Signature Generation
  console.log('\n9. Testing Cloudinary Upload Signature Generation...');
  const sigRes = await request('POST', '/api/media/signature', { folder: 'insta_v2/posts' }, { Cookie: loginCookie });
  console.log('Status:', sigRes.statusCode, 'Signature:', sigRes.data.signature ? 'Generated OK' : 'Missing');
  console.log('Cloud Name:', sigRes.data.cloudName, 'API Key:', sigRes.data.apiKey);
  if (sigRes.statusCode !== 200 || !sigRes.data.signature) throw new Error('Signature generation failed!');

  // 10. Test Post Metadata Creation
  console.log('\n10. Testing Post Creation in MongoDB...');
  const postRes = await request('POST', '/api/media/posts', {
    mediaUrl: 'https://res.cloudinary.com/dbybguptm/image/upload/v12345/insta_v2/posts/sample.jpg',
    publicId: 'insta_v2/posts/sample',
    mediaType: 'image',
    caption: 'Test post from backend integration test suite #vibes',
    location: 'San Francisco, CA',
    mediaAspect: 'square'
  }, { Cookie: loginCookie });
  console.log('Status:', postRes.statusCode, 'Post ID:', postRes.data.post?.id);
  if (postRes.statusCode !== 201) throw new Error('Post creation failed!');

  // 11. Test Story Metadata Creation
  console.log('\n11. Testing Story Creation in MongoDB...');
  const storyRes = await request('POST', '/api/media/stories', {
    mediaUrl: 'https://res.cloudinary.com/dbybguptm/image/upload/v12345/insta_v2/stories/sample.jpg',
    publicId: 'insta_v2/stories/sample',
    mediaType: 'image',
    caption: '24hr story test'
  }, { Cookie: loginCookie });
  console.log('Status:', storyRes.statusCode, 'Story ID:', storyRes.data.story?.id, 'ExpiresAt:', storyRes.data.story?.expiresAt);
  if (storyRes.statusCode !== 201) throw new Error('Story creation failed!');

  // 12. Test Logout
  console.log('\n12. Testing Logout & Cookie Invalidation...');
  const logoutRes = await request('POST', '/api/auth/logout', {}, { Cookie: loginCookie });
  console.log('Status:', logoutRes.statusCode, 'Message:', logoutRes.data.message);
  const clearedCookie = logoutRes.headers['set-cookie']?.[0];
  console.log('Cleared cookie header:', clearedCookie);
  if (logoutRes.statusCode !== 200) throw new Error('Logout failed!');

  // 13. Test Protected Route Access Without Cookie (should fail with 401)
  console.log('\n13. Testing Protected Route Rejection without Cookie...');
  const unauthRes = await request('GET', '/api/auth/me');
  console.log('Status:', unauthRes.statusCode, 'Message:', unauthRes.data.message);
  if (unauthRes.statusCode !== 401) throw new Error('Unauthenticated request was not rejected!');

  console.log('\n=== ALL 13 INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test execution error:', err.message);
  process.exit(1);
});
