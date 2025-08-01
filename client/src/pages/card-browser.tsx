import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Volume2, ChevronUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AudioService } from "@/lib/audio";

interface CardData {
  id: number;
  thai: string;
  chinese: string;
  pronunciation: string;
  example: string;
  example_translation: string;
  level: number;
  word_audio?: string;
  example_audio?: string;
  card_image?: string;
}

interface CardBrowserProps {
  level: number;
}

export default function CardBrowser({ level }: CardBrowserProps) {
  const [, setLocation] = useLocation();
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch cards for the selected level with stable caching to prevent auto-refresh
  const { data: cards = [], isLoading } = useQuery<CardData[]>({
    queryKey: ["/api/cards", level],
    enabled: level > 0,
    staleTime: 10 * 60 * 1000, // 10分钟缓存，避免过度刷新
    refetchOnWindowFocus: false, // 窗口获得焦点时不刷新
    refetchOnMount: false, // 组件挂载时不重新获取
    refetchOnReconnect: false, // 网络重连时不刷新
    refetchInterval: false, // 禁用定期刷新
  });

  // Handle scroll for back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowBackToTop(scrollTop > 300);
      }
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card);
  };

  const handleCloseDetailView = () => {
    setSelectedCard(null);
  };

  const handlePlayAudio = async (card: CardData, type: 'word' | 'example', e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const audioService = AudioService.getInstance();
      if (type === 'word') {
        await audioService.playAudio(card.thai, "th-TH", card.id);
      } else {
        await audioService.playAudio(card.example, "th-TH", card.id);
      }
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">加载卡片中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">基础泰语{level} 暂无学习卡片</p>
            <Link href="/">
              <Button variant="outline">返回首页</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  返回首页
                </Button>
              </Link>
              <Badge variant="secondary" className="text-sm">
                基础泰语{level}
              </Badge>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              共 {cards.length} 张卡片
            </div>
          </div>
        </div>
      </div>

      {/* Card Grid */}
      <div 
        ref={scrollContainerRef}
        className="max-w-6xl mx-auto px-4 py-6 h-[calc(100vh-80px)] overflow-y-auto"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map((card) => (
            <Card
              key={card.id}
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              onClick={() => handleCardClick(card)}
            >
              <CardContent className="p-4">
                {/* Main word display */}
                <div className="text-center mb-3">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {card.thai}
                  </div>
                  <div className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                    {card.chinese}
                  </div>
                </div>

                {/* Example preview */}
                <div className="text-center mb-3 min-h-[3rem] flex flex-col justify-center">
                  <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                    {truncateText(card.example, 20)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {truncateText(card.example_translation, 25)}
                  </div>
                </div>

                {/* Audio controls */}
                <div className="flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                    onClick={(e) => handlePlayAudio(card, 'word', e)}
                    title="播放单词发音"
                  >
                    <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900"
                    onClick={(e) => handlePlayAudio(card, 'example', e)}
                    title="播放例句发音"
                  >
                    <Volume2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </Button>
                </div>

                {/* Pronunciation hint */}
                <div className="text-center mt-2">
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {card.pronunciation}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Back to top button */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 rounded-full w-12 h-12 p-0 shadow-lg z-20"
          size="sm"
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
      )}

      {/* Detailed card view modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Close button */}
              <div className="flex justify-end mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseDetailView}
                >
                  ✕
                </Button>
              </div>

              {/* Detailed card content */}
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  {selectedCard.thai}
                </div>
                <div className="text-xl text-blue-600 dark:text-blue-400 font-medium mb-4">
                  {selectedCard.chinese}
                </div>
                <div className="text-gray-600 dark:text-gray-300 mb-2">
                  发音: {selectedCard.pronunciation}
                </div>

                {/* Example section */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="text-lg text-gray-800 dark:text-gray-200 mb-2">
                    {selectedCard.example}
                  </div>
                  <div className="text-gray-600 dark:text-gray-300">
                    {selectedCard.example_translation}
                  </div>
                </div>

                {/* Audio controls */}
                <div className="flex justify-center gap-4">
                  <Button
                    onClick={(e) => handlePlayAudio(selectedCard, 'word', e)}
                    className="flex items-center gap-2"
                  >
                    <Volume2 className="w-4 h-4" />
                    播放单词
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => handlePlayAudio(selectedCard, 'example', e)}
                    className="flex items-center gap-2"
                  >
                    <Volume2 className="w-4 h-4" />
                    播放例句
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}