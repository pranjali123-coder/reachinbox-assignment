import { prisma } from '../db/prisma.js';

export async function notifyRateLimit(userId: string, senderEmail: string, limit: number) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { slackToken: true } });
  if (!user?.slackToken) return;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST', headers: { Authorization: `Bearer ${user.slackToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel: 'me', text: `ReachInbox rate limit reached for ${senderEmail}. Hourly limit: ${limit}. Remaining emails were rescheduled.` })
  });
  const data = await response.json() as any;
  if (!data.ok) throw new Error(`Slack notification failed: ${data.error}`);
}
