import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Volume2,
  Database,
  Info,
  Check,
  Download,
  Trash2,
  Shield,
  Clock,
  RotateCcw,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { UserSettings, DailyUsageStatus, AdminUsageConfig } from '../../types';
import { storageService } from '../../services/storageService';
import { usageService } from '../../services/usageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSaveSettings: (settings: UserSettings) => void;
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings: initialSettings,
  onSaveSettings,
  onClearHistory,
}) => {
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'general' | 'model' | 'usage' | 'voice' | 'data' | 'about'>('general');
  const [saved, setSaved] = useState(false);
  const [usage, setUsage] = useState<DailyUsageStatus>(usageService.getStatus());
  const [adminConfig, setAdminConfig] = useState<AdminUsageConfig | null>(null);
  const [customLimit, setCustomLimit] = useState<number>(120);
  const [selectedTimezone, setSelectedTimezone] = useState<string>(usageService.getTimezone());
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [limitUpdatedSuccess, setLimitUpdatedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      usageService.refresh().then((u) => {
        setUsage(u);
        setCustomLimit(u.daily_limit_minutes || 120);
      });
      usageService.getAdminConfig().then((cfg) => {
        if (cfg) setAdminConfig(cfg);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(settings);
    usageService.setTimezone(selectedTimezone);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdateLimit = async (minutes: number) => {
    setIsUpdatingLimit(true);
    const ok = await usageService.updateAdminLimit(minutes);
    setIsUpdatingLimit(false);
    if (ok) {
      setCustomLimit(minutes);
      const newUsage = await usageService.refresh();
      setUsage(newUsage);
      setLimitUpdatedSuccess(true);
      setTimeout(() => setLimitUpdatedSuccess(false), 3000);
    }
  };

  const handleResetUsage = async () => {
    const ok = await usageService.resetUsage();
    if (ok) {
      const newUsage = await usageService.refresh();
      setUsage(newUsage);
    }
  };

  const handleExportData = () => {
    const data = storageService.exportAllData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `palia-ai-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="settings-modal-container"
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Palia AI Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sidebar Tabs */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Tab Sidebar */}
          <div className="w-full md:w-48 bg-slate-50/70 border-r border-slate-100 p-3 flex md:flex-col gap-1 overflow-x-auto">
            {[
              { id: 'general', label: 'General', icon: Sliders },
              { id: 'usage', label: 'Daily AI Limit', icon: Clock },
              { id: 'model', label: 'AI Intelligence', icon: Sparkles },
              { id: 'voice', label: 'Voice & Audio', icon: Volume2 },
              { id: 'data', label: 'Data & Privacy', icon: Database },
              { id: 'about', label: 'About Palia AI', icon: Info },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap text-left cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 text-xs text-slate-800">
            {/* 1. General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-900">Interface Language</label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                  >
                    <option value="en">English (US)</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">Auto-scroll Messages</span>
                    <span className="text-[11px] text-slate-400">
                      Keep newest message in view during active generation
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoScroll}
                    onChange={(e) => setSettings({ ...settings, autoScroll: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Enable Search Grounding by Default
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Automatically retrieve live search facts for questions
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.searchGroundingDefault}
                    onChange={(e) =>
                      setSettings({ ...settings, searchGroundingDefault: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>
              </div>
            )}

            {/* 2. Daily AI Limit & Quota Tab */}
            {activeTab === 'usage' && (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 text-blue-900 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Daily 2-Hour Allowance Policy
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-200/80 text-blue-800 text-[10px] font-bold">
                      {usage.formatted_limit}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800/90 leading-relaxed">
                    Every user receives a daily allowance of AI computation time. Quotas reset automatically at midnight ({selectedTimezone}). 
                    Only active AI generation/processing consumes allowance — reading previous chats or idle time is 100% free.
                  </p>
                </div>

                {/* Limit Adjustment Controls */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-900 block">
                    Set Daily AI Allowance (Admin & User Config)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { mins: 30, label: '30 mins' },
                      { mins: 60, label: '1 hour' },
                      { mins: 120, label: '2 hours (Standard)' },
                      { mins: 180, label: '3 hours' },
                    ].map((item) => (
                      <button
                        key={item.mins}
                        onClick={() => handleUpdateLimit(item.mins)}
                        disabled={isUpdatingLimit}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          (usage.daily_limit_minutes || 120) === item.mins
                            ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom minutes input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      value={customLimit}
                      onChange={(e) => setCustomLimit(Number(e.target.value))}
                      className="w-32 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                      placeholder="Minutes"
                    />
                    <span className="text-xs text-slate-500">minutes per day</span>
                    <button
                      onClick={() => handleUpdateLimit(customLimit)}
                      disabled={isUpdatingLimit}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Timezone Setting */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-500" />
                    Reset Timezone
                  </label>
                  <select
                    value={selectedTimezone}
                    onChange={(e) => {
                      setSelectedTimezone(e.target.value);
                      usageService.setTimezone(e.target.value);
                    }}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (Indian Standard Time - Default)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (US Eastern Time)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (US Pacific Time)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (Japan Standard Time)</option>
                    <option value="Asia/Dubai">Asia/Dubai (Gulf Standard Time)</option>
                  </select>
                </div>

                {/* Quick Reset Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">Reset Current Usage</span>
                    <span className="text-[11px] text-slate-400">
                      Instantly restore full 2-hour allowance for testing
                    </span>
                  </div>
                  <button
                    onClick={handleResetUsage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Today's Quota</span>
                  </button>
                </div>

                {limitUpdatedSuccess && (
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Daily allowance limit updated successfully!</span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Model & Intelligence Tab */}
            {activeTab === 'model' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-900">Default Model</label>
                  <select
                    value={settings.defaultModel}
                    onChange={(e) => setSettings({ ...settings, defaultModel: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                  >
                    <option value="palia-ai-ultra">
                      Palia AI Ultra (Fast real-time reasoning & synthesis)
                    </option>
                    <option value="palia-ai-pro">
                      Palia AI Pro (Deep problem solving & complex coding)
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-900">
                      Creativity & Temperature ({settings.temperature.toFixed(2)})
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {settings.temperature < 0.3
                        ? 'Precise & Factual'
                        : settings.temperature > 0.7
                        ? 'Creative & Poetic'
                        : 'Balanced'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.temperature}
                    onChange={(e) =>
                      setSettings({ ...settings, temperature: parseFloat(e.target.value) })
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-900">
                    Custom System Instruction
                  </label>
                  <textarea
                    rows={3}
                    value={settings.systemInstruction}
                    onChange={(e) =>
                      setSettings({ ...settings, systemInstruction: e.target.value })
                    }
                    placeholder="Give Palia AI personalized instructions or behavioral context..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* 4. Voice & Audio Tab */}
            {activeTab === 'voice' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-900">TTS Speech Voice</label>
                  <select
                    value={settings.voiceName}
                    onChange={(e) => setSettings({ ...settings, voiceName: e.target.value })}
                    className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium"
                  >
                    <option value="Kore">Kore (Warm & Natural Studio)</option>
                    <option value="Puck">Puck (Engaging & Expressive)</option>
                    <option value="Fenrir">Fenrir (Authoritative & Deep)</option>
                    <option value="Zephyr">Zephyr (Gentle & Calm)</option>
                    <option value="Charon">Charon (Crisp & Articulate)</option>
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Auto-Read Voice Responses
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Play audio speech automatically in Voice Assistant tool
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoPlayVoice}
                    onChange={(e) => setSettings({ ...settings, autoPlayVoice: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                </div>
              </div>
            )}

            {/* 5. Data & Privacy Tab */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-blue-800">
                    <Shield className="w-4 h-4" />
                    <span>Your Data & Privacy Pledge</span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 leading-relaxed">
                    Palia AI does NOT train AI foundation models on your private conversations or
                    attachments. All API requests are processed through secure server-side proxies.
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <span className="text-xs font-semibold text-slate-900 block">Data Backup</span>
                  <button
                    onClick={handleExportData}
                    className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-800 text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export All Chats & Settings (.json)</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-semibold text-rose-700 block">Danger Zone</span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          'Are you sure you want to delete all conversations? This action cannot be undone.'
                        )
                      ) {
                        onClearHistory();
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 font-semibold text-rose-700 text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete All Chat History</span>
                  </button>
                </div>
              </div>
            )}

            {/* 6. About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">Palia AI Suite</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      v3.8.0 Production
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    An advanced production-ready AI assistant web application featuring real-time
                    reasoning, document intelligence, generative visuals, and hands-free voice synthesis.
                  </p>
                  <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 flex justify-between">
                    <span>Developer:</span>
                    <span className="font-semibold text-slate-800">ShanPalia</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Daily AI Quota:</span>
                    <span className="font-semibold text-slate-800">
                      2 Hours (120 Minutes) / Day
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Inference Architecture:</span>
                    <span className="font-semibold text-slate-800">
                      Server-Side Express + Palia AI Engine
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {saved && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Settings Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
