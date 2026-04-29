'use client';

import { useState } from 'react';
import { Sparkles, Download, Loader2, Image as ImageIcon, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function ImageGeneratorDemo() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImg(null);

    try {
      console.log('🎨 Starting generation request...');
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      console.log('📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Generation failed:', errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log('✅ JSON received', data.url ? 'URL version' : 'Base64 version');

      if (data.b64_json) {
        setGeneratedImg(`data:image/png;base64,${data.b64_json}`);
      } else if (data.url) {
        setGeneratedImg(data.url);
      } else {
        throw new Error('No image data found in response');
      }

      console.log('✨ Image set in UI!');
    } catch (err: any) {

      console.error('❌ Client Error:', err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }

  };

  const handleDownload = () => {
    if (!generatedImg) return;
    const link = document.createElement('a');
    link.href = generatedImg;
    link.download = `vibe-generated-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-6">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
          Azure Vibe Studio
        </h2>
        <p className="text-muted-foreground text-lg">
          Powered by Azure OpenAI GPT-Image-2 (2026 Edition)
        </p>
      </div>


      <Card className="p-6 bg-background/50 backdrop-blur-xl border-primary/20 shadow-2xl relative overflow-hidden group">
         {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-700" />
        
        <div className="space-y-6 relative">
          <div className="relative">
            <textarea
              placeholder="Describe the image you want to create... (e.g., 'A cyberpunk trading terminal with holographic stocks and neon purple lighting')"
              className="w-full min-h-[120px] p-4 rounded-xl bg-muted/50 border-primary/10 focus:border-primary/40 focus:ring-1 focus:ring-primary/40 outline-none transition-all resize-none text-lg"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isGenerating}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="rounded-lg px-6 bg-primary hover:bg-primary/90 transition-all font-semibold"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-muted/30 border border-primary/5 flex items-center justify-center">
            {generatedImg ? (
              <>
                <img
                  src={generatedImg}
                  alt="Generated"
                  className="w-full h-full object-cover animate-in fade-in zoom-in duration-700"
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="bg-background/80 backdrop-blur-md hover:bg-background"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-muted-foreground/60">
                {isGenerating ? (
                   <div className="relative w-24 h-24">
                     <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping" />
                     <Loader2 className="w-24 h-24 animate-spin text-primary/40" />
                   </div>
                ) : (
                  <>
                    <ImageIcon className="w-16 h-16 opacity-20" />
                    <p className="text-sm font-medium">Your creative masterpiece will appear here</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-12">
        <div className="p-4 rounded-xl bg-muted/30 border border-primary/5 space-y-2">
          <p className="font-semibold text-sm flex items-center gap-2 text-primary">
            <Sparkles className="w-4 h-4" /> Next-Gen Reasoning
          </p>
          <p className="text-xs text-muted-foreground">Uses GPT-Image-2's advanced "Thinking" engine to interpret complex prompts.</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-primary/5 space-y-2">
          <p className="font-semibold text-sm flex items-center gap-2 text-primary">
            <Loader2 className="w-4 h-4" /> Sweden Central Speed
          </p>
          <p className="text-xs text-muted-foreground">Low-latency generation powered by high-capacity Azure AI nodes.</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 border border-primary/5 space-y-2">
           <p className="font-semibold text-sm flex items-center gap-2 text-primary">
            <ImageIcon className="w-4 h-4" /> 4K Ultra Fidelity
          </p>
          <p className="text-xs text-muted-foreground">Optimized for hyper-realistic 4K resolution and localized text rendering.</p>
        </div>

      </div>
    </div>
  );
}
