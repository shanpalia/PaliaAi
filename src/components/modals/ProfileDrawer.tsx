import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Clock,
  LogOut,
  Shield,
  RotateCcw,
  Sparkles,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Globe2,
  Info,
  ChevronRight,
  Check,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserProfile, DailyUsageStatus, UserSettings } from '../../types';
import { authService } from '../../services/authService';
import { usageService } from '../../services/usageService';
import { storageService } from '../../services/storageService';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onAuthRequired: () => void;
  onOpenSettings: () => void;
  onUserUpdated: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  user,
  onAuthRequired,
  onOpenSettings,
  onUserUpdated,
}) => {
  const [usage, setUsage] = useState<DailyUsageStatus>(usageService.getStatus());
  const [settings, setSettings] = useState<UserSettings>(storageService.getSettings());
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [activeTheme, setActiveTheme] = useState<'light' | 'dark' | 'system'>('light');
  const [selectedLang, setSelectedLang] = useState(settings.language || 'en');

  // Fetch updated usage when opened
  useEffect(() => {
    if (isOpen) {
      usageService.refresh().then((newUsage) => setUsage(newUsage));
      setSettings(storageService.getSettings());
    }
  }, [isOpen]);

  // Subscribe to real-time updates from usageService
  useEffect(() => {
    const unsub = usageService.subscribe((newUsage) => {
      setUsage(newUsage);
    });
    return unsub;
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleResetUsage = async () => {
    setIsResetting(true);
    const ok = await usageService.resetUsage();
    setIsResetting(false);
    if (ok) {
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    }
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLang(lang);
    const updated = { ...settings, language: lang };
    setSettings(updated);
    storageService.saveSettings(updated);
  };

  const handleSignOut = () => {
    authService.logout();
    onUserUpdated();
    onClose();
  };

  if (!isOpen) return null;

  const usedSeconds = usage.used_seconds || 0;
  const limitSeconds = usage.daily_limit_seconds || 7200;
  const usedMinutes = Math.min(120, Math.round(usedSeconds / 60));
  const limitMinutes = Math.round(limitSeconds / 60);
  const percentUsed = Math.min(100, Math.max(0, Math.round((usedSeconds / limitSeconds) * 100)));

  const formattedRemaining = usage.formatted_remaining
    ? usage.formatted_remaining.replace(' today', '')
    : '2h 00m remaining';

  const userInitial =
    user?.name?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'P';

  const isGuest = !user || user.id === 'guest_user';

  return (
    <div
      id="profile-drawer-root"
      className="fixed inset-0 z-50 overflow-hidden select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-drawer-title"
    >
      {/* Backdrop overlay */}
      <div
        id="profile-drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      {/* Sliding Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <aside
          id="profile-drawer-panel"
          className="w-[88vw] sm:w-[400px] max-w-[420px] bg-white h-full shadow-2xl flex flex-col pointer-events-auto border-l border-slate-200 transition-transform duration-300 ease-out animate-in slide-in-from-right"
        >
          {/* Drawer Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <span id="profile-drawer-title" className="text-sm font-bold text-slate-900">
                Account & Settings
              </span>
            </div>
            <button
              id="btn-close-profile-drawer"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Close drawer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* User Profile Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-3.5 relative z-10">
                {/* User Avatar */}
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name || 'User'}
                    className="w-12 h-12 rounded-full border-2 border-white/20 object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 border-2 border-white/20 text-white font-bold text-lg flex items-center justify-center flex-shrink-0 shadow-inner">
                    {userInitial}
                  </div>
                )}

                {/* User Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white truncate">
                      {user?.name || 'Shan Palia'}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 uppercase tracking-wider">
                      Palia AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 truncate mt-0.5">
                    {user?.email || 'shanpalia786@gmail.com'}
                  </p>
                </div>
              </div>
            </div>

            {/* Daily AI Usage Section (Real Backend Data) */}
            <div
              id="profile-daily-usage-section"
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3.5 shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                    Daily AI Usage
                  </h4>
                </div>
                <span
                  id="drawer-usage-remaining-text"
                  className={`text-xs font-bold ${
                    usage.is_limit_reached
                      ? 'text-rose-600'
                      : percentUsed > 80
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`}
                >
                  {usage.is_limit_reached ? 'Limit reached' : formattedRemaining}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden p-0.5">
                  <div
                    id="drawer-usage-progress-bar"
                    className={`h-full rounded-full transition-all duration-500 ${
                      usage.is_limit_reached
                        ? 'bg-rose-500'
                        : percentUsed > 80
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-slate-500">
                  <span>{usedMinutes} / {limitMinutes} min used today</span>
                  <span className="font-medium">{percentUsed}%</span>
                </div>
              </div>

              {/* Quota Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Daily limit
                  </span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5">
                    2 hours
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-slate-200/60 flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Reset
                  </span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 truncate">
                    Tomorrow at 12:00 AM
                  </span>
                </div>
              </div>

              {/* Reset Quota Button for Testing */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  id="btn-drawer-reset-usage"
                  onClick={handleResetUsage}
                  disabled={isResetting}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Resetting...' : 'Reset usage'}</span>
                </button>

                {resetSuccess && (
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Reset to 2h!
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions & Menu Items */}
            <div className="space-y-1">
              {/* Settings */}
              <button
                id="drawer-btn-settings"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <SettingsIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Settings</p>
                    <p className="text-[11px] text-slate-400">System prompt & voice config</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Appearance / Theme */}
              <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Appearance</p>
                    <p className="text-[11px] text-slate-400">Theme mode</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {(['light', 'dark', 'system'] as const).map((theme) => (
                    <button
                      key={theme}
                      onClick={() => setActiveTheme(theme)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize transition-all cursor-pointer ${
                        activeTheme === theme
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selection */}
              <div className="p-3 rounded-xl bg-white border border-slate-100 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Globe2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">Language</p>
                    <p className="text-[11px] text-slate-400">Default conversation language</p>
                  </div>
                </div>
                <select
                  id="drawer-select-language"
                  value={selectedLang}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="en">English (US)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="es">Español (Spanish)</option>
                  <option value="fr">Français (French)</option>
                  <option value="de">Deutsch (German)</option>
                  <option value="ar">العربية (Arabic)</option>
                </select>
              </div>

              {/* Privacy & Data */}
              <div className="p-3 rounded-xl bg-white border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Privacy & Security</p>
                    <p className="text-[11px] text-slate-400">Local encryption & private chats</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  Protected
                </span>
              </div>

              {/* About */}
              <div className="p-3 rounded-xl bg-white border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">About Palia AI</p>
                    <p className="text-[11px] text-slate-400">Version 3.2 • Built by ShanPalia</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Drawer Footer: Logout / Sign In */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            {isGuest ? (
              <button
                id="btn-drawer-login"
                onClick={() => {
                  onClose();
                  onAuthRequired();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>Sign In / Register</span>
              </button>
            ) : (
              <button
                id="btn-drawer-logout"
                onClick={handleSignOut}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
