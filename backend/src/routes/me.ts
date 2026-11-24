import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
export const meRouter = Router();
meRouter.get('/', requireAuth, async (req, res) => { const u = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, avatarUrl: true, slackToken: true } }); res.json({ ...u, slackConnected: !!u?.slackToken }); });
