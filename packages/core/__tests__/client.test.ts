import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MihariClient } from "../src/client";
import { LogLevel } from "@mihari/types";

function mockFetchSuccess(): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    status: 202,
    json: vi.fn().mockResolvedValue({ status: "accepted", count: 1 }),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function createClient(overrides = {}): MihariClient {
  return new MihariClient({
    token: "test-token",
    endpoint: "https://api.test.com",
    batchSize: 100, // High to prevent auto-flush during tests
    flushInterval: 0, // Disable timer
    ...overrides,
  });
}

describe("MihariClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T10:00:00.000Z"));
    mockFetchSuccess();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("log levels", () => {
    it("should log debug level messages", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.debug("debug message");

      await vi.advanceTimersByTimeAsync(0);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("debug");
      expect(body[0].message).toBe("debug message");
    });

    it("should log info level messages", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.info("info message");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("info");
      expect(body[0].message).toBe("info message");
    });

    it("should log warn level messages", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.warn("warn message");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("warn");
      expect(body[0].message).toBe("warn message");
    });

    it("should log error level messages", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.error("error message");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("error");
      expect(body[0].message).toBe("error message");
    });

    it("should log fatal level messages", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.fatal("fatal message");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("fatal");
      expect(body[0].message).toBe("fatal message");
    });
  });

  describe("entry format", () => {
    it("should include dt, level, and message in every entry", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.info("hello");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0]).toMatchObject({
        dt: "2026-03-15T10:00:00.000Z",
        level: "info",
        message: "hello",
      });
    });

    it("should include per-call metadata in entry", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.info("with meta", { requestId: "abc123", duration: 42 });

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].requestId).toBe("abc123");
      expect(body[0].duration).toBe(42);
    });

    it("should include config-level metadata in every entry", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({
        batchSize: 1,
        metadata: { service: "test-service", version: "1.0" },
      });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].service).toBe("test-service");
      expect(body[0].version).toBe("1.0");
    });

    it("should let per-call metadata override config metadata", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({
        batchSize: 1,
        metadata: { service: "default" },
      });

      client.info("test", { service: "override" });

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].service).toBe("override");
    });
  });

  describe("log method", () => {
    it("should accept LogLevel enum and create correct entry", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.log(LogLevel.Error, "direct log", { key: "val" });

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body[0].level).toBe("error");
      expect(body[0].message).toBe("direct log");
      expect(body[0].key).toBe("val");
    });
  });

  describe("flush", () => {
    it("should flush pending entries to the transport", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient();

      client.info("pending1");
      client.info("pending2");

      await client.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toHaveLength(2);
    });

    it("should do nothing when no entries are pending", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient();

      await client.flush();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    it("should flush remaining entries on shutdown", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient();

      client.info("last entry");

      await client.shutdown();

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("setCompressFn", () => {
    it("should pass the compress function to the transport", async () => {
      const compressFn = vi.fn().mockResolvedValue(new Uint8Array([1, 2]));
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1, compression: true });

      client.setCompressFn(compressFn);
      client.info("compressed");

      await vi.advanceTimersByTimeAsync(0);

      expect(compressFn).toHaveBeenCalledTimes(1);
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBe("gzip");
    });
  });

  describe("getDefaultMetadata", () => {
    it("should return empty object for base MihariClient", async () => {
      const fetchMock = mockFetchSuccess();
      const client = createClient({ batchSize: 1 });

      client.info("test");

      await vi.advanceTimersByTimeAsync(0);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      // Should have only dt, level, message - no extra metadata
      expect(Object.keys(body[0])).toEqual(["dt", "level", "message"]);
    });
  });
});
