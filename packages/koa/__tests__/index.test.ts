import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @mihari/core
const mockLog = vi.fn();

vi.mock("@mihari/logger-core", () => ({
  MihariClient: vi.fn().mockImplementation(() => ({
    log: mockLog,
  })),
}));

import { mihariMiddleware } from "../src/index";
import defaultExport from "../src/index";
import { LogLevel } from "@mihari/logger-types";

const TEST_CONFIG = { token: "test-token", endpoint: "https://logs.test.com" };

function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    url: "/api/test",
    status: 200,
    ip: "127.0.0.1",
    request: {
      length: undefined,
      get: vi.fn((header: string) => {
        if (header === "user-agent") return "TestAgent/1.0";
        return "";
      }),
    },
    response: {
      length: 1234,
    },
    ...overrides,
  };
}

describe("mihariMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a middleware function", () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    expect(typeof middleware).toBe("function");
  });

  it("calls next() and logs the request", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledTimes(1);
  });

  it("logs method, url, status, userAgent, contentLength, and ip", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext({
      method: "POST",
      url: "/api/users",
      status: 201,
      ip: "10.0.0.1",
    });
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as any, next);

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "POST /api/users 201",
      expect.objectContaining({
        method: "POST",
        url: "/api/users",
        status: 201,
        ip: "10.0.0.1",
        userAgent: "TestAgent/1.0",
        contentLength: 1234,
      })
    );
  });

  it("includes responseTimeMs in metadata", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as any, next);

    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta).toHaveProperty("responseTimeMs");
    expect(typeof calledMeta.responseTimeMs).toBe("number");
    expect(calledMeta.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  describe("log level selection based on status code", () => {
    it("uses Info for 2xx responses", async () => {
      const middleware = mihariMiddleware(TEST_CONFIG);

      for (const status of [200, 201, 204, 299]) {
        mockLog.mockClear();
        const ctx = createMockContext({ status });
        await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));
        expect(mockLog).toHaveBeenCalledWith(
          LogLevel.Info,
          expect.any(String),
          expect.any(Object)
        );
      }
    });

    it("uses Info for 3xx responses", async () => {
      const middleware = mihariMiddleware(TEST_CONFIG);
      const ctx = createMockContext({ status: 301 });

      await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));

      expect(mockLog).toHaveBeenCalledWith(
        LogLevel.Info,
        expect.any(String),
        expect.any(Object)
      );
    });

    it("uses Warn for 4xx responses", async () => {
      const middleware = mihariMiddleware(TEST_CONFIG);

      for (const status of [400, 401, 403, 404, 422, 429]) {
        mockLog.mockClear();
        const ctx = createMockContext({ status });
        await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));
        expect(mockLog).toHaveBeenCalledWith(
          LogLevel.Warn,
          expect.any(String),
          expect.any(Object)
        );
      }
    });

    it("uses Error for 5xx responses", async () => {
      const middleware = mihariMiddleware(TEST_CONFIG);

      for (const status of [500, 502, 503, 504]) {
        mockLog.mockClear();
        const ctx = createMockContext({ status });
        await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));
        expect(mockLog).toHaveBeenCalledWith(
          LogLevel.Error,
          expect.any(String),
          expect.any(Object)
        );
      }
    });
  });

  it("logs even when next() throws", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext({ status: 500 });
    const next = vi.fn().mockRejectedValue(new Error("handler error"));

    await expect(middleware(ctx as any, next)).rejects.toThrow("handler error");

    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Error,
      expect.stringContaining("500"),
      expect.any(Object)
    );
  });

  it("formats the log message as 'METHOD URL STATUS'", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext({ method: "DELETE", url: "/api/items/5", status: 204 });

    await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "DELETE /api/items/5 204",
      expect.any(Object)
    );
  });

  it("reads the user-agent header from ctx.request.get", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const customGet = vi.fn((header: string) => {
      if (header === "user-agent") return "CustomBot/2.0";
      return "";
    });
    const ctx = createMockContext({
      request: { length: undefined, get: customGet },
    });

    await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));

    expect(customGet).toHaveBeenCalledWith("user-agent");
    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta.userAgent).toBe("CustomBot/2.0");
  });

  it("handles undefined response.length", async () => {
    const middleware = mihariMiddleware(TEST_CONFIG);
    const ctx = createMockContext({
      response: { length: undefined },
    });

    await middleware(ctx as any, vi.fn().mockResolvedValue(undefined));

    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta.contentLength).toBeUndefined();
  });
});

describe("default export", () => {
  it("is the mihariMiddleware function", () => {
    expect(defaultExport).toBe(mihariMiddleware);
  });
});
