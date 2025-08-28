import { createClient } from '@supabase/supabase-js';
import type {
  BotUser,
  CreateUserData,
  UpdateUserData,
  UserStats,
  RequestType,
} from '../types/index.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Find user by Telegram ID
 */
export async function findUser(telegramId: number): Promise<BotUser | null> {
  try {
    const { data, error } = await supabase
      .from('gpt_tg_users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - user doesn't exist
        return null;
      }
      console.error('Error finding user:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Unexpected error finding user:', error);
    return null;
  }
}

/**
 * Create new user with default settings
 */
export async function createUser(
  telegramId: number,
  threadId: string,
  options: Partial<CreateUserData> = {},
): Promise<BotUser | null> {
  try {
    const defaultUser: CreateUserData = {
      telegram_id: telegramId,
      openai_thread_id: threadId,
      current_mode: 'txt',
      text_req_left: 100,
      image_req_left: 10,
      video_req_left: 5,
      accepted_terms: false,
      is_premium: false,
      ...options,
    };

    const { data, error } = await supabase
      .from('gpt_tg_users')
      .insert([defaultUser])
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Unexpected error creating user:', error);
    return null;
  }
}

/**
 * Update user data
 */
export async function updateUser(
  telegramId: number,
  updates: UpdateUserData,
): Promise<BotUser | null> {
  try {
    const { data, error } = await supabase
      .from('gpt_tg_users')
      .update(updates)
      .eq('telegram_id', telegramId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Unexpected error updating user:', error);
    return null;
  }
}

/**
 * Set user as premium
 */
export async function setPremium(telegramId: number): Promise<boolean> {
  try {
    const updates: UpdateUserData = {
      is_premium: true,
      text_req_left: 1000,
      image_req_left: 100,
      video_req_left: 50,
    };

    const result = await updateUser(telegramId, updates);
    return result !== null;
  } catch (error) {
    console.error('Error setting premium status:', error);
    return false;
  }
}

/**
 * Accept terms of service for user
 */
export async function acceptTerms(telegramId: number): Promise<boolean> {
  try {
    const result = await updateUser(telegramId, { accepted_terms: true });
    return result !== null;
  } catch (error) {
    console.error('Error accepting terms:', error);
    return false;
  }
}

/**
 * Decrease user requests and return updated count
 */
export async function decreaseRequests(
  telegramId: number,
  requestType: RequestType,
  amount: number = 1,
): Promise<number | null> {
  try {
    const user = await findUser(telegramId);
    if (!user) {
      console.error('User not found for request decrease');
      return null;
    }

    const currentCount = user[requestType] || 0;
    const newCount = Math.max(0, currentCount - amount);

    const result = await updateUser(telegramId, { [requestType]: newCount });
    return result ? newCount : null;
  } catch (error) {
    console.error('Error decreasing requests:', error);
    return null;
  }
}

/**
 * Check if user has enough requests
 */
export function hasRequestsLeft(user: BotUser | null, requestType: RequestType): boolean {
  if (!user) return false;
  return (user[requestType] || 0) > 0;
}

/**
 * Get user stats summary
 */
export async function getUserStats(telegramId: number): Promise<UserStats | null> {
  try {
    const user = await findUser(telegramId);
    if (!user) return null;

    return {
      telegram_id: user.telegram_id,
      current_mode: user.current_mode,
      text_req_left: user.text_req_left || 0,
      image_req_left: user.image_req_left || 0,
      video_req_left: user.video_req_left || 0,
      is_premium: user.is_premium || false,
      accepted_terms: user.accepted_terms || false,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
}

/**
 * Reset user requests (daily/monthly reset)
 */
export async function resetUserRequests(
  telegramId: number,
  isPremium: boolean = false,
): Promise<boolean> {
  try {
    const updates: UpdateUserData = isPremium
      ? {
          text_req_left: 1000,
          image_req_left: 100,
          video_req_left: 50,
        }
      : {
          text_req_left: 100,
          image_req_left: 10,
          video_req_left: 5,
        };

    const result = await updateUser(telegramId, updates);
    return result !== null;
  } catch (error) {
    console.error('Error resetting user requests:', error);
    return false;
  }
}

/**
 * Get all users (for admin purposes)
 */
export async function getAllUsers(limit: number = 100, offset: number = 0): Promise<BotUser[]> {
  try {
    const { data, error } = await supabase
      .from('gpt_tg_users')
      .select('*')
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting all users:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Unexpected error getting all users:', error);
    return [];
  }
}

/**
 * Delete user (for GDPR compliance)
 */
export async function deleteUser(telegramId: number): Promise<boolean> {
  try {
    const { error } = await supabase.from('gpt_tg_users').delete().eq('telegram_id', telegramId);

    if (error) {
      console.error('Error deleting user:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Unexpected error deleting user:', error);
    return false;
  }
}

// Centralized interaction logs (optional)
export async function insertInteractionLog(record: {
  user_id: number;
  chat_id: number;
  direction: string;
  type: string;
  content: string;
  meta: Record<string, unknown> | null;
  timestamp: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('gpt_tg_interactions').insert([record]);
    if (error) {
      console.error('Error inserting interaction log:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Unexpected error inserting interaction log:', error);
    return false;
  }
}
