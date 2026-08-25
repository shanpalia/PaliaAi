import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  UploadCloud,
  Sparkles,
  HelpCircle,
  ListOrdered,
  Languages,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  Send,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

interface DocumentAIToolProps {
  onSendToChat?: (text: string, title: string) => void;
}

export const DocumentAITool: React.FC<DocumentAIToolProps> = ({ onSendToChat }) => {
  const [file, setFile] = useState<{ name: string; size: number; content: string } | null>(null);
  const [mode, setMode] = useState<'summary' | 'qa' | 'extract' | 'translate'>('summary');
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    if (uploaded.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setFile({
        name: uploaded.name,
        size: uploaded.size,
        content: text,
      });
      setAnalysisResult('');
    };
    reader.readAsText(uploaded);
  };

  const handleAnalyze = async () => {
    if (!file || isLoading) return;

    const successDeduct = await creditService.deductCredits('Document AI Analysis', 5);
    if (!successDeduct) {
      alert('Insufficient AI credits for Document AI.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.analyzeDocument({
        documentText: file.content,
        filename: file.name,
        mode,
        question: mode === 'qa' ? question : undefined,
      });

      if (res.success && res.result) {
        setAnalysisResult(res.result);
      } else {
        alert(res.error || 'Document analysis failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="document-ai-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Document AI</h1>
              <p className="text-xs text-slate-500">
                Understand, summarize, extract, and query any PDF or document.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
            5 Credits / Run
          </span>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Options */}
          <div className="lg:col-span-5 space-y-4">
            {/* Upload Box */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <span className="text-xs font-semibold text-slate-900">Document File</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.doc,.docx,.json,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />

              {file ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{file.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {(file.size / 1024).toFixed(1)} KB · ~{Math.round(file.content.length / 5)}{' '}
                        words
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setAnalysisResult('');
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-emerald-300 hover:bg-emerald-50/20 cursor-pointer transition-all space-y-2"
                >
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-medium text-slate-700">Click or drag document here</p>
                  <p className="text-[10px] text-slate-400">PDF, TXT, MD, DOCX, CSV up to 10MB</p>
                </div>
              )}

              {/* Analysis Mode Selector */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-900">Analysis Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'summary', label: 'Executive Summary', icon: Sparkles },
                    { id: 'qa', label: 'Ask a Question', icon: HelpCircle },
                    { id: 'extract', label: 'Extract Key Data', icon: ListOrdered },
                    { id: 'translate', label: 'Translate Document', icon: Languages },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMode(item.id as any)}
                        className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all ${
                          mode === item.id
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Question input if in QA mode */}
              {mode === 'qa' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-900">
                    What would you like to know from this document?
                  </label>
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. What are the key deliverables and deadlines mentioned?"
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Action Button */}
              <button
                id="btn-analyze-doc"
                onClick={handleAnalyze}
                disabled={!file || isLoading || (mode === 'qa' && !question.trim())}
                className={`w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                  file && !isLoading && (mode !== 'qa' || question.trim())
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-emerald-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Document with Palia AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run Analysis (5 Credits)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Output Markdown */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs min-h-[440px] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-900">AI Intelligence Report</span>
                {analysisResult && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Complete
                  </span>
                )}
              </div>

              {/* Content Area */}
              <div className="flex-1 p-4 bg-slate-50/70 rounded-xl border border-slate-100 overflow-y-auto max-h-[500px]">
                {isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center py-16 space-y-3 text-center">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center animate-pulse shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      Palia AI is reading & synthesizing your document...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Extracting logical entities, structural hierarchy, and key insights
                    </p>
                  </div>
                ) : analysisResult ? (
                  <div className="prose prose-slate prose-xs sm:prose-sm max-w-none text-slate-800 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-16 space-y-2 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">No document analyzed yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Upload a PDF or document on the left and select your preferred analysis mode.
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              {analysisResult && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Report'}</span>
                  </button>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(analysisResult, `Doc AI: ${file?.name}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-medium transition-all"
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
    </div>
  );
};
