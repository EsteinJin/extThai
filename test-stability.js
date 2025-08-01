// 测试页面稳定性
console.log("开始测试页面稳定性...");

// 监听所有可能导致页面刷新的事件
let refreshEvents = [];

// 1. 监听原生页面刷新
const originalReload = window.location.reload;
window.location.reload = function() {
  console.error("🚨 检测到页面刷新调用！", new Error().stack);
  refreshEvents.push({ type: "location.reload", time: Date.now(), stack: new Error().stack });
  return originalReload.call(this);
};

// 2. 监听历史记录变化
window.addEventListener('popstate', () => {
  console.error("🚨 检测到历史记录变化！");
  refreshEvents.push({ type: "popstate", time: Date.now() });
});

// 3. 监听页面焦点变化
window.addEventListener('focus', () => {
  console.log("🔍 页面获得焦点");
});

window.addEventListener('blur', () => {
  console.log("🔍 页面失去焦点");
});

// 4. 监听网络请求
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && url.includes('/api/')) {
    console.log(`🌐 API请求: ${url}`);
  }
  return originalFetch.apply(this, args);
};

// 输出刷新事件统计
setInterval(() => {
  if (refreshEvents.length > 0) {
    console.error(`📊 刷新事件统计: ${refreshEvents.length} 次`, refreshEvents);
  }
}, 5000);

console.log("页面稳定性监控已启动");