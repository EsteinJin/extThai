import { cn } from "@/lib/utils";
import { GraduationCap, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { Link } from "wouter";

export function Navigation() {
  const [location] = useLocation();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              <span className="text-blue-500 mr-3">📚</span>
              泰语学习卡片
            </h1>
          </div>
          <nav className="flex space-x-1">
            <Link href="/">
              <a
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors inline-flex items-center",
                  location === "/" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                )}
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                学习页面
              </a>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
