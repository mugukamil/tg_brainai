import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import type {
  CallbackData,
  ImageProvider,
  TelegramCallbackQuery,
  FileOptions,
} from '@/types/index.js';
import {
  findUser,
  canConsumeRequest,
  decreaseRequests,
  getUserStats,
  updateUser,
} from '@/handlers/supabase-handler.js';
import { getTaskStatus, upscaleImage } from '@/handlers/goapi-handler.js';
import { safeEditMessageText, fetchImageBuffer } from '@/handlers/handler-utils.js';
import { logInteraction } from '@/utils/logger.js';
import { handlePaymentCallback } from '@/handlers/payment-handler.js';
import { handleTermsCallback } from '@/handlers/terms-handler.js';
import { createMainKeyboard } from '@/handlers/handler-utils.js';

export async function handleCallbackQuery(
  bot: TelegramBot,
  callbackQuery: TelegramCallbackQuery,
): Promise<void> {
  const msg = callbackQuery.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;

  try {
    const paymentHandled = await handlePaymentCallback(bot, callbackQuery as any);
    if (paymentHandled) return;
  } catch {}
  try {
    const termsHandled = await handleTermsCallback(bot, callbackQuery);
    if (termsHandled) return;
  } catch {}

  if (!callbackQuery.data) return;
  let data: CallbackData;
  try {
    data = JSON.parse(callbackQuery.data);
  } catch {
    // Not a JSON callback, ignore silently
    return;
  }

  // Handle provider switching
  if (data.action === 'set_provider') {
    const provider = data.provider as ImageProvider;
    if (provider === 'goapi' || provider === 'fal-ai') {
      try {
        await updateUser(userId, { image_provider: provider });

        const keyboard = {
          inline_keyboard: [
            [
              {
                text: provider === 'goapi' ? '✅ (Midjourney)' : '(Midjourney)',
                callback_data: JSON.stringify({ action: 'set_provider', provider: 'goapi' }),
              },
            ],
            [
              {
                text: provider === 'fal-ai' ? '🍌 (Nano Banana)' : '(Nano Banana)',
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

        try {
          await bot.editMessageText(
            `🎨 **Генерация изображений**\n\n` +
              `**Текущий провайдер:** ${provider === 'goapi' ? '(Midjourney)' : '🍌 (Nano Banana)'}\n\n` +
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
              chat_id: chatId,
              message_id: msg.message_id,
              parse_mode: 'Markdown',
              reply_markup: keyboard,
            },
          );
        } catch (editError) {
          console.error('Error editing message:', editError);
        }

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Провайдер изменен на ${provider === 'goapi' ? '(Midjourney)' : '🍌 (Nano Banana)'}`,
        });
      } catch (error) {
        console.error('Error updating image provider:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Ошибка при изменении провайдера',
          show_alert: true,
        });
      }
    }
    return;
  }

  // Handle back to main menu
  if (data.action === 'back_to_main') {
    try {
      await bot.editMessageText('🤖 Главное меню', {
        chat_id: chatId,
        message_id: msg.message_id,
      });
      await bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: createMainKeyboard(),
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error returning to main menu:', error);
    }
    return;
  }

  // Handle video provider info
  if (data.action === 'video_provider_info') {
    try {
      await bot.editMessageText(
        `🎬 **Kling 2.5 Turbo Pro - Информация о провайдере**\n\n` +
          `**Технические характеристики:**\n` +
          `• 🎯 Модель: Kling 2.5 Turbo Pro\n` +
          `• ⏱️ Длительность: 5-10 секунд\n` +
          `• 📐 Соотношения сторон: 16:9, 9:16, 1:1\n` +
          `• 🎨 Разрешение: до 1080p\n\n` +
          `**Режимы генерации:**\n` +
          `• 📝 **Text-to-Video** - создание с нуля по описанию\n` +
          `• 🖼️ **Image-to-Video** - анимация загруженных изображений\n\n` +
          `**Особенности:**\n` +
          `• ⚡ Быстрая обработка (30-90 секунд)\n` +
          `• 🎭 Кинематографическое качество\n` +
          `• 🧠 Умное понимание промптов\n` +
          `• 🔄 Автоматическое определение режима`,
        {
          chat_id: chatId,
          message_id: msg.message_id,
        },
      );
      // Send keyboard with separate message
      await bot.sendMessage(chatId, 'Дополнительные действия:', {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад к генерации видео',
                callback_data: JSON.stringify({ action: 'back_to_video' }),
              },
            ],
            [
              {
                text: '🏠 Главное меню',
                callback_data: JSON.stringify({ action: 'back_to_main' }),
              },
            ],
          ],
        },
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error showing video provider info:', error);
    }
    return;
  }

  // Handle back to video generation
  if (data.action === 'back_to_video') {
    try {
      await bot.editMessageText(
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
          chat_id: chatId,
          message_id: msg.message_id,
        },
      );
      // Send keyboard with separate message
      await bot.sendMessage(chatId, 'Выберите действие:', {
        reply_markup: {
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
        },
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error returning to video generation:', error);
    }
    return;
  }

  // Handle proceed to image generation
  if (data.action === 'proceed_to_generation') {
    try {
      await bot.editMessageText(
        `✅ **Готов к генерации изображений!**\n\n` +
          `Теперь просто отправьте текстовое описание изображения, которое вы хотите создать.\n\n` +
          `**Примеры промптов:**\n` +
          `• "Красивый закат над океаном"\n` +
          `• "Кот в космическом костюме"\n` +
          `• "Футуристический город"\n` +
          `• "Портрет девушки в стиле аниме"\n\n` +
          `📝 **Отправьте ваш промпт сейчас!**`,
        {
          chat_id: chatId,
          message_id: msg.message_id,
        },
      );
      // Send main keyboard for navigation
      await bot.sendMessage(chatId, 'Используйте кнопки для навигации:', {
        reply_markup: createMainKeyboard(),
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Error showing generation instructions:', error);
    }
    return;
  }

  const { t_id: taskId, idx: index } = data;
  if (index === undefined) {
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Неверный индекс',
      show_alert: true,
    });
    return;
  }
  const user = await findUser(userId);
  if (!user) return;
  const canUse = await canConsumeRequest(userId, 'image_req_left');
  if (!canUse) {
    const stats = await getUserStats(userId);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `❌ Нет запросов. Осталось: Изображения ${stats?.image_req_left ?? 0}`,
      show_alert: true,
    });
    return;
  }
  await bot.answerCallbackQuery(callbackQuery.id, { text: `Processing upscale ${index}...` });
  const statusMsg = await bot.sendMessage(chatId, `↗ Улучшаем качество изображения ...`);
  try {
    if (!taskId) {
      await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Неверный task ID');
      return;
    }
    const upscaleResult = await upscaleImage(taskId, index);
    if (!upscaleResult.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Улучшение изображения не удалось: ${upscaleResult.error?.message}`,
      );
      return;
    }
    const newTaskId = upscaleResult.data?.data?.task_id;
    if (!newTaskId) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Нет task ID улучшения изображения',
      );
      return;
    }
    const maxAttempts = 40;
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      try {
        attempts++;
        const statusResult = await getTaskStatus(newTaskId);
        if (statusResult.success) {
          const taskData = statusResult.data?.data;
          if (!taskData) return;
          const status = taskData.status;
          if (status === 'completed') {
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
                  { caption: `✅ Улучшенное изображение ${index}` },
                  fileOptions,
                );
              } catch {
                await bot.sendPhoto(chatId, imageUrl, {
                  caption: `✅ Улучшенное изображение ${index}`,
                });
              }
              await logInteraction({
                userId,
                chatId,
                direction: 'bot',
                type: 'image',
                content: imageUrl,
                meta: { upscaledIndex: index },
              });
              try {
                await bot.deleteMessage(chatId, statusMsg.message_id);
              } catch {}
              await decreaseRequests(userId, 'image_req_left', 1);
            } else {
              await safeEditMessageText(
                bot,
                chatId,
                statusMsg.message_id,
                '❌ Улучшение изображения завершено, но нет изображения',
              );
            }
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            await safeEditMessageText(
              bot,
              chatId,
              statusMsg.message_id,
              '❌ Ошибка, попробуйте другой запрос',
            );
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            await safeEditMessageText(
              bot,
              chatId,
              statusMsg.message_id,
              '⏰ Улучшение изображения завершено',
            );
          }
        }
      } catch (error) {
        clearInterval(pollInterval);
        console.error('Ошибка в polling улучшения изображения:', error);
      }
    }, 5000);
  } catch (error) {
    console.error('Ошибка в handleCallbackQuery:', error);
    await safeEditMessageText(bot, chatId, statusMsg.message_id, '❌ Ошибка при обработке запроса');
  }
}
