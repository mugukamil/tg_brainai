import {
  handleTextMessage,
  handleVoiceMessage,
  handlePhotoMessage,
  handleCallbackQuery,
  handlePreCheckoutQuery,
  handleSuccessfulPaymentMessage,
} from './handlers/msg-handler.js';
import { TgBotAdapter, TgMessage, TgCallbackQuery, TgPreCheckoutQuery } from './tg-client.js';

const token = process.env.TELEGRAM_BOT_TOKEN as string;

if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

/**
 * Start bot in polling mode
 * @returns Bot instance
 */
export function startBotPolling(): TgBotAdapter {
  console.log('🚀 Starting bot in polling mode...');

  const bot = new TgBotAdapter(token);

  setupBotHandlers(bot);
  setupBotEvents(bot);
  bot.login();

  console.log('🤖 BrainAI Bot started in polling mode');
  return bot;
}

/**
 * Start bot in webhook mode
 * @returns Bot instance (without polling)
 */
export function startBotWebhook(): TgBotAdapter {
  console.log('🚀 Starting bot in webhook mode...');

  const bot = new TgBotAdapter(token);

  setupBotHandlers(bot);
  setupBotEvents(bot);

  console.log('🤖 BrainAI Bot created for webhook mode');
  return bot;
}

/**
 * Setup message and event handlers
 * @param bot - Bot instance
 */
export function setupBotHandlers(bot: TgBotAdapter): void {
  // Handle regular messages
  bot.on('message', async (msg: TgMessage) => {
    try {
      // Handle successful payment
      if (msg.successful_payment) {
        console.log('Получен успешный платеж:', msg.successful_payment);
        await handleSuccessfulPaymentMessage(bot, msg);
        return;
      }

      // Handle different message types
      if (msg.text) {
        await handleTextMessage(bot, msg);
      } else if (msg.voice) {
        await handleVoiceMessage(bot, msg);
      } else if (msg.photo) {
        await handlePhotoMessage(bot, msg);
      } else if (msg.video_note ?? msg.video) {
        // Handle video messages
        await bot.sendMessage(
          msg.chat.id,
          '📹 Видеосообщения пока не поддерживаются. Пожалуйста, отправляйте текст, голос или изображения.',
        );
      } else if (msg.document) {
        // Handle documents
        await bot.sendMessage(
          msg.chat.id,
          '📄 Обработка документов пока не поддерживается. Пожалуйста, отправьте текст, голос или изображение.',
        );
      } else if (msg.sticker) {
        // Handle stickers with fun response
        await bot.sendMessage(
          msg.chat.id,
          '😄 Отличный стикер! Отправь мне сообщение, чтобы пообщаться с ИИ.',
        );
      } else if (msg.location) {
        // Handle location
        await bot.sendMessage(
          msg.chat.id,
          '📍 Местоположение получено! К сожалению, я пока не могу обрабатывать местоположения.',
        );
      } else if (msg.contact) {
        // Handle contact
        await bot.sendMessage(
          msg.chat.id,
          '👤 Контакт получен! Я не обрабатываю контакты, но спасибо, что поделились.',
        );
      } else {
        // Handle any other message type
        console.log('Unhandled message type:', Object.keys(msg));
        await bot.sendMessage(
          msg.chat.id,
          '🤔 Я получил ваше сообщение, но не знаю, как с ним обращаться. Попробуйте отправить текст, голосовое сообщение или изображение!',
        );
      }
    } catch (error) {
      console.error('Error handling message:', error);
      try {
        await bot.sendMessage(
          msg.chat.id,
          '❌ An unexpected error occurred. Please try again later.',
        );
      } catch (sendError) {
        console.error('Failed to send error message:', sendError);
      }
    }
  });

  // Handle callback queries (inline button presses)
  bot.on('callback_query', async (callbackQuery: TgCallbackQuery) => {
    try {
      await handleCallbackQuery(bot, callbackQuery);
    } catch (error) {
      console.error('Error handling callback query:', error);
      try {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ An error occurred processing your request',
          show_alert: true,
        });
      } catch (answerError) {
        console.error('Failed to answer callback query:', answerError);
      }
    }
  });

  // Handle pre-checkout queries (before payment)
  bot.on('pre_checkout_query', async (preCheckoutQuery: TgPreCheckoutQuery) => {
    try {
      console.log('Pre-checkout query received:', preCheckoutQuery);
      await handlePreCheckoutQuery(bot, preCheckoutQuery);
    } catch (error) {
      console.error('Error handling pre-checkout query:', error);
      try {
        await bot.answerPreCheckoutQuery(preCheckoutQuery.id, false, {
          error_message: 'Internal server error. Please try again later.',
        });
      } catch (answerError) {
        console.error('Failed to answer pre-checkout query:', answerError);
      }
    }
  });

  // Handle shipping queries (if needed for future features)
  // Optional shipping queries are not used; if emitted, answer with not supported
  (bot as any).on('shipping_query', async (shippingQuery: any) => {
    try {
      console.log('Shipping query received:', shippingQuery);
      // For now, we don't support shipping
      await bot.answerShippingQuery(shippingQuery.id, false, {
        error_message: 'Shipping is not supported for digital products.',
      });
    } catch (error) {
      console.error('Error handling shipping query:', error);
    }
  });

  // Handle inline queries (if bot is set to inline mode)
  bot.on('inline_query', async (inlineQuery: any) => {
    try {
      console.log('Inline query received:', inlineQuery.query);

      const results = [
        {
          type: 'article' as const,
          id: '1',
          title: '🤖 BrainAI Bot',
          description: 'Start chatting with BrainAI Bot',
          input_message_content: {
            message_text: '🤖 Click here to start using BrainAI Bot!',
          },
          thumb_url: 'https://via.placeholder.com/64x64/4CAF50/FFFFFF?text=AI',
        },
        {
          type: 'article' as const,
          id: '2',
          title: '🎨 Generate Image',
          description: 'Generate an image with AI',
          input_message_content: {
            message_text: '🎨 Switch to photo mode to generate images!',
          },
          thumb_url: 'https://via.placeholder.com/64x64/FF9800/FFFFFF?text=🎨',
        },
      ];

      await bot.answerInlineQuery(inlineQuery.id, results, {
        cache_time: 300,
        is_personal: true,
      });
    } catch (error) {
      console.error('Error handling inline query:', error);
    }
  });

  // Handle chosen inline result
  bot.on('chosen_inline_result', async (chosenResult: any) => {
    try {
      console.log('Chosen inline result:', chosenResult);
      // Log for analytics, no action needed
    } catch (error) {
      console.error('Error handling chosen inline result:', error);
    }
  });

  // Handle channel post (if bot is added to channels)
  bot.on('channel_post', async (msg: any) => {
    try {
      console.log('Channel post received:', msg.chat.title);
      // For now, just log channel posts
    } catch (error) {
      console.error('Error handling channel post:', error);
    }
  });

  // Handle edited messages
  bot.on('edited_message', async (msg: any) => {
    try {
      console.log('Message edited by user:', msg.from?.id);
      // For now, just log edited messages
      // In the future, we could re-process edited messages
    } catch (error) {
      console.error('Error handling edited message:', error);
    }
  });
}

/**
 * Setup bot events and error handling
 * @param bot - Bot instance
 */
export function setupBotEvents(bot: TgBotAdapter): void {
  // Handle polling errors
  bot.on('polling_error', (error: any) => {
    console.error('Polling error:', error.code, error.message);

    // Handle specific error types
    if (error.code === 'EFATAL') {
      console.error('Fatal polling error. Bot will need to restart.');
      process.exit(1);
    } else if (error.code === 'ECONNRESET') {
      console.log('Connection reset. Polling will continue...');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('Request timeout. Polling will continue...');
    } else {
      console.error('Unhandled polling error:', error);
    }
  });

  // Handle webhook errors (if using webhooks)
  bot.on('webhook_error', (error: any) => {
    console.error('Webhook error:', error);
  });

  // Handle general errors
  bot.on('error', (error: any) => {
    console.error('Bot error:', error);
  });

  // Log successful bot startup
  console.log('📊 Monitoring for:');
  console.log('  • Text messages');
  console.log('  • Voice messages');
  console.log('  • Photo messages');
  console.log('  • Callback queries (button presses)');
  console.log('  • Payment queries');
  console.log('  • Inline queries');

  // Optional: Get bot info
  bot
    .getMe()
    .then(botInfo => {
      console.log(`✅ Bot started successfully: @${botInfo.username} (${botInfo.first_name})`);
      console.log(`🆔 Bot ID: ${botInfo.id}`);

      // Log webhook info if using webhooks
      bot
        .getWebHookInfo()
        .then(webhookInfo => {
          if (webhookInfo.url) {
            console.log(`🌐 Webhook URL: ${webhookInfo.url}`);
            const allowedUpdates = (webhookInfo as any).allowed_updates;
            if (allowedUpdates && Array.isArray(allowedUpdates)) {
              console.log(`📋 Allowed update types: ${allowedUpdates.join(', ')}`);
              const hasPaymentUpdates = allowedUpdates.includes('pre_checkout_query');
              console.log(`💳 Payment updates enabled: ${hasPaymentUpdates ? '✅ Yes' : '❌ No'}`);
              if (!hasPaymentUpdates) {
                console.log('⚠️  WARNING: Pre-checkout queries are not enabled!');
                console.log('   The webhook needs to be reset with payment update types.');
                console.log('   Run: npm run reset-webhook');
              }
            } else {
              console.log('📋 Allowed updates: default (messages and callbacks only)');
              console.log('💳 Payment updates enabled: ❌ No');
              console.log('⚠️  WARNING: Using default webhook updates - payments will not work!');
              console.log('   Run: npm run reset-webhook');
            }
          } else {
            console.log('📡 Using polling mode (no webhook)');
          }
        })
        .catch(() => {
          // Ignore webhook info errors when using polling
        });
    })
    .catch(error => {
      console.error('Failed to get bot info:', error.message);
    });

  // Graceful shutdown handling
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT. Shutting down gracefully...');
    bot
      .stopPolling()
      .then(() => {
        console.log('✅ Bot stopped successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('Error stopping bot:', error);
        process.exit(1);
      });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM. Shutting down gracefully...');
    bot
      .stopPolling()
      .then(() => {
        console.log('✅ Bot stopped successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('Error stopping bot:', error);
        process.exit(1);
      });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately, log and continue
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, log and continue
  });
}

/**
 * Start bot based on environment configuration
 * @returns Bot instance
 */
export function startBot(): TgBotAdapter {
  const useWebhook = process.env.USE_WEBHOOK === 'true';

  if (useWebhook) {
    return startBotWebhook();
  } else {
    return startBotPolling();
  }
}
