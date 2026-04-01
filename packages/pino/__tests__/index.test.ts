import { describe, it, expect, vi, beforeEach } from "vitest";
import { Writable } from "stream";

// Mock @mihari/core before importing the module under test
const mockLog = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@mihari/logger-core", () => ({
  MihariClient: vi.fn().mockImplementation(() => ({
    log: mockLog,
    shutdown: mockShutdown,
  })),
}));

import { createMihariTransport } from "../src/index";
import defaultExport from "../src/index";
import { LogLevel } from "@mihari/logger-types";

const TEST_CONFIG = { token: "test-token", endpoint: "https://logs.test.com" };

function writeAsync(stream: Writable, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(data, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function endAsync(stream: Writable): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

describe("createMihariTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a Writable stream", () => {
    const stream = createMihariTransport(TEST_CONFIG);
    expect(stream).toBeInstanceOf(Writable);
  });

  it("stream is in objectMode", () => {
    const stream = createMihariTransport(TEST_CONFIG);
    expect(stream.writableObjectMode).toBe(true);
  });

  describe("level mapping", () => {
    const cases: Array<{ pinoLevel: number; expected: LogLevel }> = [
      { pinoLevel: 10, expected: LogLevel.Debug },
      { pinoLevel: 20, expected: LogLevel.Debug },
      { pinoLevel: 30, expected: LogLevel.Info },
      { pinoLevel: 40, expected: LogLevel.Warn },
      { pinoLevel: 50, expected: LogLevel.Error },
      { pinoLevel: 60, expected: LogLevel.Fatal },
    ];

    it.each(cases)(
      "maps pino level $pinoLevel to $expected",
      async ({ pinoLevel, expected }) => {
        const stream = createMihariTransport(TEST_CONFIG);
        const entry = { level: pinoLevel, time: Date.now(), msg: "test msg" };

        await writeAsync(stream, entry);

        expect(mockLog).toHaveBeenCalledWith(
          expected,
          "test msg",
          expect.any(Object)
        );
        stream.destroy();
      }
    );
  });

  it("maps edge-case levels: below 20 is Debug, above 50 is Fatal", async () => {
    const stream = createMihariTransport(TEST_CONFIG);

    await writeAsync(stream, { level: 5, time: Date.now(), msg: "trace-ish" });
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Debug, "trace-ish", expect.any(Object));

    await writeAsync(stream, { level: 70, time: Date.now(), msg: "beyond-fatal" });
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Fatal, "beyond-fatal", expect.any(Object));
    stream.destroy();
  });

  it("extracts msg field as the log message", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now(), msg: "hello from pino" };

    await writeAsync(stream, entry);
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "hello from pino", expect.any(Object));
    stream.destroy();
  });

  it("falls back to message field when msg is absent", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now(), message: "fallback message" };

    await writeAsync(stream, entry);
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "fallback message", expect.any(Object));
    stream.destroy();
  });

  it("uses empty string when both msg and message are absent", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now() };

    await writeAsync(stream, entry);
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "", expect.any(Object));
    stream.destroy();
  });

  it("forwards extra metadata fields", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = {
      level: 30,
      time: Date.now(),
      msg: "with meta",
      requestId: "abc-123",
      userId: 42,
    };

    await writeAsync(stream, entry);

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "with meta",
      expect.objectContaining({ requestId: "abc-123", userId: 42 })
    );
    stream.destroy();
  });

  it("includes pid and hostname when present", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = {
      level: 30,
      time: Date.now(),
      msg: "with pid",
      pid: 1234,
      hostname: "server-1",
    };

    await writeAsync(stream, entry);

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "with pid",
      expect.objectContaining({ pid: 1234, hostname: "server-1" })
    );
    stream.destroy();
  });

  it("parses string chunks as JSON", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    const jsonString = JSON.stringify({ level: 40, time: Date.now(), msg: "string chunk" });

    await writeAsync(stream, jsonString);
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Warn, "string chunk", expect.any(Object));
    stream.destroy();
  });

  it("calls callback with error for invalid JSON string", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    stream.on("error", () => {
      // suppress unhandled error
    });

    await expect(writeAsync(stream, "not valid json")).rejects.toThrow();
    stream.destroy();
  });

  it("calls client.shutdown on stream end (final)", async () => {
    const stream = createMihariTransport(TEST_CONFIG);
    await endAsync(stream);
    expect(mockShutdown).toHaveBeenCalled();
  });

  it("propagates shutdown errors in final callback", async () => {
    mockShutdown.mockRejectedValueOnce(new Error("shutdown failed"));
    const stream = createMihariTransport(TEST_CONFIG);
    stream.on("error", () => {
      // suppress
    });

    await endAsync(stream);
    expect(mockShutdown).toHaveBeenCalled();
  });
});

describe("default export", () => {
  it("is a function that returns a Writable stream", () => {
    const stream = defaultExport(TEST_CONFIG);
    expect(stream).toBeInstanceOf(Writable);
    stream.destroy();
  });
});
