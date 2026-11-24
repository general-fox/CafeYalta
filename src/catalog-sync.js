export const CATALOG_SYNC_INTERVAL_MS = 15_000;

// A single settled request starts the next interval. Waking a busy tab queues at
// most one follow-up read; it never starts a second request alongside the first.
export function startCatalogSync({
  refresh,
  document = globalThis.document,
  window = globalThis.window,
  intervalMs = CATALOG_SYNC_INTERVAL_MS,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  if (typeof refresh !== 'function') throw new TypeError('refresh must be a function.');
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new TypeError('intervalMs must be a positive number.');

  let active = true;
  let running = false;
  let wakeQueued = false;
  let timer = null;
  let offline = window?.navigator?.onLine === false;

  function visibleAndOnline() {
    const visible = typeof document?.visibilityState === 'string'
      ? document.visibilityState === 'visible'
      : document?.hidden !== true;
    return active && visible && !offline && window?.navigator?.onLine !== false;
  }

  function clearTimer() {
    if (timer !== null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function pause() {
    clearTimer();
    wakeQueued = false;
  }

  function settled() {
    running = false;
    if (!visibleAndOnline()) {
      wakeQueued = false;
      return;
    }
    if (wakeQueued) {
      wakeQueued = false;
      run();
      return;
    }
    timer = setTimeoutFn(() => {
      timer = null;
      run();
    }, intervalMs);
  }

  function run() {
    if (!active) return;
    clearTimer();
    if (!visibleAndOnline()) {
      wakeQueued = false;
      return;
    }
    if (running) {
      wakeQueued = true;
      return;
    }
    running = true;
    wakeQueued = false;
    let result;
    try { result = refresh(); }
    catch { /* The caller owns its error state; a failed read still retries later. */ }
    Promise.resolve(result).then(settled, settled);
  }

  function wake(event) {
    if (event?.type === 'online') offline = false;
    else if (typeof window?.navigator?.onLine === 'boolean') offline = !window.navigator.onLine;
    if (visibleAndOnline()) run();
    else pause();
  }

  function disconnected() {
    offline = true;
    pause();
  }

  document?.addEventListener?.('visibilitychange', wake);
  window?.addEventListener?.('focus', wake);
  window?.addEventListener?.('online', wake);
  window?.addEventListener?.('offline', disconnected);
  run();

  return function stopCatalogSync() {
    if (!active) return;
    active = false;
    pause();
    document?.removeEventListener?.('visibilitychange', wake);
    window?.removeEventListener?.('focus', wake);
    window?.removeEventListener?.('online', wake);
    window?.removeEventListener?.('offline', disconnected);
  };
}

function sameValue(left, right) {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

// Preserve the existing product/category references when only transport metadata
// changed. Array order is meaningful for display; JSON object key order is not.
export function sameCatalogContent(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  return ['categories', 'products', 'orderingEnabled', 'ordering', 'warnings']
    .every(key => sameValue(left[key], right[key]));
}
