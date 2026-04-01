import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function mockFetchSuccess(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    status: 202,
    json: vi.fn().mockResolvedValue({ status: "accepted", count: 1 }),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const baseConfig = {
  token: "test-token",
  endpoint: "https://api.test.com",
  batchSize: 100,
  flushInterval: 0,
  compression: false,
};

describe("createMihari", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchSuccess();
    vi.resetModules();
    vi.spyOn(process, "on").mockImplementation(() => process);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should return NodeMihari in Node.js environment", async () => {
    // In Node.js, window is not defined (the default)
    delete (globalThis as Record<string, unknown>).window;

    const { createMihari } = await import("../src/index");
    const { NodeMihari } = await import("@mihari/logger-node");

    const client = createMihari(baseConfig);
    expect(client).toBeInstanceOf(NodeMihari);
  });

  it("should return BrowserMihari in browser environment", async () => {
    // Simulate browser environment using vi.stubGlobal
    vi.stubGlobal("window", {
      document: {},
      location: { href: "https://test.com" },
      addEventListener: vi.fn(),
    });
    vi.stubGlobal("navigator", {
      userAgent: "TestBrowser",
      sendBeacon: vi.fn(),
    });
    vi.stubGlobal("document", {
      referrer: "",
      visibilityState: "visible",
    });
    vi.stubGlobal("Blob", class {
      constructor(public parts: unknown[], public options?: unknown) {}
    });

    const { createMihari } = await import("../src/index");
    const { BrowserMihari } = await import("@mihari/logger-browser");

    const client = createMihari(baseConfig);
    expect(client).toBeInstanceOf(BrowserMihari);
  });

  it("should return a client with all log methods", async () => {
    const { createMihari } = await import("../src/index");
    const client = createMihari(baseConfig);

    expect(typeof client.debug).toBe("function");
    expect(typeof client.info).toBe("function");
    expect(typeof client.warn).toBe("function");
    expect(typeof client.error).toBe("function");
    expect(typeof client.fatal).toBe("function");
    expect(typeof client.flush).toBe("function");
    expect(typeof client.shutdown).toBe("function");
  });

  it("should create a functional client that can log and flush", async () => {
    const fetchMock = mockFetchSuccess();
    const { createMihari } = await import("../src/index");
    const client = createMihari(baseConfig);

    client.info("test message");
    await client.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // compression is false, so body is plain JSON
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body[0].message).toBe("test message");
    expect(body[0].level).toBe("info");
  });
});

describe("re-exports", () => {
  it("should export MihariClient from @mihari/core", async () => {
    const { MihariClient } = await import("../src/index");
    expect(MihariClient).toBeDefined();
    expect(typeof MihariClient).toBe("function");
  });

  it("should export NodeMihari from @mihari/node", async () => {
    const { NodeMihari } = await import("../src/index");
    expect(NodeMihari).toBeDefined();
    expect(typeof NodeMihari).toBe("function");
  });

  it("should export BrowserMihari from @mihari/browser", async () => {
    const { BrowserMihari } = await import("../src/index");
    expect(BrowserMihari).toBeDefined();
    expect(typeof BrowserMihari).toBe("function");
  });

  it("should export LogLevel enum", async () => {
    const { LogLevel } = await import("../src/index");
    expect(LogLevel).toBeDefined();
    expect(LogLevel.Info).toBe("info");
  });
});
