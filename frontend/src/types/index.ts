export type EmailRow = { id: string; recipient: string; subject: string; scheduledAt: string; sentAt?: string | null; status: 'SCHEDULED'|'PROCESSING'|'SENT'|'FAILED'; };
export type User = { id: string; name: string; email: string; avatarUrl?: string; slackConnected: boolean; };
