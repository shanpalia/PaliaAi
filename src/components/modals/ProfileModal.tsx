import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Zap,
  Coins,
  Clock,
  LogOut,
  ShieldCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Timer,
  Activity,
} from 'lucide-react';
import { UserProfile, CreditTransaction, DailyUsageStatus } from '../../types';
import { creditService } from '../../services/creditService';
import { authService } from '../../services/authService';
import { usageService } from '../../services/usageService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onAuthRequired: () => void;
  onUserUpdated: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onAuthRequired,
  onUserUpdated,
}) => {
  const [balance, setBalance] = useState(850);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isTopUpSuccess, setIsTopUpSuccess] = useState(false);
  const [usage, setUsage] = useState<DailyUsageStatus>(usageService.getStatus());
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBalance(creditService.getBalance());
      setTransactions(creditService.getTransactions());
      usageService.refresh().then((newUsage) => setUsage(newUsage));
    }
  }, [isOpen]);

  useEffect(() => {
    const unsub = usageService.subscribe((newUsage) => {
      setUsage(newUsage);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleTopUp = () => {
    creditService.addCredits(250, 'Promotional Credit Bonus');
    setBalance(creditService.getBalance());
    setTransactions(creditService.getTransactions());
    setIsTopUpSuccess(true);
    setTimeout(() => setIsTopUpSuccess(false), 3000);
  };

  const handleResetUsage = async () => {
    setIsResetting(true);
    const ok = await usageService.resetUsage();
    setIsResetting(false);
    if (ok) {
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    }
  };

  const handleSignOut = () => {
    authService.logout();
    onUserUpdated();
    onClose();
  };

  const percentUsed = Math.min(
    100,
    Math.round(((usage.used_seconds || 0) / (usage.daily_limit_seconds || 7200)) * 100)
  );

  return (
    <div
      id="profile-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="profile-modal-container"
        className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">User Profile & AI Usage</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Identity Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/30 border border-blue-400/40 text-white flex items-center justify-center text-lg font-bold">
              {user?.name?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">{user?.name || 'Shan Palia'}</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/40 text-blue-200 text-[10px] font-semibold border border-blue-400/30">
                  {user?.plan || 'Pro Tier'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{user?.email || 'shanpalia786@gmail.com'}</p>
            </div>
          </div>
        </div>

        {/* Daily 2-Hour AI Usage Allowance Section */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 shadow-2xs">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                usage.is_limit_reached ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Daily AI Allowance
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-bold ${usage.is_limit_reached ? 'text-rose-600' : 'text-slate-900'}`}>
                    {usage.formatted_remaining}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                {usage.formatted_limit}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">Resets midnight (Asia/Kolkata)</p>
            </div>
          </div>

          {/* Usage Visual Meter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Used today: <strong className="text-slate-900">{usage.formatted_used}</strong> ({percentUsed}%)</span>
              <span>Total allowance: <strong>{usage.daily_limit_minutes}m</strong></span>
            </div>
            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  usage.is_limit_reached
                    ? 'bg-rose-500'
                    : percentUsed > 80
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          {/* Information & Fair Usage Notice */}
          <div className="p-3 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-600 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>How AI Usage is Measured</span>
            </div>
            <p className="leading-relaxed text-slate-500">
              Only active AI computation time (Chat generation, Web Search, Image AI, Document AI, Translator, Coding AI) is counted. 
              Reading old chats and idle website time do <strong>NOT</strong> consume your allowance.
            </p>
          </div>

          {/* Limit Reached Banner if applicable */}
          {usage.is_limit_reached && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Daily AI limit reached</p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  You've used today's 2-hour AI allowance. Your AI access will reset tomorrow at midnight (Asia/Kolkata).
                </p>
              </div>
            </div>
          )}

          {/* Reset button for testing / quick admin */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">Date: {usage.usage_date}</span>
            <button
              id="btn-profile-reset-usage"
              onClick={handleResetUsage}
              disabled={isResetting}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              title="Reset today's usage for testing"
            >
              <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
              <span>{isResetting ? 'Resetting...' : 'Reset Usage (Test)'}</span>
            </button>
          </div>

          {resetSuccess && (
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>Daily AI usage allowance has been successfully reset!</span>
            </div>
          )}
        </div>

        {/* Footer Sign Out */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
