import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import type { TelegramMessage, FileOptions } from '@/types/index.js';
import {
  generateImageWithFal,
  submitFalImageTask,
  waitForFalTaskCompletion,
  validateNanoBananaOptions,
  uploadFileToFal,
  isFalConfigured,
  type NanoBananaTextToImageRequest,
} from '@/handlers/fal-handler.js';
import { decreaseRequests, canConsumeRequest, getUserStats } from '@/handlers/supabase-handler.js';
import {
  createMainKeyboard,
  fetchImageBuffer,
  ongoingTasks,
  safeEditMessageText,
} from '@/handlers/handler-utils.js';
import { logInteraction } from '@/utils/logger.js';

/**
 * Parse fal.ai Nano Banana specific image command parameters
 */
function parseFalImageCommand(text: string): {
  prompt: string;
  aspect_ratio: NonNullable<NanoBananaTextToImageRequest['aspect_ratio']>;
  num_images: number;
  output_format: NonNullable<NanoBananaTextToImageRequest['output_format']>;
} {
  // Remove the command prefix if present
  const cleanText = text.replace(/^\/fal\s*/, '').trim();

  let params = {
    prompt: '',
    aspect_ratio: '1:1' as NonNullable<NanoBananaTextToImageRequest['aspect_ratio']>,
    num_images: 1,
    output_format: 'jpeg' as NonNullable<NanoBananaTextToImageRequest['output_format']>,
  };

  // Look for aspect ratio parameter
  const aspectMatch = cleanText.match(/--ar\s+(21:9|1:1|4:3|3:2|2:3|5:4|4:5|3:4|16:9|9:16)/i);
  if (aspectMatch && aspectMatch[1]) {
    params.aspect_ratio = aspectMatch[1] as NonNullable<
      NanoBananaTextToImageRequest['aspect_ratio']
    >;
  }

  // Look for number of images parameter
  const numMatch = cleanText.match(/--n\s+(\d+)/i);
  if (numMatch && numMatch[1]) {
    params.num_images = Math.min(Math.max(parseInt(numMatch[1]), 1), 4);
  }

  // Look for output format parameter
  const formatMatch = cleanText.match(/--format\s+(jpeg|png|webp)/i);
  if (formatMatch && formatMatch[1]) {
    params.output_format = formatMatch[1].toLowerCase() as NonNullable<
      NanoBananaTextToImageRequest['output_format']
    >;
  }

  // Extract the main prompt by removing all parameter flags
  params.prompt = cleanText
    .replace(/--ar\s+[^\s]+/gi, '')
    .replace(/--n\s+\d+/gi, '')
    .replace(/--format\s+[^\s]+/gi, '')
    .trim();

  return params;
}

export async function handleFalPhotoGeneration(
  bot: TelegramBot,
  msg: TelegramMessage,
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const caption = msg.caption;
  const hasPhoto = msg.photo && msg.photo.length > 0;

  if (!userId || (!text && !caption)) {
    return;
  }

  // Check if fal.ai is configured
  if (!isFalConfigured()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация изображений через Nano Banana недоступна. Сервис не настроен.',
    );
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

  const commandText = text || caption || '';
  const params = parseFalImageCommand(commandText);
  if (!params.prompt || params.prompt.length < 3) {
    await bot.sendMessage(
      chatId,
      '❌ Пожалуйста, предоставьте более подробный промпт для генерации изображения.',
    );
    return;
  }

  // Validate Nano Banana parameters
  const validationParams = {
    aspect_ratio: params.aspect_ratio || ('1:1' as const),
    num_images: params.num_images,
    output_format: params.output_format || ('jpeg' as const),
  };
  const validation = validateNanoBananaOptions(validationParams);
  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  ongoingTasks.set(userId, true);

  // Determine if this is image-to-image or text-to-image
  const isImageToImage = Boolean(hasPhoto && caption);
  const statusMsg = await bot.sendMessage(
    chatId,
    isImageToImage
      ? '🍌 Редактирование изображения с помощью Nano Banana...'
      : '🍌 Генерация изображения с помощью Nano Banana...',
  );

  try {
    let imageUrls: string[] = [];

    // If user sent a photo, upload it to fal.ai storage for image-to-image editing
    if (hasPhoto && caption && msg.photo && msg.photo.length > 0) {
      try {
        // Get the highest quality photo
        const photo = msg.photo[msg.photo.length - 1];
        if (!photo) {
          throw new Error('No photo found');
        }
        // Get the file URL directly
        const fileUrl = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to fal.ai storage
        const uploadResult = await uploadFileToFal(buffer, `input_${Date.now()}.jpg`);

        if (!uploadResult.success || !uploadResult.data?.url) {
          throw new Error('Failed to upload image to fal.ai storage');
        }

        imageUrls = [uploadResult.data.url];
        console.log('📤 Image uploaded to fal.ai storage:', uploadResult.data.url);
      } catch (uploadError) {
        console.error('❌ Error uploading image:', uploadError);
        await safeEditMessageText(
          bot,
          chatId,
          statusMsg.message_id,
          '❌ Ошибка при загрузке изображения для редактирования.',
        );
        return;
      }
    }

    await logInteraction({
      userId: userId,
      chatId,
      direction: 'user',
      type: 'image',
      content: params.prompt,
      meta: {
        provider: 'fal-ai',
        model: 'nano-banana',
        mode: isImageToImage ? 'image-to-image' : 'text-to-image',
        aspect_ratio: params.aspect_ratio,
        num_images: params.num_images,
      },
    });

    // Generate/edit image with Nano Banana
    const generateOptions: Omit<NanoBananaTextToImageRequest, 'prompt'> = {
      aspect_ratio: params.aspect_ratio || '1:1',
      num_images: params.num_images,
      output_format: params.output_format || 'jpeg',
    };

    const generateResult = await generateImageWithFal(params.prompt, generateOptions, imageUrls);

    if (!generateResult.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка: ${generateResult.error?.message ?? 'Не удалось начать генерацию изображения'}`,
      );
      return;
    }

    const taskData = generateResult.data;
    if (!taskData?.data?.images || taskData.data.images.length === 0) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Генерация завершена, но изображения не получены.',
      );
      return;
    }

    // Send the generated image(s)
    const images = taskData.data.images;
    const firstImage = images[0];
    const description = taskData.data.description || '';

    if (firstImage?.url) {
      try {
        // Try to fetch and send as buffer for better compatibility
        const { buffer, filename, contentType } = await fetchImageBuffer(firstImage.url);
        const fileOptions: FileOptions = contentType ? { filename, contentType } : { filename };

        const caption = isImageToImage
          ? `🍌 Изображение отредактировано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`
          : `🍌 Изображение создано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`;

        await bot.sendPhoto(
          chatId,
          buffer,
          {
            caption,
            reply_markup: createMainKeyboard(),
          },
          fileOptions,
        );
      } catch (fetchError) {
        // Fallback to sending URL directly
        console.warn('Failed to fetch image buffer, sending URL directly:', fetchError);

        const caption = isImageToImage
          ? `🍌 Изображение отредактировано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`
          : `🍌 Изображение создано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`;

        await bot.sendPhoto(chatId, firstImage.url, {
          caption,
          reply_markup: createMainKeyboard(),
        });
      }

      await logInteraction({
        userId: userId,
        chatId,
        direction: 'bot',
        type: 'image',
        content: firstImage.url,
        meta: {
          provider: 'fal-ai',
          model: 'nano-banana',
          mode: isImageToImage ? 'image-to-image' : 'text-to-image',
          prompt: params.prompt,
          aspect_ratio: params.aspect_ratio,
          num_images: params.num_images,
          description: description,
        },
      });

      // If there are multiple images, send them too
      if (images.length > 1) {
        for (let i = 1; i < images.length; i++) {
          const image = images[i];
          if (image?.url) {
            try {
              await bot.sendPhoto(chatId, image.url, {
                caption: `🍌 Вариант ${i + 1}`,
              });
            } catch (error) {
              console.error(`Failed to send image ${i + 1}:`, error);
            }
          }
        }
      }

      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch {
        // Ignore deletion errors
      }

      await decreaseRequests(userId, 'image_req_left', 1);

      await bot.sendMessage(
        chatId,
        '✨ Генерация завершена! Используйте кнопки ниже для навигации.',
        {
          reply_markup: createMainKeyboard(),
        },
      );
    } else {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Генерация завершена, но URL изображения не получен.',
      );
    }
  } catch (error) {
    console.error('Ошибка в handleFalPhotoGeneration:', error);
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

export async function handleFalPhotoGenerationWithQueue(
  bot: TelegramBot,
  msg: TelegramMessage,
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const text = msg.text;
  const caption = msg.caption;
  const hasPhoto = msg.photo && msg.photo.length > 0;

  if (!userId || (!text && !caption)) {
    return;
  }

  // Check if user sent a photo with caption for image-to-image editing
  const isImageToImage = Boolean(hasPhoto && caption);

  // Check if fal.ai is configured
  if (!isFalConfigured()) {
    await bot.sendMessage(
      chatId,
      '❌ Генерация изображений через Nano Banana недоступна. Сервис не настроен.',
    );
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

  const commandText = text || caption || '';
  const params = parseFalImageCommand(commandText);
  if (!params.prompt || params.prompt.length < 3) {
    await bot.sendMessage(
      chatId,
      '❌ Пожалуйста, предоставьте более подробный промпт для генерации изображения.',
    );
    return;
  }

  // Validate Nano Banana parameters
  const validationParams = {
    aspect_ratio: params.aspect_ratio || ('1:1' as const),
    num_images: params.num_images,
    output_format: params.output_format || ('jpeg' as const),
  };
  const validation = validateNanoBananaOptions(validationParams);
  if (!validation.valid) {
    await bot.sendMessage(chatId, `❌ Неверные параметры:\n${validation.errors.join('\n')}`);
    return;
  }

  ongoingTasks.set(userId, true);

  const statusMsg = await bot.sendMessage(
    chatId,
    isImageToImage
      ? '🍌 Отправка задачи редактирования в очередь Nano Banana...'
      : '🍌 Отправка задачи генерации в очередь Nano Banana...',
  );

  try {
    let imageUrls: string[] = [];

    // If user sent a photo, upload it to fal.ai storage for image-to-image editing
    if (hasPhoto && caption && msg.photo && msg.photo.length > 0) {
      try {
        // Get the highest quality photo
        const photo = msg.photo[msg.photo.length - 1];
        if (!photo) {
          throw new Error('No photo found');
        }
        // Get the file URL directly
        const fileUrl = await bot.getFileLink(photo.file_id);
        const response = await fetch(fileUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to fal.ai storage
        const uploadResult = await uploadFileToFal(buffer, `input_${Date.now()}.jpg`);

        if (!uploadResult.success || !uploadResult.data?.url) {
          throw new Error('Failed to upload image to fal.ai storage');
        }

        imageUrls = [uploadResult.data.url];
        console.log('📤 Image uploaded to fal.ai storage:', uploadResult.data.url);
      } catch (uploadError) {
        console.error('❌ Error uploading image:', uploadError);
        await safeEditMessageText(
          bot,
          chatId,
          statusMsg.message_id,
          '❌ Ошибка при загрузке изображения для редактирования.',
        );
        return;
      }
    }

    await logInteraction({
      userId: userId,
      chatId,
      direction: 'user',
      type: 'image',
      content: params.prompt,
      meta: {
        provider: 'fal-ai',
        model: 'nano-banana',
        mode: isImageToImage ? 'image-to-image' : 'text-to-image',
        aspect_ratio: params.aspect_ratio,
        num_images: params.num_images,
      },
    });

    // Submit task to queue
    const submitOptions: Omit<NanoBananaTextToImageRequest, 'prompt'> = {
      aspect_ratio: params.aspect_ratio || '1:1',
      num_images: params.num_images,
      output_format: params.output_format || 'jpeg',
    };

    const submitResult = await submitFalImageTask(params.prompt, submitOptions, imageUrls);

    if (!submitResult.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка отправки задачи: ${submitResult.error?.message ?? 'Неизвестная ошибка'}`,
      );
      return;
    }

    const requestId = submitResult.data?.request_id;
    if (!requestId) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Не получен ID задачи от сервера.',
      );
      return;
    }

    await safeEditMessageText(
      bot,
      chatId,
      statusMsg.message_id,
      `⏳ Задача отправлена в очередь (ID: ${requestId}). Ожидание результата...`,
    );

    // Wait for task completion
    const resultResponse = await waitForFalTaskCompletion(requestId, isImageToImage, 300000, 5000);

    if (!resultResponse.success) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        `❌ Ошибка получения результата: ${resultResponse.error?.message ?? 'Неизвестная ошибка'}`,
      );
      return;
    }

    const taskData = resultResponse.data;
    if (!taskData?.data?.images || taskData.data.images.length === 0) {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Задача завершена, но изображения не получены.',
      );
      return;
    }

    // Send the generated image(s)
    const images = taskData.data.images;
    const firstImage = images[0];
    const description = taskData.data.description || '';

    if (firstImage?.url) {
      try {
        // Try to fetch and send as buffer for better compatibility
        const { buffer, filename, contentType } = await fetchImageBuffer(firstImage.url);
        const fileOptions: FileOptions = contentType ? { filename, contentType } : { filename };

        const caption = isImageToImage
          ? `🍌 Изображение отредактировано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`
          : `🍌 Изображение создано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`;

        await bot.sendPhoto(
          chatId,
          buffer,
          {
            caption,
            reply_markup: createMainKeyboard(),
          },
          fileOptions,
        );
      } catch (fetchError) {
        // Fallback to sending URL directly
        console.warn('Failed to fetch image buffer, sending URL directly:', fetchError);

        const caption = isImageToImage
          ? `🍌 Изображение отредактировано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`
          : `🍌 Изображение создано с помощью Nano Banana\n\n${description ? `💬 ${description}` : ''}`;

        await bot.sendPhoto(chatId, firstImage.url, {
          caption,
          reply_markup: createMainKeyboard(),
        });
      }

      await logInteraction({
        userId: userId,
        chatId,
        direction: 'bot',
        type: 'image',
        content: firstImage.url,
        meta: {
          provider: 'fal-ai',
          model: 'nano-banana',
          mode: isImageToImage ? 'image-to-image' : 'text-to-image',
          prompt: params.prompt,
          aspect_ratio: params.aspect_ratio,
          num_images: params.num_images,
          description: description,
          request_id: requestId,
        },
      });

      // If there are multiple images, send them too
      if (images.length > 1) {
        for (let i = 1; i < images.length; i++) {
          const image = images[i];
          if (image?.url) {
            try {
              await bot.sendPhoto(chatId, image.url, {
                caption: `🍌 Вариант ${i + 1}`,
              });
            } catch (error) {
              console.error(`Failed to send image ${i + 1}:`, error);
            }
          }
        }
      }

      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch {
        // Ignore deletion errors
      }

      await decreaseRequests(userId, 'image_req_left', 1);

      await bot.sendMessage(
        chatId,
        '✨ Генерация завершена! Используйте кнопки ниже для навигации.',
        {
          reply_markup: createMainKeyboard(),
        },
      );
    } else {
      await safeEditMessageText(
        bot,
        chatId,
        statusMsg.message_id,
        '❌ Задача завершена, но URL изображения не получен.',
      );
    }
  } catch (error) {
    console.error('Ошибка в handleFalPhotoGenerationWithQueue:', error);
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
