import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as os from "os";

function mockFetchSuccess(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    status: 202,
    json: vi.fn().mockResolvedValue({ status: "accepted", count: 1 }),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("NodeMihari", () => {
  let processOnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
    mockFetchSuccess();
    processOnSpy = vi.spyOn(process, "on").mockImplementation(() => process);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function createNodeMihari(overrides = {}) {
    // Dynamic import to ensure fresh module with mocks
    const { NodeMihari } = await import("../src/index");
    return new NodeMihari({
      token: "test-token",
      endpoint: "https://api.test.com",
      batchSize: 100,
      flushInterval: 0,
      ...overrides,
    });
  }

  describe("default metadata", () => {
    it("should include hostname in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].hostname).toBe(os.hostname());
    });

    it("should include pid in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].pid).toBe(process.pid);
    });

    it("should include platform in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].platform).toBe(process.platform);
    });

    it("should include nodeVersion in log entries", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].nodeVersion).toBe(process.version);
    });

    it("should merge system metadata with per-call metadata", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("test", { requestId: "abc" });

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].hostname).toBe(os.hostname());
      expect(body[0].requestId).toBe("abc");
    });
  });

  describe("compression", () => {
    it("should enable compression by default", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({ batchSize: 1 });

      client.info("compressed");

      await vi.advanceTimersByTimeAsync(0);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBe("gzip");
    });

    it("should disable compression when config.compression is false", async () => {
      const fetchMock = mockFetchSuccess();
      const client = await createNodeMihari({
        batchSize: 1,
        compression: false,
      });

      client.info("uncompressed");

      await vi.advanceTimersByTimeAsync(0);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBeUndefined();
    });
  });

  describe("exit handlers", () => {
    it("should register beforeExit handler", async () => {
      await createNodeMihari();

      const beforeExitCalls = processOnSpy.mock.calls.filter(
        (call) => call[0] === "beforeExit"
      );
      expect(beforeExitCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should register SIGINT handler", async () => {
      await createNodeMihari();

      const sigintCalls = processOnSpy.mock.calls.filter(
        (call) => call[0] === "SIGINT"
      );
      expect(sigintCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("should register SIGTERM handler", async () => {
      await createNodeMihari();

      const sigtermCalls = processOnSpy.mock.calls.filter(
        (call) => call[0] === "SIGTERM"
      );
      expect(sigtermCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("log methods inherited from MihariClient", () => {
    it("should support all log levels", async () => {
      const client = await createNodeMihari();

      expect(typeof client.debug).toBe("function");
      expect(typeof client.info).toBe("function");
      expect(typeof client.warn).toBe("function");
      expect(typeof client.error).toBe("function");
      expect(typeof client.fatal).toBe("function");
    });

    it("should support flush", async () => {
      const client = await createNodeMihari();
      expect(typeof client.flush).toBe("function");

      // Should not throw
      await client.flush();
    });

    it("should support shutdown", async () => {
      const client = await createNodeMihari();
      expect(typeof client.shutdown).toBe("function");

      await client.shutdown();
    });
  });
});
