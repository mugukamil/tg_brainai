import { createClient } from '@supabase/supabase-js';
import type {
  DbUser,
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

// Quota configuration (weekly limits)
const DEFAULT_TEXT_REQUESTS = parseInt(process.env.DEFAULT_TEXT_REQUESTS ?? '100', 10);
const DEFAULT_IMAGE_REQUESTS = parseInt(process.env.DEFAULT_IMAGE_REQUESTS ?? '10', 10);
const DEFAULT_VIDEO_REQUESTS = parseInt(process.env.DEFAULT_VIDEO_REQUESTS ?? '5', 10);

const PREMIUM_TEXT_REQUESTS = parseInt(process.env.PREMIUM_TEXT_REQUESTS ?? '1000', 10);
const PREMIUM_IMAGE_REQUESTS = parseInt(process.env.PREMIUM_IMAGE_REQUESTS ?? '100', 10);
const PREMIUM_VIDEO_REQUESTS = parseInt(process.env.PREMIUM_VIDEO_REQUESTS ?? '50', 10);

type QuotaRow = {
  id: string;
  user_id: string;
  period_start: string; // DATE
  period_end: string; // DATE
  text_used: number;
  image_used: number;
  video_used: number;
  reset_at: string;
  created_at: string;
  updated_at: string;
};

function formatDateUTC(d: Date): string {
  const year = d.getUTCFullYear();
  const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${d.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ISO week: Monday 00:00:00 UTC to Sunday 23:59:59 UTC
function getCurrentWeekPeriodUTC(now: Date = new Date()): { start: string; end: string } {
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day; // move to Monday
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  startDate.setUTCDate(startDate.getUTCDate() + diffToMonday);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  return { start: formatDateUTC(startDate), end: formatDateUTC(endDate) };
}

function getLimits(isPremium: boolean): { text: number; image: number; video: number } {
  if (isPremium) {
    return {
      text: PREMIUM_TEXT_REQUESTS,
      image: PREMIUM_IMAGE_REQUESTS,
      video: PREMIUM_VIDEO_REQUESTS,
    };
  }
  return {
    text: DEFAULT_TEXT_REQUESTS,
    image: DEFAULT_IMAGE_REQUESTS,
    video: DEFAULT_VIDEO_REQUESTS,
  };
}

function mapRequestTypeToColumn(
  requestType: RequestType,
): 'text_used' | 'image_used' | 'video_used' {
  if (requestType === 'image_req_left') return 'image_used';
  if (requestType === 'video_req_left') return 'video_used';
  return 'text_used';
}

function addDaysUTC(d: Date, days: number): Date {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  c.setUTCDate(c.getUTCDate() + days);
  return c;
}

function addMonthsUTC(d: Date, months: number): Date {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  c.setUTCMonth(c.getUTCMonth() + months);
  return c;
}

function getAnchoredPeriodForUser(
  user: Partial<DbUser> & {
    free_period_start?: string | Date;
    premium_started_at?: string | Date;
  },
): { start: string; end: string } {
  const now = new Date();
  if (user.is_premium) {
    const source = user.premium_started_at ?? user.created_at ?? now;
    const anchor = new Date(source);
    let periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchor.getUTCDate()),
    );
    if (periodStart > now) {
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, anchor.getUTCDate()),
      );
    }
    const end = addMonthsUTC(periodStart, 1);
    end.setUTCDate(end.getUTCDate() - 1);
    return { start: formatDateUTC(periodStart), end: formatDateUTC(end) };
  }
  const freeSource = user.free_period_start ?? user.created_at ?? now;
  const anchor = new Date(freeSource);
  let periodStart = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()),
  );
  while (addDaysUTC(periodStart, 7) <= now) {
    periodStart = addDaysUTC(periodStart, 7);
  }
  const end = addDaysUTC(periodStart, 6);
  return { start: formatDateUTC(periodStart), end: formatDateUTC(end) };
}

async function getOrCreateCurrentQuotaRow(userDbId: string): Promise<QuotaRow | null> {
  // Pull minimal user fields to compute anchored period
  const { data: userRow, error: uErr } = await supabase
    .from('gpt_tg_users')
    .select('id, is_premium, created_at, premium_started_at, free_period_start')
    .eq('id', userDbId)
    .single();
  if (uErr) {
    console.error('Error fetching user for period calc:', uErr);
  }
  const { start, end } = userRow ? getAnchoredPeriodForUser(userRow) : getCurrentWeekPeriodUTC();
  // Try to fetch existing row
  const existing = await supabase
    .from('user_quotas')
    .select('*')
    .eq('user_id', userDbId)
    .eq('period_start', start)
    .maybeSingle();

  if (existing.error && existing.error.code !== 'PGRST116') {
    console.error('Error fetching user_quotas:', existing.error);
    return null;
  }
  if (existing.data) return existing.data as unknown as QuotaRow;

  // Create new row with zeros for current period
  const insertRes = await supabase
    .from('user_quotas')
    .insert([
      {
        user_id: userDbId,
        period_start: start,
        period_end: end,
        text_used: 0,
        image_used: 0,
        video_used: 0,
        reset_at: new Date().toISOString(),
      },
    ])
    .select('*')
    .single();

  if (insertRes.error) {
    console.error('Error inserting user_quotas:', insertRes.error);
    return null;
  }
  return insertRes.data as unknown as QuotaRow;
}

/**
 * Find user by Telegram ID
 */
export async function findUser(telegramId: number): Promise<DbUser | null> {
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
    return data as DbUser;
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
): Promise<DbUser | null> {
  try {
    const today = new Date();
    const defaultUser: CreateUserData = {
      telegram_id: telegramId,
      openai_thread_id: threadId,
      current_mode: 'text',
      text_req_left: 100,
      image_req_left: 10,
      video_req_left: 5,
      accepted_terms: false,
      is_premium: false,
      free_period_start: formatDateUTC(today),
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
    return data as DbUser;
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
): Promise<DbUser | null> {
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
    return data as DbUser;
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
    const result = await updateUser(telegramId, {
      is_premium: true,
      premium_started_at: new Date().toISOString(),
    });
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
  amount = 1,
): Promise<number | null> {
  try {
    const user = await findUser(telegramId);
    if (!user) {
      console.error('User not found for request decrease');
      return null;
    }
    const quotaRow = await getOrCreateCurrentQuotaRow(String(user.id));
    if (!quotaRow) return null;
    const column = mapRequestTypeToColumn(requestType);
    const newUsed = Math.max(0, (quotaRow as any)[column] + amount);
    const updateRes = await supabase
      .from('user_quotas')
      .update({ [column]: newUsed })
      .eq('id', quotaRow.id)
      .select('*')
      .single();
    if (updateRes.error) {
      console.error('Error updating user_quotas usage:', updateRes.error);
      return null;
    }
    const limits = getLimits(!!user.is_premium);
    const maxForType =
      requestType === 'image_req_left'
        ? limits.image
        : requestType === 'video_req_left'
          ? limits.video
          : limits.text;
    const remaining = Math.max(0, maxForType - newUsed);
    return remaining;
  } catch (error) {
    console.error('Error decreasing requests:', error);
    return null;
  }
}

/**
 * Compute remaining requests for the current week
 */
export async function getRemainingRequests(
  telegramId: number,
  requestType: RequestType,
): Promise<number | null> {
  try {
    const user = await findUser(telegramId);
    if (!user) return null;
    const limits = getLimits(!!user.is_premium);
    const quotaRow = await getOrCreateCurrentQuotaRow(String(user.id));
    if (!quotaRow) return null;
    const used =
      requestType === 'image_req_left'
        ? quotaRow.image_used
        : requestType === 'video_req_left'
          ? quotaRow.video_used
          : quotaRow.text_used;
    const maxForType =
      requestType === 'image_req_left'
        ? limits.image
        : requestType === 'video_req_left'
          ? limits.video
          : limits.text;
    return Math.max(0, maxForType - used);
  } catch (e) {
    console.error('Error getting remaining requests:', e);
    return null;
  }
}

/**
 * Check if user can consume a request of given type this week
 */
export async function canConsumeRequest(
  telegramId: number,
  requestType: RequestType,
  amount = 1,
): Promise<boolean> {
  const remaining = await getRemainingRequests(telegramId, requestType);
  if (remaining === null) return false;
  return remaining >= amount;
}

/**
 * Check if user has enough requests
 */
export function hasRequestsLeft(user: DbUser | null, requestType: RequestType): boolean {
  if (!user) return false;
  const limits = getLimits(!!user.is_premium);
  // This function cannot be async (kept for compatibility). Optimistically compare against cached counts (0 means unknown)
  // Callers should rely on decreaseRequests to strictly enforce limits.
  const provisionalLeft =
    requestType === 'image_req_left'
      ? limits.image
      : requestType === 'video_req_left'
        ? limits.video
        : limits.text;
  return provisionalLeft > 0;
}

/**
 * Get user stats summary
 */
export async function getUserStats(telegramId: number): Promise<UserStats | null> {
  try {
    const user = await findUser(telegramId);
    if (!user) return null;
    const limits = getLimits(!!user.is_premium);
    const quotaRow = await getOrCreateCurrentQuotaRow(String(user.id));
    const textUsed = quotaRow?.text_used ?? 0;
    const imageUsed = quotaRow?.image_used ?? 0;
    const videoUsed = quotaRow?.video_used ?? 0;
    const createdRaw: any = (user as any).created_at;
    const updatedRaw: any = (user as any).updated_at ?? createdRaw;
    const created_at =
      typeof createdRaw === 'string' ? createdRaw : new Date(createdRaw).toISOString();
    const updated_at =
      typeof updatedRaw === 'string' ? updatedRaw : new Date(updatedRaw).toISOString();
    const modeRaw: any = (user as any).current_mode;
    const current_mode = modeRaw;
    return {
      telegram_id: (user as any).telegram_id,
      current_mode,
      text_req_left: Math.max(0, limits.text - textUsed),
      image_req_left: Math.max(0, limits.image - imageUsed),
      video_req_left: Math.max(0, limits.video - videoUsed),
      is_premium: !!(user as any).is_premium,
      accepted_terms: !!(user as any).accepted_terms,
      created_at,
      updated_at,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
}

/**
 * Reset user requests (daily/monthly reset)
 */
export async function resetUserRequests(telegramId: number, isPremium = false): Promise<boolean> {
  try {
    const user = await findUser(telegramId);
    if (!user) return false;
    const quotaRow = await getOrCreateCurrentQuotaRow(String(user.id));
    if (!quotaRow) return false;
    const { error } = await supabase
      .from('user_quotas')
      .update({
        text_used: 0,
        image_used: 0,
        video_used: 0,
        reset_at: new Date().toISOString(),
      })
      .eq('id', quotaRow.id);
    if (error) {
      console.error('Error resetting user weekly quotas:', error);
      return false;
    }
    // Optionally sync premium flag
    if (isPremium && !user.is_premium) {
      await updateUser(telegramId, { is_premium: true });
    }
    return true;
  } catch (error) {
    console.error('Error resetting user requests:', error);
    return false;
  }
}

/**
 * Get all users (for admin purposes)
 */
export async function getAllUsers(limit = 100, offset = 0): Promise<DbUser[]> {
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
    return data ?? [];
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
