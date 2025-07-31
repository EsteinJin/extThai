import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@shared/schema";
import { FlashCard } from "@/components/flashcard";
import { Button } from "@/components/ui/button";
import { RefreshCw, Play, Pause, SkipBack, SkipForward, Moon, Sun, ArrowLeft, CheckCircle, Circle, Settings, Timer, TimerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "wouter";
import { AudioService } from "@/lib/audio";
import { progressService } from "@/lib/progress";
import { settingsService } from "@/lib/settings";

export default function LearningPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const level = params.level ? parseInt(params.level, 10) : 1;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [completedCards, setCompletedCards] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [settings, setSettings] = useState(settingsService.getSettings());
  const [autoPageTurn, setAutoPageTurn] = useState(false);
  const [autoPageInterval, setAutoPageInterval] = useState<NodeJS.Timeout | null>(null);

  const { data: cards = [], isLoading, refetch } = useQuery<Card[]>({
    queryKey: ["/api/cards", level, "random"],
    queryFn: () => fetch(`/api/cards?level=${level}&random=true&limit=10`).then(res => res.json()),
  });

  // Load progress when cards are loaded
  useEffect(() => {
    if (cards.length > 0) {
      const savedProgress = progressService.getProgress();
      
      if (savedProgress && savedProgress.level === level && progressService.isRecentProgress(savedProgress)) {
        // Resume from saved progress, but ensure index is within bounds
        const safeIndex = Math.min(savedProgress.currentIndex, cards.length - 1);
        setCurrentIndex(safeIndex);
        setAutoPlay(true); // Always auto-play
        setIsDarkMode(savedProgress.darkMode);
        setCompletedCards(savedProgress.completedCards);
        
        toast({
          title: "学习进度已恢复",
          description: `继续学习第${level}级，从第${safeIndex + 1}张卡片开始`,
        });
      } else {
        // Start fresh or different level
        setCurrentIndex(0);
        setCompletedCards([]);
        setAutoPlay(true); // Always auto-play
      }
    }
  }, [cards.length, level, toast]);

  // Save progress whenever current state changes
  useEffect(() => {
    if (cards.length > 0) {
      progressService.saveProgress(level, currentIndex, completedCards, true, isDarkMode);
    }
  }, [level, currentIndex, completedCards, isDarkMode, cards.length]);

  const audioService = AudioService.getInstance();

  // Navigation functions with audio stop
  const goToNext = useCallback(() => {
    if (cards.length > 0) {
      // Stop current audio before changing cards
      audioService.stopAllAudio();
      const nextIndex = (currentIndex + 1) % cards.length;
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, cards.length, audioService]);

  const goToPrev = useCallback(() => {
    if (cards.length > 0) {
      // Stop current audio before changing cards
      audioService.stopAllAudio();
      const prevIndex = currentIndex === 0 ? cards.length - 1 : currentIndex - 1;
      setCurrentIndex(prevIndex);
    }
  }, [currentIndex, cards.length, audioService]);

  // Mark current card as completed
  const markCurrentCardCompleted = useCallback(() => {
    if (cards.length > 0 && currentIndex < cards.length && !completedCards.includes(currentIndex)) {
      const newCompleted = [...completedCards, currentIndex];
      setCompletedCards(newCompleted);
      progressService.markCardCompleted(level, currentIndex, newCompleted);
      
      toast({
        title: "卡片已标记为完成",
        description: `已完成 ${newCompleted.length}/${cards.length} 张卡片`,
      });
    }
  }, [currentIndex, completedCards, cards.length, level, toast]);



  // Auto-play audio when card changes - always play word and example after page turn
  useEffect(() => {
    if (cards.length > 0 && currentIndex >= 0 && currentIndex < cards.length && cards[currentIndex]) {
      console.log(`🎵 Auto-playing audio for card ${currentIndex + 1}/${cards.length}: ${cards[currentIndex].thai}`);
      
      const playSequentialAudio = async () => {
        try {
          // Stop any currently playing audio first
          audioService.stopAllAudio();
          
          const card = cards[currentIndex];
          
          // Play word audio first (always play this)
          console.log(`🎯 Playing word: ${card.thai}`);
          await audioService.playAudio(card.thai, "th-TH");
          
          // Small delay between word and example for better listening experience
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Play example audio if exists
          if (card.example && card.example.trim()) {
            console.log(`🎯 Playing example: ${card.example}`);
            await audioService.playAudio(card.example, "th-TH");
          }
        } catch (error) {
          console.error("Auto-play failed:", error);
        }
      };
      
      // Small delay to allow UI to update before starting audio
      setTimeout(playSequentialAudio, 300);
    }
  }, [currentIndex, cards, audioService]);

  // Auto page turn functionality
  useEffect(() => {
    if (autoPageTurn && cards.length > 0) {
      const interval = setInterval(() => {
        goToNext();
      }, 8000); // Turn page every 8 seconds
      
      setAutoPageInterval(interval);
      return () => clearInterval(interval);
    } else if (autoPageInterval) {
      clearInterval(autoPageInterval);
      setAutoPageInterval(null);
    }
  }, [autoPageTurn, goToNext, cards.length]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (autoPageInterval) {
        clearInterval(autoPageInterval);
      }
    };
  }, [autoPageInterval]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return; // Don't interfere with form inputs
      }
      
      switch (event.code) {
        case 'Space':
        case 'ArrowRight':
          event.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          goToPrev();
          break;
        case 'KeyD':
          event.preventDefault();
          setIsDarkMode(prev => !prev);
          break;
        case 'KeyC':
          event.preventDefault();
          markCurrentCardCompleted();
          break;
        case 'KeyT':
          event.preventDefault();
          setAutoPageTurn(!autoPageTurn);
          toast({
            title: autoPageTurn ? "自动翻页已关闭" : "自动翻页已开启",
            description: autoPageTurn ? "停止自动翻页" : "每8秒自动翻到下一张卡片",
          });
          break;
        case 'KeyR':
          event.preventDefault();
          audioService.stopAllAudio();
          refetch();
          setCurrentIndex(0);
          setCompletedCards([]);
          toast({
            title: "换一组",
            description: "已重新获取随机卡片",
          });
          break;
        case 'Escape':
          if (showHelp) {
            event.preventDefault();
            setShowHelp(false);
          }
          break;
        case 'KeyH':
          event.preventDefault();
          setShowHelp(!showHelp);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToNext, goToPrev, autoPageTurn, showHelp, refetch, audioService, setCurrentIndex, setCompletedCards, toast]);

  // Touch/swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "卡片已刷新",
      description: "学习卡片已更新到最新状态",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    );
  }

  return (
    <div 
      className={isDarkMode ? 'dark' : ''}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`min-h-screen flex flex-col transition-colors ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        {/* Clean Mobile Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="text-sm font-medium">
              基础泰语{level}
            </div>
          </div>
          
          {cards.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {Math.min(currentIndex + 1, cards.length)}/{cards.length}
              </div>
              {completedCards.length > 0 && (
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓{completedCards.length}
                </div>
              )}
              <Button
                variant="ghost"
                onClick={() => setIsDarkMode(!isDarkMode)}
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isDarkMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
              </Button>
            </div>
          )}
        </div>

        {/* Slim Progress Indicator */}
        {cards.length > 0 && (
          <div className="px-4 pb-1 shrink-0">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-0.5">
              <div 
                className="bg-green-500 h-0.5 rounded-full transition-all duration-500"
                style={{ width: `${(completedCards.length / cards.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Optimized Card View */}
        {cards.length > 0 && currentIndex >= 0 && currentIndex < cards.length ? (
          <div className="flex-1 flex items-center justify-center px-3 py-4">
            <div className="w-full max-w-lg">
              {cards[currentIndex] ? (
                <FlashCard 
                  key={`card-${cards[currentIndex].id}-${currentIndex}`} 
                  card={cards[currentIndex]} 
                  index={currentIndex} 
                />
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl shadow-lg min-h-[50vh] flex items-center justify-center">
                  <div className="text-gray-500 dark:text-gray-400 text-lg">
                    卡片加载失败
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                第{level}级课程
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                暂无学习卡片
              </p>
              <p className="text-gray-500 dark:text-gray-500">
                该级别还没有学习内容，请联系管理员添加卡片。
              </p>
            </div>
          </div>
        )}

        {/* Floating Control Panel - Always Visible */}
        {cards.length > 0 && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto">
            <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-full border border-gray-300 dark:border-gray-600 shadow-2xl px-2 py-2 transition-all duration-200">
              <div className="flex items-center gap-1">
                {/* Previous Button */}
                <Button
                  variant="ghost"
                  onClick={goToPrev}
                  size="sm"
                  className="h-10 w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 hover:scale-105 active:scale-95"
                  title="上一张 (← 键)"
                >
                  <SkipBack className="w-4 h-4" />
                </Button>

                {/* Complete Button */}
                <Button
                  variant={completedCards.includes(currentIndex) ? "default" : "ghost"}
                  onClick={markCurrentCardCompleted}
                  disabled={completedCards.includes(currentIndex)}
                  size="sm"
                  className={`h-10 w-10 rounded-full p-0 transition-all duration-150 hover:scale-105 active:scale-95 ${
                    completedCards.includes(currentIndex) 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400'
                  }`}
                  title="标记完成 (C 键)"
                >
                  {completedCards.includes(currentIndex) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                </Button>

                {/* Auto Page Toggle */}
                <Button
                  variant={autoPageTurn ? "default" : "ghost"}
                  onClick={() => {
                    setAutoPageTurn(!autoPageTurn);
                    toast({
                      title: autoPageTurn ? "自动翻页已关闭" : "自动翻页已开启", 
                      description: autoPageTurn ? "停止自动翻页" : "每8秒自动翻到下一张卡片",
                    });
                  }}
                  size="sm"
                  className={`h-10 w-10 rounded-full p-0 transition-all duration-150 hover:scale-105 active:scale-95 ${autoPageTurn 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="自动翻页 (T 键)"
                >
                  {autoPageTurn ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4" />}
                </Button>

                {/* Refresh Button */}
                <Button
                  variant="ghost"
                  onClick={() => {
                    audioService.stopAllAudio();
                    refetch();
                    setCurrentIndex(0);
                    setCompletedCards([]);
                    toast({
                      title: "换一组",
                      description: "已重新获取随机卡片",
                    });
                  }}
                  size="sm"
                  className="h-10 w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 hover:scale-105 active:scale-95"
                  title="换一组 (R 键)"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>

                {/* Next Button */}
                <Button
                  variant="ghost"
                  onClick={goToNext}
                  size="sm"
                  className="h-10 w-10 rounded-full p-0 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-150 hover:scale-105 active:scale-95"
                  title="下一张 (空格/→ 键)"
                >
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Minimal Tips */}
        {cards.length > 0 && !showHelp && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 pointer-events-none">
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center bg-black/30 dark:bg-white/20 backdrop-blur-md rounded-full px-3 py-1 transition-all duration-200">
              {autoPageTurn ? (
                <span className="text-blue-400 font-medium">自动翻页中 (8秒)</span>
              ) : (
                "滑动翻页 • H键帮助"
              )}
            </div>
          </div>
        )}

        {/* Help Button - Fixed Position */}
        {cards.length > 0 && !showHelp && (
          <div className="fixed top-4 right-4 z-40 pointer-events-auto">
            <Button
              onClick={() => setShowHelp(true)}
              variant="outline"
              size="sm"
              className="h-8 w-8 rounded-full p-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl border-gray-300 dark:border-gray-600 shadow-lg transition-all duration-200 hover:scale-105"
            >
              ?
            </Button>
          </div>
        )}

        {/* Simplified Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHelp(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4 dark:text-white text-center">快捷键</h3>
              <div className="grid grid-cols-2 gap-3 text-sm dark:text-gray-300">
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">空格/→</span>
                  <span className="text-xs mt-1">下一张</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">←</span>
                  <span className="text-xs mt-1">上一张</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">C</span>
                  <span className="text-xs mt-1">完成</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">T</span>
                  <span className="text-xs mt-1">自动翻页</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">R</span>
                  <span className="text-xs mt-1">换一组</span>
                </div>
                <div className="flex flex-col items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="font-mono text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">D</span>
                  <span className="text-xs mt-1">夜间模式</span>
                </div>
              </div>
              <Button 
                onClick={() => setShowHelp(false)} 
                className="w-full mt-4 h-9"
                variant="outline"
              >
                关闭 (ESC)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
