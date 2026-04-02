/**
 * Returns the current timestamp in ISO 8601 format.
 */
export function isoTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Detects whether the current runtime is a browser environment.
 */
export function isBrowser(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).window !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).document !== "undefined"
  );
}

/**
 * Detects whether the current runtime is Node.js.
 */
export function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null
  );
}

/**
 * Waits for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
