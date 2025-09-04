import type { TelegramLikeBot as TelegramBot, TgMessage } from '../tg-client.js';
import { analyzeImage, createThread } from './openai-handler.js';
import {
  findUser,
  createUser,
  updateUser,
  decreaseRequests,
  canConsumeRequest,
  getUserStats,
} from './supabase-handler.js';
import {
  handlePreCheckout,
  handleSuccessfulPayment,
  showPricing,
  checkPaymentStatus,
} from './payment-handler.js';
import { showTermsOfService, hasAcceptedTerms } from './terms-handler.js';
import { createMainKeyboard } from './handler-utils.js';
import { handlePhotoGeneration } from './flows/image.js';
import { handleVideoGeneration } from './flows/video.js';
import { handleTextGeneration } from './flows/text.js';
import { logInteraction } from '../utils/logger.js';
export { handleVoiceMessage } from './flows/voice.js';
export { handleCallbackQuery } from './flows/callbacks.js';

export async function handleTextMessage(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;

  if (!userId || !text) {
    return;
  }

  try {
    let user = await findUser(userId);
    if (!user) {
      const thread = await createThread();
      user = await createUser(userId, thread.id);
    }

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Не удалось инициализировать пользователя. Пожалуйста, попробуйте снова.',
      );
      return;
    }

    if (text.startsWith('/start')) {
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

Попробуйте продвинутые модели: ChatGPT 5, /Midjourney, Veo 3 и другие.

Бесплатно доступны: GPT-4.1 mini, DeepSeek, Gemini 2.5, GPT Images и Perplexity web search.

Как пользоваться:

📝 ТЕКСТ: просто задайте вопрос или отправьте изображение в чат (выберите модель с помощью /model).

🔎 ПОИСК: нажмите /s для умного веб-поиска.

🌅 ИЗОБРАЖЕНИЯ: выберите /photo для генерации или редактирования картинок.

🎬 ВИДЕО: нажмите /video, чтобы создать клип (доступно в /premium).`,
        { reply_markup: createMainKeyboard() },
      );
      return;
    }

    if (text === '📝 ChatGPT' || text === '/text') {
      if (user.current_mode !== 'text') {
        await updateUser(userId, { current_mode: 'text' });
      }
      await bot.sendMessage(chatId, 'Вы в режиме ChatGPT. Напишите в чат 👇', {
        reply_markup: createMainKeyboard(),
      });
      return;
    }

    if (text === '🎨 Генерация изображений' || text === '/photo') {
      if (user.current_mode !== 'photo') {
        await updateUser(userId, { current_mode: 'photo' });
      }
      await bot.sendMessage(chatId, 'Напишите инструкцию в чат 👇 для создания изображения', {
        reply_markup: createMainKeyboard(),
      });
      return;
    }

    if (text === '🎬 Генерация видео' || text === '/video') {
      if (user.current_mode !== 'video') {
        await updateUser(userId, { current_mode: 'video' });
      }
      await bot.sendMessage(chatId, 'Напишите инструкцию в чат 👇 для видео', {
        reply_markup: createMainKeyboard(),
      });
      return;
    }

    if (text === '✨ Премиум' || text === '/pay') {
      await showPricing(bot, chatId);
      return;
    }

    if (text === '/status') {
      await checkPaymentStatus(bot, chatId, userId);
      return;
    }

    if (text === '/help') {
      const helpMessage = `📖 **Справка по BrainAI Bot**

              🖼 **Команды режима фотографий:**
              • Отправьте любой текст для генерации 4 изображений
              • --ar 16:9 : Установить соотношение сторон
              • --fast : Быстрая генерация
              • --turbo : Самая быстрая генерация
              • --relax : Медленнее, но бесплатная генерация

              🎬 **Команды режима видео:**
              • Отправьте текст для генерации видео
              • --res 720p : Установить разрешение
              • --dur 10 : Установить продолжительность в секундах
              • --fps 30 : Установить кадры в секунду

              💬 **Команды текстового режима:**
              • Отправьте любое сообщение для чата с ИИ
              • Отправляйте голосовые сообщения (автоматическая транскрипция)
              • Отправляйте изображения с подписями для анализа

              ⚡ **Быстрые команды:**
              /photo - Переключиться в режим изображений
              /text - Переключиться в текстовый режим
              /video - Переключиться в режим видео
              /status - Проверить использование
              /help - Показать эту справку`;

      await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
      return;
    }

    // Check if terms are accepted before processing content
    const termsAccepted = await hasAcceptedTerms(userId);
    if (!termsAccepted) {
      await showTermsOfService(bot, chatId, userId);
      return;
    }

    // Get current user data with updated info
    user = await findUser(userId);
    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Пользователь не найден. Пожалуйста, попробуйте /start сначала.',
      );
      return;
    }

    // Handle different modes
    const currentMode = user.current_mode ?? 'text';

    await logInteraction({
      userId,
      chatId,
      direction: 'user',
      type: 'text',
      content: text,
    });
    if (currentMode === 'photo') {
      await handlePhotoGeneration(bot, msg);
    } else if (currentMode === 'video') {
      await handleVideoGeneration(bot, msg);
    } else {
      await handleTextGeneration(bot, msg, user);
    }
  } catch (error) {
    console.error('Ошибка в handleTextMessage:', error);
    await bot.sendMessage(
      chatId,
      '❌ Произошла неожиданная ошибка. Пожалуйста, попробуйте снова позже.',
    );
  }
}

// handleVideoGeneration and handleTextGeneration are delegated to flows

// handleVoiceMessage exported from flows/voice.ts

export async function handlePhotoMessage(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId || !msg.photo) {
    return;
  }

  try {
    const user = await findUser(userId);
    if (!user) return;
    const allowed = await canConsumeRequest(userId, 'text_req_left');
    if (!allowed) {
      const stats = await getUserStats(userId);
      await bot.sendMessage(
        chatId,
        `❌ У вас закончились запросы на анализ изображения.\nОсталось: Текст ${stats?.text_req_left ?? 0}, Изображения ${stats?.image_req_left ?? 0}, Видео ${stats?.video_req_left ?? 0}`,
      );
      return;
    }

    // Check terms acceptance
    const termsAccepted = await hasAcceptedTerms(userId);
    if (!termsAccepted) {
      await showTermsOfService(bot, chatId, userId);
      return;
    }

    await bot.sendChatAction(chatId, 'typing');

    if (!msg.photo || msg.photo.length === 0 || !userId) {
      await bot.sendMessage(chatId, '❌ Фото не найдено.');
      return;
    }

    const photoId = msg.photo[msg.photo.length - 1]!.file_id;
    const fileLink = await bot.getFileLink(photoId);

    // Set MIME type for image processing
    const analysis = await analyzeImage(
      fileLink,
      msg.caption ?? 'caption: \n\nanswer in russian language if other not specified!',
    );

    await bot.sendMessage(chatId, analysis, {
      parse_mode: 'Markdown',
      reply_markup: createMainKeyboard(),
    });

    await decreaseRequests(userId, 'text_req_left');
  } catch (error) {
    console.error('Ошибка в handlePhotoMessage:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при анализе изображения.');
  }
}

// handleCallbackQuery delegated to flows/callbacks.ts

export async function handlePreCheckoutQuery(
  bot: TelegramBot,
  preCheckoutQuery: any,
): Promise<void> {
  await handlePreCheckout(bot, preCheckoutQuery);
}

export async function handleSuccessfulPaymentMessage(
  bot: TelegramBot,
  message: any,
): Promise<void> {
  await handleSuccessfulPayment(bot, message);
}
