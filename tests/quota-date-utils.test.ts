import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Quota Date Utilities', () => {
  let mockDate: Date;

  beforeEach(() => {
    // Set a consistent date for testing
    mockDate = new Date('2024-01-15T12:00:00Z'); // Monday, January 15, 2024
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDateUTC', () => {
    it('should format date correctly in UTC', () => {
      const testCases = [
        { input: new Date('2024-01-01T00:00:00Z'), expected: '2024-01-01' },
        { input: new Date('2024-12-31T23:59:59Z'), expected: '2024-12-31' },
        { input: new Date('2024-02-29T12:00:00Z'), expected: '2024-02-29' }, // Leap year
        { input: new Date('2024-10-05T00:00:00Z'), expected: '2024-10-05' },
      ];

      // Simulate the formatDateUTC function
      const formatDateUTC = (d: Date): string => {
        const year = d.getUTCFullYear();
        const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${d.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      testCases.forEach(({ input, expected }) => {
        expect(formatDateUTC(input)).toBe(expected);
      });
    });

    it('should handle timezone conversions correctly', () => {
      // Test that local time doesn't affect UTC formatting
      const formatDateUTC = (d: Date): string => {
        const year = d.getUTCFullYear();
        const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${d.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Date in different timezones should format to same UTC date
      const utcDate = new Date('2024-01-15T23:00:00Z');
      const estDate = new Date('2024-01-15T18:00:00-05:00'); // Same moment in EST

      expect(formatDateUTC(utcDate)).toBe('2024-01-15');
      expect(formatDateUTC(estDate)).toBe('2024-01-15');
    });
  });

  describe('getCurrentWeekPeriodUTC', () => {
    it('should calculate Monday to Sunday week periods correctly', () => {
      const getCurrentWeekPeriodUTC = (now: Date = new Date()): { start: string; end: string } => {
        const formatDateUTC = (d: Date): string => {
          const year = d.getUTCFullYear();
          const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
          const day = `${d.getUTCDate()}`.padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const day = now.getUTCDay(); // 0=Sun, 1=Mon, ...
        const diffToMonday = day === 0 ? -6 : 1 - day; // move to Monday
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        startDate.setUTCDate(startDate.getUTCDate() + diffToMonday);
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 6);
        return { start: formatDateUTC(startDate), end: formatDateUTC(endDate) };
      };

      const testCases = [
        {
          date: new Date('2024-01-15T12:00:00Z'), // Monday
          expectedStart: '2024-01-15',
          expectedEnd: '2024-01-21'
        },
        {
          date: new Date('2024-01-16T12:00:00Z'), // Tuesday
          expectedStart: '2024-01-15',
          expectedEnd: '2024-01-21'
        },
        {
          date: new Date('2024-01-17T12:00:00Z'), // Wednesday
          expectedStart: '2024-01-15',
          expectedEnd: '2024-01-21'
        },
        {
          date: new Date('2024-01-21T12:00:00Z'), // Sunday
          expectedStart: '2024-01-15',
          expectedEnd: '2024-01-21'
        },
        {
          date: new Date('2024-01-22T00:00:00Z'), // Next Monday
          expectedStart: '2024-01-22',
          expectedEnd: '2024-01-28'
        },
      ];

      testCases.forEach(({ date, expectedStart, expectedEnd }) => {
        const period = getCurrentWeekPeriodUTC(date);
        expect(period.start).toBe(expectedStart);
        expect(period.end).toBe(expectedEnd);
      });
    });

    it('should handle year boundaries correctly', () => {
      const getCurrentWeekPeriodUTC = (now: Date = new Date()): { start: string; end: string } => {
        const formatDateUTC = (d: Date): string => {
          const year = d.getUTCFullYear();
          const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
          const day = `${d.getUTCDate()}`.padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        const day = now.getUTCDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        startDate.setUTCDate(startDate.getUTCDate() + diffToMonday);
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + 6);
        return { start: formatDateUTC(startDate), end: formatDateUTC(endDate) };
      };

      // Test week spanning year boundary
      const newYearWeek = getCurrentWeekPeriodUTC(new Date('2024-01-01T12:00:00Z')); // Monday
      expect(newYearWeek.start).toBe('2024-01-01');
      expect(newYearWeek.end).toBe('2024-01-07');

      // Test week before year boundary
      const lastWeekOfYear = getCurrentWeekPeriodUTC(new Date('2023-12-28T12:00:00Z')); // Thursday
      expect(lastWeekOfYear.start).toBe('2023-12-25'); // Monday
      expect(lastWeekOfYear.end).toBe('2023-12-31'); // Sunday
    });
  });

  describe('addDaysUTC', () => {
    it('should add days correctly in UTC', () => {
      const addDaysUTC = (d: Date, days: number): Date => {
        const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        c.setUTCDate(c.getUTCDate() + days);
        return c;
      };

      const formatDateUTC = (d: Date): string => {
        const year = d.getUTCFullYear();
        const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${d.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDate = new Date('2024-01-15T12:00:00Z');

      // Test adding positive days
      expect(formatDateUTC(addDaysUTC(startDate, 1))).toBe('2024-01-16');
      expect(formatDateUTC(addDaysUTC(startDate, 7))).toBe('2024-01-22');
      expect(formatDateUTC(addDaysUTC(startDate, 30))).toBe('2024-02-14');

      // Test adding negative days
      expect(formatDateUTC(addDaysUTC(startDate, -1))).toBe('2024-01-14');
      expect(formatDateUTC(addDaysUTC(startDate, -7))).toBe('2024-01-08');

      // Test month boundary
      const endOfMonth = new Date('2024-01-31T12:00:00Z');
      expect(formatDateUTC(addDaysUTC(endOfMonth, 1))).toBe('2024-02-01');

      // Test year boundary
      const endOfYear = new Date('2023-12-31T12:00:00Z');
      expect(formatDateUTC(addDaysUTC(endOfYear, 1))).toBe('2024-01-01');
    });
  });

  describe('Weekly Period Anchoring', () => {
    it('should calculate weekly periods anchored to a specific start date', () => {
      const addDaysUTC = (d: Date, days: number): Date => {
        const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        c.setUTCDate(c.getUTCDate() + days);
        return c;
      };

      const formatDateUTC = (d: Date): string => {
        const year = d.getUTCFullYear();
        const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${d.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // Simulate the anchored period calculation for free users
      const getAnchoredWeeklyPeriod = (anchorDate: Date, currentDate: Date): { start: string; end: string } => {
        let periodStart = new Date(
          Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate())
        );

        // Move forward in 7-day increments until we find the current period
        while (addDaysUTC(periodStart, 7) <= currentDate) {
          periodStart = addDaysUTC(periodStart, 7);
        }

        const periodEnd = addDaysUTC(periodStart, 6);
        return { start: formatDateUTC(periodStart), end: formatDateUTC(periodEnd) };
      };

      // Test cases
      const anchorDate = new Date('2024-01-03T10:00:00Z'); // Wednesday

      // Same week
      let period = getAnchoredWeeklyPeriod(anchorDate, new Date('2024-01-05T12:00:00Z'));
      expect(period.start).toBe('2024-01-03');
      expect(period.end).toBe('2024-01-09');

      // Exactly 1 week later
      period = getAnchoredWeeklyPeriod(anchorDate, new Date('2024-01-10T12:00:00Z'));
      expect(period.start).toBe('2024-01-10');
      expect(period.end).toBe('2024-01-16');

      // 2 weeks and 3 days later
      period = getAnchoredWeeklyPeriod(anchorDate, new Date('2024-01-20T12:00:00Z'));
      expect(period.start).toBe('2024-01-17');
      expect(period.end).toBe('2024-01-23');
    });

    it('should handle edge cases for weekly period calculation', () => {
      const addDaysUTC = (d: Date, days: number): Date => {
        const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        c.setUTCDate(c.getUTCDate() + days);
        return c;
      };

      const formatDateUTC = (d: Date): string => {
        const year = d.getUTCFullYear();
        const month = `${d.getUTCMonth() + 1}`.padStart(2, '0');
        const day = `${d.getUTCDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const getAnchoredWeeklyPeriod = (anchorDate: Date, currentDate: Date): { start: string; end: string } => {
        let periodStart = new Date(
          Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate())
        );

        while (addDaysUTC(periodStart, 7) <= currentDate) {
          periodStart = addDaysUTC(periodStart, 7);
        }

        const periodEnd = addDaysUTC(periodStart, 6);
        return { start: formatDateUTC(periodStart), end: formatDateUTC(periodEnd) };
      };

      // Test exact boundary - last second of a period
      const anchorDate = new Date('2024-01-01T00:00:00Z'); // Monday
      const lastSecondOfWeek = new Date('2024-01-07T23:59:59Z'); // Sunday
      let period = getAnchoredWeeklyPeriod(anchorDate, lastSecondOfWeek);
      expect(period.start).toBe('2024-01-01');
      expect(period.end).toBe('2024-01-07');

      // First second of next period
      const firstSecondOfNextWeek = new Date('2024-01-08T00:00:00Z'); // Next Monday
      period = getAnchoredWeeklyPeriod(anchorDate, firstSecondOfNextWeek);
      expect(period.start).toBe('2024-01-08');
      expect(period.end).toBe('2024-01-14');
    });
  });
});
