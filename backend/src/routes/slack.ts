import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';

export const slackRouter = Router();
slackRouter.get('/connect', requireAuth, (req, res) => {
  if (!env.SLACK_CLIENT_ID) return res.status(503).send('Slack OAuth is not configured');
  const scopes = encodeURIComponent('chat:write');
  res.redirect(`https://slack.com/oauth/v2/authorize?client_id=${env.SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(env.SLACK_CALLBACK_URL)}`);
});
slackRouter.get('/callback', requireAuth, async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const response = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.SLACK_CLIENT_ID!, client_secret: env.SLACK_CLIENT_SECRET!, code, redirect_uri: env.SLACK_CALLBACK_URL }) });
    const data = await response.json() as any;
    if (!data.ok || !data.access_token) throw new Error(data.error || 'Slack OAuth failed');
    await prisma.user.update({ where: { id: req.user!.id }, data: { slackToken: data.access_token, slackTeamId: data.team?.id } });
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (e: any) { res.status(500).send(`Slack connection failed: ${e.message}`); }
});
slackRouter.post('/disconnect', requireAuth, async (req, res) => { await prisma.user.update({ where: { id: req.user!.id }, data: { slackToken: null, slackTeamId: null } }); res.json({ ok: true }); });
