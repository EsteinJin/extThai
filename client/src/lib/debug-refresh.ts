// 页面刷新调试工具
let refreshCount = 0;

// 监听页面刷新事件
const originalReload = window.location.reload;
window.location.reload = function() {
  refreshCount++;
  console.log(`🚨 页面刷新 #${refreshCount} - 调用栈:`, new Error().stack);
  return originalReload.call(this);
};

// 监听React Query状态变化
const originalConsoleLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('invalidateQueries') || 
      message.includes('refetch') || 
      message.includes('hot updated')) {
    console.error(`🚨 可能导致刷新的操作: ${message}`, new Error().stack);
  }
  return originalConsoleLog.apply(this, args);
};

export { refreshCount };