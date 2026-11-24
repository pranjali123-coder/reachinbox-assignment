import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';

export const emailQueue = new Queue('email-send', { connection: redis as any, defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000, attempts: 5 } });
export const queueConnection = redis as any;
export { env };
