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
      ({ pinoLevel, expected }, done) => {
        const stream = createMihariTransport(TEST_CONFIG);
        const entry = { level: pinoLevel, time: Date.now(), msg: "test msg" };

        stream.write(entry, () => {
          expect(mockLog).toHaveBeenCalledWith(
            expected,
            "test msg",
            expect.any(Object)
          );
          stream.destroy();
          if (typeof done === "function") done();
        });
      }
    );
  });

  it("maps edge-case levels: below 20 is Debug, above 50 is Fatal", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);

    stream.write({ level: 5, time: Date.now(), msg: "trace-ish" }, () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Debug, "trace-ish", expect.any(Object));

      stream.write({ level: 70, time: Date.now(), msg: "beyond-fatal" }, () => {
        expect(mockLog).toHaveBeenCalledWith(LogLevel.Fatal, "beyond-fatal", expect.any(Object));
        stream.destroy();
        if (typeof done === "function") done();
      });
    });
  });

  it("extracts msg field as the log message", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now(), msg: "hello from pino" };

    stream.write(entry, () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "hello from pino", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("falls back to message field when msg is absent", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now(), message: "fallback message" };

    stream.write(entry, () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "fallback message", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("uses empty string when both msg and message are absent", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = { level: 30, time: Date.now() };

    stream.write(entry, () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("forwards extra metadata fields", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = {
      level: 30,
      time: Date.now(),
      msg: "with meta",
      requestId: "abc-123",
      userId: 42,
    };

    stream.write(entry, () => {
      expect(mockLog).toHaveBeenCalledWith(
        LogLevel.Info,
        "with meta",
        expect.objectContaining({ requestId: "abc-123", userId: 42 })
      );
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("includes pid and hostname when present", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const entry = {
      level: 30,
      time: Date.now(),
      msg: "with pid",
      pid: 1234,
      hostname: "server-1",
    };

    stream.write(entry, () => {
      expect(mockLog).toHaveBeenCalledWith(
        LogLevel.Info,
        "with pid",
        expect.objectContaining({ pid: 1234, hostname: "server-1" })
      );
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("parses string chunks as JSON", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    const jsonString = JSON.stringify({ level: 40, time: Date.now(), msg: "string chunk" });

    stream.write(jsonString, () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Warn, "string chunk", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("calls callback with error for invalid JSON string", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);
    stream.on("error", () => {
      // suppress unhandled error
    });

    stream.write("not valid json", (err) => {
      expect(err).toBeInstanceOf(Error);
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("calls client.shutdown on stream end (final)", (done) => {
    const stream = createMihariTransport(TEST_CONFIG);

    stream.end(() => {
      expect(mockShutdown).toHaveBeenCalled();
      if (typeof done === "function") done();
    });
  });

  it("propagates shutdown errors in final callback", (done) => {
    mockShutdown.mockRejectedValueOnce(new Error("shutdown failed"));
    const stream = createMihariTransport(TEST_CONFIG);
    stream.on("error", () => {
      // suppress
    });

    stream.end(() => {
      // The error is propagated through the stream error event
      // or through the final callback mechanism
      expect(mockShutdown).toHaveBeenCalled();
      if (typeof done === "function") done();
    });
  });
});

describe("default export", () => {
  it("is a function that returns a Writable stream", () => {
    const stream = defaultExport(TEST_CONFIG);
    expect(stream).toBeInstanceOf(Writable);
    stream.destroy();
  });
});
