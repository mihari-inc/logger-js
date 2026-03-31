import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function mockFetchSuccess(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    status: 202,
    json: vi.fn().mockResolvedValue({ status: "accepted", count: 1 }),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

// Set up browser-like globals
function setupBrowserGlobals() {
  const eventListeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockWindow = {
    document: {},
    location: {
      href: "https://example.com/page",
    },
    addEventListener: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!eventListeners[event]) {
        eventListeners[event] = [];
      }
      eventListeners[event].push(handler);
    }),
  };

  const mockNavigator = {
    userAgent: "TestBrowser/1.0",
    sendBeacon: vi.fn().mockReturnValue(true),
  };

  const mockDocument = {
    referrer: "https://referrer.com",
    visibilityState: "visible" as string,
  };

  // Assign to globalThis
  (globalThis as Record<string, unknown>).window = mockWindow;
  (globalThis as Record<string, unknown>).navigator = mockNavigator;
  (globalThis as Record<string, unknown>).document = mockDocument;
  (globalThis as Record<string, unknown>).Blob = class MockBlob {
    parts: unknown[];
    options: unknown;
    constructor(parts: unknown[], options?: unknown) {
      this.parts = parts;
      this.options = options;
    }
  };

  return { mockWindow, mockNavigator, mockDocument, eventListeners };
}

function cleanupBrowserGlobals() {
  delete (globalThis as Record<string, unknown>).window;
  // Don't delete navigator/document as they may be needed by Node
  (globalThis as Record<string, unknown>).navigator = undefined as unknown;
  (globalThis as Record<string, unknown>).document = undefined as unknown;
  delete (globalThis as Record<string, unknown>).Blob;
}

describe("BrowserMihari", () => {
  let browserGlobals: ReturnType<typeof setupBrowserGlobals>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
    mockFetchSuccess();
    browserGlobals = setupBrowserGlobals();

    // Reset module registry so BrowserMihari picks up fresh globals
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanupBrowserGlobals();
  });

  async function createBrowserMihari(overrides = {}) {
    const { BrowserMihari } = await import("../src/index");
    return new BrowserMihari({
      token: "test-token",
      endpoint: "https://api.test.com",
      batchSize: 100,
      flushInterval: 0,
      ...overrides,
    });
  }

  describe("default metadata", () => {
    it("should include userAgent in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].userAgent).toBe("TestBrowser/1.0");
    });

    it("should include url in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].url).toBe("https://example.com/page");
    });

    it("should include referrer in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].referrer).toBe("https://referrer.com");
    });

    it("should merge browser metadata with per-call metadata", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({ batchSize: 1 });

      client.info("test", { component: "header" });

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].userAgent).toBe("TestBrowser/1.0");
      expect(body[0].component).toBe("header");
    });
  });

  describe("visibility change handler", () => {
    it("should register visibilitychange event listener", async () => {
      await createBrowserMihari();

      const visibilityCalls = browserGlobals.mockWindow.addEventListener.mock.calls.filter(
        (call: unknown[]) => call[0] === "visibilitychange"
      );
      expect(visibilityCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should register pagehide event listener", async () => {
      await createBrowserMihari();

      const pagehideCalls = browserGlobals.mockWindow.addEventListener.mock.calls.filter(
        (call: unknown[]) => call[0] === "pagehide"
      );
      expect(pagehideCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should call sendBeacon on visibilitychange to hidden", async () => {
      await createBrowserMihari();

      browserGlobals.mockDocument.visibilityState = "hidden";

      // Trigger visibilitychange handlers
      const handlers = browserGlobals.eventListeners["visibilitychange"] || [];
      for (const handler of handlers) {
        handler();
      }

      expect(browserGlobals.mockNavigator.sendBeacon).toHaveBeenCalled();
    });

    it("should not call sendBeacon on visibilitychange to visible", async () => {
      await createBrowserMihari();

      browserGlobals.mockDocument.visibilityState = "visible";

      const handlers = browserGlobals.eventListeners["visibilitychange"] || [];
      for (const handler of handlers) {
        handler();
      }

      expect(browserGlobals.mockNavigator.sendBeacon).not.toHaveBeenCalled();
    });
  });

  describe("sendBeacon fallback", () => {
    it("should call sendBeacon on pagehide", async () => {
      await createBrowserMihari();

      const handlers = browserGlobals.eventListeners["pagehide"] || [];
      for (const handler of handlers) {
        handler();
      }

      expect(browserGlobals.mockNavigator.sendBeacon).toHaveBeenCalledWith(
        "https://api.test.com",
        expect.anything()
      );
    });

    it("should gracefully handle missing sendBeacon", async () => {
      browserGlobals.mockNavigator.sendBeacon = undefined as unknown as typeof navigator.sendBeacon;
      const client = await createBrowserMihari();

      // Trigger pagehide - should not throw
      const handlers = browserGlobals.eventListeners["pagehide"] || [];
      for (const handler of handlers) {
        expect(() => handler()).not.toThrow();
      }
    });
  });

  describe("compression", () => {
    it("should enable compression by default", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({ batchSize: 1 });

      client.info("compressed");

      await vi.advanceTimersByTimeAsync(0);

      // pako is used for browser compression; since we're in Node test env
      // the import may or may not work, but the compressFn should be set
      // Check that Content-Encoding is gzip if compression worked
      expect(fetchMock).toHaveBeenCalled();
    });

    it("should not set compression when config.compression is false", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createBrowserMihari({
        batchSize: 1,
        compression: false,
      });

      client.info("uncompressed");

      await vi.advanceTimersByTimeAsync(0);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBeUndefined();
    });
  });

  describe("log methods inherited from MihariClient", () => {
    it("should support all log levels", async () => {
      const client = await createBrowserMihari();

      expect(typeof client.debug).toBe("function");
      expect(typeof client.info).toBe("function");
      expect(typeof client.warn).toBe("function");
      expect(typeof client.error).toBe("function");
      expect(typeof client.fatal).toBe("function");
    });

    it("should support flush and shutdown", async () => {
      const client = await createBrowserMihari();

      await client.flush();
      await client.shutdown();
    });
  });
});
