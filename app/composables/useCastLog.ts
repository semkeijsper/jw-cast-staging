/**
 * Opt-in cast trace.
 *
 * None of the Chromecast paths can be exercised without real hardware, and the
 * failures show up on phones where there is no console to read — so every line
 * is mirrored into `castLogLines` for `cast/CastDebugPanel.vue` to render and
 * copy. Enable with `?castdebug` in the URL or `localStorage.castDebug`.
 *
 * The buffer lives in sessionStorage so it survives a reload: reloading mid-cast
 * is itself one of the things under test, and both halves have to end up in one
 * copyable block.
 */

const STORAGE_KEY = 'castDebugLog';
const MAX_LINES = 300;

export const castLogLines = ref<string[]>([]);

let enabled: boolean | null = null;

export function castDebugEnabled() {
  if (enabled !== null) {
    return enabled;
  }
  try {
    enabled = window.location.search.includes('castdebug')
      || window.localStorage.getItem('castDebug') !== null;
  }
  catch {
    enabled = false;
  }
  if (enabled) {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      castLogLines.value = stored ? JSON.parse(stored) : [];
    }
    catch {
      castLogLines.value = [];
    }
    castLogLines.value.push('——————— page load ———————');
  }
  return enabled;
}

function formatArg(arg: unknown) {
  if (typeof arg === 'string') {
    return arg;
  }
  try {
    return JSON.stringify(arg);
  }
  catch {
    return String(arg);
  }
}

export function castLog(...args: unknown[]) {
  if (!castDebugEnabled()) {
    return;
  }
  console.info('[cast]', ...args);
  const time = new Date().toISOString().slice(11, 23);
  castLogLines.value.push(`${time} ${args.map(arg => formatArg(arg)).join(' ')}`);
  if (castLogLines.value.length > MAX_LINES) {
    castLogLines.value.splice(0, castLogLines.value.length - MAX_LINES);
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(castLogLines.value));
  }
  catch {
    // Storage full or unavailable — the in-memory lines still render
  }
}

// Failures always reach the console; the trace only mirrors them when enabled
export function reportCastError(message: string, error: unknown) {
  console.error(`[cast] ${message}`, error);
  castLog('ERROR', message, errorCodeOf(error));
}

export function clearCastLog() {
  castLogLines.value = [];
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  catch {
    // Nothing to do — the in-memory lines are already cleared
  }
}
