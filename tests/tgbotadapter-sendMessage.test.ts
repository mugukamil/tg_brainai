import { describe, it, expect, vi } from 'vitest';

class FakeClient {
  token = 'X';
  constructor(_t: string) {}
  async sendMessage(opts: any) {
    return { id: Math.random(), messageId: Math.floor(Math.random() * 1000), text: opts.text, chatId: opts.chatId };
  }
  on() {}
  async sendPhoto() { return {}; }
  async sendChatAction() {}
  async getFile() { return { file_path: 'file' }; }
  async editMessageText() {}
  async deleteMessage() {}
  async answerCallbackQuery() {}
  async getMe() { return { id: 1, username: 'u', first_name: 'f' }; }
}

vi.mock('telegramsjs', () => ({ TelegramClient: FakeClient }));

describe('TgBotAdapter.sendMessage', async () => {
  const { TgBotAdapter } = await import('../src/tg-client.js');

  it('splits long messages into chunks and preserves reply markup on first chunk', async () => {
    const adapter = new TgBotAdapter('token');
    const spy = vi.spyOn((adapter as any).client, 'sendMessage');

    const long = 'a'.repeat(5000);
    await adapter.sendMessage(1, long, { reply_markup: { k: 1 } });

    expect(spy).toHaveBeenCalled();
    const calls = spy.mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    expect(calls[0][0].replyMarkup).toBeDefined();
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i][0].replyMarkup).toBeUndefined();
    }
  });
});


