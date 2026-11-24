import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type AuthUser = { id: string; email: string; name: string; avatarUrl?: string | null };
export function signUser(user: AuthUser) { return jwt.sign(user, env.JWT_SECRET, { expiresIn: '7d' }); }
export function verifyUser(token: string) { return jwt.verify(token, env.JWT_SECRET) as AuthUser; }
