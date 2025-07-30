import { Card } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Volume2, Play, BookOpen } from "lucide-react";
import { getCardColor, formatCardNumber } from "@/lib/utils";
import { AudioService } from "@/lib/audio";
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
    const audioService = AudioService.getInstance();
    
    try {
      setLoading(true);
      
      // Use AudioService playAudio method which handles TTS and external audio
      console.log(`🎯 Playing ${type} audio: ${text}`);
      await audioService.playAudio(text, "th-TH");
      
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
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden min-h-[50vh] max-h-[85vh] flex flex-col card-transition cursor-pointer transform hover:scale-[1.02]"
      onClick={() => setCardFlipped(!cardFlipped)}
    >
      <div className="p-4 md:p-6 lg:p-8 flex-1 flex flex-col justify-center">        
        <div className="space-y-4 md:space-y-6">
          {/* Thai Word - Optimized for mobile */}
          <div className="text-center">
            <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 leading-tight" style={{fontFamily: 'sans-serif'}}>
              {card.thai}
            </div>
            <div className="text-lg md:text-xl text-gray-500 dark:text-gray-400 italic font-medium">
              {card.pronunciation}
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-600 w-12 mx-auto"></div>
          
          {/* Chinese Translation */}
          <div className={`text-center transition-opacity duration-300 ${cardFlipped ? 'opacity-100' : 'opacity-70'}`}>
            <div className="text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-800 dark:text-gray-200">
              {card.chinese}
            </div>
            {!cardFlipped && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">点击卡片查看详情</p>
            )}
          </div>
          
          {/* Example Section - Keep text size prominent */}
          {card.example && (
            <div className={`bg-yellow-100 dark:bg-yellow-900/30 rounded-xl p-4 md:p-6 border-l-4 border-yellow-500 shadow-md transition-all duration-500 ${cardFlipped ? 'opacity-100 transform translate-y-0' : 'opacity-60 transform translate-y-2'}`}>
              <h4 className="text-base md:text-lg font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center">
                <BookOpen className="w-4 h-4 mr-2" />
                例句 Example
              </h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xl md:text-2xl lg:text-3xl text-yellow-900 dark:text-yellow-100 font-semibold leading-relaxed flex-1" style={{fontFamily: 'sans-serif'}}>
                    {card.example}
                  </p>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayAudio(card.example, "example");
                    }}
                    variant="ghost"
                    size="sm"
                    className="ml-3 text-yellow-600 hover:text-yellow-800 dark:text-yellow-300 dark:hover:text-yellow-100"
                    disabled={isPlayingExample}
                  >
                    {isPlayingExample ? (
                      <div className="animate-pulse">
                        <Volume2 className="w-4 h-4" />
                      </div>
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-base md:text-lg text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  {card.example_translation}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Play button for Thai word - Compact mobile design */}
        <div className="flex justify-center mt-4 md:mt-6">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handlePlayAudio(card.thai, "word");
            }}
            variant="outline"
            size="default"
            className="px-6 py-2 text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-200 dark:border-blue-800 dark:hover:bg-blue-900/20 shadow-sm hover:shadow-md transition-all duration-300"
            disabled={isPlayingWord}
          >
            {isPlayingWord ? (
              <div className="animate-pulse flex items-center">
                <Volume2 className="w-5 h-5 mr-2" />
                <span className="text-base font-medium">播放中...</span>
              </div>
            ) : (
              <div className="flex items-center">
                <Play className="w-5 h-5 mr-2" />
                <span className="text-base font-medium">播放发音</span>
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
