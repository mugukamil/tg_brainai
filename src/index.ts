import 'dotenv/config';
import { startBot } from './tg-bot.js';
import { startWebhook } from './handlers/webhook-handler.js';

interface StartupConfig {
  useWebhook: boolean;
  isDevelopment: boolean;
  port: number;
  webhookUrl: string | undefined;
}

function getStartupConfig(): StartupConfig {
  return {
    useWebhook: process.env.USE_WEBHOOK === 'true',
    isDevelopment: process.env.NODE_ENV === 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    webhookUrl: process.env.WEBHOOK_URL,
  };
}

async function main(): Promise<void> {
  try {
    console.log('🚀 Starting BrainAI Bot...');

    // Validate required environment variables
    const requiredEnvVars = [
      'TELEGRAM_BOT_TOKEN',
      'OPENAI_API_KEY',
      'GOAPI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_KEY',
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:');
      missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
      });
      console.error('\n💡 Please check your .env file and ensure all required variables are set.');
      process.exit(1);
    }

    const config = getStartupConfig();

    if (config.useWebhook) {
      console.log('🌐 Starting in webhook mode...');

      await startWebhook(startBot());

      console.log('✅ BrainAI Bot started successfully in webhook mode!');
    } else {
      console.log('📡 Starting in polling mode...');

      startBot();

      console.log('✅ BrainAI Bot started successfully in polling mode!');
    }

    // Log startup configuration (without sensitive data)
    console.log('📊 Startup Configuration:');
    console.log(`   Mode: ${config.useWebhook ? 'Webhook' : 'Polling'}`);
    console.log(`   Environment: ${config.isDevelopment ? 'Development' : 'Production'}`);
    console.log(`   Port: ${config.port}`);
    if (config.webhookUrl) {
      console.log(`   Webhook URL: ${config.webhookUrl}`);
    }

    console.log('\n🎉 Bot is ready to receive messages!');
  } catch (error) {
    console.error('❌ Failed to start BrainAI Bot:', error);

    if (error instanceof Error) {
      console.error('Error details:', error.message);

      // Provide specific troubleshooting based on error type
      if (error.message.includes('EADDRINUSE')) {
        console.error(
          '💡 Port is already in use. Try a different port or stop the conflicting process.',
        );
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('💡 Network connectivity issue. Check your internet connection.');
      } else if (error.message.includes('unauthorized') ?? error.message.includes('401')) {
        console.error('💡 Authentication failed. Check your API keys in the .env file.');
      } else if (error.message.includes('webhook')) {
        console.error(
          '💡 Webhook setup failed. Check ngrok installation and network connectivity.',
        );
      }
    }

    process.exit(1);
  }
}

// Handle graceful shutdown
const shutdown = (signal: string): void => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  // Give time for cleanup operations
  setTimeout(() => {
    console.log('✅ BrainAI Bot stopped');
    process.exit(0);
  }, 1000);
};

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error: Error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch(error => {
  console.error('❌ Fatal startup error:', error);
  process.exit(1);
});
