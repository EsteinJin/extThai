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
  private currentAudio: HTMLAudioElement | null = null;
  private speechSynthesis: SpeechSynthesis | null = null;

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
    // Stop any currently playing audio first
    this.stopAllAudio();

    try {
      // Try Speech Synthesis first for faster response
      await this.playWithSpeechSynthesis(text, language);
    } catch (error) {
      console.error("Speech synthesis failed, trying external audio:", error);
      
      try {
        const audioUrl = await this.generateAudio(text, language);
        
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          this.currentAudio = audio;
          
          // Clear reference when audio ends
          audio.addEventListener('ended', () => {
            this.currentAudio = null;
          });
          
          await audio.play();
        }
      } catch (audioError) {
        console.error("All audio playback methods failed:", audioError);
        // Silently fail rather than throwing error
      }
    }
  }

  private async playWithSpeechSynthesis(text: string, language: string = "th-TH"): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.speechSynthesis) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      // Stop any current speech
      this.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 0.9; // Slightly faster for better responsiveness
      utterance.volume = 1.0;

      let resolved = false;
      
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      utterance.onend = resolveOnce;
      utterance.onerror = (event) => {
        console.warn(`Speech synthesis error: ${event.error}`);
        resolveOnce(); // Don't reject, just resolve to continue
      };

      // Immediate playback without delay for better responsiveness
      try {
        this.speechSynthesis.speak(utterance);
        
        // Timeout fallback for Safari issues
        setTimeout(() => {
          if (!resolved) {
            console.warn("Speech synthesis timeout, resolving anyway");
            resolveOnce();
          }
        }, 3000); // 3 second timeout
      } catch (error) {
        reject(error);
      }
    });
  }
}

export const audioService = AudioService.getInstance();
