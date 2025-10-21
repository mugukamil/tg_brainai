import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import type { TelegramMessage, RequestType } from '@/types/index.js';
import {
  generateVideoWithFal,
  submitFalVideoTask,
  waitForFalVideoTaskCompletion,
  validateFalVideoOptions,
  isFalVideoConfigured,
  parseVideoCommand,
  formatVideoStatusMessage,
} from '@/handlers/fal-video-handler.js';
import { decreaseRequests, canConsumeRequest } from '@/handlers/supabase-handler.js';
import { safeEditMessageText } from '@/handlers/handler-utils.js';
import { logInteraction } from '@/utils/logger.js';

// Helper function to detect media type from URL
function getMediaType(url: string): 'video' | 'animation' | 'document' {
  const urlLower = url.toLowerCase();

  // Check file extension
  const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase();

  // GIF detection
  if (extension === 'gif' || urlLower.includes('.gif') || urlLower.includes('format=gif')) {
    return 'animation';
  }

  // Video formats
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(extension || '')) {
    return 'video';
  }

  // Check URL patterns
  if (urlLower.includes('/gif/') || urlLower.includes('type=gif')) {
    return 'animation';
  }

  // Default to video for Kling outputs
  return 'video';
}

/**
 * Handle video generation with fal.ai Kling (image-to-video)
 * This requires both a prompt and an image URL
 */
export async function handleFalVideoGeneration(
  bot: TelegramBot,
  msg: TelegramMessage,
  imageUrl: string,
): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';

  if (!isFalVideoConfigured()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация видео Nano Banana в настоящее время недоступна. Проверьте конфигурацию FAL_KEY.',
    );
    return;
  }

  const userId = msg.from?.id;
  if (!userId) return;

  const canUse = await canConsumeRequest(userId, 'video_req_left' as RequestType);
  if (!canUse) {
    await bot.sendMessage(
      chatId,
      '❌ У вас закончились видео-запросы. Оформите премиум в разделе ✨ Премиум.',
    );
    return;
  }

  // Parse command and validate
  const params = parseVideoCommand(text, imageUrl);
  const validation = validateFalVideoOptions(params);

  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, '🎬 Запуск генерации видео с Kling...');

  try {
    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'user',
      type: 'video',
      content: params.prompt,
      meta: { image_url: imageUrl, duration: params.duration },
    });

    // Submit task to queue
    console.log('Submitting video task to fal.ai...');
    const submitResult = await submitFalVideoTask(params.prompt, imageUrl, {
      duration: params.duration,
      ...(params.negative_prompt && { negative_prompt: params.negative_prompt }),
      ...(params.cfg_scale !== undefined && { cfg_scale: params.cfg_scale }),
    });

    if (!submitResult.success || !submitResult.data?.request_id) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка запуска: ${submitResult.error?.message ?? 'Неизвестная ошибка'}`,
      );
      return;
    }

    const requestId = submitResult.data.request_id;
    console.log('Task submitted with ID:', requestId);

    await safeEditMessageText(bot, chatId, statusMsg.message_id, '⏳ Задача в очереди...');

    // Wait for completion with polling
    const maxWaitTime = 600000; // 10 minutes
    const pollInterval = 5000; // 5 seconds
    let attempts = 0;
    const maxAttempts = maxWaitTime / pollInterval;

    const pollTimer = setInterval(async () => {
      attempts++;

      try {
        const result = await waitForFalVideoTaskCompletion(requestId, pollInterval, pollInterval);

        if (result.success && result.data?.data?.video?.url) {
          clearInterval(pollTimer);

          const videoUrl = result.data.data.video.url;
          const mediaType = getMediaType(videoUrl);
          const caption = `🎬 ${mediaType === 'animation' ? 'Анимация' : 'Видео'} по запросу: ${params.prompt}\n\n📸 Длительность: ${params.duration}с`;

          console.log(`Sending media as ${mediaType}:`, videoUrl);

          try {
            switch (mediaType) {
              case 'animation':
                await bot.sendAnimation(chatId, videoUrl, { caption });
                break;
              case 'video':
                await bot.sendVideo(chatId, videoUrl, {
                  caption,
                  duration: parseInt(params.duration),
                  supports_streaming: true,
                });
                break;
              case 'document':
                await bot.sendDocument(chatId, videoUrl, { caption });
                break;
            }
          } catch (sendError) {
            console.error(`Failed to send as ${mediaType}, trying as document:`, sendError);
            // Fallback to document if specific method fails
            try {
              await bot.sendDocument(chatId, videoUrl, {
                caption: `📎 Медиа файл: ${params.prompt}`,
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
            userId: userId!,
            chatId,
            direction: 'bot',
            type: 'video',
            content: videoUrl,
            meta: { prompt: params.prompt, duration: params.duration },
          });

          await decreaseRequests(userId, 'video_req_left' as RequestType, 1);

          try {
            await bot.deleteMessage(chatId, statusMsg.message_id);
          } catch {}
        } else if (result.success && result.data?.status) {
          // Update status message
          const statusText = formatVideoStatusMessage(result.data.status);
          await safeEditMessageText(bot, chatId, statusMsg.message_id, statusText);
        } else if (!result.success) {
          clearInterval(pollTimer);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            `❌ Ошибка генерации: ${result.error?.message ?? 'Неизвестная ошибка'}`,
          );

          await logInteraction({
            userId: userId!,
            chatId,
            direction: 'bot',
            type: 'video',
            content: `❌ Ошибка: ${result.error?.message}`,
            meta: { prompt: params.prompt },
          });
        } else if (attempts >= maxAttempts) {
          clearInterval(pollTimer);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            '⏰ Превышено время ожидания генерации видео. Попробуйте позже.',
          );
        }
      } catch (error: unknown) {
        console.error('Error during video polling:', error);
        clearInterval(pollTimer);
        await safeEditMessageText(
          bot,
          chatId,
          statusMsg.message_id,
          `❌ Ошибка мониторинга: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }, pollInterval);

    // Safety timeout to clear interval
    setTimeout(() => {
      clearInterval(pollTimer);
    }, maxWaitTime + 5000);
  } catch (error: unknown) {
    console.error('Error in handleFalVideoGeneration:', error);
    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      `❌ Ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
    );

    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'bot',
      type: 'video',
      content: `❌ Ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }
}

/**
 * Handle direct video generation (simplified version using subscribe)
 * For faster, simpler generation without queue management
 */
export async function handleFalVideoGenerationDirect(
  bot: TelegramBot,
  msg: TelegramMessage,
  imageUrl: string,
): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text || msg.caption || '';

  if (!isFalVideoConfigured()) {
    await bot.sendMessage(chatId, '❌ Генерация видео в настоящее время недоступна.');
    return;
  }

  const userId = msg.from?.id;
  if (!userId) return;

  const canUse = await canConsumeRequest(userId, 'video_req_left' as RequestType);
  if (!canUse) {
    await bot.sendMessage(
      chatId,
      '❌ У вас закончились видео-запросы. Оформите премиум в разделе ✨ Премиум.',
    );
    return;
  }

  // Parse command and validate
  const params = parseVideoCommand(text, imageUrl);
  const validation = validateFalVideoOptions(params);

  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, '🎬 Генерация видео с Kling...');

  try {
    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'user',
      type: 'video',
      content: params.prompt,
      meta: { image_url: imageUrl, duration: params.duration },
    });

    // Use direct generation with subscribe (real-time updates)
    const result = await generateVideoWithFal(params.prompt, imageUrl, {
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
    const mediaType = getMediaType(videoUrl);
    const caption = `🎬 ${mediaType === 'animation' ? 'Анимация' : 'Видео'} по запросу: ${params.prompt}\n\n📸 Длительность: ${params.duration}с`;

    console.log(`Sending media as ${mediaType}:`, videoUrl);

    try {
      switch (mediaType) {
        case 'animation':
          await bot.sendAnimation(chatId, videoUrl, { caption });
          break;
        case 'video':
          await bot.sendVideo(chatId, videoUrl, {
            caption,
            duration: parseInt(params.duration),
            supports_streaming: true,
          });
          break;
        case 'document':
          await bot.sendDocument(chatId, videoUrl, { caption });
          break;
      }
    } catch (sendError) {
      console.error(`Failed to send as ${mediaType}, trying as document:`, sendError);
      try {
        await bot.sendDocument(chatId, videoUrl, {
          caption: `📎 Медиа файл: ${params.prompt}`,
        });
      } catch (docError) {
        console.error('Failed to send as document:', docError);
        await bot.sendMessage(
          chatId,
          `✅ Генерация завершена!\n\nСсылка на результат: ${videoUrl}\n\nЗапрос: ${params.prompt}`,
        );
      }
    }

    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'bot',
      type: 'video',
      content: videoUrl,
      meta: { prompt: params.prompt, duration: params.duration },
    });

    await decreaseRequests(userId, 'video_req_left' as RequestType, 1);

    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch {}
  } catch (error: unknown) {
    console.error('Error in handleFalVideoGenerationDirect:', error);
    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      `❌ Ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
    );

    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'bot',
      type: 'video',
      content: `❌ Ошибка: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }
}
