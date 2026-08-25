import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Globe,
  Search,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Send,
  Compass,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';
import { SearchSource } from '../../types';

export const WebSearchTool: React.FC<{ onSendToChat?: (text: string) => void }> = ({
  onSendToChat,
}) => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const sampleSearches = [
    'Latest breakthrough discoveries in James Webb Space Telescope',
    'Recent semiconductor and quantum computing advancements',
    'Global renewable energy transition trends and milestones',
    'Next-generation foundation models architecture evolution',
  ];

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm || query).trim();
    if (!q || isLoading) return;

    const successDeduct = await creditService.deductCredits('Live Web Search', 5);
    if (!successDeduct) {
      alert('Insufficient AI credits for Web Search.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.searchWeb(q);
      if (res.success && res.answer) {
        setAnswer(res.answer);
        setSources((res.sources as any) || []);
        setSearchQueries(res.searchQueries || [q]);
      } else {
        alert(res.error || 'Search failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="web-search-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Grounded Web Search</h1>
              <p className="text-xs text-slate-500">
                Real-time internet intelligence powered by Google Search grounding with verified sources.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-semibold border border-sky-200">
            5 Credits / Search
          </span>
        </div>

        {/* Search Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <Search className="w-5 h-5 text-slate-400 ml-2" />
            <input
              id="web-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything with live web grounding..."
              className="flex-1 p-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              id="btn-submit-web-search"
              type="submit"
              disabled={!query.trim() || isLoading}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                query.trim() && !isLoading
                  ? 'bg-sky-600 text-white hover:bg-sky-700 cursor-pointer shadow-sky-200'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </form>

          {/* Quick suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 pt-3 px-1 border-t border-slate-100 mt-2">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3" /> Trending:
            </span>
            {sampleSearches.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(s);
                  handleSearch(s);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-600 border border-slate-200 transition-colors truncate max-w-[240px]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Results Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Answer View */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 min-h-[400px]">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  Synthesized Web Intelligence
                </span>
                {answer && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center mx-auto animate-bounce shadow-md">
                    <Globe className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800">
                    Querying live search indexes...
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Grounded with factual citations and real-time sources
                  </p>
                </div>
              ) : answer ? (
                <div className="prose prose-slate prose-sm max-w-none text-slate-800 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <Globe className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs font-medium text-slate-600">No active search yet</p>
                  <p className="text-[11px] text-slate-400">
                    Type a topic above to ground Palia AI with real-time web results.
                  </p>
                </div>
              )}

              {answer && onSendToChat && (
                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => onSendToChat(answer)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-xs font-medium transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Discuss in Chat</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sources List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <span className="text-xs font-semibold text-slate-900 block">
                Verified Citations & Sources ({sources.length})
              </span>

              {sources.length > 0 ? (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-700 line-clamp-2">
                          {src.title || src.uri}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 flex-shrink-0 mt-0.5" />
                      </div>
                      <span className="text-[10px] text-slate-400 truncate block mt-1">
                        {src.uri}
                      </span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-6 text-center">
                  Sources will be listed here after performing a web search.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
