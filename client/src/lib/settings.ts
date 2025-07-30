export interface LearningSettings {
  autoPlaySpeed: number; // 0.5-2.0
  cardFlipDelay: number; // ms
  audioVolume: number; // 0-1
  keyboardEnabled: boolean;
  gesturesEnabled: boolean;
  showPronunciation: boolean;
  showTranslation: boolean;
  exampleAudio: boolean;
  darkMode: boolean;
  animationsEnabled: boolean;
}

export class SettingsService {
  private static instance: SettingsService;
  private storageKey = 'thai-learning-settings';

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  getDefaultSettings(): LearningSettings {
    return {
      autoPlaySpeed: 0.8,
      cardFlipDelay: 300,
      audioVolume: 1.0,
      keyboardEnabled: true,
      gesturesEnabled: true,
      showPronunciation: true,
      showTranslation: true,
      exampleAudio: true,
      darkMode: false,
      animationsEnabled: true,
    };
  }

  saveSettings(settings: LearningSettings): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettings(): LearningSettings {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return { ...this.getDefaultSettings(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return this.getDefaultSettings();
  }

  updateSetting<K extends keyof LearningSettings>(key: K, value: LearningSettings[K]): void {
    const settings = this.getSettings();
    settings[key] = value;
    this.saveSettings(settings);
  }
}

export const settingsService = SettingsService.getInstance();