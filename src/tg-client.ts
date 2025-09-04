import { TelegramClient } from 'telegramsjs';

import type { Message, CallbackQuery, PreCheckoutQuery, User } from '@telegram.ts/types';

type ChatAction =
  | 'typing'
  | 'upload_photo'
  | 'record_audio'
  | 'upload_audio'
  | 'upload_document'
  | 'find_location'
  | 'record_video'
  | 'upload_video'
  | 'choose_sticker'
  | 'record_voice'
  | 'upload_voice'
  | 'record_video_note'
  | 'upload_video_note';

export type TgMessage = Message;

export type TgCallbackQuery = CallbackQuery & { message?: Message };

export type TgPreCheckoutQuery = PreCheckoutQuery;

export type Update = {
  update_id?: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
  pre_checkout_query?: TgPreCheckoutQuery;
};

export type EventName =
  | 'message'
  | 'callbackQuery'
  | 'preCheckoutQuery'
  | 'inlineQuery'
  | 'chosenInlineResult'
  | 'channelPost'
  | 'editedMessage'
  | 'error'
  // legacy snake_case accepted for compatibility with existing code
  | 'callback_query'
  | 'pre_checkout_query'
  | 'inline_query'
  | 'chosen_inline_result'
  | 'channel_post'
  | 'edited_message'
  | 'polling_error'
  | 'webhook_error';

export class TgBotAdapter {
  private client: TelegramClient;
  private token: string;

  constructor(token: string) {
    const TG: any = TelegramClient;
    if (!TG) throw new Error('TelegramsJS export TelegramBot not found');
    this.token = token;
    this.client = new TG(token);
  }

  on(event: EventName, handler: (payload: any) => void): void {
    if (event === 'message') {
      this.client.on('message', (m: any) => handler(this.mapMessage(m)) as any);
      return;
    }
    if (event === 'callbackQuery' || event === 'callback_query') {
      this.client.on('callbackQuery', (q: any) => handler(this.mapCallbackQuery(q)) as any);
      return;
    }
    if (event === 'preCheckoutQuery' || event === 'pre_checkout_query') {
      this.client.on('preCheckoutQuery', (q: any) => handler(this.mapPreCheckoutQuery(q)) as any);
      return;
    }
    if (event === 'inlineQuery' || event === 'inline_query') {
      this.client.on('inlineQuery', handler as any);
      return;
    }
    if (event === 'chosenInlineResult' || event === 'chosen_inline_result') {
      this.client.on('chosenInlineResult', handler as any);
      return;
    }
    if (event === 'channelPost' || event === 'channel_post') {
      this.client.on('channelPost', handler as any);
      return;
    }
    if (event === 'editedMessage' || event === 'edited_message') {
      this.client.on('editedMessage', handler as any);
      return;
    }
    if (event === 'polling_error' || event === 'webhook_error') {
      this.client.on('error', handler as any);
      return;
    }
    this.client.on(event as any, handler as any);
  }

  async sendMessage(chatId: number, text: string, options?: any): Promise<TgMessage> {
    const MAX_TG_MESSAGE_LENGTH = 4096;
    const fullText = typeof text === 'string' ? text : String(text ?? '');

    const sendChunk = async (chunk: string, includeReplyMarkup: boolean) => {
      const raw = await this.client.sendMessage({
        chatId,
        text: chunk,
        parseMode: options?.parse_mode,
        replyMarkup: includeReplyMarkup ? options?.reply_markup : undefined,
      } as any);
      return this.mapMessage(raw);
    };

    if (fullText.length <= MAX_TG_MESSAGE_LENGTH) {
      return await sendChunk(fullText, true);
    }

    const chunks: string[] = [];
    let index = 0;
    while (index < fullText.length) {
      let end = Math.min(index + MAX_TG_MESSAGE_LENGTH, fullText.length);
      if (end < fullText.length) {
        let splitAt = fullText.lastIndexOf('\n', end - 1);
        if (splitAt < index) {
          splitAt = fullText.lastIndexOf(' ', end - 1);
        }
        if (splitAt >= index + 1000) {
          end = splitAt + 1;
        }
      }
      chunks.push(fullText.slice(index, end));
      index = end;
    }

    let lastMessage: TgMessage | undefined;
    for (let i = 0; i < chunks.length; i++) {
      lastMessage = await sendChunk(chunks[i]!, i === 0);
    }
    return lastMessage!;
  }

  async sendPhoto(
    chatId: number,
    data: Buffer | string,
    options?: any,
    _fileOptions?: { filename?: string; contentType?: string },
  ): Promise<TgMessage> {
    const msg = await this.client.sendPhoto({
      chatId,
      photo: data as any,
      caption: options?.caption,
      replyMarkup: options?.reply_markup,
    } as any);
    return this.mapMessage(msg);
  }

  async sendVideo(
    chatId: number,
    data: Buffer | string,
    options?: any,
    _fileOptions?: { filename?: string; contentType?: string },
  ): Promise<TgMessage> {
    const msg = await this.client.sendVideo({
      chatId,
      video: data as any,
      caption: options?.caption,
      replyMarkup: options?.reply_markup,
    } as any);
    return this.mapMessage(msg);
  }

  async sendChatAction(chatId: number, action: ChatAction): Promise<void> {
    await this.client.sendChatAction({ chatId, action: action as any } as any);
  }

  async getFileLink(fileId: string): Promise<string> {
    const file: any = await this.client.getFile(fileId);
    const token = this.token;
    const filePath: string = file?.file_path ?? file?.filePath ?? file?.file?.file_path ?? '';
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  }

  async editMessageText(
    text: string,
    params: { chat_id: number; message_id: number },
  ): Promise<void> {
    await this.client.editMessageText({
      chatId: params.chat_id,
      messageId: params.message_id,
      text,
    } as any);
  }

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    await this.client.deleteMessage(chatId, messageId);
  }

  async answerCallbackQuery(
    id: string,
    options?: { text?: string; show_alert?: boolean },
  ): Promise<void> {
    await this.client.answerCallbackQuery({
      callbackQueryId: id,
      text: options?.text,
      showAlert: options?.show_alert,
    } as any);
  }

  async answerPreCheckoutQuery(
    id: string,
    ok: boolean,
    options?: { error_message?: string },
  ): Promise<void> {
    await this.client.answerPreCheckoutQuery({
      preCheckoutQueryId: id,
      ok,
      errorMessage: options?.error_message,
    } as any);
  }

  async answerShippingQuery(
    id: string,
    ok: boolean,
    options?: { error_message?: string },
  ): Promise<void> {
    await this.client.answerShippingQuery({
      shippingQueryId: id,
      ok,
      errorMessage: options?.error_message,
    } as any);
  }

  async answerInlineQuery(id: string, results: any[], options?: any): Promise<void> {
    await this.client.answerInlineQuery({
      inlineQueryId: id,
      results,
      ...(options ?? {}),
    });
  }

  async sendInvoice(
    chatId: number,
    title: string,
    description: string,
    payload: string,
    providerToken: string,
    currency: string,
    prices: Array<{ label: string; amount: number }>,
    options?: any,
  ): Promise<void> {
    await this.client.sendInvoice({
      chatId,
      title,
      description,
      payload,
      providerToken,
      currency,
      prices: prices.map(p => ({ label: p.label, amount: p.amount })),
      startParameter: options?.start_parameter,
      photoUrl: options?.photo_url,
      photoSize: options?.photo_size,
      photoWidth: options?.photo_width,
      photoHeight: options?.photo_height,
      needName: options?.need_name,
      needPhoneNumber: options?.need_phone_number,
      needEmail: options?.need_email,
      needShippingAddress: options?.need_shipping_address,
      isFlexible: options?.is_flexible,
    } as any);
  }

  async getMe(): Promise<{ id: number; username?: string; first_name?: string }> {
    const user = await this.client.getMe();
    const u = user as unknown as User;
    return {
      id: (u as any).id,
      username: (u as any).username,
      first_name: (u as any).first_name,
    } as any;
  }

  async getWebHookInfo(): Promise<{ url?: string; allowed_updates?: string[] }> {
    const token = this.token;
    if (!token) {
      throw new Error('Bot token not available');
    }

    // Use raw API call to get webhook info with all details
    const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      method: 'GET',
    });

    const result = (await response.json()) as any;
    if (!result.ok) {
      console.error('Failed to get webhook info:', result);
      return { url: '' };
    }

    const webhookInfo = result.result;
    console.log(
      '📊 Webhook allowed updates:',
      webhookInfo.allowed_updates ?? 'default (messages only)',
    );

    return {
      url: webhookInfo.url,
      allowed_updates: webhookInfo.allowed_updates,
    } as any;
  }

  async setWebHook(url: string): Promise<boolean> {
    const token = this.token;
    if (!token) {
      throw new Error('Bot token not available');
    }

    // Use raw API call to set webhook with all update types
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        allowed_updates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'inline_query',
          'chosen_inline_result',
          'callback_query',
          'shipping_query',
          'pre_checkout_query',
          'poll',
          'poll_answer',
          'my_chat_member',
          'chat_member',
          'chat_join_request',
        ],
      }),
    });

    const result = (await response.json()) as any;
    if (!result.ok) {
      console.error('Failed to set webhook:', result);
      throw new Error(`Failed to set webhook: ${result.description ?? 'Unknown error'}`);
    }

    console.log('✅ Webhook set with all update types including pre_checkout_query');
    return true;
  }

  async deleteWebHook(): Promise<void> {
    await (this.client as any).deleteWebhook?.(false);
  }

  login(): void {
    this.client.login();
  }

  stopPolling(): Promise<void> {
    return Promise.resolve();
  }

  private mapMessage(m: any): TgMessage {
    const msg: any = { ...m };
    msg.message_id = msg.message_id ?? msg.id ?? msg.messageId;
    msg.text = msg.text ?? msg.content ?? undefined;
    msg.caption = msg.caption ?? undefined;
    msg.chat = msg.chat ?? { id: msg.chatId ?? msg.chat?.id };
    msg.from =
      msg.from ??
      (msg.author
        ? {
          id: msg.author.id,
          username: msg.author.username,
          first_name: msg.author.firstName,
        }
        : undefined);
    return msg as TgMessage;
  }

  private mapCallbackQuery(q: any): TgCallbackQuery {
    return q as TgCallbackQuery;
  }

  private mapPreCheckoutQuery(q: any): TgPreCheckoutQuery {
    const query: any = { ...q };
    // Ensure id field is properly mapped
    query.id = query.id ?? query.query_id ?? query.queryId ?? query.preCheckoutQueryId;
    // Map user data if needed
    if (query.from && !query.from.id && query.from.userId) {
      query.from.id = query.from.userId;
    }
    return query as TgPreCheckoutQuery;
  }
}

export type TelegramLikeBot = TgBotAdapter;
