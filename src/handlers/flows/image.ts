import type { TelegramLikeBot as TelegramBot } from '../../tg-client.js';
import type { BotUser, ProcessingMode, PaymentMode } from '../../types/index.js';
import { generateImage, getTaskStatus } from '../goapi-handler.js';
import { decreaseRequests, hasRequestsLeft } from '../supabase-handler.js';
import { createMainKeyboard, fetchImageBuffer, formatImageStatus, ongoingTasks, safeEditMessageText, parseImageCommand } from '../handler-utils.js';
import { logInteraction } from '../../utils/logger.js';

export async function handlePhotoGeneration(
  bot: TelegramBot,
  msg: any,
  user: BotUser,
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;

  if (!userId || !text) {
    return;
  }

  if (!hasRequestsLeft(user, 'image_req_left')) {
    await bot.sendMessage(
      chatId,
      `У вас закончились запросы\nТекстовые запросы: ${user.text_req_left}\nГенерация изображений: ${user.image_req_left}\nВидео запросы: ${user.video_req_left}`,
    );
    return;
  }

  if (ongoingTasks.has(userId)) {
    await bot.sendMessage(
      chatId,
      '⏳ Пожалуйста, дождитесь завершения создания текущего изображения, прежде чем начинать создание нового.',
    );
    return;
  }

  const params = parseImageCommand(text);
  if (!params.prompt || params.prompt.length < 3) {
    await bot.sendMessage(
      chatId,
      '❌ Пожалуйста, предоставьте более подробную подсказку для генерации изображения.',
    );
    return;
  }

  ongoingTasks.set(userId, true);
  const statusMsg = await bot.sendMessage(chatId, '🖼 Генерируется изображение ...');

  try {
    const generateResult = await generateImage(params.prompt, {
      aspect_ratio: params.aspect_ratio,
      process_mode: params.process_mode as ProcessingMode,
      skip_prompt_check: params.skip_prompt_check,
      service_mode: params.service_mode as PaymentMode,
    });

    if (!generateResult.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка: ${generateResult.error?.message || 'Не удалось начать генерацию видео'}`,
      );
      return;
    }

    const taskId = generateResult.data?.data?.task_id;
    if (!taskId) {
      await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Нет task ID в ответе');
      return;
    }

    let lastStatus = '';
    const maxAttempts = 60;
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      try {
        attempts++;
        const statusResult = await getTaskStatus(taskId);
        if (!statusResult.success) {
          clearInterval(pollInterval);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            `❌ Ошибка при проверке статуса: ${statusResult.error?.message}`,
          );
          return;
        }

        const taskData = statusResult.data?.data;
        if (!taskData) return;
        const currentStatus = taskData.status;
        const progress = taskData.output?.progress || 0;

        if (currentStatus !== lastStatus || progress > 0) {
          lastStatus = currentStatus;
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            formatImageStatus(currentStatus, progress),
          );
        }

        if (currentStatus === 'completed') {
          clearInterval(pollInterval);
          const imageUrl = taskData.output.image_url;
          if (imageUrl) {
            try {
              const { buffer, filename, contentType } = await fetchImageBuffer(imageUrl);
              const fileOptions: any = contentType ? { filename, contentType } : { filename };
              await bot.sendPhoto(
                chatId,
                buffer,
                {
                  caption: `Сгенерированное изображение: "${params.prompt}"\nСоотношение сторон: ${params.aspect_ratio}\nРежим: ${params.process_mode}`,
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '1', callback_data: JSON.stringify({ t_id: taskId, idx: 1 }) },
                        { text: '2', callback_data: JSON.stringify({ t_id: taskId, idx: 2 }) },
                        { text: '3', callback_data: JSON.stringify({ t_id: taskId, idx: 3 }) },
                        { text: '4', callback_data: JSON.stringify({ t_id: taskId, idx: 4 }) },
                      ],
                    ],
                  },
                },
                fileOptions,
              );
            } catch (e) {
              await bot.sendPhoto(chatId, imageUrl, {
                caption: `Сгенерированное изображение: "${params.prompt}"\nСоотношение сторон: ${params.aspect_ratio}\nРежим: ${params.process_mode}`,
              });
            }
            await logInteraction({ userId: userId!, chatId, direction: 'bot', type: 'image', content: imageUrl, meta: { prompt: params.prompt, aspect_ratio: params.aspect_ratio, mode: params.process_mode } });
            try {
              await bot.deleteMessage(chatId, statusMsg.message_id);
            } catch {}
            await decreaseRequests(userId, 'image_req_left', 1);
            await bot.sendMessage(chatId, 'Выберите номер изображения 1-4👇', {
              reply_markup: createMainKeyboard(),
            });
          } else {
            await safeEditMessageText(
              bot,
              chatId,
              statusMsg.message_id,
              '❌ Генерация изображения завершена, но URL-адрес изображения не получен.',
            );
          }
        } else if (currentStatus === 'failed') {
          clearInterval(pollInterval);
          await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Ошибка попробуйте другой запрос');
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            '⏰ Время генерации истекло. Попробуйте ещё раз, используя более простую подсказку.',
          );
        }
      } catch (error) {
        clearInterval(pollInterval);
        console.error('Ошибка в polling:', error);
        await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Ошибка при мониторинге прогресса генерации.');
      }
    }, 5000);
  } catch (error) {
    console.error('Ошибка в handlePhotoGeneration:', error);
    await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Неожиданная ошибка при генерации изображения.');
  } finally {
    ongoingTasks.delete(userId);
  }
}


