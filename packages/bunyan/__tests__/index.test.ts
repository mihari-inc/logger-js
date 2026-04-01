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
      async ({ bunyanLevel, expected }) => {
        const stream = new MihariBunyanStream(TEST_CONFIG);
        const record = makeBunyanRecord({ level: bunyanLevel });

        await writeAsync(stream, record);

        expect(mockLog).toHaveBeenCalledWith(
          expected,
          "test message",
          expect.any(Object)
        );
        stream.destroy();
      }
    );
  });

  it("maps levels below 20 to Debug", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    await writeAsync(stream, makeBunyanRecord({ level: 5 }));
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Debug, "test message", expect.any(Object));
    stream.destroy();
  });

  it("maps levels above 50 to Fatal", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    await writeAsync(stream, makeBunyanRecord({ level: 70 }));
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Fatal, "test message", expect.any(Object));
    stream.destroy();
  });

  it("passes msg as the log message", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    await writeAsync(stream, makeBunyanRecord({ msg: "hello bunyan" }));
    expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "hello bunyan", expect.any(Object));
    stream.destroy();
  });

  it("includes bunyanName, hostname, and pid in metadata", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    const record = makeBunyanRecord({ name: "my-service", hostname: "host-2", pid: 5678 });

    await writeAsync(stream, record);

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
  });

  it("excludes time, v, level, and msg from metadata (destructured out)", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    await writeAsync(stream, makeBunyanRecord());
    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta).not.toHaveProperty("time");
    expect(calledMeta).not.toHaveProperty("v");
    expect(calledMeta).not.toHaveProperty("level");
    expect(calledMeta).not.toHaveProperty("msg");
    stream.destroy();
  });

  it("forwards extra metadata fields from the bunyan record", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    const record = makeBunyanRecord({ requestId: "req-42", component: "auth" });

    await writeAsync(stream, record);

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "test message",
      expect.objectContaining({ requestId: "req-42", component: "auth" })
    );
    stream.destroy();
  });

  it("calls callback with error when _write throws", async () => {
    const stream = new MihariBunyanStream(TEST_CONFIG);
    mockLog.mockImplementationOnce(() => {
      throw new Error("log failed");
    });
    stream.on("error", () => {
      // suppress
    });

    await expect(writeAsync(stream, makeBunyanRecord())).rejects.toThrow("log failed");
    stream.destroy();
  });

  describe("_final (shutdown)", () => {
    it("calls client.shutdown on stream end", async () => {
      const stream = new MihariBunyanStream(TEST_CONFIG);
      await endAsync(stream);
      expect(mockShutdown).toHaveBeenCalled();
    });

    it("propagates shutdown errors", async () => {
      mockShutdown.mockRejectedValueOnce(new Error("shutdown boom"));
      const stream = new MihariBunyanStream(TEST_CONFIG);
      stream.on("error", () => {
        // suppress
      });

      await endAsync(stream);
      expect(mockShutdown).toHaveBeenCalled();
    });
  });
});

describe("default export", () => {
  it("is the MihariBunyanStream class", () => {
    expect(DefaultExport).toBe(MihariBunyanStream);
  });
});
