import { describe, it, expect } from "vitest";
import {
  LogLevel,
  type LogEntry,
  type MihariConfig,
  type TransportOptions,
  type BatchOptions,
  type TransportResponse,
  type TransportError,
  type CompressFn,
} from "../src/index";

describe("LogLevel enum", () => {
  it("should have Debug = 'debug'", () => {
    expect(LogLevel.Debug).toBe("debug");
  });

  it("should have Info = 'info'", () => {
    expect(LogLevel.Info).toBe("info");
  });

  it("should have Warn = 'warn'", () => {
    expect(LogLevel.Warn).toBe("warn");
  });

  it("should have Error = 'error'", () => {
    expect(LogLevel.Error).toBe("error");
  });

  it("should have Fatal = 'fatal'", () => {
    expect(LogLevel.Fatal).toBe("fatal");
  });

  it("should have exactly 5 members", () => {
    const values = Object.values(LogLevel);
    expect(values).toHaveLength(5);
    expect(values).toEqual(["debug", "info", "warn", "error", "fatal"]);
  });
});

describe("type exports", () => {
  it("should allow creating a valid LogEntry", () => {
    const entry: LogEntry = {
      dt: "2026-01-01T00:00:00.000Z",
      level: LogLevel.Info,
      message: "test message",
    };
    expect(entry.dt).toBe("2026-01-01T00:00:00.000Z");
    expect(entry.level).toBe(LogLevel.Info);
    expect(entry.message).toBe("test message");
  });

  it("should allow LogEntry with extra fields via index signature", () => {
    const entry: LogEntry = {
      dt: "2026-01-01T00:00:00.000Z",
      level: LogLevel.Debug,
      message: "hello",
      customField: 42,
      nested: { a: 1 },
    };
    expect(entry.customField).toBe(42);
    expect(entry.nested).toEqual({ a: 1 });
  });

  it("should allow creating a valid MihariConfig", () => {
    const config: MihariConfig = {
      token: "test-token",
      endpoint: "https://example.com",
      batchSize: 50,
      flushInterval: 3000,
      maxQueueSize: 500,
      compression: true,
      retries: 5,
      metadata: { service: "test" },
    };
    expect(config.token).toBe("test-token");
    expect(config.endpoint).toBe("https://example.com");
    expect(config.batchSize).toBe(50);
    expect(config.compression).toBe(true);
  });

  it("should allow MihariConfig with only required fields", () => {
    const config: MihariConfig = {
      token: "tok",
      endpoint: "https://api.test.com",
    };
    expect(config.token).toBe("tok");
    expect(config.batchSize).toBeUndefined();
  });

  it("should allow creating a valid TransportOptions", () => {
    const opts: TransportOptions = {
      token: "t",
      endpoint: "https://e.com",
      compression: false,
      retries: 2,
    };
    expect(opts.token).toBe("t");
    expect(opts.compression).toBe(false);
  });

  it("should allow creating a valid BatchOptions", () => {
    const opts: BatchOptions = {
      batchSize: 20,
      flushInterval: 1000,
      maxQueueSize: 200,
    };
    expect(opts.batchSize).toBe(20);
  });

  it("should allow creating a valid TransportResponse", () => {
    const resp: TransportResponse = {
      status: "accepted",
      count: 5,
    };
    expect(resp.status).toBe("accepted");
    expect(resp.count).toBe(5);
  });

  it("should allow creating a valid TransportError", () => {
    const err: TransportError = {
      error: "something went wrong",
    };
    expect(err.error).toBe("something went wrong");
  });

  it("should allow defining a CompressFn", () => {
    const fn: CompressFn = async (data) => data;
    expect(typeof fn).toBe("function");
  });
});
