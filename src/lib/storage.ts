/** Namespaced JSON localStorage helpers. All failures (private mode, quota, bad JSON) are swallowed. */
const PREFIX = 'wissel.';

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storage()?.getItem(PREFIX + key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore: storage unavailable or full.
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // Ignore.
  }
}
