export interface NotificationPayload {
  recipient: string;
  subject: string;
  message: string;
}

export async function deliverNotification(payload: NotificationPayload): Promise<'email' | 'webhook' | 'queued'> {
  const webhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Notification webhook returned ${response.status}`);
    return 'webhook';
  }

  if (process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFICATION_FROM_EMAIL, to: [payload.recipient], subject: payload.subject, text: payload.message }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
    return 'email';
  }

  return 'queued';
}
