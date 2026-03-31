import { MihariClient } from "@mihari/core";
import { MihariConfig } from "@mihari/types";
import { NodeMihari } from "@mihari/node";
import { BrowserMihari } from "@mihari/browser";

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

export { MihariClient } from "@mihari/core";
export { NodeMihari } from "@mihari/node";
export { BrowserMihari } from "@mihari/browser";
export { MihariConfig, LogLevel, LogEntry } from "@mihari/types";
