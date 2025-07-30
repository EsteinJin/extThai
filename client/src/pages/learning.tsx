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
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [goToNext, goToPrev]);

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
        {/* Minimalist Mobile Header */}
        <div className="flex justify-between items-center p-4 shrink-0">
          <Link href="/">
            <Button variant="ghost" size="sm" className={`${
              isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-800'
            }`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          
          {cards.length > 0 && (
            <div className="flex items-center gap-4">
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {Math.min(currentIndex + 1, cards.length)} / {cards.length}
              </div>
              
              <Button
                variant={completedCards.includes(currentIndex) ? "default" : "ghost"}
                onClick={markCurrentCardCompleted}
                disabled={cards.length === 0 || completedCards.includes(currentIndex)}
                size="sm"
                className={`${
                  completedCards.includes(currentIndex) 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {completedCards.includes(currentIndex) ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setIsDarkMode(!isDarkMode)}
                size="sm"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {cards.length > 0 && (
          <div className="px-4 pb-4 shrink-0">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div 
                className="bg-green-500 h-1 rounded-full transition-all duration-500"
                style={{ width: `${(completedCards.length / cards.length) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Full Screen Card View */}
        {cards.length > 0 && currentIndex >= 0 && currentIndex < cards.length ? (
          <div className="flex-1 flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-4xl">
              {cards[currentIndex] ? (
                <FlashCard 
                  key={`card-${cards[currentIndex].id}-${currentIndex}`} 
                  card={cards[currentIndex]} 
                  index={currentIndex} 
                />
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-3xl shadow-xl min-h-[70vh] flex items-center justify-center">
                  <div className="text-gray-500 dark:text-gray-400 text-xl">
                    卡片 {currentIndex + 1} 加载失败
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

        {/* Navigation Buttons and Tips */}
        {cards.length > 0 && (
          <div className="px-4 pb-4 shrink-0">
            <div className="flex justify-between items-center mb-2">
              <Button
                variant="ghost"
                onClick={goToPrev}
                disabled={cards.length === 0}
                className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <SkipBack className="w-4 h-4 mr-2" />
                上一张
              </Button>

              <div className="flex space-x-2">
                <Button
                  variant={autoPageTurn ? "default" : "ghost"}
                  onClick={() => setAutoPageTurn(!autoPageTurn)}
                  className={`${autoPageTurn 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'
                  }`}
                  title="自动翻页 (8秒间隔)"
                >
                  {autoPageTurn ? <Timer className="w-4 h-4" /> : <TimerOff className="w-4 h-4" />}
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setShowHelp(!showHelp)}
                  className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    // Refetch new random cards
                    refetch();
                    setCurrentIndex(0);
                    setCompletedCards([]);
                    toast({
                      title: "已刷新卡片",
                      description: "获取新的随机10张卡片",
                    });
                  }}
                  className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  换一组
                </Button>
              </div>

              <Button
                variant="ghost"
                onClick={goToNext}
                disabled={cards.length === 0}
                className={`${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-800'}`}
              >
                下一张
                <SkipForward className="w-4 h-4 ml-2" />
              </Button>
            </div>
            <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} text-center space-y-1`}>
              <div>滑动或按空格键翻页 • C键标记完成 • D键切换主题</div>
              <div>
                {autoPageTurn ? (
                  <span className="text-blue-500 font-medium">自动翻页开启 (8秒间隔)</span>
                ) : (
                  "T键自动翻页 • R键换一组 • H键显示帮助"
                )}
              </div>
            </div>
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowHelp(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold mb-4 dark:text-white">键盘快捷键</h3>
              <div className="space-y-2 text-sm dark:text-gray-300">
                <div className="flex justify-between">
                  <span>空格键 / →</span>
                  <span>下一张卡片</span>
                </div>
                <div className="flex justify-between">
                  <span>←</span>
                  <span>上一张卡片</span>
                </div>
                <div className="flex justify-between">
                  <span>C</span>
                  <span>标记完成</span>
                </div>
                <div className="flex justify-between">
                  <span>D</span>
                  <span>切换夜间模式</span>
                </div>
                <div className="flex justify-between">
                  <span>R</span>
                  <span>刷新卡片组</span>
                </div>
                <div className="flex justify-between">
                  <span>H</span>
                  <span>显示/隐藏帮助</span>
                </div>
                <div className="flex justify-between">
                  <span>T</span>
                  <span>自动翻页开关</span>
                </div>
                <div className="flex justify-between">
                  <span>ESC</span>
                  <span>关闭帮助</span>
                </div>
              </div>
              <Button 
                onClick={() => setShowHelp(false)} 
                className="w-full mt-4"
                variant="outline"
              >
                关闭
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
