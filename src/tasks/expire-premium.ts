import 'dotenv/config';
import { checkAndExpireAllPremium } from '../handlers/supabase-handler.js';

/**
 * Scheduled task to check and expire premium subscriptions
 * This script should be run periodically (e.g., daily via cron job)
 */
async function expirePremiumTask(): Promise<void> {
  console.log('🔍 Starting premium expiration check...');

  try {
    // Validate required environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_KEY are required');
    }

    const result = await checkAndExpireAllPremium();

    if (result.expired > 0) {
      console.log(`✅ Successfully expired ${result.expired} premium subscriptions`);
    } else {
      console.log('✅ No premium subscriptions to expire');
    }

    if (result.errors > 0) {
      console.warn(`⚠️ ${result.errors} errors occurred during expiration check`);
    }

    console.log('🏁 Premium expiration check completed');
  } catch (error) {
    console.error('❌ Premium expiration task failed:', error);

    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Run the task if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  expirePremiumTask()
    .then(() => {
      console.log('✅ Premium expiration task completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Premium expiration task failed:', error);
      process.exit(1);
    });
}

export { expirePremiumTask };
