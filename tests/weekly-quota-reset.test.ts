import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

// Mock environment variables
vi.mock('dotenv/config', () => ({}));

describe('Weekly Request Quota Reset', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn(),
    };
    (createClient as any).mockReturnValue(mockSupabase);

    // Mock environment variables
    process.env.DEFAULT_TEXT_REQUESTS = '100';
    process.env.DEFAULT_IMAGE_REQUESTS = '10';
    process.env.DEFAULT_VIDEO_REQUESTS = '5';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('demonstrates weekly quota reset after 1 week', async () => {
    const userId = 'test-user-123';
    const telegramId = 12345;

    // Mock user data
    const mockUser = {
      id: userId,
      telegram_id: telegramId,
      is_premium: false,
      created_at: '2024-01-01T00:00:00Z',
      free_period_start: '2024-01-01',
    };

    const supabaseHandler = await import('../src/handlers/supabase-handler.js');

    // === WEEK 1: Monday Jan 1 - Sunday Jan 7 ===
    vi.setSystemTime(new Date('2024-01-05T12:00:00Z')); // Friday of first week

    // Setup user mock
    const userSelectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockUser,
          error: null,
        }),
      }),
    });

    // Mock quota for first week - 50 requests used
    const quotaMock = vi.fn();
    quotaMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'quota-week1',
                user_id: userId,
                period_start: '2024-01-01',
                period_end: '2024-01-07',
                text_used: 50,
                image_used: 5,
                video_used: 2,
              },
              error: null,
            }),
          }),
        }),
      }),
    }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'gpt_tg_users') {
        return { select: userSelectMock };
      }
      if (table === 'user_quotas') {
        return quotaMock();
      }
    });

    // Check remaining requests in first week
    const week1Remaining = await supabaseHandler.getRemainingRequests(telegramId, 'text_req_left');
    expect(week1Remaining).toBe(50); // 100 - 50 = 50 remaining

    // Can still consume requests
    const canConsumeWeek1 = await supabaseHandler.canConsumeRequest(
      telegramId,
      'text_req_left',
      10,
    );
    expect(canConsumeWeek1).toBe(true);

    console.log('Week 1 - Remaining text requests:', week1Remaining);

    // === WEEK 2: Monday Jan 8 - Sunday Jan 14 ===
    vi.setSystemTime(new Date('2024-01-08T12:00:00Z')); // Monday of second week

    // For the second week, the system will look for a quota row for the new period
    // When it doesn't find one, it will create a new one
    quotaMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: null, // No quota row exists for week 2 yet
              error: null,
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'quota-week2',
              user_id: userId,
              period_start: '2024-01-08',
              period_end: '2024-01-14',
              text_used: 0, // Fresh start!
              image_used: 0,
              video_used: 0,
              reset_at: '2024-01-08T12:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    }));

    // Check remaining requests in second week
    const week2Remaining = await supabaseHandler.getRemainingRequests(telegramId, 'text_req_left');
    expect(week2Remaining).toBe(100); // Full quota available!

    // Can consume the full amount again
    const canConsumeWeek2 = await supabaseHandler.canConsumeRequest(
      telegramId,
      'text_req_left',
      100,
    );
    expect(canConsumeWeek2).toBe(true);

    console.log('Week 2 - Remaining text requests:', week2Remaining);
    console.log('✅ Quota successfully reset after 1 week!');

    // === Verify different request types also reset ===
    const imageRemaining = await supabaseHandler.getRemainingRequests(telegramId, 'image_req_left');
    expect(imageRemaining).toBe(10); // Full image quota

    const videoRemaining = await supabaseHandler.getRemainingRequests(telegramId, 'video_req_left');
    expect(videoRemaining).toBe(5); // Full video quota
  });
});
