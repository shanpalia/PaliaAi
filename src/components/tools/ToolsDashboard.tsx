import React from 'react';
import {
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Languages,
  FileSpreadsheet,
  Code2,
  Mic,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ToolType } from '../../types';

interface ToolsDashboardProps {
  onSelectTool: (tool: ToolType) => void;
}

const tools = [
  {
    id: 'chat' as ToolType,
    title: 'AI Chat',
    category: 'Conversation',
    desc: 'General purpose intelligent dialogue, reasoning, complex problem solving, and contextual memory.',
    icon: MessageSquare,
    badge: 'Core',
    color: 'from-blue-600 to-indigo-600',
    creditsCost: '2 credits/msg',
  },
  {
    id: 'image' as ToolType,
    title: 'Image AI',
    category: 'Creative Studio',
    desc: 'Generate photorealistic and conceptual visuals, edit existing images, remove backgrounds, and enhance resolution.',
    icon: ImageIcon,
    badge: 'Visuals',
    color: 'from-purple-600 to-pink-600',
    creditsCost: '15 credits/img',
  },
  {
    id: 'document' as ToolType,
    title: 'Document AI',
    category: 'Productivity',
    desc: 'Upload PDF and text documents for instant executive summaries, key data extraction, and deep QA queries.',
    icon: FileText,
    badge: 'Analysis',
    color: 'from-emerald-600 to-teal-600',
    creditsCost: '5 credits/doc',
  },
  {
    id: 'translator' as ToolType,
    title: 'Translator',
    category: 'Language',
    desc: 'High-precision translation across 50+ languages with nuance detection, tone customization, and audio pronunciation.',
    icon: Languages,
    badge: 'Multi-lingual',
    color: 'from-amber-500 to-orange-600',
    creditsCost: '3 credits/query',
  },
  {
    id: 'resume' as ToolType,
    title: 'Resume Builder',
    category: 'Career',
    desc: 'Create job-winning resumes with AI STAR-method bullet enhancement, live modern previews, and instant PDF download.',
    icon: FileSpreadsheet,
    badge: 'Pro CV',
    color: 'from-indigo-600 to-violet-600',
    creditsCost: '10 credits/build',
  },
  {
    id: 'code' as ToolType,
    title: 'Coding Assistant',
    category: 'Developer',
    desc: 'Generate clean boilerplate, debug complex logic, optimize algorithms, and explain architectural patterns.',
    icon: Code2,
    badge: 'Developer',
    color: 'from-cyan-600 to-blue-700',
    creditsCost: '4 credits/task',
  },
  {
    id: 'voice' as ToolType,
    title: 'Voice Assistant',
    category: 'Hands-Free',
    desc: 'Real-time conversational voice assistant with ultra-low latency audio synthesis and live waveform visualizer.',
    icon: Mic,
    badge: 'Voice AI',
    color: 'from-rose-500 to-red-600',
    creditsCost: '5 credits/min',
  },
  {
    id: 'search' as ToolType,
    title: 'Web Search',
    category: 'Research',
    desc: 'Real-time live web search powered by Google Search grounding with verified source URLs and factual citations.',
    icon: Globe,
    badge: 'Live Data',
    color: 'from-sky-500 to-blue-600',
    creditsCost: '5 credits/query',
  },
];

export const ToolsDashboard: React.FC<ToolsDashboardProps> = ({ onSelectTool }) => {
  return (
    <div id="tools-dashboard" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 relative overflow-hidden shadow-lg">
          <div className="relative z-10 max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-medium backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Palia AI Intelligence Suite</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
              Next-Generation AI Tools
            </h1>
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              Experience the comprehensive AI ecosystem built by ShanPalia. Each tool is engineered for high accuracy, speed, and clean output.
            </p>
          </div>
          <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 pointer-events-none flex items-center justify-center">
            <Sparkles className="w-96 h-96 text-white" />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Available AI Tools</h2>
            <span className="text-xs text-slate-500">8 Specialized Modules</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div
                  key={tool.id}
                  id={`tool-card-${tool.id}`}
                  onClick={() => onSelectTool(tool.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${tool.color} text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {tool.badge}
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-medium text-slate-400">
                        {tool.category}
                      </span>
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {tool.creditsCost}
                    </span>
                    <span className="font-semibold text-indigo-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
