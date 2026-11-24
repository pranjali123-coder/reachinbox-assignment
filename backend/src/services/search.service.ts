import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env.js';

export const es = new Client({ node: env.ELASTICSEARCH_URL });
const INDEX = 'emails';

export async function ensureIndex() {
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) await es.indices.create({ index: INDEX, mappings: { properties: {
    recipient: { type: 'text' }, subject: { type: 'text' }, body: { type: 'text' }, status: { type: 'keyword' }, scheduledAt: { type: 'date' }, sentAt: { type: 'date' }, userId: { type: 'keyword' }
  } } });
}

export async function indexEmail(email: any) {
  await es.index({ index: INDEX, id: email.id, document: {
    userId: email.userId, recipient: email.recipient, subject: email.subject, body: email.body,
    status: email.status, scheduledAt: email.scheduledAt, sentAt: email.sentAt
  }, refresh: 'wait_for' });
}

export async function searchEmails(userId: string, q: string) {
  const result = await es.search({ index: INDEX, query: { bool: { must: q ? [{ multi_match: { query: q, fields: ['recipient', 'subject', 'body'] } }] : [{ match_all: {} }], filter: [{ term: { userId } }] } }, sort: [{ scheduledAt: 'desc' }] });
  return result.hits.hits.map((h: any) => ({ id: h._id, ...h._source }));
}
