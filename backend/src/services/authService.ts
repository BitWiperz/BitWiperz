import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';

type RegisterInput = { email: string; password: string; name?: string };
type LoginInput = { email: string; password: string };

const JWT_SECRET = process.env.JWT_SECRET ?? 'devsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

const sanitizeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async ({ email, password, name }: RegisterInput) => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error('Email already in use');
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await User.create({ email, passwordHash, name: name ?? null });
  return sanitizeUser(user);
};

export const login = async ({ email, password }: LoginInput) => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid credentials');
  }

  const token = jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return { token, user: sanitizeUser(user) };
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; iat: number; exp: number };
  } catch {
    return null;
  }
};
