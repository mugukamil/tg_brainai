#!/usr/bin/env node

/**
 * Production/local server script for running the bot in webhook mode WITHOUT ngrok
 */

import 'dotenv/config';
import { startBotWebhook } from './tg-bot.js';
import { startWebhook } from './handlers/webhook-handler.js';

interface ServerConfig {
  botToken: string;
  publicUrl: string;
  port: number;
}

function validateEnvironment(): ServerConfig {
  const requiredVars = ['TELEGRAM_BOT_TOKEN', 'WEBHOOK_PUBLIC_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    publicUrl: process.env.WEBHOOK_PUBLIC_URL!,
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

async function startServer(): Promise<void> {
  console.log('🚀 Starting BrainAI Bot webhook server (no ngrok)...\n');

  try {
    // Validate environment
    const cfg = validateEnvironment();

    // Force server mode defaults
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.USE_NGROK = 'false';

    // Create bot instance for webhook mode
    const bot = startBotWebhook();

    // Start webhook server (no ngrok)
    const webhookHandler = await startWebhook(bot);

    // Display server info
    console.log('\n🎉 Webhook server started successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Bot is running in webhook mode (no ngrok)');
    const baseUrl = cfg.publicUrl.replace(/\/$/, '');
    await webhookHandler.getStatus();
    console.log(`📡 Webhook URL: ${baseUrl}/webhook`);
    console.log(`🔍 Health check: ${baseUrl}/health`);
    console.log(`📚 API docs: ${baseUrl}/docs`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      try {
        await webhookHandler.stop();
        console.log('✅ Webhook server stopped');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

    process.on('uncaughtException', async (error: Error) => {
      console.error('❌ Uncaught Exception:', error);
      try {
        await webhookHandler.stop();
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      try {
        await webhookHandler.stop();
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start webhook server:', error instanceof Error ? error.message : error);
    console.error('\n🔧 Troubleshooting:');
    console.error('  • Ensure WEBHOOK_PUBLIC_URL is set to your public domain (https)');
    console.error('  • Verify your Telegram bot token is valid');
    console.error('  • Ensure your server port is accessible from the internet');
    console.error('  • Run `npm run type-check` to verify TypeScript compilation');
    process.exit(1);
  }
}

// Banner
console.log(`
┌─────────────────────────────────────────┐
│           🤖 BrainAI Bot               │
│     Webhook Server (no ngrok)         │
│            TypeScript Edition          │
└─────────────────────────────────────────┘
`);

// Start server
startServer().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});


