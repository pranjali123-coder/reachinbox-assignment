import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { signUser } from '../lib/auth.js';

export const authRouter = Router();

function googleClient() { return new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL); }
authRouter.get('/google', (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google OAuth is not configured');
  const url = googleClient().generateAuthUrl({ access_type: 'offline', scope: ['openid', 'email', 'profile'], prompt: 'select_account' });
  res.redirect(url);
});

authRouter.get('/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const { tokens } = await googleClient().getToken(code);
    const ticket = await googleClient().verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new Error('Google profile unavailable');
    const user = await prisma.user.upsert({ where: { googleId: p.sub }, update: { name: p.name ?? p.email, email: p.email, avatarUrl: p.picture }, create: { googleId: p.sub, name: p.name ?? p.email, email: p.email, avatarUrl: p.picture } });
    const token = signUser({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });
    res.cookie('reachinbox_token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7 * 24 * 3600000 });
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (e: any) { res.status(500).send(`Google login failed: ${e.message}`); }
});

authRouter.post('/logout', (req, res) => { res.clearCookie('reachinbox_token'); res.json({ ok: true }); });
