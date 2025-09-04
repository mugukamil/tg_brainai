import type { TelegramLikeBot as TelegramBot } from '../../tg-client.js';
import { findUser, canConsumeRequest, getUserStats } from '../supabase-handler.js';
import { showTermsOfService, hasAcceptedTerms } from '../terms-handler.js';
import { transcribeAudio } from '../openai-handler.js';
import { handleTextGeneration } from './text.js';

export async function handleVoiceMessage(bot: TelegramBot, msg: any): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  if (!userId) return;
  try {
    const user = await findUser(userId);
    if (!user) return;
    const allowed = await canConsumeRequest(userId, 'text_req_left');
    if (!allowed) {
      const stats = await getUserStats(userId);
      await bot.sendMessage(
        chatId,
        `❌ Нет запросов. Осталось: Текст ${stats?.text_req_left ?? 0}`,
      );
      return;
    }
    const termsAccepted = await hasAcceptedTerms(userId);
    if (!termsAccepted) {
      await showTermsOfService(bot, chatId, userId);
      return;
    }
    await bot.sendChatAction(chatId, 'typing');
    if (!msg.voice) {
      await bot.sendMessage(chatId, '❌ Голосовое сообщение не найдено.');
      return;
    }
    const fileId = msg.voice.file_id;
    const fileLink = await bot.getFileLink(fileId);
    const transcription = await transcribeAudio(fileLink);
    if (transcription?.text) {
      const syntheticMsg = { ...msg, text: transcription.text, from: msg.from };
      await bot.sendMessage(chatId, `🎤 Расшифрованное сообщение: "${transcription.text}"`);
      await handleTextGeneration(bot, syntheticMsg, user);
    } else {
      await bot.sendMessage(
        chatId,
        '❌ Не удалось расшифровать голосовое сообщение. Пожалуйста, попробуйте снова.',
      );
    }
  } catch (error) {
    console.error('Ошибка в handleVoiceMessage:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при обработке голосового сообщения.');
  }
}
