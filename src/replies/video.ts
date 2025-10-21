import { logInteraction } from '@/utils/logger';
import { TelegramLikeBot } from '@/tg-client';
import { updateUser } from '@/handlers/supabase-handler';
import { DbUser } from '@/types';

export const videoReply = async (
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

  if (user.current_mode !== 'video') {
    await updateUser(userId, { current_mode: 'video' });
  }

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '✅ Kling 2.5 Turbo Pro',
          callback_data: JSON.stringify({ action: 'video_provider_info' }),
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
    `🎬 **Генерация видео**\n\n` +
      `**Текущий провайдер:** Kling 2.5 Turbo Pro\n\n` +
      `**Возможности:**\n` +
      `• 📝 Text-to-Video - создание видео из текстового описания\n` +
      `• 🖼️ Image-to-Video - анимация изображений\n` +
      `• ⏱️ Продолжительность: 5-10 секунд\n` +
      `• 🎨 Высокое качество кинематографической анимации\n` +
      `• ⚡ Автоматическое определение режима\n\n` +
      `**Как использовать:**\n` +
      `• Отправьте текст для создания видео из описания\n` +
      `• Отправьте изображение с подписью для анимации фото\n\n` +
      `Напишите описание видео или отправьте изображение с подписью 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    },
  );
};
