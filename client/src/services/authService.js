import api from './api';

export const authService = {
  // Register a new account
  signup: async ({ fullName, username, email, password }) => {
    return await api.post('/auth/signup', {
      fullName,
      username,
      email,
      password
    });
  },

  // Log in with username/email and password
  login: async ({ identifier, password }) => {
    return await api.post('/auth/login', {
      identifier,
      password
    });
  },

  // Log out current session
  logout: async () => {
    return await api.post('/auth/logout');
  },

  // Get current user session from HTTP-only cookie
  getMe: async () => {
    return await api.get('/auth/me');
  },

  // Check username availability during signup
  checkUsername: async (username, { signal } = {}) => {
    return await api.get('/auth/check-username', {
      params: { username },
      signal
    });
  }
};

export default authService;
