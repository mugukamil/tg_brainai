import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import axios from 'axios';
import { isValidAspectRatio } from './goapi-handler.js';
import type {
  ImageGenerationParams,
  ProcessingMode,
  TelegramReplyKeyboard,
} from '../types/index.js';

export const ongoingTasks = new Map<number, boolean>();

export function createMainKeyboard(): TelegramReplyKeyboard {
  return {
    keyboard: [
      [{ text: '🎨 Генерация изображений' }, { text: '📝 ChatGPT' }],
      [{ text: '🎬 Генерация видео' }, { text: '✨ Премиум' }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

export function parseImageCommand(text: string): ImageGenerationParams {
  const params: ImageGenerationParams = {
    prompt: text,
    aspect_ratio: '1:1',
    process_mode: 'fast',
    skip_prompt_check: false,
    service_mode: 'public',
  };

  const arMatch = text.match(/--ar\s+(\d+:\d+)/i);
  if (arMatch?.[1] && isValidAspectRatio(arMatch[1])) {
    params.aspect_ratio = arMatch[1];
    params.prompt = text.replace(/--ar\s+\d+:\d+/i, '').trim();
  }

  const modeMatch = text.match(/--(fast|turbo|relax)/i);
  if (modeMatch?.[1]) {
    params.process_mode = modeMatch[1].toLowerCase() as ProcessingMode;
    params.prompt = text.replace(/--(fast|turbo|relax)/i, '').trim();
  }

  params.prompt = params.prompt.replace(/\s+/g, ' ').trim();
  return params;
}

export function formatImageStatus(status: string, progress = 0): string {
  const statusEmojis: Record<string, string> = {
    pending: '⏳',
    processing: '🎨',
    completed: '✅',
    failed: '❌',
    staged: '📋',
  };
  const emoji = statusEmojis[status] ?? '🤖';
  let message = `${emoji} Статус: ${status}`;
  if (progress > 0 && progress < 100) {
    const progressBar =
      '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
    message += `\n[${progressBar}] ${progress}%`;
  }
  return message;
}

export async function fetchImageBuffer(
  imageUrl: string,
): Promise<{ buffer: Buffer; contentType?: string; filename: string }> {
  const response = await axios.get<ArrayBuffer>(imageUrl, { responseType: 'arraybuffer' });
  const contentType = (response.headers['content-type'] as string | undefined) ?? 'image/png';
  const ext = contentType.split('/')[1] ?? 'png';
  const filename = `image.${ext}`;
  return { buffer: Buffer.from(response.data), contentType, filename };
}

export async function safeEditMessageText(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  try {
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId });
  } catch (error) {
    const errorObj = error as {
      response?: { body?: { description?: string } };
      message?: string;
      code?: string;
    };
    const desc: string | undefined = errorObj?.response?.body?.description ?? errorObj?.message;
    const code: string | undefined = errorObj?.code;
    if (code === 'ETELEGRAM' && desc && /message to edit not found/i.test(desc)) {
      return;
    }
    console.error('editMessageText failed:', error);
  }
}
