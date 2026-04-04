import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendAlertDeliveryEmail } from '../alert-delivery-email.js';

const sendAlertNotification = vi.fn().mockResolvedValue(undefined);

vi.mock('../prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    listing: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../config.js', () => ({
  config: { appUrl: 'https://app.matchprop.test' },
}));

vi.mock('../../services/mailer/index.js', () => ({
  isSendGridAvailableForSend: vi.fn(() => Promise.resolve(true)),
  getMailerForSend: vi.fn(() =>
    Promise.resolve({
      sendMagicLink: vi.fn(),
      sendAlertNotification,
    })
  ),
}));

import { prisma } from '../prisma.js';

describe('sendAlertDeliveryEmail', () => {
  beforeEach(() => {
    sendAlertNotification.mockClear();
    vi.mocked(prisma.user.findUnique).mockReset();
    vi.mocked(prisma.listing.findUnique).mockReset();
  });

  it('no envía si el usuario no tiene email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: null } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValue({
      title: 'Casa',
      price: 100,
      currency: 'USD',
    } as never);
    await sendAlertDeliveryEmail({
      userId: 'u1',
      listingId: 'l1',
      alertType: 'NEW_LISTING',
    });
    expect(sendAlertNotification).not.toHaveBeenCalled();
  });

  it('envía con SendGrid disponible y datos mínimos', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: 'buyer@test.com' } as never);
    vi.mocked(prisma.listing.findUnique).mockResolvedValue({
      title: 'Depto centro',
      price: 250000,
      currency: 'USD',
    } as never);
    await sendAlertDeliveryEmail({
      userId: 'u1',
      listingId: 'l1',
      alertType: 'PRICE_DROP',
    });
    expect(sendAlertNotification).toHaveBeenCalledTimes(1);
    const arg = sendAlertNotification.mock.calls[0]![0];
    expect(arg.to).toBe('buyer@test.com');
    expect(arg.subject).toContain('MatchProp');
    expect(arg.text).toContain('l1');
    expect(arg.html).toContain('/listing/l1');
  });
});
