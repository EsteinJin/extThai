import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, Trophy, Star, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { progressService } from "@/lib/progress";
import { useQuery } from "@tanstack/react-query";
import { Card as CardType } from "@shared/schema";

const courses = [
  {
    level: 1,
    title: "基础泰语1",
    description: "入门级泰语，学习基本问候和日常用语",
    icon: BookOpen,
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700"
  },
  {
    level: 2,
    title: "基础泰语2",
    description: "进阶基础泰语，掌握更多实用对话",
    icon: GraduationCap,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700"
  },
  {
    level: 3,
    title: "基础泰语3",
    description: "中级泰语，学习复杂句型和语法",
    icon: Trophy,
    color: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700"
  },
  {
    level: 4,
    title: "基础泰语4",
    description: "高级基础泰语，掌握流利对话技巧",
    icon: Star,
    color: "bg-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700"
  }
];

export default function CourseSelectionPage() {
  // Get cards data to calculate progress with stable caching
  const { data: allCards = [] } = useQuery<CardType[]>({
    queryKey: ["/api/cards"],
    queryFn: () => fetch("/api/cards").then(res => res.json()),
    staleTime: 15 * 60 * 1000, // 15分钟内不重新获取
    refetchOnWindowFocus: false, // 窗口获得焦点时不刷新
    refetchOnMount: false, // 组件挂载时不重新获取
  });

  // Get progress for each level
  const getProgressForLevel = (level: number) => {
    const levelCards = allCards.filter(card => card.level === level);
    const progress = progressService.getProgress();
    
    if (progress && progress.level === level && progressService.isRecentProgress(progress)) {
      const completedPercentage = levelCards.length > 0 
        ? Math.round((progress.completedCards.length / levelCards.length) * 100)
        : 0;
      return {
        completed: progress.completedCards.length,
        total: levelCards.length,
        percentage: completedPercentage,
        hasProgress: true
      };
    }
    
    return {
      completed: 0,
      total: levelCards.length,
      percentage: 0,
      hasProgress: false
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex flex-col justify-center py-12 px-4">
      <div className="max-w-6xl mx-auto w-full">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">泰语学习课程</h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto">选择您想要学习的课程级别，开始您的泰语学习之旅</p>
        </div>

        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {courses.map((course) => {
            const Icon = course.icon;
            const progress = getProgressForLevel(course.level);
            
            return (
              <Card key={course.level} className="group hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardContent className="p-10 text-center">
                  <div className={`w-20 h-20 ${course.bgColor} rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-300 relative shadow-lg`}>
                    <Icon className={`w-10 h-10 ${course.textColor}`} />
                    {progress.hasProgress && progress.percentage === 100 && (
                      <div className="absolute -top-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                        <CheckCircle className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">{course.title}</h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{course.description}</p>
                  
                  {/* Progress Display */}
                  {progress.total > 0 && (
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-gray-500">学习进度</span>
                        <span className="text-sm text-gray-500">{progress.completed}/{progress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div 
                          className={`h-3 rounded-full transition-all duration-500 ${course.color.replace('bg-', 'bg-')}`}
                          style={{ width: `${progress.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-gray-500">{progress.percentage}% 完成</div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <Link href={`/cards/${course.level}`} className="flex-1">
                      <Button 
                        variant="outline"
                        className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-xl transition-all duration-300 text-base shadow-sm hover:shadow-md"
                      >
                        浏览卡片
                      </Button>
                    </Link>
                    <Link href={`/learning/${course.level}`} className="flex-1">
                      <Button 
                        className={`w-full ${course.color} hover:opacity-90 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 text-base shadow-lg hover:shadow-xl`}
                      >
                        {progress.hasProgress ? "继续学习" : "开始学习"}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}