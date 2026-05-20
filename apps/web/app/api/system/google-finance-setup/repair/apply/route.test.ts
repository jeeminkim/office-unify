import { describe, expect, it, vi, beforeEach } from 'vitest';

const applyRepair = vi.fn();
const requireAuth = vi.fn();

vi.mock('@/lib/server/persona-chat-auth', () => ({
  requirePersonaChatAuth: () => requireAuth(),
}));

vi.mock('@/lib/server/googleSheetsRepair', () => ({
  runGoogleSheetsRepairCore: (...args: unknown[]) => applyRepair(...args),
}));

describe('POST /api/system/google-finance-setup/repair/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuth.mockResolvedValue({ ok: true });
  });

  it('returns 400 when confirm is not true', async () => {
    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://local/api/system/google-finance-setup/repair/apply', {
        method: 'POST',
        body: JSON.stringify({ confirm: false }),
      }),
    );
    expect(res.status).toBe(400);
    const j = (await res.json()) as { status: string };
    expect(j.status).toBe('confirmation_required');
    expect(applyRepair).not.toHaveBeenCalled();
  });

  it('calls apply when confirm true', async () => {
    applyRepair.mockResolvedValue({
      ok: true,
      status: 'applied',
      appliedOperations: ['write_portfolio_quotes_sample'],
      skippedOperations: [],
      qualityMeta: { writeAction: true, confirmed: true, idempotent: false },
    });
    const { POST } = await import('./route');
    const res = await POST(
      new Request('http://local/api/system/google-finance-setup/repair/apply', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      }),
    );
    expect(res.status).toBe(200);
    expect(applyRepair).toHaveBeenCalledWith(expect.objectContaining({ confirm: true }));
  });
});
