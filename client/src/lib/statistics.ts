export interface LearningStatistics {
  totalCards: number;
  studiedCards: number;
  completedCards: number;
  studyTime: number; // in minutes
  streak: number; // consecutive days
  lastStudied: number; // timestamp
  level: number;
  accuracy: number; // percentage
}

export interface SessionStatistics {
  cardsReviewed: number;
  timeSpent: number; // in seconds
  correctAnswers: number;
  sessionStart: number; // timestamp
}

export class StatisticsService {
  private static instance: StatisticsService;
  private storageKey = 'thai-learning-stats';
  private sessionKey = 'thai-session-stats';

  static getInstance(): StatisticsService {
    if (!StatisticsService.instance) {
      StatisticsService.instance = new StatisticsService();
    }
    return StatisticsService.instance;
  }

  getDefaultStats(): LearningStatistics {
    return {
      totalCards: 0,
      studiedCards: 0,
      completedCards: 0,
      studyTime: 0,
      streak: 0,
      lastStudied: 0,
      level: 1,
      accuracy: 0,
    };
  }

  getStats(): LearningStatistics {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...this.getDefaultStats(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
    return this.getDefaultStats();
  }

  updateStats(updates: Partial<LearningStatistics>): void {
    try {
      const stats = this.getStats();
      const updatedStats = { ...stats, ...updates };
      localStorage.setItem(this.storageKey, JSON.stringify(updatedStats));
    } catch (error) {
      console.error('Failed to save statistics:', error);
    }
  }

  recordCardCompleted(level: number): void {
    const stats = this.getStats();
    this.updateStats({
      completedCards: stats.completedCards + 1,
      studiedCards: Math.max(stats.studiedCards, stats.completedCards + 1),
      lastStudied: Date.now(),
      level,
    });
  }

  recordStudySession(cardsReviewed: number, timeSpent: number): void {
    const stats = this.getStats();
    this.updateStats({
      studiedCards: stats.studiedCards + cardsReviewed,
      studyTime: stats.studyTime + Math.round(timeSpent / 60), // convert to minutes
      lastStudied: Date.now(),
    });
  }

  calculateStreak(): number {
    const stats = this.getStats();
    if (!stats.lastStudied) return 0;

    const now = new Date();
    const lastStudied = new Date(stats.lastStudied);
    const daysDiff = Math.floor((now.getTime() - lastStudied.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) {
      return stats.streak || 1; // Today counts as streak
    } else if (daysDiff === 1) {
      return (stats.streak || 0) + 1; // Yesterday, increment streak
    } else {
      return 0; // Streak broken
    }
  }

  // Session tracking
  startSession(): void {
    const sessionStats: SessionStatistics = {
      cardsReviewed: 0,
      timeSpent: 0,
      correctAnswers: 0,
      sessionStart: Date.now(),
    };
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify(sessionStats));
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }

  updateSession(updates: Partial<SessionStatistics>): void {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (stored) {
        const sessionStats = JSON.parse(stored);
        const updatedSession = { ...sessionStats, ...updates };
        localStorage.setItem(this.sessionKey, JSON.stringify(updatedSession));
      }
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }

  endSession(): SessionStatistics | null {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (stored) {
        const sessionStats: SessionStatistics = JSON.parse(stored);
        sessionStats.timeSpent = Math.round((Date.now() - sessionStats.sessionStart) / 1000);
        
        // Record in overall stats
        this.recordStudySession(sessionStats.cardsReviewed, sessionStats.timeSpent);
        
        // Clear session
        localStorage.removeItem(this.sessionKey);
        
        return sessionStats;
      }
    } catch (error) {
      console.error('Failed to end session:', error);
    }
    return null;
  }
}

export const statisticsService = StatisticsService.getInstance();