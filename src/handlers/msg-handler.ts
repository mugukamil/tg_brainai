import type { TelegramLikeBot as TelegramBot, TgMessage } from '../tg-client.js';
import type { RequestType, TelegramMessage, TelegramPreCheckoutQuery } from '@/types/index.js';

import { analyzeImage } from './openai-handler.js';
import { decreaseRequests, canConsumeRequest, getUserStats } from './supabase-handler.js';
import {
  handlePreCheckout,
  handleSuccessfulPayment,
  showPricing,
  checkPaymentStatus,
} from './payment-handler.js';
import { showTermsOfService, hasAcceptedTerms } from './terms-handler.js';
import {
  createMainKeyboard,
  helpMessage,
  safeEditMessageText,
  isBotBlockedError,
  safeSendMessage,
} from './handler-utils.js';
import { handlePhotoGeneration } from '../flows/image.js';
import { handleVideoGeneration } from '../flows/video.js';
import { handleTextGeneration } from '../flows/text.js';

import {
  generateVideoWithFal,
  validateFalVideoOptions,
  isFalVideoConfigured,
  parseVideoCommand as parseFalVideoCommand,
} from './fal-video-handler.js';
import { logInteraction } from '@/utils/logger.js';
import { findOrCreate } from '@/findOrCreate.js';
import { startReply } from '../replies/start.js';
import { textReply } from '../replies/text.js';
import { photoReply } from '../replies/photo.js';
import { videoReply } from '../replies/video.js';

export { handleVoiceMessage } from '../flows/voice.js';
export { handleCallbackQuery } from '../flows/callbacks.js';
export { handlePreCheckout, handleSuccessfulPayment } from './payment-handler.js';

export async function handleTextMessage(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;

  if (!userId || !text) {
    return;
  }

  try {
    const user = await findOrCreate(userId);

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Не удалось инициализировать пользователя. Пожалуйста, попробуйте снова.',
      );
      return;
    }

    switch (text) {
      case '/start':
        await startReply(userId, chatId, text, bot);
        return;
      case '📝 ChatGPT':
      case '/text':
        await textReply(user, userId, chatId, text, bot);
        return;
      case '🎨 Генерация изображений':
      case '/photo':
        await photoReply(user, userId, chatId, text, bot);
        return;
      case '🎬 Генерация видео':
      case '/video':
        await videoReply(user, userId, chatId, text, bot);
        return;
      case '✨ Премиум':
      case '/pay':
        await showPricing(bot, chatId);
        return;
      case '/status':
        await checkPaymentStatus(bot, chatId, userId);
        return;
      case '/help':
        await bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
        return;
    }

    const currentMode = user.current_mode ?? 'text';

    await logInteraction({
      userId,
      chatId,
      direction: 'user',
      type: 'text',
      content: text,
    });
    if (currentMode === 'photo') {
      await handlePhotoGeneration(bot, msg as any);
    } else if (currentMode === 'video') {
      await handleVideoGeneration(bot, msg as any);
    } else {
      await handleTextGeneration(bot, msg as any, user);
    }
  } catch (error) {
    console.error('Ошибка в handleTextMessage:', error);
    // Don't try to send a message if the user blocked the bot
    if (!isBotBlockedError(error)) {
      await safeSendMessage(
        bot,
        chatId,
        '❌ Произошла неожиданная ошибка. Пожалуйста, попробуйте снова позже.',
      );
    }
  }
}

async function handleImageAnalysis(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId || !msg.photo) return;

  const allowed = await canConsumeRequest(userId, 'text_req_left');
  if (!allowed) {
    const stats = await getUserStats(userId);
    await bot.sendMessage(
      chatId,
      `❌ У вас закончились запросы на анализ изображения.\nОсталось: Текст ${stats?.text_req_left ?? 0}, Изображения ${stats?.image_req_left ?? 0}, Видео ${stats?.video_req_left ?? 0}`,
    );
    return;
  }

  await bot.sendChatAction(chatId, 'typing');

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
}

export async function handlePhotoMessage(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId || !msg.photo) return;

  try {
    const user = await findOrCreate(userId);

    if (!user) {
      await bot.sendMessage(
        chatId,
        '❌ Не удалось инициализировать пользователя. Пожалуйста, попробуйте снова.',
      );
      return;
    }
    await bot.sendChatAction(chatId, 'typing');

    const currentMode = user.current_mode ?? 'text';
    console.log(currentMode, 'CURRENT_MODE');

    switch (currentMode) {
      case 'text':
        await handleImageAnalysis(bot, msg);
        break;
      case 'photo':
        await handlePhotoGeneration(bot, msg as any);
        break;
      case 'video':
        await handleImageToVideo(bot, msg as any);
        break;
      default:
        await bot.sendMessage(chatId, '❌ Неверный режим');
        break;
    }
  } catch (e) {
    console.log(e);
  }
}

async function handleImageToVideo(bot: TelegramBot, msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const prompt = msg.caption || 'Создать видео на основе этого изображения';

  if (!userId || !msg.photo) return;

  // Check fal.ai video generation availability
  if (!isFalVideoConfigured()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация видео в настоящее время недоступна. Проверьте конфигурацию FAL_KEY.',
    );
    return;
  }

  // Check video requests quota
  const canUse = await canConsumeRequest(userId, 'video_req_left');
  if (!canUse) {
    await bot.sendMessage(
      chatId,
      '❌ У вас закончились видео-запросы. Оформите премиум в разделе ✨ Премиум.',
    );
    return;
  }

  // Check terms acceptance
  const termsAccepted = await hasAcceptedTerms(userId);
  if (!termsAccepted) {
    await showTermsOfService(bot, chatId, userId);
    return;
  }

  const photoId = msg.photo[msg.photo.length - 1]!.file_id;
  const fileLink = await bot.getFileLink(photoId);

  // Parse video parameters with image using fal.ai handler
  const params = parseFalVideoCommand(prompt, fileLink);
  const validation = validateFalVideoOptions(params);

  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, '🎬 Генерация видео с Kling...');

  try {
    await logInteraction({
      userId: userId,
      chatId,
      direction: 'user',
      type: 'video',
      content: `Image-to-video: ${params.prompt}`,
      meta: { image_url: fileLink, duration: params.duration },
    });

    // Use fal.ai Kling for video generation
    const result = await generateVideoWithFal(params.prompt, fileLink, {
      duration: params.duration,
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      ...(params.cfg_scale !== undefined && { cfg_scale: params.cfg_scale }),
    });

    if (!result.success || !result.data?.data?.video?.url) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка генерации: ${result.error?.message ?? 'Неизвестная ошибка'}`,
      );
      return;
    }

    const videoUrl = result.data.data.video.url;
    const caption = `🎬 Видео из изображения: ${params.prompt}\n\n📸 Длительность: ${params.duration}с`;

    console.log('Sending video:', videoUrl);

    try {
      // Try sending as video first
      await bot.sendVideo(chatId, videoUrl, {
        caption,
        duration: parseInt(params.duration),
        supports_streaming: true,
      });
    } catch (sendError) {
      console.error('Failed to send video, trying as document:', sendError);
      try {
        await bot.sendDocument(chatId, videoUrl, {
          caption: `📎 Видео файл: ${params.prompt}`,
        });
      } catch (docError) {
        console.error('Failed to send as document:', docError);
        // Last resort: send URL as text
        await bot.sendMessage(
          chatId,
          `✅ Генерация завершена!\n\nСсылка на результат: ${videoUrl}\n\nЗапрос: ${params.prompt}`,
        );
      }
    }

    await logInteraction({
      userId: userId,
      chatId,
      direction: 'bot',
      type: 'video',
      content: videoUrl,
      meta: { prompt: params.prompt, type: 'image-to-video', duration: params.duration },
    });

    await decreaseRequests(userId, 'video_req_left' as RequestType, 1);

    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch {}
  } catch (e: unknown) {
    console.error('Error in handleImageToVideo:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    await safeEditMessageText(bot, chatId, statusMsg.message_id, `❌ Ошибка: ${errorMessage}`);
  }
}

// handleCallbackQuery delegated to flows/callbacks.ts

export async function handlePreCheckoutQuery(
  bot: TelegramBot,
  preCheckoutQuery: TelegramPreCheckoutQuery,
): Promise<void> {
  await handlePreCheckout(bot, preCheckoutQuery as any);
}

export async function handleSuccessfulPaymentMessage(
  bot: TelegramBot,
  message: TelegramMessage,
): Promise<void> {
  await handleSuccessfulPayment(bot, message as any);
}
