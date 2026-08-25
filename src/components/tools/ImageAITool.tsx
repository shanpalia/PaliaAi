import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Download,
  Copy,
  Check,
  Send,
  Layers,
  Wand2,
  RefreshCw,
  Crop,
  ZoomIn,
  Trash2,
  UploadCloud,
  Eye,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { creditService } from '../../services/creditService';

interface ImageAIToolProps {
  onSendToChat?: (imageUrl: string, prompt: string) => void;
}

const styles = [
  'Photorealistic 8K',
  'Futuristic Cyberpunk',
  '3D Pixar / Unreal Engine 5',
  'Digital Concept Art',
  'Minimalist Vector Anime',
  'Studio Cinematic Portrait',
  'Architectural Modernism',
  'Oil Painting Fantasy',
];

const aspectRatios = [
  { label: '1:1 Square', value: '1:1' },
  { label: '16:9 Landscape', value: '16:9' },
  { label: '9:16 Portrait', value: '9:16' },
  { label: '4:3 Standard', value: '4:3' },
];

export const ImageAITool: React.FC<ImageAIToolProps> = ({ onSendToChat }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(styles[0]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploadedBaseImg, setUploadedBaseImg] = useState<string | null>(null);
  const [editOperation, setEditOperation] = useState<'enhance' | 'remove_bg' | 'upscale' | 'custom'>('enhance');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const samplePrompts = [
    'Futuristic electric sports car navigating a neon-lit rain highway at night',
    'A serene zen garden on a floating orbital space station with cherry blossoms',
    'Sleek translucent glass AI robot designing an architectural skyscraper',
    'Cybernetic panther with glowing blue fiber optic fur resting in a crystal cave',
  ];

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    // Deduct credits (15 credits)
    const successDeduct = await creditService.deductCredits('Image AI Generation', 15);
    if (!successDeduct) {
      alert('Insufficient credits for Image AI. Please check your credit balance.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await aiService.generateImage({
        prompt: prompt.trim(),
        aspectRatio,
        style: selectedStyle,
      });

      if (res.success && res.imageUrl) {
        setGeneratedImage(res.imageUrl);
        setDescription(res.description || `Generated: ${prompt}`);
      } else {
        alert(res.error || 'Image generation failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      setPrompt(samplePrompts[Math.floor(Math.random() * samplePrompts.length)]);
    } else {
      setPrompt((prev) => `${prev}, highly detailed, octane render, 8k resolution, cinematic dramatic lighting, masterpiece`);
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedBaseImg(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyImage = () => {
    if (!generatedImage) return;
    navigator.clipboard.writeText(generatedImage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `palia-ai-${Date.now()}.png`;
    a.click();
  };

  return (
    <div id="image-ai-tool" className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">Image AI Studio</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-100">
                15 Credits / Gen
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Generate photorealistic visuals, digital illustrations, or enhance existing images.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'generate'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Generate Image
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'edit'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Edit & Enhance
            </button>
          </div>
        </div>

        {/* Main Grid: Controls + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Configuration Panel */}
          <div className="lg:col-span-5 space-y-5">
            {activeTab === 'generate' ? (
              /* Generate Form */
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                {/* Prompt */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-900">
                      Visual Prompt
                    </label>
                    <button
                      type="button"
                      onClick={handleEnhancePrompt}
                      className="text-[11px] font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>{prompt ? 'Enhance Prompt' : 'Inspire Me'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want to create in vivid detail..."
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                  />
                </div>

                {/* Style Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-900">Artistic Style</label>
                  <select
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    {styles.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-900">Aspect Ratio</label>
                  <div className="grid grid-cols-2 gap-2">
                    {aspectRatios.map((ar) => (
                      <button
                        key={ar.value}
                        type="button"
                        onClick={() => setAspectRatio(ar.value)}
                        className={`p-2 rounded-xl text-xs font-medium border text-center transition-all ${
                          aspectRatio === ar.value
                            ? 'bg-purple-50 text-purple-700 border-purple-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {ar.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit button */}
                <button
                  id="btn-generate-image"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || isLoading}
                  className={`w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                    prompt.trim() && !isLoading
                      ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer shadow-purple-200'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Visual Artwork...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Image (15 Credits)</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Edit & Enhance Form */
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-900">Source Image</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadImage}
                  />
                  {uploadedBaseImg ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
                      <img
                        src={uploadedBaseImg}
                        alt="Uploaded preview"
                        className="w-full h-40 object-cover"
                      />
                      <button
                        onClick={() => setUploadedBaseImg(null)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/70 text-white hover:bg-rose-600 transition-colors"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-purple-300 hover:bg-purple-50/20 cursor-pointer transition-all space-y-2"
                    >
                      <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-xs font-medium text-slate-700">Click or drag image here</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG, WEBP up to 10MB</p>
                    </div>
                  )}
                </div>

                {/* Edit Operations */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-900">Edit Task</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'enhance', label: 'AI Enhance & Polish' },
                      { id: 'remove_bg', label: 'Background Clean' },
                      { id: 'upscale', label: 'Super-Resolution' },
                      { id: 'custom', label: 'Prompt Modification' },
                    ].map((op) => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setEditOperation(op.id as any)}
                        className={`p-2 rounded-xl text-xs font-medium border text-center transition-all ${
                          editOperation === op.id
                            ? 'bg-purple-50 text-purple-700 border-purple-300 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Edit Instruction */}
                {editOperation === 'custom' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-900">
                      Instruction for Palia AI
                    </label>
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. Add cinematic neon lighting and a futuristic city behind"
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                )}

                {/* Process Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!uploadedBaseImg || isLoading}
                  className={`w-full py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                    uploadedBaseImg && !isLoading
                      ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer shadow-purple-200'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>Apply AI Image Transformation (15 Credits)</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Image Canvas & Output View */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs min-h-[420px] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-900">Generated Output</span>
                {generatedImage && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> High Fidelity Ready
                  </span>
                )}
              </div>

              {/* Display Area */}
              <div className="flex-1 flex items-center justify-center p-4 bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden min-h-[300px]">
                {isLoading ? (
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-md animate-spin">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      Palia AI is rendering your artwork...
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Synthesizing neural textures, composition, and lighting
                    </p>
                  </div>
                ) : generatedImage ? (
                  <div className="w-full flex flex-col items-center gap-3">
                    <img
                      src={generatedImage}
                      alt="Palia Generated Artwork"
                      className="max-h-[360px] w-auto max-w-full rounded-xl object-contain shadow-md border border-slate-200"
                    />
                    {description && (
                      <p className="text-xs text-slate-600 text-center italic max-w-md">
                        &ldquo;{description}&rdquo;
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-2 text-slate-400">
                    <ImageIcon className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">No image generated yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Enter a prompt or select a preset on the left, then click Generate to create artwork.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              {generatedImage && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition-all shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>

                    <button
                      onClick={handleCopyImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {onSendToChat && (
                    <button
                      onClick={() => onSendToChat(generatedImage, prompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 text-xs font-medium transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Discuss in Chat</span>
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
