import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export async function sendViaEthereal(params: { from: string; to: string; subject: string; text: string }) {
  if (!env.ETHEREAL_USER || !env.ETHEREAL_PASS) throw new Error('Ethereal credentials are not configured');
  const transporter = nodemailer.createTransport({ host: env.ETHEREAL_HOST, port: env.ETHEREAL_PORT, secure: false, auth: { user: env.ETHEREAL_USER, pass: env.ETHEREAL_PASS } });
  const info = await transporter.sendMail(params);
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) };
}
