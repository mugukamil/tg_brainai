import { logInteraction } from '@/utils/logger';
import { TelegramLikeBot } from '@/tg-client';
import { updateUser } from '@/handlers/supabase-handler';
import { DbUser } from '@/types';

export const photoReply = async (
  user: DbUser,
  userId: number,
  chatId: number,
  text: string,
  bot: TelegramLikeBot,
) => {
  await logInteraction({
    userId,
    chatId,
    direction: 'user',
    type: 'text',
    content: text,
  });

  if (user.current_mode !== 'photo') {
    await updateUser(userId, { current_mode: 'photo' });
  }

  const currentProvider = (user as any).image_provider || 'goapi';

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: currentProvider === 'goapi' ? '✅ (Midjourney)' : '(Midjourney)',
          callback_data: JSON.stringify({ action: 'set_provider', provider: 'goapi' }),
        },
      ],
      [
        {
          text: currentProvider === 'fal-ai' ? '🍌 (Nano Banana)' : '(Nano Banana)',
          callback_data: JSON.stringify({ action: 'set_provider', provider: 'fal-ai' }),
        },
      ],
      [
        {
          text: '🚀 Начать генерацию',
          callback_data: JSON.stringify({ action: 'proceed_to_generation' }),
        },
      ],
      [
        {
          text: '🔙 Главное меню',
          callback_data: JSON.stringify({ action: 'back_to_main' }),
        },
      ],
    ],
  };

  await bot.sendMessage(
    chatId,
    `🎨 **Генерация изображений**\n\n` +
      `**Текущий провайдер:** ${currentProvider === 'goapi' ? '(Midjourney)' : '🍌 (Nano Banana)'}\n\n` +
      `**(Midjourney):**\n` +
      `• Высокое качество художественных изображений\n` +
      `• Стилизованная генерация\n` +
      `• Поддержка upscale и вариаций\n` +
      `• Редактирование изображений\n\n` +
      `**(Nano Banana):**\n` +
      `• Фотореалистичные изображения\n` +
      `• Быстрая генерация\n` +
      `• Хорошее понимание текста\n` +
      `Выберите провайдера для генерации изображений:`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    },
  );
};
