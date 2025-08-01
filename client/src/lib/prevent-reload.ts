// Prevent unwanted page reloads during critical operations
let reloadBlocked = false;

// Prevent navigation away during critical operations  
export function preventNavigation() {
  const handler = (e: BeforeUnloadEvent) => {
    if (reloadBlocked) {
      e.preventDefault();
      e.returnValue = 'Audio generation in progress. Are you sure you want to leave?';
      return 'Audio generation in progress. Are you sure you want to leave?';
    }
  };
  
  window.addEventListener('beforeunload', handler);
  
  return () => {
    window.removeEventListener('beforeunload', handler);
  };
}

// Block reloads during critical operations
export function blockReloads() {
  reloadBlocked = true;
}

export function unblockReloads() {
  reloadBlocked = false;
}

// Force reload function
export function forceReload() {
  reloadBlocked = false;
  window.location.href = window.location.href;
}

// Initialize navigation prevention
const removeNavigationHandler = preventNavigation();