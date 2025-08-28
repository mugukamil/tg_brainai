#!/usr/bin/env node

/**
 * Development script for running the bot in webhook mode with ngrok
 * This script sets up local development environment with webhook support using TypeScript
 */

import 'dotenv/config';
import { startBotWebhook } from './tg-bot.js';
import { startWebhook } from './handlers/webhook-handler.js';

interface DevConfig {
  botToken: string;
  nodeEnv: string;
  port: number;
}

function validateEnvironment(): DevConfig {
  const requiredVars = ['TELEGRAM_BOT_TOKEN'];
  const missing = requiredVars.filter(varName => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  };
}

async function startDevelopment(): Promise<void> {
  console.log('🔧 Starting BrainAI Bot in webhook development mode...\n');

  try {
    // Validate environment
    validateEnvironment();

    // Set development environment
    process.env.NODE_ENV = 'development';

    // Create bot instance for webhook mode
    const bot = startBotWebhook();

    // Start webhook with ngrok
    console.log('🌐 Setting up Fastify webhook with ngrok...');
    const webhookHandler = await startWebhook(bot);

    // Display development info
    console.log('\n🎉 Development server started successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📱 Your bot is now running in webhook mode');
    const status = await webhookHandler.getStatus();
    console.log(`🔗 Ngrok URL: ${status.local?.ngrokUrl || 'N/A'}`);
    console.log(`📡 Webhook URL: ${status.local?.webhookUrl || 'N/A'}`);
    console.log(`🔍 Health check: ${status.local?.ngrokUrl || 'N/A'}/health`);
    console.log(`📚 API docs: ${status.local?.ngrokUrl || 'N/A'}/docs`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Tips for development:');
    console.log('  • Test your bot by sending messages in Telegram');
    console.log('  • Check webhook health at the health endpoint');
    console.log('  • Watch console logs for incoming requests');
    console.log('  • Press Ctrl+C to stop and cleanup');

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

      try {
        await webhookHandler.stop();
        console.log('✅ Webhook development server stopped');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    };

    // Setup shutdown handlers
    process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));

    // Handle uncaught exceptions
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
    console.error(
      '❌ Failed to start Fastify development server:',
      error instanceof Error ? error.message : error,
    );
    console.error('\n🔧 Troubleshooting:');
    console.error('  • Make sure your .env file is configured');
    console.error('  • Check that ngrok is installed (npm install -g ngrok)');
    console.error('  • Verify your Telegram bot token is valid');
    console.error('  • Ensure no other processes are using the same port');
    console.error('  • Check that all Fastify plugins are installed');
    console.error('  • Run `npm run type-check` to verify TypeScript compilation');
    process.exit(1);
  }
}

// Display startup banner
console.log(`
┌─────────────────────────────────────────┐
│           🤖 BrainAI Bot Dev             │
│      Fastify Webhook Development       │
│            TypeScript Edition           │
└─────────────────────────────────────────┘
`);

// Start development server
startDevelopment().catch(error => {
  console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
