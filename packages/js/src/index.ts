import { MihariClient } from "@mihari/logger-core";
import { MihariConfig } from "@mihari/logger-types";
import { NodeMihari } from "@mihari/logger-node";
import { BrowserMihari } from "@mihari/logger-browser";

/**
 * Detects whether the current runtime is a browser environment.
 */
function isBrowserEnv(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.document !== "undefined"
  );
}

/**
 * Creates a mihari client appropriate for the current environment.
 * Returns a NodeMihari instance in Node.js and a BrowserMihari
 * instance in the browser.
 */
export function createMihari(config: MihariConfig): MihariClient {
  if (isBrowserEnv()) {
    return new BrowserMihari(config);
  }
  return new NodeMihari(config);
}

export { MihariClient } from "@mihari/logger-core";
export { NodeMihari } from "@mihari/logger-node";
export { BrowserMihari } from "@mihari/logger-browser";
export { MihariConfig, LogLevel, LogEntry } from "@mihari/logger-types";
