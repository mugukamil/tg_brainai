import { createMainKeyboard } from '@/handlers/handler-utils';
import { logInteraction } from '@/utils/logger';
import { TelegramLikeBot } from '@/tg-client';

export const startReply = async (
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
  await bot.sendMessage(
    chatId,
    `Привет! Этот бот открывает доступ к лучшим ИИ-инструментам для создания текста, изображений, видео.

  Попробуйте продвинутые модели: ChatGPT 5, Midjourney, Kling и другие.

  Как пользоваться:

  📝 ТЕКСТ: просто задайте вопрос или отправьте изображение в чат (выберите модель с помощью /model).

  🔎 ПОИСК: нажмите /s для умного веб-поиска.

  🌅 ИЗОБРАЖЕНИЯ: выберите /photo для генерации или редактирования картинок.

  🎬 ВИДЕО: нажмите /video, чтобы создать клип (доступно в /premium).
  📸➡️🎬 В режиме видео: отправьте изображение с подписью для создания видео из фото.`,
    { reply_markup: createMainKeyboard() },
  );
};
