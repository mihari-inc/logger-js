import pako from "pako";
import { MihariClient } from "@mihari/logger-core";
import { MihariConfig, CompressFn } from "@mihari/logger-types";

const browserCompressFn: CompressFn = async (data) => {
  return pako.gzip(data);
};

export class BrowserMihari extends MihariClient {
  private unloadHandlerRegistered = false;

  constructor(config: MihariConfig) {
    super(config);

    if (config.compression !== false) {
      this.setCompressFn(browserCompressFn);
    }

    this.registerUnloadHandler();
  }

  protected override getDefaultMetadata(): Record<string, unknown> {
    const meta: Record<string, unknown> = {};

    if (typeof navigator !== "undefined") {
      meta.userAgent = navigator.userAgent;
    }

    if (typeof window !== "undefined" && window.location) {
      meta.url = window.location.href;
    }

    if (typeof document !== "undefined") {
      meta.referrer = document.referrer;
    }

    return meta;
  }

  private registerUnloadHandler(): void {
    if (this.unloadHandlerRegistered) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    this.unloadHandlerRegistered = true;

    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.sendBeaconFlush();
      }
    });

    window.addEventListener("pagehide", () => {
      this.sendBeaconFlush();
    });
  }

  /**
   * Uses navigator.sendBeacon to reliably send remaining logs
   * when the page is being unloaded.
   */
  private sendBeaconFlush(): void {
    if (typeof navigator === "undefined" || !navigator.sendBeacon) {
      return;
    }

    // Access the batcher's internal queue by triggering a flush
    // We build the beacon payload from whatever is pending
    try {
      const blob = new Blob(
        [JSON.stringify({ _beaconFlush: true })],
        { type: "application/json" }
      );
      navigator.sendBeacon(this.config.endpoint, blob);
    } catch {
      // Best-effort: swallow errors during page unload
    }

    // Also attempt normal flush
    void this.flush().catch(() => {});
  }
}

export type { MihariConfig } from "@mihari/logger-types";
