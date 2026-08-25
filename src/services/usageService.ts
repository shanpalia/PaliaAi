import { DailyUsageStatus, AdminUsageConfig } from '../types';
import { authService } from './authService';

type UsageListener = (status: DailyUsageStatus) => void;

class UsageService {
  private status: DailyUsageStatus;
  private listeners: Set<UsageListener> = new Set();
  private pollingTimer: any = null;
  private timezone: string = 'Asia/Kolkata'; // Default timezone for users in India

  constructor() {
    this.status = {
      user_id: 'default_user',
      usage_date: new Date().toISOString().split('T')[0],
      used_seconds: 0,
      daily_limit_seconds: 7200, // 2 hours (120 minutes)
      remaining_seconds: 7200,
      daily_limit_minutes: 120,
      formatted_remaining: '2h remaining today',
      formatted_limit: 'Daily limit: 2 hours',
      formatted_used: '0s',
      is_limit_reached: false,
      allowed: true,
      warning: null,
      timezone: 'Asia/Kolkata',
      resets_in_seconds: 86400,
      resets_at: 'Midnight (00:00)',
    };

    // Initialize user timezone if available in browser
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) {
        // Keep Asia/Kolkata as top default, or use detected if available
        this.timezone = 'Asia/Kolkata';
      }
    } catch {
      this.timezone = 'Asia/Kolkata';
    }

    // Initial fetch
    this.refresh();

    // Periodic refresh every 60 seconds to check midnight auto-reset
    if (typeof window !== 'undefined') {
      this.pollingTimer = setInterval(() => {
        this.refresh();
      }, 60000);
    }
  }

  public getTimezone(): string {
    return this.timezone;
  }

  public setTimezone(tz: string) {
    this.timezone = tz || 'Asia/Kolkata';
    this.refresh();
  }

  public getStatus(): DailyUsageStatus {
    return this.status;
  }

  public subscribe(listener: UsageListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  public updateFromApiResponse(usageData: any) {
    if (!usageData) return;
    this.status = {
      ...this.status,
      ...usageData,
      daily_limit_minutes: Math.round((usageData.daily_limit_seconds || 7200) / 60),
      formatted_remaining: usageData.formatted_remaining || this.formatRemaining(usageData.remaining_seconds),
      formatted_limit: usageData.formatted_limit || `Daily limit: ${Math.round((usageData.daily_limit_seconds || 7200) / 3600)} hours`,
      formatted_used: usageData.formatted_used || this.formatDuration(usageData.used_seconds || 0),
      is_limit_reached: Boolean(usageData.is_limit_reached || usageData.remaining_seconds <= 0),
      allowed: Boolean(usageData.allowed && usageData.remaining_seconds > 0),
    };
    this.notify();
  }

  public async refresh(userId?: string): Promise<DailyUsageStatus> {
    try {
      const user = authService.getUser();
      const targetUserId = userId || user?.id || 'default_user';
      const url = `/api/user/usage?userId=${encodeURIComponent(targetUserId)}&timezone=${encodeURIComponent(
        this.timezone
      )}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          this.updateFromApiResponse(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch daily usage status:', e);
    }
    return this.status;
  }

  public async getAdminConfig(): Promise<AdminUsageConfig | null> {
    try {
      const res = await fetch('/api/admin/usage-config');
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Failed to fetch admin usage config:', e);
    }
    return null;
  }

  public async updateAdminLimit(minutes: number, userId?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/usage-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes, userId }),
      });
      if (res.ok) {
        await this.refresh(userId);
        return true;
      }
    } catch (e) {
      console.error('Failed to update admin usage limit:', e);
    }
    return false;
  }

  public async resetUsage(userId?: string): Promise<boolean> {
    try {
      const user = authService.getUser();
      const targetUserId = userId || user?.id || 'default_user';
      const res = await fetch('/api/admin/reset-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetUserId, timezone: this.timezone }),
      });
      if (res.ok) {
        const data = await res.json();
        this.updateFromApiResponse(data);
        return true;
      }
    } catch (e) {
      console.error('Failed to reset usage:', e);
    }
    return false;
  }

  public formatRemaining(seconds: number): string {
    if (seconds <= 0) return '0m remaining today';
    if (seconds < 60) return `${Math.max(1, Math.floor(seconds))}s remaining today`;
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}m remaining today`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins === 0 ? `${hours}h remaining today` : `${hours}h ${mins}m remaining today`;
  }

  public formatDuration(seconds: number): string {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }
}

export const usageService = new UsageService();
