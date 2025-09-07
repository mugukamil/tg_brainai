import type { TelegramLikeBot as TelegramBot } from '../../tg-client.js';
import {
  isAvailable as isVideoAvailable,
  parseVideoCommand,
  validateParams as validateVideoParams,
  generateVideo,
  getPredictionStatus,
} from '../video-handler.js';
import { decreaseRequests, canConsumeRequest } from '../supabase-handler.js';
import { safeEditMessageText } from '../handler-utils.js';
import { logInteraction } from '../../utils/logger.js';

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

export async function handleVideoGeneration(bot: TelegramBot, msg: any): Promise<void> {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text) return;
  if (!isVideoAvailable()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация видео в настоящее время недоступна. Обратитесь в службу поддержки.',
    );
    return;
  }
  const userId = msg.from?.id;
  if (!userId) return;
  const canUse = await canConsumeRequest(userId, 'video_req_left' as any);
  if (!canUse) {
    await bot.sendMessage(
      chatId,
      '❌ У вас закончились видео-запросы. Оформите премиум в разделе ✨ Премиум.',
    );
    return;
  }
  const params = parseVideoCommand(text);
  const validation = validateVideoParams(params);
  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }
  const statusMsg = await bot.sendMessage(chatId, '🎬 Генерация видео запущена...');
  try {
    await logInteraction({
      userId: userId!,
      chatId,
      direction: 'user',
      type: 'video',
      content: params.prompt,
    });
    const start = await generateVideo(params.prompt, params);
    if (!start.success || !start.data?.prediction_id) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка запуска: ${start.error?.message ?? 'unknown'}`,
      );
      return;
    }
    const id = start.data.prediction_id;
    let attempts = 0;
    const maxAttempts = 180; // up to 15 min at 5s interval
    let lastStatus = '';
    let transientErrors = 0;
    const maxTransientErrors = 5;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const st = await getPredictionStatus(id);
        if (!st.success) {
          transientErrors++;
          if (transientErrors >= maxTransientErrors) {
            clearInterval(timer);
            await safeEditMessageText(
              bot,
              chatId,
              statusMsg.message_id,
              `❌ Ошибка статуса: ${st.error?.message ?? 'Неизвестная ошибка'}`,
            );
            return;
          }
          return; // skip this tick, continue polling
        }
        transientErrors = 0;
        const status = st.data?.status ?? 'processing';
        if (status !== lastStatus) {
          lastStatus = status;
          await safeEditMessageText(bot, chatId, statusMsg.message_id, `🎬 Статус: ${status}`);
        }
        if (status === 'succeeded') {
          clearInterval(timer);
          const url = Array.isArray(st.data?.output) ? st.data?.output[0] : undefined;
          if (url) {
            const mediaType = getMediaType(url);
            const caption = `🎬 ${mediaType === 'animation' ? 'Анимация' : 'Видео'} по запросу: ${params.prompt}`;

            console.log(`Sending media as ${mediaType}:`, url);

            try {
              switch (mediaType) {
                case 'animation':
                  await bot.sendAnimation(chatId, url, { caption });
                  break;
                case 'video':
                  await bot.sendVideo(chatId, url, {
                    caption,
                    duration: params.duration,
                    supports_streaming: true,
                    width: 1280,
                    height: 720,
                  });
                  break;
                case 'document':
                  await bot.sendDocument(chatId, url, { caption });
                  break;
              }
            } catch (sendError) {
              console.error(`Failed to send as ${mediaType}, trying as document:`, sendError);
              // Fallback to document if specific method fails
              try {
                await bot.sendDocument(chatId, url, {
                  caption: `📎 Медиа файл: ${params.prompt}`,
                });
              } catch (docError) {
                console.error('Failed to send as document:', docError);
                // Last resort: send URL as text
                await bot.sendMessage(
                  chatId,
                  `✅ Генерация завершена!\n\nСсылка на результат: ${url}\n\nЗапрос: ${params.prompt}`,
                );
              }
            }
            await logInteraction({
              userId: userId!,
              chatId,
              direction: 'bot',
              type: 'video',
              content: url,
              meta: { prompt: params.prompt },
            });
            await decreaseRequests(userId, 'video_req_left' as any, 1);
            try {
              await bot.deleteMessage(chatId, statusMsg.message_id);
            } catch {}
          } else {
            await logInteraction({
              userId: userId!,
              chatId,
              direction: 'bot',
              type: 'video',
              content: '✅ Видео готово, но URL не получен.',
              meta: { prompt: params.prompt },
            });
            await safeEditMessageText(
              bot,
              chatId,
              statusMsg.message_id,
              '✅ Видео готово, но URL не получен.',
            );
          }
        } else if (status === 'failed') {
          await logInteraction({
            userId: userId!,
            chatId,
            direction: 'bot',
            type: 'video',
            content: '❌ Задача не выполнена. Попробуйте другой запрос.',
            meta: { prompt: params.prompt },
          });
          clearInterval(timer);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            '❌ Задача не выполнена. Попробуйте другой запрос.',
          );
        } else if (attempts >= maxAttempts) {
          clearInterval(timer);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            '⏰ Тайм-аут ожидания видео. Попробуйте снова.',
          );
        }
      } catch (e: any) {
        console.log(e);
        await logInteraction({
          userId: userId!,
          chatId,
          direction: 'bot',
          type: 'video',
          content: e.message,
        });
        clearInterval(timer);
        await safeEditMessageText(
          bot,
          chatId,
          statusMsg.message_id,
          '❌ Ошибка мониторинга видео.',
        );
      }
    }, 5000);
  } catch (e: any) {
    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      `❌ Ошибка: ${e?.message ?? 'unknown'}`,
    );
  }
}
