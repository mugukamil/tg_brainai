import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import { canConsumeRequest, decreaseRequests, getUserStats } from '@/handlers/supabase-handler.js';
import { createMessage, getAssistantResponse } from '@/handlers/openai-handler.js';
import { createMainKeyboard } from '@/handlers/handler-utils.js';
import { logInteraction } from '@/utils/logger.js';
import { DbUser, TelegramMessage } from '@/types/index.js';

export async function handleTextGeneration(
  bot: TelegramBot,
  msg: TelegramMessage,
  user: DbUser,
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  if (!userId || !text) return;
  const allowed = await canConsumeRequest(userId, 'text_req_left');
  if (!allowed) {
    const stats = await getUserStats(userId);
    await bot.sendMessage(
      chatId,
      `У вас закончились запросы\nТекстовые запросы: ${stats?.text_req_left ?? 0}\nГенерация изображений: ${stats?.image_req_left ?? 0}\nВидео запросы: ${stats?.video_req_left ?? 0}`,
    );
    return;
  }
  try {
    await bot.sendChatAction(chatId, 'typing');
    if (user.openai_thread_id) {
      await createMessage(user.openai_thread_id, text);
      const response = await getAssistantResponse(user.openai_thread_id);
      await logInteraction({
        userId,
        chatId,
        direction: 'bot',
        type: 'text',
        content: response,
      });
      await bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        reply_markup: createMainKeyboard(),
      });
    } else {
      await bot.sendMessage(chatId, '❌ Не найден OpenAI thread для пользователя.');
    }
    await decreaseRequests(userId, 'text_req_left');
  } catch (error) {
    console.error('Ошибка в handleTextGeneration:', error);
    await bot.sendMessage(
      chatId,
      '❌ Ошибка при обработке вашего сообщения. Пожалуйста, попробуйте снова.',
    );
  }
}

export async function handleVoiceMessage(bot: TelegramBot, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  try {
    await bot.sendChatAction(chatId, 'typing');
    // Voice handling delegated to main msg-handler to keep scope narrow here if needed later
  } catch (error) {
    console.error('Ошибка в handleVoiceMessage:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при обработке голосового сообщения.');
  }
}
