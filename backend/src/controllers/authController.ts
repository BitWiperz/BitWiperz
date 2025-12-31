import type { Request, Response, NextFunction } from 'express';

import { login, register, verifyToken } from '../services/authService.js';

export const postRegister = async (req: Request, res: Response) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await register({ email, password, name });
    return res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Error && /already in use/i.test(error.message)) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    // eslint-disable-next-line no-console
    console.error('Register failed', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
};

export const postLogin = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  try {
    const { token, user } = await login({ email, password });
    return res.json({ token, user });
  } catch (error) {
    if (error instanceof Error && /invalid credentials/i.test(error.message)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // eslint-disable-next-line no-console
    console.error('Login failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Login failed', details: message });
  }
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice('Bearer '.length);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Attach user info to request for downstream handlers
  (req as any).user = { id: payload.sub, email: payload.email };
  return next();
};

export const getMe = (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({ user });
};
