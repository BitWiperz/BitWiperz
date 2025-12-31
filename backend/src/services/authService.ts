import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import type { UserRow, PublicUser } from '../models/user.js';
import { getSupabaseAdmin } from '../db/supabase.js';

type RegisterInput = { email: string; password: string; name?: string };
type LoginInput = { email: string; password: string };

const JWT_EXPIRES_IN: string | number = (process.env.JWT_EXPIRES_IN ?? '24h') as string | number;

function getJwtSecret(): jwt.Secret {
  const s = process.env.JWT_SECRET;
  if (!s) {
    throw new Error('JWT_SECRET is required but not set. Please set a strong, random secret in your environment.');
  }
  return s as jwt.Secret;
}

const sanitizeUser = (row: UserRow): PublicUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const register = async ({ email, password, name }: RegisterInput): Promise<PublicUser> => {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: findErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .limit(1);
  if (findErr) {
    // eslint-disable-next-line no-console
    console.error('[auth/register] Lookup failed', {
      message: findErr.message,
      details: (findErr as any).details,
      hint: (findErr as any).hint,
      code: (findErr as any).code,
    });
    throw new Error(`Lookup failed: ${findErr.message}`);
  }
  if (existing && existing.length > 0) {
    throw new Error('Email already in use');
  }

  const saltRoundsEnv = process.env.BCRYPT_ROUNDS;
  const saltRounds = Math.max(4, Number(saltRoundsEnv ?? 12));
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const insert = {
    email,
    password_hash: passwordHash,
    name: name ?? null,
  };
  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert(insert)
    .select('*')
    .single();
  if (insErr) {
    // eslint-disable-next-line no-console
    console.error('[auth/register] Insert failed', {
      message: insErr.message,
      details: (insErr as any).details,
      hint: (insErr as any).hint,
      code: (insErr as any).code,
      payload: insert,
    });
    throw new Error(`Registration failed: ${insErr.message}`);
  }
  return sanitizeUser(created as UserRow);
};

export const login = async ({ email, password }: LoginInput): Promise<{ token: string; user: PublicUser }> => {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  if (error || !row) {
    throw new Error('Invalid credentials');
  }
  const user = row as UserRow;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('Invalid credentials');
  }

  let token: string;
  try {
    const options: jwt.SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
    token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret(), options);
  } catch (err) {
    token = jwt.sign({ sub: String(user.id), email: user.email }, getJwtSecret());
  }
  return { token, user: sanitizeUser(user) };
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, getJwtSecret()) as { sub: string; email: string; iat: number; exp: number };
  } catch {
    return null;
  }
};
