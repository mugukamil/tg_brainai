import type { TelegramLikeBot } from '@/tg-client.js';
import fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import type { TelegramUpdate } from '@/types/index.js';
import {
  handleTextMessage,
  handleVoiceMessage,
  handleCallbackQuery,
  handlePreCheckoutQuery,
  handleSuccessfulPaymentMessage,
  handlePhotoMessage,
} from '@/handlers/msg-handler.js';

export interface WebhookHandler {
  getStatus(): Promise<{
    webhook?: Record<string, unknown>;
    local?: {
      webhookUrl: string | null;
      ngrokUrl: string | null;
      serverRunning: boolean;
    };
    error?: string;
  }>;
  stop(): Promise<void>;
  startLocalWebhook(port?: number): Promise<void>;
  startServer(options?: { port?: number; useNgrok?: boolean; baseUrl?: string }): Promise<void>;
}

export class WebhookHandler implements WebhookHandler {
  private bot: TelegramLikeBot;
  private webhookUrl: string | null = null;
  private ngrokUrl: string | null = null;
  private ngrokListener: unknown = null;
  private app: FastifyInstance | null = null;
  private processedUpdateIds: Set<number> = new Set();
  private readonly MAX_PROCESSED_IDS = 1000; // Keep last 1000 update IDs in memory

  constructor(bot: TelegramLikeBot) {
    this.bot = bot;
  }

  async startLocalWebhook(port = 3000): Promise<void> {
    // Backward-compatible dev helper: always uses ngrok
    return this.startServer({ port, useNgrok: true });
  }

  async startServer(options?: {
    port?: number;
    useNgrok?: boolean;
    baseUrl?: string;
  }): Promise<void> {
    const port = options?.port ?? 3000;
    const useNgrok = options?.useNgrok !== false;
    const baseUrl = options?.baseUrl;

    try {
      console.log('🚀 Starting webhook server...');

      // Create Fastify app
      this.app = fastify({
        logger: {
          level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
        },
        trustProxy: true,
      });

      // Register routes
      this.setupRoutes();

      // Start Fastify server
      await this.app.listen({ port, host: '0.0.0.0' });
      console.log(`✅ Fastify server running on port ${port}`);

      if (useNgrok) {
        // Start ngrok tunnel
        console.log('🌐 Starting ngrok tunnel...');
        const ngrok = await import('@ngrok/ngrok');
        const ngrokConfig: any = {
          addr: port,
        };
        if (process.env.NGROK_AUTHTOKEN) {
          ngrokConfig.authtoken = process.env.NGROK_AUTHTOKEN;
        }
        this.ngrokListener = await ngrok.connect(ngrokConfig);
        this.ngrokUrl =
          typeof (this.ngrokListener as any)?.url === 'function'
            ? (this.ngrokListener as any).url()
            : String((this.ngrokListener as any)?.url ?? '');
        console.log(`✅ Ngrok tunnel established: ${this.ngrokUrl}`);

        // Set webhook URL via ngrok
        this.webhookUrl = `${this.ngrokUrl}/webhook`;
      } else {
        // No ngrok: require baseUrl
        const resolvedBaseUrl = baseUrl ?? process.env.WEBHOOK_PUBLIC_URL ?? '';
        if (!resolvedBaseUrl) {
          throw new Error('WEBHOOK_PUBLIC_URL is required when USE_NGROK=false');
        }
        this.ngrokUrl = null;
        this.webhookUrl = `${resolvedBaseUrl.replace(/\/$/, '')}/webhook`;
        console.log(`🌐 Using public URL for webhook: ${this.webhookUrl}`);
      }

      // Configure webhook with Telegram
      await this.setWebhook();

      console.log(`📡 Webhook URL: ${this.webhookUrl}`);
      if (this.ngrokUrl) {
        console.log(`🔍 Health check: ${this.ngrokUrl}/health`);
        console.log(`📚 API docs: ${this.ngrokUrl}/docs`);
      } else if (baseUrl ?? process.env.WEBHOOK_PUBLIC_URL) {
        const url = (baseUrl ?? process.env.WEBHOOK_PUBLIC_URL) as string;
        console.log(`🔍 Health check: ${url.replace(/\/$/, '')}/health`);
        console.log(`📚 API docs: ${url.replace(/\/$/, '')}/docs`);
      }
    } catch (error) {
      console.error('Failed to start webhook server:', error);
      throw error;
    }
  }

  private setupRoutes(): void {
    const rawPrefix = process.env.WEBHOOK_PATH_PREFIX ?? '';
    const basePrefix =
      rawPrefix && rawPrefix !== '/' ? `/${rawPrefix.replace(/^\/+|\/+$/g, '')}` : '';

    const registerRoutes = (prefix: string) => {
      // Health check endpoint
      this.app!.get(`${prefix}/health`, async () => {
        return {
          status: 'ok',
          timestamp: new Date().toISOString(),
          webhook: this.webhookUrl,
          ngrok: this.ngrokUrl,
        };
      });

      // Main webhook endpoint
      this.app!.post(
        `${prefix}/webhook`,
        async (request: FastifyRequest<{ Body: TelegramUpdate }>) => {
          const update = request.body;
          try {
            await this.processUpdate(update);
            return { ok: true };
          } catch (error) {
            console.error('Webhook processing error:', error);
            throw error;
          }
        },
      );

      // API docs endpoint
      this.app!.get(`${prefix}/docs`, async () => {
        return {
          message: 'BrainAI Bot Webhook API',
          endpoints: {
            'GET /health': 'Health check',
            'POST /webhook': 'Telegram webhook',
            'GET /docs': 'This documentation',
          },
        };
      });
    };

    // Register at root (no prefix)
    registerRoutes('');

    // Also register with base prefix if provided (for reverse proxies)
    if (basePrefix) {
      registerRoutes(basePrefix);
    }
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    console.log('=== WEBHOOK UPDATE RECEIVED ===');
    console.log('Update ID:', update.update_id);
    console.log(
      'Update type:',
      Object.keys(update)
        .filter(k => k !== 'update_id')
        .join(', '),
    );
    console.log('Full update:', JSON.stringify(update, null, 2));

    // Check if we've already processed this update ID
    const updateId = update.update_id;
    if (this.processedUpdateIds.has(updateId)) {
      console.log(`⚠️ Duplicate update ${updateId} detected - skipping processing`);
      return; // Return successfully so Telegram doesn't resend
    }

    // Mark this update as processed
    this.processedUpdateIds.add(updateId);

    // Prevent memory leak by limiting the size of the Set
    if (this.processedUpdateIds.size > this.MAX_PROCESSED_IDS) {
      // Remove oldest entries (convert to array, remove first items, recreate Set)
      const idsArray = Array.from(this.processedUpdateIds);
      const keepIds = idsArray.slice(-this.MAX_PROCESSED_IDS);
      this.processedUpdateIds = new Set(keepIds);
    }

    try {
      if (update.message) {
        const msg = update.message;

        if (msg.successful_payment) {
          await handleSuccessfulPaymentMessage(this.bot as any, msg as any);
        } else if (msg.text) {
          await handleTextMessage(this.bot as any, msg as any);
        } else if (msg.photo) {
          await handlePhotoMessage(this.bot as any, msg as any);
        } else if (msg.voice) {
          await handleVoiceMessage(this.bot as any, msg as any);
        }
      }

      if (update.callback_query) {
        await handleCallbackQuery(this.bot as any, update.callback_query);
      }

      if (update.pre_checkout_query) {
        console.log('=== PRE-CHECKOUT QUERY DETECTED IN WEBHOOK ===');
        console.log('Pre-checkout query data:', JSON.stringify(update.pre_checkout_query, null, 2));
        console.log('Calling handlePreCheckoutQuery...');
        await handlePreCheckoutQuery(this.bot as any, update.pre_checkout_query);
        console.log('handlePreCheckoutQuery completed');
      }
    } catch (error) {
      console.error('Error processing update:', error);
      console.error('Error details:', {
        message: (error as any)?.message,
        stack: (error as any)?.stack,
        update: JSON.stringify(update, null, 2),
      });

      // Import the helper at the top of the file:
      // import { isBotBlockedError } from './handler-utils.js';

      // Don't re-throw if user blocked the bot - we want to return 200 OK
      const { isBotBlockedError } = await import('./handler-utils.js');
      if (isBotBlockedError(error)) {
        console.log('⚠️ Ignoring update from blocked user to prevent retry loop');
        return; // Return successfully so Telegram stops resending this update
      }

      // Re-throw other errors
      throw error;
    }
  }

  private async setWebhook(): Promise<void> {
    try {
      if (!this.webhookUrl) {
        throw new Error('Webhook URL not set');
      }

      const result = await this.bot.setWebHook(this.webhookUrl);
      if (result) {
        console.log('✅ Webhook configured successfully');

        // Get and display webhook info
        const webhookInfo = await this.bot.getWebHookInfo();
        console.log('🌐 Webhook URL:', webhookInfo.url);
        console.log('📋 Allowed updates:', webhookInfo.allowed_updates?.join(', ') ?? 'default');

        // Check if pre_checkout_query is included
        if (webhookInfo.allowed_updates?.includes('pre_checkout_query')) {
          console.log('✅ Payment updates (pre_checkout_query) are enabled');
        } else {
          console.log('⚠️ Payment updates (pre_checkout_query) are NOT enabled!');
        }
      } else {
        throw new Error('Failed to set webhook');
      }
    } catch (error) {
      console.error('Failed to set webhook:', error);
      throw error;
    }
  }

  async getStatus() {
    try {
      const webhookInfo = await this.bot.getWebHookInfo();
      return {
        webhook: webhookInfo,
        local: {
          webhookUrl: this.webhookUrl,
          ngrokUrl: this.ngrokUrl,
          serverRunning: !!this.app,
        },
      };
    } catch (error) {
      console.error('Error getting webhook status:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        local: {
          webhookUrl: this.webhookUrl,
          ngrokUrl: this.ngrokUrl,
          serverRunning: false,
        },
      };
    }
  }

  async stop(): Promise<void> {
    try {
      console.log('🛑 Stopping webhook servers...');

      // Remove webhook
      await this.bot.deleteWebHook();
      console.log('✅ Webhook removed');

      // Close ngrok tunnel
      if (this.ngrokListener && (this.ngrokListener as any).close) {
        await (this.ngrokListener as any).close();
        console.log('✅ Ngrok tunnel closed');
      }

      // Close Fastify server
      if (this.app) {
        await this.app.close();
        console.log('✅ Fastify server closed');
      }

      console.log('🎉 Webhook servers stopped successfully');
    } catch (error) {
      console.error('Error stopping webhook servers:', error);
      throw error;
    }
  }
}

export async function startWebhook(bot: TelegramLikeBot): Promise<WebhookHandler> {
  const webhookHandler = new WebhookHandler(bot);

  // Start the webhook server
  const port = parseInt(process.env.PORT ?? '3000');
  const useNgrok = process.env.USE_NGROK !== 'false';
  const baseUrl = process.env.WEBHOOK_PUBLIC_URL;
  if (baseUrl) {
    await webhookHandler.startServer({ port, useNgrok, baseUrl });
  } else {
    await webhookHandler.startServer({ port, useNgrok });
  }

  return webhookHandler;
}
