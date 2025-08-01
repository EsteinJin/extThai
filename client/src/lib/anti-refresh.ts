// 防页面刷新强制锁定机制
class AntiRefreshManager {
  private static instance: AntiRefreshManager;
  private locked = false;
  private originalConsoleLog: typeof console.log;

  static getInstance(): AntiRefreshManager {
    if (!AntiRefreshManager.instance) {
      AntiRefreshManager.instance = new AntiRefreshManager();
    }
    return AntiRefreshManager.instance;
  }

  constructor() {
    this.originalConsoleLog = console.log;
    this.setupProtection();
  }

  private setupProtection() {
    // 拦截可能导致刷新的console.log调用
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      // 如果是音频相关的日志，静默处理
      if (message.includes('Stopping all audio') || 
          message.includes('🛑') || 
          message.includes('vite') ||
          message.includes('hot updated')) {
        return; // 完全忽略这些日志
      }
      this.originalConsoleLog(...args);
    };

    // 阻止页面刷新
    window.addEventListener('beforeunload', (e) => {
      if (this.locked) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });
  }

  lock(): void {
    this.locked = true;
  }

  unlock(): void {
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }
}

export const antiRefreshManager = AntiRefreshManager.getInstance();