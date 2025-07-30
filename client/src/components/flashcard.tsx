import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Volume2, Play, BookOpen } from "lucide-react";
import { getCardColor, formatCardNumber } from "@/lib/utils";
import { audioService } from "@/lib/audio";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface FlashCardProps {
  card: Card;
  index: number;
}

export function FlashCard({ card, index }: FlashCardProps) {
  const { toast } = useToast();
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  const [isPlayingExample, setIsPlayingExample] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);

  if (!card) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-3xl shadow-xl min-h-[70vh] flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400 text-xl">卡片加载中...</div>
      </div>
    );
  }

  const handlePlayAudio = async (text: string, type: "word" | "example") => {
    const setLoading = type === "word" ? setIsPlayingWord : setIsPlayingExample;
    
    try {
      setLoading(true);
      
      let audioUrl: string | null = null;
      
      // Check if card has generated audio files
      if (type === "word" && card.word_audio) {
        audioUrl = `/api/audio/generated/${card.word_audio.replace('generated/audio/', '')}`;
        console.log(`🎯 Using BACKEND generated word audio: ${audioUrl}`);
      } else if (type === "example" && card.example_audio) {
        audioUrl = `/api/audio/generated/${card.example_audio.replace('generated/audio/', '')}`;
        console.log(`🎯 Using BACKEND generated example audio: ${audioUrl}`);
      } else {
        // Fallback to external audio generation
        console.log(`🌐 Using EXTERNAL audio service for: ${text}`);
        audioUrl = await audioService.generateAudio(text, "th-TH");
      }
      
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        await audio.play();
      } else {
        throw new Error("Could not generate audio");
      }
    } catch (error) {
      console.error("Audio playback failed:", error);
      toast({
        title: "音频播放失败",
        description: "请检查网络连接后重试",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden min-h-[70vh] flex flex-col card-transition cursor-pointer transform hover:scale-[1.01]"
      onClick={() => setCardFlipped(!cardFlipped)}
    >
      <div className="p-6 md:p-8 lg:p-12 flex-1 flex flex-col justify-center">        
        <div className="space-y-8 md:space-y-12">
          {/* Thai Word - Larger for mobile */}
          <div className="text-center">
            <div className="text-5xl md:text-6xl lg:text-7xl font-bold thai-text text-gray-900 dark:text-white mb-4 leading-tight">
              {card.thai}
            </div>
            <div className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 italic font-medium">
              {card.pronunciation}
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-600 w-16 mx-auto"></div>
          
          {/* Chinese Translation */}
          <div className={`text-center transition-opacity duration-300 ${cardFlipped ? 'opacity-100' : 'opacity-70'}`}>
            <div className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-800 dark:text-gray-200">
              {card.chinese}
            </div>
            {!cardFlipped && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">点击卡片查看详情</p>
            )}
          </div>
          
          {/* Example Section - Enhanced with animation */}
          {card.example && (
            <div className={`bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl p-6 md:p-8 border-l-4 border-yellow-500 shadow-lg transition-all duration-500 ${cardFlipped ? 'opacity-100 transform translate-y-0' : 'opacity-60 transform translate-y-2'}`}>
              <h4 className="text-lg md:text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4 flex items-center">
                <BookOpen className="w-5 h-5 mr-2" />
                例句 Example
              </h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xl md:text-2xl lg:text-3xl thai-text text-yellow-900 dark:text-yellow-100 font-semibold leading-relaxed flex-1">
                    {card.example}
                  </p>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayAudio(card.example, "example");
                    }}
                    variant="ghost"
                    size="sm"
                    className="ml-4 text-yellow-600 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-100"
                    disabled={isPlayingExample}
                  >
                    {isPlayingExample ? (
                      <div className="animate-pulse">
                        <Volume2 className="w-5 h-5" />
                      </div>
                    ) : (
                      <Play className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <p className="text-lg md:text-xl text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  {card.example_translation}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
