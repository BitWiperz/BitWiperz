const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface User {
  id: number;
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
  async register(data: RegisterData): Promise<User> {
    try {
      const url = `${API_BASE_URL}/auth/register`;
      console.log('Registering user at:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

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
      const url = `${API_BASE_URL}/auth/login`;
      console.log('Logging in at:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

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
};
