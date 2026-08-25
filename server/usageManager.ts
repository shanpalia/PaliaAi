import fs from 'fs';
import path from 'path';

export interface DailyUsageRecord {
  user_id: string;
  usage_date: string; // 'YYYY-MM-DD'
  used_seconds: number;
  daily_limit_seconds: number; // default 7200 (2 hours)
  updated_at: number;
  timezone: string;
}

export interface AdminUsageConfig {
  defaultDailyLimitMinutes: number; // default 120 (2 hours)
  userOverrides: Record<string, number>; // userId -> custom limit minutes
}

interface UsageDBData {
  records: Record<string, DailyUsageRecord>; // key: `${user_id}_${usage_date}`
  adminConfig: AdminUsageConfig;
}

export interface UsageStatus {
  user_id: string;
  usage_date: string;
  used_seconds: number;
  daily_limit_seconds: number;
  remaining_seconds: number;
  daily_limit_minutes: number;
  formatted_remaining: string;
  formatted_limit: string;
  formatted_used: string;
  is_limit_reached: boolean;
  allowed: boolean;
  warning: string | null;
  timezone: string;
  resets_in_seconds: number;
  resets_at: string;
}

class UsageManager {
  private dbPath: string;
  private data: UsageDBData;

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
        console.error('Could not create data directory:', e);
      }
    }
    this.dbPath = path.join(dataDir, 'daily_usage.json');
    this.data = this.loadDB();
  }

  private loadDB(): UsageDBData {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          records: parsed.records || {},
          adminConfig: {
            defaultDailyLimitMinutes: parsed.adminConfig?.defaultDailyLimitMinutes ?? 120,
            userOverrides: parsed.adminConfig?.userOverrides || {},
          },
        };
      }
    } catch (e) {
      console.warn('Failed to read usage database, initializing defaults:', e);
    }
    return {
      records: {},
      adminConfig: {
        defaultDailyLimitMinutes: 120, // 2 hours
        userOverrides: {},
      },
    };
  }

  private saveDB(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write usage database:', e);
    }
  }

  public getDateInTimezone(tz: string = 'Asia/Kolkata'): string {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz || 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date()); // Returns 'YYYY-MM-DD'
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  public getSecondsUntilMidnight(tz: string = 'Asia/Kolkata'): number {
    try {
      const now = new Date();
      // Get current date string in the target timezone
      const dateStr = this.getDateInTimezone(tz);
      // Construct start of tomorrow in that timezone
      const [year, month, day] = dateStr.split('-').map(Number);
      const tomorrowStr = `${year}-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}T00:00:00`;
      
      // Calculate remaining seconds roughly
      const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const midnight = new Date(localNow);
      midnight.setHours(24, 0, 0, 0);
      const diff = Math.max(0, Math.floor((midnight.getTime() - localNow.getTime()) / 1000));
      return diff;
    } catch {
      return 86400 - (Math.floor(Date.now() / 1000) % 86400);
    }
  }

  public getEffectiveLimitSeconds(userId: string): number {
    const overrideMin = this.data.adminConfig.userOverrides?.[userId];
    if (typeof overrideMin === 'number' && overrideMin > 0) {
      return overrideMin * 60;
    }
    return (this.data.adminConfig.defaultDailyLimitMinutes || 120) * 60;
  }

  public formatRemainingTime(seconds: number): string {
    if (seconds <= 0) {
      return '0m remaining today';
    }
    if (seconds < 60) {
      return `${Math.max(1, Math.floor(seconds))}s remaining today`;
    }
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) {
      return `${totalMinutes}m remaining today`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      return `${hours}h remaining today`;
    }
    return `${hours}h ${mins}m remaining today`;
  }

  public formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins < 60) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }

  public formatLimit(seconds: number): string {
    const hours = seconds / 3600;
    if (Number.isInteger(hours)) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    const mins = Math.floor(seconds / 60);
    return `${mins} minutes`;
  }

  public getWarning(remainingSeconds: number): string | null {
    if (remainingSeconds <= 0) {
      return "You've used today's 2-hour AI allowance. Your AI access will reset tomorrow.";
    }
    if (remainingSeconds <= 300) {
      // 5 minutes
      return '5 minutes remaining today.';
    }
    if (remainingSeconds <= 600) {
      // 10 minutes
      return '10 minutes remaining today.';
    }
    if (remainingSeconds <= 1800) {
      // 30 minutes
      return '30 minutes of AI usage remaining today.';
    }
    if (remainingSeconds <= 3600) {
      // 60 minutes
      return 'You have 1 hour of AI usage remaining today.';
    }
    return null;
  }

  public getOrCreateRecord(userId: string, tz: string = 'Asia/Kolkata'): DailyUsageRecord {
    const validTz = tz || 'Asia/Kolkata';
    const usage_date = this.getDateInTimezone(validTz);
    const key = `${userId}_${usage_date}`;

    if (!this.data.records[key]) {
      const limitSeconds = this.getEffectiveLimitSeconds(userId);
      this.data.records[key] = {
        user_id: userId,
        usage_date,
        used_seconds: 0,
        daily_limit_seconds: limitSeconds,
        updated_at: Date.now(),
        timezone: validTz,
      };
      this.saveDB();
    } else {
      // Ensure daily limit reflects any current admin config update
      const currentLimit = this.getEffectiveLimitSeconds(userId);
      if (this.data.records[key].daily_limit_seconds !== currentLimit) {
        this.data.records[key].daily_limit_seconds = currentLimit;
      }
    }

    return this.data.records[key];
  }

  public getUsageStatus(userId: string, tz: string = 'Asia/Kolkata'): UsageStatus {
    const record = this.getOrCreateRecord(userId, tz);
    const remaining_seconds = Math.max(0, record.daily_limit_seconds - record.used_seconds);
    const is_limit_reached = remaining_seconds <= 0;
    const allowed = !is_limit_reached;
    const warning = this.getWarning(remaining_seconds);
    const resets_in_seconds = this.getSecondsUntilMidnight(record.timezone);

    return {
      user_id: record.user_id,
      usage_date: record.usage_date,
      used_seconds: record.used_seconds,
      daily_limit_seconds: record.daily_limit_seconds,
      remaining_seconds,
      daily_limit_minutes: Math.round(record.daily_limit_seconds / 60),
      formatted_remaining: this.formatRemainingTime(remaining_seconds),
      formatted_limit: `Daily limit: ${this.formatLimit(record.daily_limit_seconds)}`,
      formatted_used: this.formatDuration(record.used_seconds),
      is_limit_reached,
      allowed,
      warning,
      timezone: record.timezone,
      resets_in_seconds,
      resets_at: 'Midnight (00:00)',
    };
  }

  public recordUsage(userId: string, elapsedSeconds: number, tz: string = 'Asia/Kolkata'): UsageStatus {
    const record = this.getOrCreateRecord(userId, tz);
    const actualElapsed = Math.max(1, Math.round(elapsedSeconds));
    record.used_seconds += actualElapsed;
    record.updated_at = Date.now();
    this.saveDB();
    return this.getUsageStatus(userId, tz);
  }

  public resetUserUsage(userId: string, tz: string = 'Asia/Kolkata'): UsageStatus {
    const record = this.getOrCreateRecord(userId, tz);
    record.used_seconds = 0;
    record.updated_at = Date.now();
    this.saveDB();
    return this.getUsageStatus(userId, tz);
  }

  public getAdminConfig(): AdminUsageConfig & {
    allRecordsCount: number;
    todayActiveUsers: number;
  } {
    const today = this.getDateInTimezone('Asia/Kolkata');
    const todayUsers = Object.values(this.data.records).filter((r) => r.usage_date === today).length;
    return {
      defaultDailyLimitMinutes: this.data.adminConfig.defaultDailyLimitMinutes || 120,
      userOverrides: this.data.adminConfig.userOverrides || {},
      allRecordsCount: Object.keys(this.data.records).length,
      todayActiveUsers: todayUsers,
    };
  }

  public setAdminLimit(minutes: number, userId?: string): void {
    if (minutes <= 0) return;
    if (userId) {
      if (!this.data.adminConfig.userOverrides) {
        this.data.adminConfig.userOverrides = {};
      }
      this.data.adminConfig.userOverrides[userId] = minutes;
    } else {
      this.data.adminConfig.defaultDailyLimitMinutes = minutes;
    }
    this.saveDB();
  }
}

export const usageManager = new UsageManager();
