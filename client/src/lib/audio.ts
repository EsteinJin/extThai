import { apiRequest } from "@/lib/queryClient";

interface AudioStatusResponse {
  status: "Pending" | "Done" | "Error";
  location?: string;
}

interface PlaybackRecord {
  text: string;
  timestamp: number;
  success: boolean;
}

export class AudioService {
  private static instance: AudioService;
  private htmlAudioCache = new Map<string, HTMLAudioElement>();
  private currentAudio: HTMLAudioElement | null = null;
  private playbackHistory: PlaybackRecord[] = [];

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  stopAllAudio(): void {
    console.log("🛑 Stopping all audio");
    
    // Stop current audio immediately
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
        this.currentAudio = null;
      } catch (e) {
        // Ignore errors when stopping audio
      }
    }
    
    // Clear any cached audio elements that may be playing
    this.htmlAudioCache.forEach(audio => {
      try {
        if (!audio.paused) {
          audio.pause();
          audio.currentTime = 0;
          audio.src = '';
        }
      } catch (e) {
        // Ignore errors when stopping cached audio
      }
    });
    
    // Clear cache completely
    this.htmlAudioCache.clear();
  }

  async playAudio(text: string, language: string = "th-TH", cardId?: number): Promise<void> {
    const startTime = performance.now();
    
    // Stop any currently playing audio first
    this.stopAllAudio();

    try {
      // Only use backend pre-generated high-quality audio
      const backendAudioPlayed = await this.tryBackendAudio(text, cardId);
      if (backendAudioPlayed) {
        this.recordPlayback(text, startTime, true);
        return;
      }

      // No fallback - only backend audio supported
      console.log(`⚠️ No backend audio available for "${text}". Please generate audio files first.`);
      this.recordPlayback(text, startTime, false);
      
    } catch (error) {
      console.error("Backend audio playback failed:", error);
      this.recordPlayback(text, startTime, false);
    }
  }

  private cardCache = new Map<number, any>();
  private cacheTimestamp = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache

  private async getCardData(cardId: number): Promise<any> {
    const now = Date.now();
    
    // Check if cache is expired
    if (now - this.cacheTimestamp > this.CACHE_DURATION) {
      this.cardCache.clear();
      this.cacheTimestamp = now;
    }
    
    // Return cached card if available
    if (this.cardCache.has(cardId)) {
      return this.cardCache.get(cardId);
    }
    
    // Fetch all cards and cache them
    try {
      const response = await fetch(`/api/cards`);
      const cards = await response.json();
      
      // Cache all cards for faster subsequent lookups
      cards.forEach((card: any) => {
        this.cardCache.set(card.id, card);
      });
      
      return this.cardCache.get(cardId);
    } catch (error) {
      console.log("Failed to fetch card data:", error);
      return null;
    }
  }

  private async tryBackendAudio(text: string, cardId?: number): Promise<boolean> {
    try {
      // If we have a card ID, try to get the audio file path from cached card data
      if (cardId) {
        const card = await this.getCardData(cardId);
        
        if (card) {
          // Try word audio path first
          if (card.word_audio && text === card.thai) {
            const audioUrl = `/api/audio/generated/${card.word_audio.split('/').pop()}`;
            if (await this.playAudioFile(audioUrl, text)) return true;
          }
          
          // Try example audio path
          if (card.example_audio && text === card.example) {
            const audioUrl = `/api/audio/generated/${card.example_audio.split('/').pop()}`;
            if (await this.playAudioFile(audioUrl, text)) return true;
          }
        }
      }
      
      // Fallback: Try pattern-based filename search (for backward compatibility)
      const possibleFilenames = [
        `${text.replace(/[^a-zA-Zก-๙0-9]/g, '_')}.mp3`,
        `word_${text.replace(/[^a-zA-Zก-๙0-9]/g, '_')}.mp3`,
        `example_${text.replace(/[^a-zA-Zก-๙0-9]/g, '_')}.mp3`
      ];
      
      for (const filename of possibleFilenames) {
        const audioUrl = `/api/audio/generated/${filename}`;
        if (await this.playAudioFile(audioUrl, text)) return true;
      }
      
      return false;
    } catch (error) {
      console.log(`📱 Backend audio not available for "${text}":`, error);
      return false;
    }
  }

  private async playAudioFile(audioUrl: string, text: string): Promise<boolean> {
    try {
      console.log(`🎯 Playing audio: "${text}" (${audioUrl.split('/').pop()})`);
      
      // Stop current audio before playing new one
      this.stopAllAudio();
      
      // Create new audio instance 
      const audio = new Audio(audioUrl);
      audio.preload = 'metadata';
      
      this.currentAudio = audio;
      
      // Clean up after playback
      const cleanup = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };
      
      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });
      
      // Direct playback with promise
      return new Promise((resolve) => {
        audio.addEventListener('canplay', async () => {
          try {
            await audio.play();
            resolve(true);
          } catch (playError) {
            console.log(`⚠️ Play failed: ${audioUrl}`);
            cleanup();
            resolve(false);
          }
        }, { once: true });
        
        audio.addEventListener('error', () => {
          console.log(`⚠️ Audio load failed: ${audioUrl}`);
          cleanup();
          resolve(false);
        }, { once: true });
      });
    } catch (error) {
      console.log(`⚠️ Audio error: ${error}`);
      return false;
    }
  }

  private recordPlayback(text: string, startTime: number, success: boolean): void {
    const duration = performance.now() - startTime;
    this.playbackHistory.push({
      text,
      timestamp: Date.now(),
      success
    });
    
    // Keep only last 50 records
    if (this.playbackHistory.length > 50) {
      this.playbackHistory.shift();
    }
    
    console.log(`🎵 Audio playback ${success ? 'success' : 'failed'} for "${text}" in ${duration.toFixed(0)}ms`);
  }

  getPlaybackStats(): {successRate: number, averageResponseTime: number} {
    if (this.playbackHistory.length === 0) return {successRate: 100, averageResponseTime: 0};
    
    const successful = this.playbackHistory.filter(h => h.success).length;
    const successRate = (successful / this.playbackHistory.length) * 100;
    
    return {
      successRate: Math.round(successRate),
      averageResponseTime: 0 // Could calculate if we stored timing
    };
  }
}

// Export singleton instance
export const audioService = AudioService.getInstance();