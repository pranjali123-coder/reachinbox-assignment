import { Worker, Job } from 'bullmq';
import { prisma } from '../db/prisma.js';
import { redis, connectRedis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { sendViaEthereal } from '../services/email.service.js';
import { indexEmail } from '../services/search.service.js';
import { notifyRateLimit } from '../services/slack.service.js';
import { emailQueue } from './queue.js';

const pacingLua = `
local last = tonumber(redis.call('GET', KEYS[1]) or '0')
local now = tonumber(ARGV[1])
local delay = tonumber(ARGV[2])
local next = math.max(now, last + delay)
redis.call('SET', KEYS[1], next, 'PX', delay + 60000)
return next
`;

async function reservePacing(senderId: string) {
  const now = Date.now();
  const key = `sender:pacing:${senderId}`;
  const next = Number(await redis.eval(pacingLua, { keys: [key], arguments: { '1': String(now), '2': String(env.MIN_DELAY_MS) } }));
  return Math.max(0, next - now);
}

async function reserveHourlySlot(senderId: string, userId: string, senderEmail: string, limit: number) {
  const hour = Math.floor(Date.now() / 3600000);
  const key = `sender:hour:${senderId}:${hour}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 7200);
  if (count <= limit) return { allowed: true, waitMs: 0 };
  await redis.decr(key);
  const nextHour = (hour + 1) * 3600000;
  await notifyRateLimit(userId, senderEmail, limit).catch(() => undefined);
  return { allowed: false, waitMs: nextHour - Date.now() };
}

async function process(job: Job<{ emailId: string }>) {
  const email = await prisma.email.findUnique({ where: { id: job.data.emailId }, include: { sender: true } });
  if (!email) return;
  if (email.status === 'SENT') return;

  const paceWait = await reservePacing(email.senderId);
  if (paceWait > 0) {
    await emailQueue.add('send-email', job.data, { jobId: `${email.id}:pace:${Date.now()}`, delay: paceWait, attempts: 5 });
    return;
  }

  const slot = await reserveHourlySlot(email.senderId, email.userId, email.sender.email, email.senderId ? env.MAX_EMAILS_PER_HOUR_PER_SENDER : env.MAX_EMAILS_PER_HOUR_PER_SENDER);
  if (!slot.allowed) {
    await emailQueue.add('send-email', job.data, { jobId: `${email.id}:hour:${Date.now()}`, delay: slot.waitMs, attempts: 5 });
    return;
  }

  const locked = await prisma.email.updateMany({ where: { id: email.id, status: 'SCHEDULED' }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
  if (locked.count === 0) return;

  try {
    const result = await sendViaEthereal({ from: email.sender.email, to: email.recipient, subject: email.subject, text: email.body });
    const updated = await prisma.email.update({ where: { id: email.id }, data: { status: 'SENT', sentAt: new Date(), lastError: null } });
    await indexEmail(updated);
    console.log(`Sent ${email.id}; preview: ${result.previewUrl ?? 'n/a'}`);
  } catch (err: any) {
    const updated = await prisma.email.update({ where: { id: email.id }, data: { status: 'FAILED', lastError: err.message } });
    await indexEmail(updated);
    throw err;
  }
}

export async function startWorker() {
  await connectRedis();
  const worker = new Worker('email-send', process, { connection: redis as any, concurrency: env.WORKER_CONCURRENCY });
  worker.on('completed', job => console.log(`Job completed: ${job.id}`));
  worker.on('failed', (job, err) => console.error(`Job failed: ${job?.id}`, err.message));
  return worker;
}
