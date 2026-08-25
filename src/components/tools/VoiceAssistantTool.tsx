import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw,
  Radio,
  Sliders,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

interface VoiceLog {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

const voiceOptions = [
  { id: 'Kore', label: 'Kore (Balanced & Warm Studio)' },
  { id: 'Puck', label: 'Puck (Engaging & Energetic)' },
  { id: 'Fenrir', label: 'Fenrir (Deep & Authoritative)' },
  { id: 'Zephyr', label: 'Zephyr (Soft & Calm)' },
  { id: 'Charon', label: 'Charon (Crisp & Articulate)' },
];

export const VoiceAssistantTool: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [logs, setLogs] = useState<VoiceLog[]>([
    {
      id: 'init',
      sender: 'assistant',
      text: "Hello! I'm Palia AI Voice Assistant. Tap the microphone below and speak naturally. I will respond conversationally with voice playback.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleVoiceQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userLog: VoiceLog = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setLogs((prev) => [...prev, userLog]);

    setIsThinking(true);

    // Deduct credits
    await creditService.deductCredits('Voice Conversation Turn', 5);

    try {
      const res = await aiService.sendChatMessage({
        message: queryText,
        systemInstruction:
          'You are Palia AI Voice Assistant. Provide concise, clear, and engaging answers suitable for natural spoken audio. Limit responses to 2-4 sentences unless requested otherwise.',
      });

      const replyText = res.reply || 'I am here to assist you with anything you need.';
      const botLog: VoiceLog = {
        id: `bot_${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setLogs((prev) => [...prev, botLog]);

      // Speak response
      setIsThinking(false);
      setIsSpeaking(true);
      await aiService.speakText(replyText, selectedVoice);
    } catch (err) {
      console.error('Voice loop error:', err);
    } finally {
      setIsThinking(false);
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleVoiceQuery(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start voice recognition:', err);
      setIsListening(false);
    }
  };

  return (
    <div id="voice-assistant-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Conversational Voice Assistant</h1>
              <p className="text-xs text-slate-500">
                Hands-free conversational dialogue with ultra-low latency audio synthesis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="p-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none"
            >
              {voiceOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Central Futuristic Orb & Waveform Display */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm flex flex-col items-center justify-center space-y-6 text-center relative overflow-hidden">
          {/* Animated Futuristic Neural Orb */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring layers */}
            <div
              className={`absolute w-44 h-44 rounded-full transition-all duration-700 ${
                isListening
                  ? 'bg-rose-500/20 scale-125 animate-ping'
                  : isSpeaking
                  ? 'bg-indigo-500/20 scale-115 animate-pulse'
                  : isThinking
                  ? 'bg-amber-500/20 scale-110 animate-spin'
                  : 'bg-slate-100 scale-100'
              }`}
            />
            <div
              className={`absolute w-36 h-36 rounded-full transition-all duration-500 ${
                isListening
                  ? 'bg-rose-500/30'
                  : isSpeaking
                  ? 'bg-indigo-500/30'
                  : isThinking
                  ? 'bg-amber-500/30'
                  : 'bg-slate-200/60'
              }`}
            />

            {/* Central Mic Interactive Button */}
            <button
              id="btn-voice-mic-main"
              onClick={toggleListening}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 transform active:scale-95 ${
                isListening
                  ? 'bg-rose-600 text-white shadow-rose-300 ring-8 ring-rose-100 scale-105'
                  : isSpeaking
                  ? 'bg-indigo-600 text-white shadow-indigo-200 ring-8 ring-indigo-100 animate-pulse'
                  : isThinking
                  ? 'bg-amber-500 text-white shadow-amber-200 ring-8 ring-amber-100'
                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300'
              }`}
            >
              {isListening ? (
                <MicOff className="w-10 h-10" />
              ) : isThinking ? (
                <RefreshCw className="w-10 h-10 animate-spin" />
              ) : isSpeaking ? (
                <Volume2 className="w-10 h-10" />
              ) : (
                <Mic className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Status Text */}
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              {isListening
                ? 'Listening to you...'
                : isThinking
                ? 'Palia AI is thinking...'
                : isSpeaking
                ? `Speaking via ${selectedVoice} voice...`
                : 'Tap the microphone to speak'}
            </h2>
            <p className="text-xs text-slate-400">
              {isListening
                ? 'Speak clearly into your microphone'
                : 'Hands-free bidirectional audio stream'}
            </p>
          </div>

          {/* Audio Waveform visualizer bars */}
          <div className="flex items-center gap-1.5 h-10">
            {[...Array(18)].map((_, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-150 ${
                  isListening
                    ? 'bg-rose-500'
                    : isSpeaking
                    ? 'bg-indigo-600'
                    : isThinking
                    ? 'bg-amber-500'
                    : 'bg-slate-200'
                }`}
                style={{
                  height:
                    isListening || isSpeaking
                      ? `${Math.max(12, Math.sin(i * 0.6 + Date.now() / 300) * 36 + 18)}px`
                      : '8px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Live Conversation Transcript */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-semibold text-slate-900 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-indigo-600" />
              Voice Session Transcript
            </span>
            <span className="text-[11px] text-slate-400">{logs.length} messages</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`flex gap-3 text-xs ${
                  log.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {log.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                    P
                  </div>
                )}
                <div
                  className={`max-w-md p-3 rounded-2xl ${
                    log.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <p className="leading-relaxed">{log.text}</p>
                  <span
                    className={`text-[9px] block mt-1 ${
                      log.sender === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                    }`}
                  >
                    {log.timestamp}
                  </span>
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
