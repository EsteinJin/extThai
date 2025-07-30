import { apiRequest } from "./queryClient";

export interface AudioGenerationRequest {
  text: string;
  language?: string;
}

export interface AudioGenerationResponse {
  success: boolean;
  id?: string;
  location?: string;
  error?: string;
}

export interface AudioStatusResponse {
  status: string;
  location?: string;
}

export class AudioService {
  private static instance: AudioService;
  private audioCache = new Map<string, string>();
  private htmlAudioCache = new Map<string, HTMLAudioElement>();
  private currentAudio: HTMLAudioElement | null = null;
  private speechSynthesis: SpeechSynthesis | null = null;
  private playbackHistory: Array<{text: string, timestamp: number, success: boolean}> = [];

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  constructor() {
    this.speechSynthesis = window.speechSynthesis || null;
  }

  // Stop all current audio playback
  stopAllAudio(): void {
    // Stop HTML5 Audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    // Stop Speech Synthesis
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
    }
  }

  async generateAudio(text: string, language: string = "th-TH"): Promise<string | null> {
    const cacheKey = `${text}_${language}`;
    
    // Check cache first
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    try {
      // Generate audio
      const generateResponse = await apiRequest("/api/audio/generate", "POST", {
        text,
        language
      });
      
      const generateResult: AudioGenerationResponse = await generateResponse;
      
      if (!generateResult.success || !generateResult.id) {
        throw new Error("Failed to generate audio");
      }

      // Poll for audio completion and return proxy URL
      const audioId = await this.pollForAudioId(generateResult.id);
      
      if (audioId) {
        // Use our proxy endpoint instead of direct soundoftext URL
        const proxyUrl = `/api/audio/download/${audioId}`;
        this.audioCache.set(cacheKey, proxyUrl);
        return proxyUrl;
      }
      
      return null;
    } catch (error) {
      console.error("Audio generation failed:", error);
      return null;
    }
  }

  private async pollForAudioId(id: string, maxAttempts: number = 10): Promise<string | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const statusResult: AudioStatusResponse = await apiRequest(`/api/audio/${id}`, "GET");
        
        if (statusResult.status === "Done") {
          return id; // Return the ID to use with our proxy endpoint
        }
        
        if (statusResult.status === "Error") {
          throw new Error("Audio generation failed");
        }
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Audio polling attempt ${attempt + 1} failed:`, error);
      }
    }
    
    return null;
  }

  async playAudio(text: string, language: string = "th-TH"): Promise<void> {
    const startTime = performance.now();
    
    // Stop any currently playing audio first
    this.stopAllAudio();

    try {
      // Try Speech Synthesis first for faster response
      await this.playWithSpeechSynthesis(text, language);
      
      // Record successful playback
      this.recordPlayback(text, startTime, true);
    } catch (error) {
      console.error("Speech synthesis failed, trying external audio:", error);
      
      try {
        const audioUrl = await this.generateAudio(text, language);
        
        if (audioUrl) {
          // Check cache for HTML Audio object
          let audio = this.htmlAudioCache.get(audioUrl);
          if (!audio) {
            audio = new Audio(audioUrl);
            this.htmlAudioCache.set(audioUrl, audio);
            
            // Preload for better performance
            audio.preload = 'metadata';
          }
          
          this.currentAudio = audio;
          
          // Clear reference when audio ends
          audio.addEventListener('ended', () => {
            this.currentAudio = null;
          });
          
          await audio.play();
          this.recordPlayback(text, startTime, true);
        }
      } catch (audioError) {
        console.error("All audio playback methods failed:", audioError);
        this.recordPlayback(text, startTime, false);
        // Silently fail rather than throwing error
      }
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

  private async playWithSpeechSynthesis(text: string, language: string = "th-TH"): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      // Stop any current speech
      this.speechSynthesis.cancel();

      // Wait longer for mobile devices to properly clear previous speech
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language;
        utterance.rate = 0.8; // Slower for mobile clarity
        utterance.volume = 1.0;
        utterance.pitch = 1.0;

        let resolved = false;
        
        const resolveOnce = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        // Enhanced mobile compatibility
        utterance.onstart = () => {
          console.log(`🎵 Mobile TTS started: ${text}`);
        };

        utterance.onend = () => {
          console.log(`✅ Mobile TTS completed: ${text}`);
          resolveOnce();
        };

        utterance.onerror = (event) => {
          console.warn(`Mobile TTS error: ${event.error}`);
          resolveOnce(); // Don't reject, just resolve to continue
        };

        // Get voices with mobile compatibility check
        let voices = this.speechSynthesis!.getVoices();
        
        const playWithVoice = () => {
          // Find the best Thai voice for mobile
          const thaiVoice = voices.find(voice => 
            voice.lang.toLowerCase().includes('th') || 
            voice.name.toLowerCase().includes('thai')
          );
          
          if (thaiVoice) {
            utterance.voice = thaiVoice;
            console.log(`📱 Using Thai voice for mobile: ${thaiVoice.name}`);
          } else {
            // Fallback to any available voice on mobile
            console.log("📱 No Thai voice found on mobile, using default");
          }

          // Mobile-specific: Force interaction before playing
          if (window.navigator.userAgent.includes('Mobile')) {
            console.log("📱 Mobile device detected, ensuring TTS compatibility");
          }

          try {
            this.speechSynthesis!.speak(utterance);
          } catch (error) {
            console.error("📱 Mobile TTS speak error:", error);
            resolveOnce();
          }
        };

        // Handle voices loading asynchronously (critical for mobile)
        if (voices.length === 0) {
          this.speechSynthesis!.onvoiceschanged = () => {
            voices = this.speechSynthesis!.getVoices();
            if (voices.length > 0) {
              playWithVoice();
            }
          };
          
          // Fallback timeout if voices never load
          setTimeout(() => {
            if (voices.length === 0) {
              console.warn("📱 Mobile voices never loaded, playing without voice selection");
              this.speechSynthesis!.speak(utterance);
            }
          }, 1000);
        } else {
          playWithVoice();
        }
        
        // Extended timeout for mobile devices
        setTimeout(() => {
          if (!resolved) {
            console.warn("📱 Mobile TTS timeout, resolving anyway");
            resolveOnce();
          }
        }, 8000); // 8 second timeout for mobile
      }, 300); // 300ms delay for mobile
    });
  }
}

export const audioService = AudioService.getInstance();
