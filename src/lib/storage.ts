/**
 * Tiny typed wrapper around localStorage.
 *
 * Everything the site remembers about a reader lives here: reading settings,
 * which wonders they took on, how they voted. Nothing is sent anywhere.
 */
const PREFIX = "little-thinker:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private browsing, quota, etc. — settings just do not persist */
  }
}
