export interface LearningProgress {
  level: number;
  currentIndex: number;
  lastStudied: number; // timestamp
  completedCards: number[];
  autoPlay: boolean;
  darkMode: boolean;
}

export class ProgressService {
  private static instance: ProgressService;
  private storageKey = 'thai-learning-progress';

  static getInstance(): ProgressService {
    if (!ProgressService.instance) {
      ProgressService.instance = new ProgressService();
    }
    return ProgressService.instance;
  }

  saveProgress(level: number, currentIndex: number, completedCards: number[] = [], autoPlay: boolean = false, darkMode: boolean = false): void {
    const progress: LearningProgress = {
      level,
      currentIndex,
      lastStudied: Date.now(),
      completedCards,
      autoPlay,
      darkMode
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save learning progress:', error);
    }
  }

  getProgress(): LearningProgress | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load learning progress:', error);
    }
    return null;
  }

  clearProgress(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear learning progress:', error);
    }
  }

  // Check if progress is from the same session (within 24 hours)
  isRecentProgress(progress: LearningProgress): boolean {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    return (now - progress.lastStudied) < dayInMs;
  }

  // Mark a card as completed
  markCardCompleted(level: number, cardIndex: number, allCompletedCards: number[] = []): void {
    const progress = this.getProgress();
    if (progress && progress.level === level) {
      const updatedCompleted = Array.from(new Set([...progress.completedCards, cardIndex]));
      this.saveProgress(level, progress.currentIndex, updatedCompleted, progress.autoPlay, progress.darkMode);
    } else {
      // New level, start fresh
      this.saveProgress(level, 0, [cardIndex]);
    }
  }

  // Get completion status for a level
  getLevelCompletion(level: number): { completed: number[], percentage: number } {
    const progress = this.getProgress();
    if (progress && progress.level === level) {
      return {
        completed: progress.completedCards,
        percentage: 0 // Will be calculated by the component based on total cards
      };
    }
    return { completed: [], percentage: 0 };
  }
}

export const progressService = ProgressService.getInstance();