import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/navigation";
import CourseSelectionPage from "@/pages/course-selection";
import LearningPage from "@/pages/learning";
import FileManagementPage from "@/pages/file-management";
import CardBrowser from "@/pages/card-browser";
import NotFound from "@/pages/not-found";
import { AudioService } from "@/lib/audio";
import { useEffect } from "react";

function Router() {
  const [location] = useLocation();
  
  // Stop audio when navigating to home page
  useEffect(() => {
    if (location === '/') {
      const audioService = AudioService.getInstance();
      audioService.stopAllAudio();
    }
  }, [location]);

  return (
    <Switch>
      <Route path="/" component={CourseSelectionPage} />
      <Route path="/learning/:level?" component={LearningPage} />
      <Route path="/cards/:level">
        {(params) => <CardBrowser level={parseInt(params.level, 10)} />}
      </Route>
      <Route path="/file-management">
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <FileManagementPage />
          </main>
        </div>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <Router />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
