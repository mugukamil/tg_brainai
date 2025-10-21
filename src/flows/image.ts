import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import type {
  ProcessingMode,
  PaymentMode,
  ImageProvider,
  TelegramMessage,
  FileOptions,
} from '@/types/index.js';
import { generateImage, getTaskStatus } from '@/handlers/goapi-handler.js';
import { handleFalPhotoGeneration } from './image-fal.js';
import { decreaseRequests, canConsumeRequest, getUserStats } from '@/handlers/supabase-handler.js';
import {
  createMainKeyboard,
  fetchImageBuffer,
  formatImageStatus,
  ongoingTasks,
  safeEditMessageText,
  parseImageCommand,
} from '@/handlers/handler-utils.js';
import { logInteraction } from '@/utils/logger.js';
import { findOrCreate } from '@/findOrCreate.js';

export async function handlePhotoGeneration(bot: TelegramBot, msg: TelegramMessage): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const caption = msg.caption;
  const photoId = msg.photo ? msg.photo[msg.photo.length - 1]!.file_id : null;
  const image_url = photoId ? await bot.getFileLink(photoId) : undefined;

  if (!userId || (!text && !caption)) {
    return;
  }

  // Get user to check preferred image provider
  const user = await findOrCreate(userId);
  if (!user) {
    await bot.sendMessage(chatId, '❌ Не удалось получить информацию о пользователе.');
    return;
  }

  // Get the user's preferred image provider
  const imageProvider: ImageProvider = (user as any).image_provider || 'goapi';

  // Route to appropriate handler based on provider
  if (imageProvider === 'fal-ai') {
    await handleFalPhotoGeneration(bot, msg);
    return;
  }

  // Continue with goapi implementation for backward compatibility
  if (!text) {
    return;
  }

  const allowed = await canConsumeRequest(userId, 'image_req_left');
  if (!allowed) {
    const stats = await getUserStats(userId);
    await bot.sendMessage(
      chatId,
      `У вас закончились запросы\nТекстовые запросы: ${stats?.text_req_left ?? 0}\nГенерация изображений: ${stats?.image_req_left ?? 0}\nВидео запросы: ${stats?.video_req_left ?? 0}`,
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

  const params = parseImageCommand(text ?? caption);
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
      task_type: 'describe',
      ...(image_url && { image_url }),
    });

    if (!generateResult.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка: ${generateResult.error?.message ?? 'Не удалось начать генерацию видео'}`,
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
        const progress = taskData.output?.progress ?? 0;

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
              const fileOptions: FileOptions = contentType
                ? { filename, contentType }
                : { filename };
              await bot.sendPhoto(
                chatId,
                buffer,
                {
                  caption: `Сгенерированное изображение: "${params.prompt}"\nСоотношение сторон: ${params.aspect_ratio}\nРежим: ${params.process_mode}`,
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: '1',
                          callback_data: JSON.stringify({
                            t_id: taskId,
                            idx: 1,
                          }),
                        },
                        {
                          text: '2',
                          callback_data: JSON.stringify({
                            t_id: taskId,
                            idx: 2,
                          }),
                        },
                        {
                          text: '3',
                          callback_data: JSON.stringify({
                            t_id: taskId,
                            idx: 3,
                          }),
                        },
                        {
                          text: '4',
                          callback_data: JSON.stringify({
                            t_id: taskId,
                            idx: 4,
                          }),
                        },
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
            await logInteraction({
              userId: userId!,
              chatId,
              direction: 'bot',
              type: 'image',
              content: imageUrl,
              meta: {
                prompt: params.prompt,
                aspect_ratio: params.aspect_ratio,
                mode: params.process_mode,
              },
            });
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
          await safeEditMessageText(
            bot,
            chatId,
            statusMsg.message_id,
            '❌ Ошибка попробуйте другой запрос',
          );
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
        await safeEditMessageText(
          bot,
          chatId,
          statusMsg.message_id,
          '❌ Ошибка при мониторинге прогресса генерации.',
        );
      }
    }, 10000);
  } catch (error) {
    console.error('Ошибка в handlePhotoGeneration:', error);
    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      '❌ Неожиданная ошибка при генерации изображения.',
    );
  } finally {
    ongoingTasks.delete(userId);
  }
}
