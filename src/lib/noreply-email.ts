import nodemailer from 'nodemailer';
import { SITE_DOMAIN } from '@/lib/urls';

/**
 * No-reply transport for automated developer emails (welcome, live-access).
 * Gmail SMTP with app-password auth; never throws - a mail failure must not
 * break the signup that triggered it.
 */

const NOREPLY_ADDRESS = process.env.NOREPLY_FROM || `no-reply@${SITE_DOMAIN}`;
const NOREPLY_FROM = `Resms <${NOREPLY_ADDRESS}>`;

const AUTH_USER = process.env.NOREPLY_GMAIL_USER || process.env.GMAIL_USER;
const AUTH_PASS = process.env.NOREPLY_GMAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;
// 587/STARTTLS fallback for boxes that block outbound 465.
const SMTP_PORT = Number(process.env.NOREPLY_SMTP_PORT) || 465;

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: AUTH_USER, pass: AUTH_PASS },
});

export function isNoReplyConfigured(): boolean {
  return !!(AUTH_USER && AUTH_PASS);
}

export async function sendNoReplyMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!opts.to || !emailRegex.test(opts.to)) return false;
  if (!isNoReplyConfigured()) return false;
  try {
    await transporter.sendMail({
      from: NOREPLY_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (error) {
    console.error('[NoReplyMail] send failed:', error);
    return false;
  }
}
