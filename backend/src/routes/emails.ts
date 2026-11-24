import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { emailQueue } from '../queue/queue.js';
import { indexEmail, searchEmails } from '../services/search.service.js';

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const scheduleSchema = z.object({ subject: z.string().min(1), body: z.string().min(1), startAt: z.string().datetime(), delayMs: z.number().int().min(0).max(86400000), hourlyLimit: z.number().int().min(1).max(100000), senderEmail: z.string().email(), recipients: z.array(z.string().email()).min(1).max(10000) });

emailsRouter.post('/schedule', async (req, res) => {
  const input = scheduleSchema.parse(req.body);
  const sender = await prisma.sender.upsert({ where: { userId_email: { userId: req.user!.id, email: input.senderEmail } }, update: {}, create: { userId: req.user!.id, email: input.senderEmail } });
  const campaign = await prisma.campaign.create({ data: { userId: req.user!.id, subject: input.subject, body: input.body, startAt: new Date(input.startAt), delayMs: input.delayMs, hourlyLimit: input.hourlyLimit } });
  const created = [];
  for (let i = 0; i < input.recipients.length; i++) {
    const scheduledAt = new Date(new Date(input.startAt).getTime() + i * input.delayMs);
    const email = await prisma.email.create({ data: { userId: req.user!.id, campaignId: campaign.id, senderId: sender.id, recipient: input.recipients[i], subject: input.subject, body: input.body, scheduledAt } });
    await emailQueue.add('send-email', { emailId: email.id }, { jobId: email.id, delay: Math.max(0, scheduledAt.getTime() - Date.now()) });
    await indexEmail(email);
    created.push(email.id);
  }
  res.status(201).json({ campaignId: campaign.id, count: created.length });
});

emailsRouter.get('/scheduled', async (req, res) => res.json(await prisma.email.findMany({ where: { userId: req.user!.id, status: 'SCHEDULED' }, orderBy: { scheduledAt: 'asc' }, take: 1000 })));
emailsRouter.get('/sent', async (req, res) => res.json(await prisma.email.findMany({ where: { userId: req.user!.id, status: { in: ['SENT', 'FAILED'] } }, orderBy: { sentAt: 'desc' }, take: 1000 })));
emailsRouter.get('/search', async (req, res) => res.json(await searchEmails(req.user!.id, String(req.query.q ?? ''))));
