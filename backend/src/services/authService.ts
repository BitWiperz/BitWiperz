import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { User } from '../models/user.js';

type RegisterInput = { email: string; password: string; name?: string };
type LoginInput = { email: string; password: string };

const _JWT_SECRET = process.env.JWT_SECRET ?? '';
if (!_JWT_SECRET) {
  throw new Error('JWT_SECRET is required but not set. Please set a strong, random secret in your environment.');
}
const JWT_SECRET: jwt.Secret = _JWT_SECRET;
const JWT_EXPIRES_IN: string | number = (process.env.JWT_EXPIRES_IN ?? '7d') as string | number;

type PublicUser = { id: number; email: string; name: string | null; createdAt: Date; updatedAt: Date };

const sanitizeUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const register = async ({ email, password, name }: RegisterInput): Promise<PublicUser> => {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    throw new Error('Email already in use');
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await User.create({ email, passwordHash, name: name ?? null });
  return sanitizeUser(user);
};

export const login = async ({ email, password }: LoginInput): Promise<{ token: string; user: PublicUser }> => {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid credentials');
  }

  let token: string;
  try {
    const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
    token = jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET, options);
  } catch (err) {
    // Fallback without expiresIn if environment value causes issues
    token = jwt.sign({ sub: String(user.id), email: user.email }, JWT_SECRET);
  }

  return { token, user: sanitizeUser(user) };
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string; iat: number; exp: number };
  } catch {
    return null;
  }
};
