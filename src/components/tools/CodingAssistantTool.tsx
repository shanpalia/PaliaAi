import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Code2,
  Sparkles,
  Bug,
  Zap,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Send,
  Play,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

const languages = [
  'TypeScript',
  'JavaScript',
  'Python',
  'React / JSX',
  'Rust',
  'Go',
  'SQL',
  'Java',
  'C++',
  'HTML & Tailwind CSS',
];

const sampleCode = `// Example: API Request with retry logic and timeout
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(\`HTTP \${response.status}\`);
      return await response.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, delay * attempt));
    }
  }
}`;

export const CodingAssistantTool: React.FC<{ onSendToChat?: (code: string) => void }> = ({
  onSendToChat,
}) => {
  const [language, setLanguage] = useState(languages[0]);
  const [action, setAction] = useState<'generate' | 'explain' | 'debug' | 'optimize'>('generate');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState(sampleCode);
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    if (action === 'generate' && !prompt.trim()) return;
    if (action !== 'generate' && !code.trim()) return;
    if (isLoading) return;

    const successDeduct = await creditService.deductCredits('Coding Assistant', 4);
    if (!successDeduct) {
      alert('Insufficient AI credits for Coding Assistant.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.assistCode({
        code: action !== 'generate' ? code : undefined,
        language,
        action,
        prompt: action === 'generate' ? prompt : undefined,
      });

      if (res.success && res.result) {
        setResult(res.result);
      } else {
        alert(res.error || 'Code assistant execution failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="coding-assistant-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">AI Coding Assistant</h1>
              <p className="text-xs text-slate-500">
                Generate algorithms, debug complex code, optimize runtime complexity, and explain syntax.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 font-semibold border border-cyan-200">
            4 Credits / Task
          </span>
        </div>

        {/* Action Tabs & Language Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Action buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 gap-1 flex-wrap">
            {[
              { id: 'generate', label: 'Generate Code', icon: Sparkles },
              { id: 'explain', label: 'Explain Code', icon: HelpCircle },
              { id: 'debug', label: 'Debug & Fix', icon: Bug },
              { id: 'optimize', label: 'Optimize Performance', icon: Zap },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setAction(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    action === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Language:</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2-Column Editor & Result View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Left Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between min-h-[380px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {action === 'generate' ? 'Prompt / Requirements' : `Source Code (${language})`}
                </span>
                {action !== 'generate' && (
                  <button
                    onClick={() => setCode(sampleCode)}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Load Sample
                  </button>
                )}
              </div>

              {action === 'generate' ? (
                <textarea
                  rows={10}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the function, component, or algorithm you need (e.g., 'Write an async queue with rate limiter and retry backoff')..."
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              ) : (
                <textarea
                  rows={12}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste your source code here..."
                  className="w-full p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed resize-none"
                />
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                id="btn-execute-code-assist"
                onClick={handleExecute}
                disabled={isLoading || (action === 'generate' ? !prompt.trim() : !code.trim())}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                  !isLoading && (action === 'generate' ? prompt.trim() : code.trim())
                    ? 'bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-slate-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing with Palia AI...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Assistant (4 Credits)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result Right Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between min-h-[380px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Output & Solution</span>
                {result && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Generated
                  </span>
                )}
              </div>

              <div className="min-h-[260px] max-h-[460px] overflow-y-auto p-3 rounded-xl bg-slate-50/70 border border-slate-100 text-xs">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 text-slate-400 space-y-2 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-cyan-600" />
                    <p className="font-semibold text-slate-700">Analyzing syntax & logic...</p>
                    <p className="text-[11px]">Applying modern code patterns and type safety</p>
                  </div>
                ) : result ? (
                  <div className="prose prose-slate prose-xs max-w-none text-slate-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center py-16 text-slate-400 italic">
                    Solution and explanations will appear here...
                  </div>
                )}
              </div>
            </div>

            {result && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Solution'}</span>
                </button>

                {onSendToChat && (
                  <button
                    onClick={() => onSendToChat(result)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 text-xs font-medium transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send to Chat</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
