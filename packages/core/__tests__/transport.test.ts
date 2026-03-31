import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpTransport } from "../src/transport";
import { LogLevel, type LogEntry } from "@mihari/types";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    dt: "2026-01-01T00:00:00.000Z",
    level: LogLevel.Info,
    message: "test",
    ...overrides,
  };
}

function mockFetch(status: number, json: unknown = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    status,
    json: vi.fn().mockResolvedValue(json),
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

describe("HttpTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should strip trailing slashes from endpoint", () => {
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com///",
      });
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });

      void transport.send([makeEntry()]).then(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "https://api.test.com",
          expect.anything()
        );
      });
      vi.advanceTimersByTime(0);
    });

    it("should default compression to false", async () => {
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });

      await transport.send([makeEntry()]);

      const callArgs = fetchMock.mock.calls[0][1];
      expect(callArgs.headers["Content-Encoding"]).toBeUndefined();
    });

    it("should default retries to 3", async () => {
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });
      const fetchMock = vi.fn().mockRejectedValue(new Error("network error"));
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const sendPromise = transport.send([makeEntry()]);

      // Advance through all retries: delays of 1000, 2000
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await expect(sendPromise).rejects.toThrow("network error");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe("send", () => {
    it("should send logs as JSON POST with auth header", async () => {
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });
      const transport = new HttpTransport({
        token: "my-token",
        endpoint: "https://api.test.com",
      });

      await transport.send([makeEntry()]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.test.com");
      expect(options.method).toBe("POST");
      expect(options.headers["Authorization"]).toBe("Bearer my-token");
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("should return TransportResponse on 202", async () => {
      mockFetch(202, { status: "accepted", count: 3 });
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });

      const result = await transport.send([makeEntry(), makeEntry(), makeEntry()]);
      expect(result).toEqual({ status: "accepted", count: 3 });
    });

    it("should throw on 401 without retrying", async () => {
      const fetchMock = mockFetch(401, { error: "unauthorized" });
      const transport = new HttpTransport({
        token: "bad",
        endpoint: "https://api.test.com",
      });

      await expect(transport.send([makeEntry()])).rejects.toThrow(
        "Invalid or missing authentication token"
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should throw on 400 without retrying", async () => {
      const fetchMock = mockFetch(400, { error: "bad request" });
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });

      await expect(transport.send([makeEntry()])).rejects.toThrow(
        "No valid logs found"
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should throw on unexpected status after retries", async () => {
      const fetchMock = mockFetch(500, {});
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        retries: 2,
      });

      const sendPromise = transport.send([makeEntry()]);
      await vi.advanceTimersByTimeAsync(1000);

      await expect(sendPromise).rejects.toThrow("Unexpected response status: 500");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("should retry with exponential backoff on network errors", async () => {
      const fetchMock = vi.fn()
        .mockRejectedValueOnce(new Error("network error"))
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce({
          status: 202,
          json: vi.fn().mockResolvedValue({ status: "accepted", count: 1 }),
        });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });

      const sendPromise = transport.send([makeEntry()]);

      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // Second retry after 2000ms
      await vi.advanceTimersByTimeAsync(2000);

      const result = await sendPromise;
      expect(result).toEqual({ status: "accepted", count: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("should serialize log entries as JSON body", async () => {
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
      });

      const entries = [makeEntry({ message: "hello" })];
      await transport.send(entries);

      const body = fetchMock.mock.calls[0][1].body;
      expect(JSON.parse(body)).toEqual(entries);
    });
  });

  describe("compression", () => {
    it("should add Content-Encoding header when compression is enabled and compressFn is set", async () => {
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });
      const compressFn = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        compression: true,
      });
      transport.setCompressFn(compressFn);

      await transport.send([makeEntry()]);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBe("gzip");
      expect(compressFn).toHaveBeenCalledTimes(1);
    });

    it("should not compress when compression is false", async () => {
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });
      const compressFn = vi.fn();

      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        compression: false,
      });
      transport.setCompressFn(compressFn);

      await transport.send([makeEntry()]);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBeUndefined();
      expect(compressFn).not.toHaveBeenCalled();
    });

    it("should not compress when compressFn is not set even if compression is true", async () => {
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });

      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        compression: true,
      });

      await transport.send([makeEntry()]);

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers["Content-Encoding"]).toBeUndefined();
    });

    it("should send compressed body when compression is enabled", async () => {
      const compressedData = new Uint8Array([10, 20, 30]);
      const fetchMock = mockFetch(202, { status: "accepted", count: 1 });
      const compressFn = vi.fn().mockResolvedValue(compressedData);

      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        compression: true,
      });
      transport.setCompressFn(compressFn);

      await transport.send([makeEntry()]);

      const body = fetchMock.mock.calls[0][1].body;
      expect(body).toBe(compressedData);
    });
  });

  describe("setCompressFn", () => {
    it("should accept and store a compression function", async () => {
      const compressFn = vi.fn().mockResolvedValue(new Uint8Array([1]));
      const transport = new HttpTransport({
        token: "tok",
        endpoint: "https://api.test.com",
        compression: true,
      });

      transport.setCompressFn(compressFn);

      mockFetch(202, { status: "accepted", count: 1 });
      await transport.send([makeEntry()]);

      expect(compressFn).toHaveBeenCalledOnce();
    });
  });
});
