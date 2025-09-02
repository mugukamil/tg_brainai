import { describe, it, expect, vi } from 'vitest';
vi.mock('../src/handlers/goapi-handler.js', () => ({
  isValidAspectRatio: () => true,
}));

const importUtils = async () => await import('../src/handlers/handler-utils.js');

describe('safeEditMessageText', () => {
  it('swallows ETELEGRAM edit not found error', async () => {
    const bot = {
      editMessageText: vi.fn().mockRejectedValue({
        code: 'ETELEGRAM',
        response: { body: { description: 'Bad Request: message to edit not found' } },
      }),
    } as any;

    const { safeEditMessageText } = await importUtils();
    await expect(safeEditMessageText(bot, 1, 1, 'hi')).resolves.toBeUndefined();
    expect(bot.editMessageText).toHaveBeenCalled();
  });
});


