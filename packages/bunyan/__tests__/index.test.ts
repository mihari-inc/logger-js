import { describe, it, expect, vi, beforeEach } from "vitest";
import { Writable } from "stream";

// Mock @mihari/core
const mockLog = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@mihari/logger-core", () => ({
  MihariClient: vi.fn().mockImplementation(() => ({
    log: mockLog,
    shutdown: mockShutdown,
  })),
}));

import { MihariBunyanStream } from "../src/index";
import DefaultExport from "../src/index";
import { LogLevel } from "@mihari/logger-types";

const TEST_CONFIG = { token: "test-token", endpoint: "https://logs.test.com" };

function makeBunyanRecord(overrides: Record<string, unknown> = {}) {
  return {
    level: 30,
    msg: "test message",
    time: new Date().toISOString(),
    name: "test-app",
    hostname: "server-1",
    pid: 9999,
    v: 0,
    ...overrides,
  };
}

describe("MihariBunyanStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends Writable", () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    expect(stream).toBeInstanceOf(Writable);
  });

  it("operates in objectMode", () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    expect(stream.writableObjectMode).toBe(true);
  });

  describe("level mapping", () => {
    const cases: Array<{ bunyanLevel: number; expected: LogLevel }> = [
      { bunyanLevel: 10, expected: LogLevel.Debug },
      { bunyanLevel: 20, expected: LogLevel.Debug },
      { bunyanLevel: 30, expected: LogLevel.Info },
      { bunyanLevel: 40, expected: LogLevel.Warn },
      { bunyanLevel: 50, expected: LogLevel.Error },
      { bunyanLevel: 60, expected: LogLevel.Fatal },
    ];

    it.each(cases)(
      "maps bunyan level $bunyanLevel to $expected",
      ({ bunyanLevel, expected }, done) => {
        const stream = new MihariBunyanStream(TEST_CONFIG);
        const record = makeBunyanRecord({ level: bunyanLevel });

        stream.write(record, () => {
          expect(mockLog).toHaveBeenCalledWith(
            expected,
            "test message",
            expect.any(Object)
          );
          stream.destroy();
          if (typeof done === "function") done();
        });
      }
    );
  });

  it("maps levels below 20 to Debug", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    stream.write(makeBunyanRecord({ level: 5 }), () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Debug, "test message", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("maps levels above 50 to Fatal", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    stream.write(makeBunyanRecord({ level: 70 }), () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Fatal, "test message", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("passes msg as the log message", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    stream.write(makeBunyanRecord({ msg: "hello bunyan" }), () => {
      expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "hello bunyan", expect.any(Object));
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("includes bunyanName, hostname, and pid in metadata", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    const record = makeBunyanRecord({ name: "my-service", hostname: "host-2", pid: 5678 });

    stream.write(record, () => {
      expect(mockLog).toHaveBeenCalledWith(
        LogLevel.Info,
        "test message",
        expect.objectContaining({
          bunyanName: "my-service",
          hostname: "host-2",
          pid: 5678,
        })
      );
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("excludes time, v, level, and msg from metadata (destructured out)", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    stream.write(makeBunyanRecord(), () => {
      const calledMeta = mockLog.mock.calls[0][2];
      expect(calledMeta).not.toHaveProperty("time");
      expect(calledMeta).not.toHaveProperty("v");
      expect(calledMeta).not.toHaveProperty("level");
      expect(calledMeta).not.toHaveProperty("msg");
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("forwards extra metadata fields from the bunyan record", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    const record = makeBunyanRecord({ requestId: "req-42", component: "auth" });

    stream.write(record, () => {
      expect(mockLog).toHaveBeenCalledWith(
        LogLevel.Info,
        "test message",
        expect.objectContaining({ requestId: "req-42", component: "auth" })
      );
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  it("calls callback with error when _write throws", (done) => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    mockLog.mockImplementationOnce(() => {
      throw new Error("log failed");
    });
    stream.on("error", () => {
      // suppress
    });

    stream.write(makeBunyanRecord(), (err) => {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("log failed");
      stream.destroy();
      if (typeof done === "function") done();
    });
  });

  describe("_final (shutdown)", () => {
    it("calls client.shutdown on stream end", (done) => {
      const stream = new MihariBunyanStream(TEST_CONFIG);
      stream.end(() => {
        expect(mockShutdown).toHaveBeenCalled();
        if (typeof done === "function") done();
      });
    });

    it("propagates shutdown errors", (done) => {
      mockShutdown.mockRejectedValueOnce(new Error("shutdown boom"));
      const stream = new MihariBunyanStream(TEST_CONFIG);
      stream.on("error", () => {
        // suppress
      });

      stream.end(() => {
        expect(mockShutdown).toHaveBeenCalled();
        if (typeof done === "function") done();
      });
    });
  });
});

describe("default export", () => {
  it("is the MihariBunyanStream class", () => {
    expect(DefaultExport).toBe(MihariBunyanStream);
  });
});
