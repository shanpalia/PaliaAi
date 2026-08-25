import React, { useState } from 'react';
import {
  Languages,
  ArrowRightLeft,
  Volume2,
  Copy,
  Check,
  Mic,
  MicOff,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

const languageList = [
  'English',
  'Spanish',
  'French',
  'German',
  'Japanese',
  'Chinese (Mandarin)',
  'Arabic',
  'Hindi',
  'Urdu',
  'Portuguese',
  'Russian',
  'Italian',
  'Korean',
  'Turkish',
  'Dutch',
  'Swedish',
  'Polish',
  'Indonesian',
  'Vietnamese',
  'Thai',
];

const toneOptions = ['Natural', 'Formal & Business', 'Casual & Friendly', 'Poetic & Expressive', 'Academic & Precise'];

export const TranslatorTool: React.FC = () => {
  const [sourceText, setSourceText] = useState('');
  const [sourceLang, setSourceLang] = useState('Auto-Detect');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [tone, setTone] = useState(toneOptions[0]);
  const [translatedText, setTranslatedText] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [phoneticGuide, setPhoneticGuide] = useState('');
  const [culturalNotes, setCulturalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim() || isLoading) return;

    const successDeduct = await creditService.deductCredits('AI Translation', 3);
    if (!successDeduct) {
      alert('Insufficient AI credits for Translation.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.translate({
        text: sourceText.trim(),
        targetLang,
        sourceLang,
        tone,
      });

      if (res.success && res.translatedText) {
        setTranslatedText(res.translatedText);
        setDetectedLang(res.detectedSourceLanguage || '');
        setPhoneticGuide(res.phoneticGuide || '');
        setCulturalNotes(res.culturalNotes || '');
      } else {
        alert(res.error || 'Translation failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwap = () => {
    if (sourceLang === 'Auto-Detect') {
      setSourceLang(targetLang);
      setTargetLang('English');
    } else {
      const prevSource = sourceLang;
      setSourceLang(targetLang);
      setTargetLang(prevSource);
    }
    const prevSrcText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(prevSrcText);
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = async (text: string) => {
    if (!text || isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      await aiService.speakText(text, 'Kore');
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const toggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = 'en-US';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setSourceText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      rec.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  return (
    <div id="translator-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Neural Translator</h1>
              <p className="text-xs text-slate-500">
                High-fidelity context-aware translation with tone control and pronunciation.
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-semibold border border-amber-100">
            3 Credits / Run
          </span>
        </div>

        {/* Toolbar: Language Selectors & Tone */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          {/* Source & Target Lang Selectors */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-1">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                From
              </label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="Auto-Detect">Auto-Detect Language</option>
                {languageList.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSwap}
              className="mt-4 p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Swap Languages"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                To
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {languageList.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tone Selector */}
          <div className="w-full sm:w-auto">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Tone of Voice
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full sm:w-48 p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {toneOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dual Translation Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Source Input Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between min-h-[300px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {detectedLang ? `Source (${detectedLang})` : 'Original Text'}
                </span>
                <span className="text-[11px] text-slate-400">{sourceText.length} chars</span>
              </div>
              <textarea
                rows={8}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Type, paste, or speak text here..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleMic}
                  className={`p-2 rounded-xl transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="Speak input"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                {sourceText && (
                  <button
                    onClick={() => handleSpeak(sourceText)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Listen to original text"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                id="btn-run-translation"
                onClick={handleTranslate}
                disabled={!sourceText.trim() || isLoading}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                  sourceText.trim() && !isLoading
                    ? 'bg-amber-500 text-white hover:bg-amber-600 cursor-pointer shadow-amber-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Translate (3 Credits)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Target Output Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between min-h-[300px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Translation ({targetLang})
                </span>
                {translatedText && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> Accurate
                  </span>
                )}
              </div>

              <div className="min-h-[160px] text-sm text-slate-900 leading-relaxed">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center py-12 text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-500 mr-2" />
                    <span>Palia AI is translating...</span>
                  </div>
                ) : translatedText ? (
                  <p className="whitespace-pre-wrap">{translatedText}</p>
                ) : (
                  <p className="text-slate-400 text-xs italic">
                    Translation will appear here in real time...
                  </p>
                )}
              </div>

              {/* Phonetics & Cultural Nuance */}
              {phoneticGuide && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-amber-800">
                    <Info className="w-3.5 h-3.5" />
                    <span>Phonetic / Pronunciation</span>
                  </div>
                  <p className="text-amber-900 font-mono text-[11px]">{phoneticGuide}</p>
                  {culturalNotes && (
                    <p className="text-amber-800/80 text-[11px] pt-1">{culturalNotes}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {translatedText && (
                  <button
                    onClick={() => handleSpeak(translatedText)}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="Listen to translation"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {translatedText && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
