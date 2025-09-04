import type { TelegramLikeBot as TelegramBot } from '../tg-client.js';
import { setPremium, getUserStats } from './supabase-handler.js';
import type { PaymentInvoice } from '../types/index.js';
import { logInteraction } from '../utils/logger.js';

/**
 * Create invoice for premium subscription
 */
export async function sendPremiumInvoice(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const invoice: PaymentInvoice = {
      title: 'Премиум',
      description:
        'Премиум подписка | 1000 текстовых запросов, 50 изображений, 10 видео на 1 месяц',
      payload: JSON.stringify({ type: 'premium', duration: 'monthly' }),
      provider_token: '', // Empty for Telegram Stars
      currency: 'XTR', // Telegram Stars
      prices: [
        {
          label: 'Премиум на месяц',
          amount: 1,
        },
      ],
      start_parameter: 'premium_subscription',
      // photo_url: 'https://placeholder.co/512x512?text=Premium',
      // photo_size: 512,
      // photo_width: 512,
      // photo_height: 512,
      need_name: false,
      need_phone_number: false,
      need_email: false,
      need_shipping_address: false,
      send_phone_number_to_provider: false,
      send_email_to_provider: false,
      is_flexible: false,
    };

    console.log('Sending invoice to chat:', chatId, 'with params:', invoice);

    await bot.sendInvoice(
      chatId,
      invoice.title,
      invoice.description,
      invoice.payload,
      invoice.provider_token,
      invoice.currency,
      invoice.prices,
      {
        start_parameter: invoice.start_parameter,
        photo_url: invoice.photo_url,
        photo_size: invoice.photo_size,
        photo_width: invoice.photo_width,
        photo_height: invoice.photo_height,
        need_name: invoice.need_name,
        need_phone_number: invoice.need_phone_number,
        need_email: invoice.need_email,
        need_shipping_address: invoice.need_shipping_address,
        is_flexible: invoice.is_flexible,
      },
    );

    console.log('Invoice sent successfully to chat:', chatId);

    await logInteraction({
      userId: chatId,
      chatId,
      direction: 'bot',
      type: 'other',
      content: 'sendInvoice',
      meta: { invoice },
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    console.error('Error details:', {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
      response: (error as any)?.response,
      data: (error as any)?.response?.data,
    });

    // Send user-friendly error message
    try {
      await bot.sendMessage(
        chatId,
        '❌ Не удалось создать счет для оплаты.\n\n' +
          '🔄 Пожалуйста, попробуйте еще раз позже или обратитесь в поддержку.\n\n' +
          'Если проблема сохраняется, убедитесь что:\n' +
          '• У вас последняя версия Telegram\n' +
          '• Telegram Stars доступны в вашем регионе',
      );
    } catch (msgError) {
      console.error('Failed to send error message to user:', msgError);
    }

    throw error; // Re-throw to maintain existing error handling flow
  }
}

/**
 * Handle pre-checkout query
 */
export async function handlePreCheckout(bot: TelegramBot, preCheckoutQuery: any): Promise<void> {
  try {
    console.log('=== PRE-CHECKOUT QUERY RECEIVED ===');
    console.log('Full preCheckoutQuery object:', JSON.stringify(preCheckoutQuery, null, 2));

    const { id, from, invoice_payload } = preCheckoutQuery;

    if (!from) {
      console.error('No from user data in pre-checkout query');
      await bot.answerPreCheckoutQuery(id, false, {
        error_message: 'Неверные данные пользователя.',
      });
      return;
    }

    console.log(`Pre-checkout from user ${from.id}: ${invoice_payload}`);
    console.log('User data:', JSON.stringify(from, null, 2));
    await logInteraction({
      userId: from.id,
      chatId: preCheckoutQuery.from.id,
      direction: 'user',
      type: 'other',
      content: 'pre_checkout_query',
      meta: { invoice_payload },
    });

    // Parse payload to verify the purchase
    let payload;
    try {
      console.log('Attempting to parse invoice_payload:', invoice_payload);
      payload = JSON.parse(invoice_payload);
      console.log('Parsed payload:', payload);
    } catch (error) {
      console.error('Неверные данные счета:', error);
      await bot.answerPreCheckoutQuery(id, false, {
        error_message: 'Неверные данные счета',
      });
      return;
    }

    // Validate the purchase
    if (payload.type === 'premium') {
      console.log('Premium purchase detected, checking user stats...');
      // Check if user exists
      const userStats = await getUserStats(from.id);
      console.log('User stats:', userStats);
      if (!userStats) {
        await bot.answerPreCheckoutQuery(id, false, {
          error_message: 'Пользователь не найден. Пожалуйста, запустите бота сначала.',
        });
        return;
      }

      // Approve the payment
      console.log('Approving pre-checkout query with id:', id);
      await bot.answerPreCheckoutQuery(id, true);
      console.log('Pre-checkout query approved successfully');
      await logInteraction({
        userId: from.id,
        chatId: from.id,
        direction: 'system',
        type: 'other',
        content: 'pre_checkout_ok',
        meta: { invoice_payload: payload },
      });
    } else {
      await bot.answerPreCheckoutQuery(id, false, {
        error_message: 'Неизвестный тип покупки',
      });
    }
  } catch (error) {
    console.error('Error handling pre-checkout:', error);
    console.error('Error details:', {
      message: (error as any)?.message,
      stack: (error as any)?.stack,
      response: (error as any)?.response,
    });
    await bot.answerPreCheckoutQuery(preCheckoutQuery.id, false, {
      error_message: 'Внутренняя ошибка сервера',
    });
  }
}

/**
 * Handle successful payment
 */
export async function handleSuccessfulPayment(bot: TelegramBot, message: any): Promise<void> {
  try {
    const { chat, from } = message;
    const successfulPayment = message.successful_payment;
    if (!successfulPayment) {
      console.error('Не найдены данные о платеже');
      return;
    }
    const { invoice_payload, total_amount, currency } = successfulPayment;

    console.log(`Successful payment from user ${from?.id}: ${total_amount} ${currency}`);
    await logInteraction({
      userId: from?.id || 0,
      chatId: chat.id,
      direction: 'system',
      type: 'other',
      content: 'successful_payment',
      meta: { total_amount, currency, invoice_payload },
    });

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(invoice_payload);
    } catch (error) {
      console.error('Неверные данные счета в успешном платеже:', error);
      await bot.sendMessage(chat.id, '❌ Ошибка обработки платежа. Обратитесь в поддержку.');
      return;
    }

    if (payload.type === 'premium') {
      // Set user as premium
      if (!from) {
        console.error('No from user data in successful payment');
        return;
      }
      const success = await setPremium(from.id);

      if (success) {
        await bot.sendMessage(
          chat.id,
          '🎉 Поздравляем с покупкой Премиум!\n\n' +
            '✅ Ваш аккаунт обновлен до премиум статуса\n' +
            '📊 Лимиты обновлены:\n' +
            '• 1000 текстовых запросов\n' +
            '• 100 генераций изображений\n' +
            '• 50 генераций видео\n\n' +
            'Спасибо за поддержку! 💙',
        );
        await logInteraction({
          userId: from.id,
          chatId: chat.id,
          direction: 'bot',
          type: 'text',
          content: 'premium_welcome',
        });

        // Log the successful upgrade
        console.log(`User ${from.id} upgraded to premium successfully`);
      } else {
        await bot.sendMessage(
          chat.id,
          '⚠️ Платеж получен, но произошла ошибка при обновлении аккаунта.\n' +
            'Пожалуйста, обратитесь в поддержку с указанием времени покупки.',
        );
        console.error(`Failed to set premium status for user ${from.id}`);
      }
    } else {
      console.error('Неизвестный тип покупки:', payload.type);
      await bot.sendMessage(chat.id, '❌ Неизвестный тип покупки. Обратитесь в поддержку.');
    }
  } catch (error) {
    console.error('Ошибка в handleSuccessfulPayment:', error);
    await bot.sendMessage(
      message.chat.id,
      '❌ Произошла ошибка при обработке платежа. Обратитесь в поддержку.',
    );
  }
}

/**
 * Show pricing information
 */
export async function showPricing(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const pricingMessage =
      '💎 **Премиум подписка**\n\n' +
      '🆓 **Бесплатный план:**\n' +
      '• 100 текстовых запросов в месяц\n' +
      '• 10 генераций изображений в месяц\n' +
      '• 5 генераций видео в месяц\n\n' +
      '⭐ **Премиум план (100 ⭐):**\n' +
      '• 1000 текстовых запросов в месяц\n' +
      '• 100 генераций изображений в месяц\n' +
      '• 50 генераций видео в месяц\n' +
      '• Приоритетная обработка\n' +
      '• Доступ к новым функциям\n\n' +
      '💫 Telegram Stars - это внутренняя валюта Telegram\n' +
      'Купить можно прямо в приложении';

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '⭐ Купить Премиум (100 ⭐)',
            callback_data: JSON.stringify({ action: 'buy_premium' }),
          },
        ],
        [
          {
            text: '💰 Как получить Telegram Stars?',
            callback_data: JSON.stringify({ action: 'how_to_buy_stars' }),
          },
        ],
      ],
    };

    await bot.sendMessage(chatId, pricingMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Ошибка в showPricing:', error);
    await bot.sendMessage(chatId, '❌ Ошибка загрузки информации о ценах.');
  }
}

/**
 * Show how to buy Telegram Stars
 */
export async function showHowToBuyStars(bot: TelegramBot, chatId: number): Promise<void> {
  try {
    const starsMessage =
      '💫 **Как получить Telegram Stars:**\n\n' +
      '1. Откройте любой чат в Telegram\n' +
      '2. Нажмите на скрепку (📎) для вложений\n' +
      "3. Выберите 'Подарок' или 'Gift'\n" +
      "4. Выберите 'Купить Stars'\n" +
      '5. Выберите количество Stars\n' +
      '6. Оплатите удобным способом\n\n' +
      '💳 **Способы оплаты:**\n' +
      '• Банковская карта\n' +
      '• Google Pay / Apple Pay\n' +
      '• И другие способы в вашей стране\n\n' +
      '⚡ Stars поступят мгновенно на ваш аккаунт';

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: '🔙 Назад к ценам',
            callback_data: JSON.stringify({ action: 'show_pricing' }),
          },
        ],
      ],
    };

    await bot.sendMessage(chatId, starsMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Ошибка в showHowToBuyStars:', error);
    await bot.sendMessage(chatId, '❌ Ошибка загрузки информации.');
  }
}

/**
 * Handle payment-related callback queries
 */
export async function handlePaymentCallback(
  bot: TelegramBot,
  callbackQuery: any,
): Promise<boolean> {
  try {
    const { data, message, from } = callbackQuery;

    if (!data || !message || !from) {
      return false;
    }
    const chatId = message.chat.id;

    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      return false; // Not a payment callback
    }

    const { action } = parsedData;

    switch (action) {
      case 'buy_premium':
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Создаем счет для оплаты...',
        });
        try {
          await sendPremiumInvoice(bot, chatId);
        } catch (error) {
          console.error('Failed to send premium invoice from callback:', error);
          // Error message already sent to user in sendPremiumInvoice
        }
        return true;

      case 'show_pricing':
        await bot.answerCallbackQuery(callbackQuery.id);
        await bot.editMessageText('Загружаем информацию о ценах...', {
          chat_id: chatId,
          message_id: message.message_id,
        });
        await showPricing(bot, chatId);
        await bot.deleteMessage(chatId, message.message_id);
        return true;

      case 'how_to_buy_stars':
        await bot.answerCallbackQuery(callbackQuery.id);
        await showHowToBuyStars(bot, chatId);
        return true;

      default:
        return false; // Not a payment callback
    }
  } catch (error) {
    console.error('Ошибка в handlePaymentCallback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Произошла ошибка',
      show_alert: true,
    });
    return true;
  }
}

/**
 * Check user's payment status and show appropriate message
 */
export async function checkPaymentStatus(
  bot: TelegramBot,
  chatId: number,
  userId: number,
): Promise<void> {
  try {
    const userStats = await getUserStats(userId);

    if (!userStats) {
      await bot.sendMessage(chatId, '❌ Пользователь не найден.');
      return;
    }

    const statusMessage = userStats.is_premium
      ? '⭐ **Премиум статус активен**\n\n' +
        `📊 Ваши лимиты:\n` +
        `• Текст: ${userStats.text_req_left}\n` +
        `• Изображения: ${userStats.image_req_left}\n` +
        `• Видео: ${userStats.video_req_left}`
      : '🆓 **Бесплатный план**\n\n' +
        `📊 Ваши лимиты:\n` +
        `• Текст: ${userStats.text_req_left}\n` +
        `• Изображения: ${userStats.image_req_left}\n` +
        `• Видео: ${userStats.video_req_left}\n\n` +
        `💎 Хотите больше? Перейдите на Премиум!`;

    const keyboard = userStats.is_premium
      ? {
          inline_keyboard: [
            [
              {
                text: '📊 Обновить статистику',
                callback_data: JSON.stringify({ action: 'refresh_stats' }),
              },
            ],
          ],
        }
      : {
          inline_keyboard: [
            [
              {
                text: '⭐ Купить Премиум',
                callback_data: JSON.stringify({ action: 'buy_premium' }),
              },
            ],
          ],
        };

    await bot.sendMessage(chatId, statusMessage, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (error) {
    console.error('Ошибка в checkPaymentStatus:', error);
    await bot.sendMessage(chatId, '❌ Ошибка получения статуса.');
  }
}
