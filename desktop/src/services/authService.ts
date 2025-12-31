const API_BASE_URL_RAW = import.meta.env.VITE_API_URL as string | undefined;
if (!API_BASE_URL_RAW) {
  console.error('[config] VITE_API_URL is not set. Please define it in your .env to point to the backend API.');
  throw new Error('Missing VITE_API_URL environment variable');
}
const API_BASE_URL = API_BASE_URL_RAW;

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  } catch {}
  // Redirect to login route (SPA)
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

async function apiFetch(path: string, options: RequestInit = {}, includeAuth: boolean = true): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (includeAuth) {
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (includeAuth && response.status === 401) {
    console.warn('Unauthorized. Clearing auth and redirecting to /login');
    clearAuthAndRedirect();
  }
  return response;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  clearAuthOnStartup(): void {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      console.log('[auth] Cleared auth on startup');
    } catch {}
  },
  async register(data: RegisterData): Promise<User> {
    try {
      const url = `/auth/register`;
      console.log('Registering user at:', `${API_BASE_URL}${url}`);
      const response = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }, false);

      console.log('Register response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Register error:', error);
        throw new Error(error.error || 'Registration failed');
      }

      const result = await response.json();
      return result.user;
    } catch (error) {
      console.error('Register fetch error:', error);
      throw error;
    }
  },

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const url = `/auth/login`;
      console.log('Logging in at:', `${API_BASE_URL}${url}`);
      const response = await apiFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }, false);

      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Login error:', error);
        throw new Error(error.error || 'Login failed');
      }

      const result = await response.json();
      // Store token in localStorage
      localStorage.setItem('auth_token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      return result;
    } catch (error) {
      console.error('Login fetch error:', error);
      throw error;
    }
  },

  async logout(): Promise<void> {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },
  async validateSessionOnStartup(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;
    try {
      const res = await apiFetch('/auth/me', { method: 'GET' }, true);
      if (res.ok) return true;
      // Token rejected; clear stored auth
      await this.logout();
      return false;
    } catch {
      await this.logout();
      return false;
    }
  },
  // Export helper for other services to use
  apiFetch,
};
