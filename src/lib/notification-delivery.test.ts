import { deliverNotification } from './notification-delivery';

const originalWebhookUrl = process.env.NOTIFICATION_WEBHOOK_URL;
const originalResendApiKey = process.env.RESEND_API_KEY;
const originalFromEmail = process.env.NOTIFICATION_FROM_EMAIL;

const payload = {
  recipient: 'manager@example.com',
  subject: 'Test notification',
  message: 'This is a test notification.',
};

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('deliverNotification', () => {
  beforeEach(() => {
    delete process.env.NOTIFICATION_WEBHOOK_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_FROM_EMAIL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreEnvironmentVariable('NOTIFICATION_WEBHOOK_URL', originalWebhookUrl);
    restoreEnvironmentVariable('RESEND_API_KEY', originalResendApiKey);
    restoreEnvironmentVariable('NOTIFICATION_FROM_EMAIL', originalFromEmail);
  });

  it('fails explicitly when no delivery provider is configured', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(deliverNotification(payload)).rejects.toThrow(
      'Notification delivery is not configured.'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('delivers through the configured webhook', async () => {
    process.env.NOTIFICATION_WEBHOOK_URL = 'https://webhook.example/notifications';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deliverNotification(payload)).resolves.toBe('webhook');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://webhook.example/notifications',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
  });

  it('delivers through Resend when email credentials are configured', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.NOTIFICATION_FROM_EMAIL = 'notifications@example.com';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await expect(deliverNotification(payload)).resolves.toBe('email');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-resend-key',
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('fails explicitly when email credentials are incomplete', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';

    await expect(deliverNotification(payload)).rejects.toThrow(
      'Notification delivery is not configured.'
    );
  });
});
