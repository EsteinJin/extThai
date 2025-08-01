// 稳定缓存管理器 - 防止意外页面刷新
export class StableCacheManager {
  private static instance: StableCacheManager;
  private refreshBlockers: Set<string> = new Set();

  static getInstance(): StableCacheManager {
    if (!StableCacheManager.instance) {
      StableCacheManager.instance = new StableCacheManager();
    }
    return StableCacheManager.instance;
  }

  // 添加刷新阻塞器
  addRefreshBlocker(key: string): void {
    this.refreshBlockers.add(key);
    console.log(`🔒 Added refresh blocker: ${key}`);
  }

  // 移除刷新阻塞器
  removeRefreshBlocker(key: string): void {
    this.refreshBlockers.delete(key);
    console.log(`🔓 Removed refresh blocker: ${key}`);
  }

  // 检查是否被阻塞
  isRefreshBlocked(): boolean {
    return this.refreshBlockers.size > 0;
  }

  // 获取当前阻塞器
  getActiveBlockers(): string[] {
    return Array.from(this.refreshBlockers);
  }

  // 强制清理所有阻塞器
  clearAllBlockers(): void {
    this.refreshBlockers.clear();
    console.log(`🧹 Cleared all refresh blockers`);
  }
}

// 全局实例
export const stableCacheManager = StableCacheManager.getInstance();