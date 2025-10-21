import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import type { TelegramMessage, RequestType } from '@/types/index.js';
import {
  generateVideoWithFal,
  validateFalVideoOptions,
  isFalVideoConfigured,
  parseVideoCommand,
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

export async function handleVideoGeneration(bot: TelegramBot, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;

  if (!isFalVideoConfigured()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация видео в настоящее время недоступна. Проверьте конфигурацию FAL_KEY.',
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

  // Parse command without image URL (text-to-video)
  const params = parseVideoCommand(text);
  const validation = validateFalVideoOptions(params);

  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  const statusMsg = await bot.sendMessage(chatId, '🎬 Генерация видео с Kling (text-to-video)...');

  try {
    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'user',
      type: 'video',
      content: params.prompt,
      meta: { duration: params.duration, type: 'text-to-video' },
    });

    // Use fal.ai Kling for text-to-video generation
    const result = await generateVideoWithFal(params.prompt, undefined, {
      duration: params.duration,
      ...(params.aspect_ratio && { aspect_ratio: params.aspect_ratio }),
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
      meta: { prompt: params.prompt, duration: params.duration, type: 'text-to-video' },
    });

    await decreaseRequests(userId, 'video_req_left' as RequestType, 1);

    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch {}
  } catch (e: unknown) {
    console.error('Error in handleVideoGeneration:', e);
    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      `❌ Ошибка: ${e instanceof Error ? e.message : 'unknown'}`,
    );

    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'bot',
      type: 'video',
      content: `❌ Ошибка: ${e instanceof Error ? e.message : 'unknown'}`,
    });
  }
}
