import { describe, it, expect, vi, beforeEach } from "vitest";
import { LogLevel } from "@mihari/logger-types";

// Hoist mock functions so vi.mock factories can reference them
const { mockLog, mockShutdown } = vi.hoisted(() => ({
  mockLog: vi.fn(),
  mockShutdown: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mihari/logger-core", () => ({
  MihariClient: vi.fn().mockImplementation(function () {
    return { log: mockLog, shutdown: mockShutdown };
  }),
}));

vi.mock("winston-transport", async () => {
  const { EventEmitter } = await import("events");
  class FakeTransport extends EventEmitter {
    constructor(_opts?: Record<string, unknown>) {
      super();
    }
  }
  return { default: FakeTransport, __esModule: true };
});

const { MihariWinstonTransport } = await import("../src/index");
const DefaultExport = (await import("../src/index")).default;

const TEST_CONFIG = { token: "test-token", endpoint: "https://logs.test.com" };

describe("MihariWinstonTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("can be constructed with mihariConfig", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    expect(transport).toBeDefined();
  });

  describe("level mapping", () => {
    const cases: Array<{ winstonLevel: string; expected: LogLevel }> = [
      { winstonLevel: "silly", expected: LogLevel.Debug },
      { winstonLevel: "debug", expected: LogLevel.Debug },
      { winstonLevel: "verbose", expected: LogLevel.Info },
      { winstonLevel: "info", expected: LogLevel.Info },
      { winstonLevel: "warn", expected: LogLevel.Warn },
      { winstonLevel: "warning", expected: LogLevel.Warn },
      { winstonLevel: "error", expected: LogLevel.Error },
      { winstonLevel: "crit", expected: LogLevel.Fatal },
      { winstonLevel: "critical", expected: LogLevel.Fatal },
      { winstonLevel: "emerg", expected: LogLevel.Fatal },
      { winstonLevel: "alert", expected: LogLevel.Fatal },
    ];

    it.each(cases)(
      "maps winston level '$winstonLevel' to $expected",
      ({ winstonLevel, expected }) => {
        const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
        const callback = vi.fn();

        transport.log({ level: winstonLevel, message: "test" }, callback);

        expect(mockLog).toHaveBeenCalledWith(expected, "test", expect.any(Object));
        expect(callback).toHaveBeenCalled();
      }
    );
  });

  it("defaults to Info for unknown levels", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const callback = vi.fn();

    transport.log({ level: "unknown-level", message: "test" }, callback);

    expect(mockLog).toHaveBeenCalledWith(LogLevel.Info, "test", expect.any(Object));
  });

  it("calls the log callback synchronously", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const callback = vi.fn();

    transport.log({ level: "info", message: "hello" }, callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("emits 'logged' event asynchronously via setImmediate", async () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const loggedHandler = vi.fn();
    transport.on("logged", loggedHandler);
    const callback = vi.fn();

    const logInfo = { level: "info", message: "event test" };
    transport.log(logInfo, callback);

    // 'logged' should not have fired yet (setImmediate)
    expect(loggedHandler).not.toHaveBeenCalled();

    // Wait for setImmediate to fire
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(loggedHandler).toHaveBeenCalledWith(logInfo);
  });

  it("forwards metadata excluding splat", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const callback = vi.fn();

    transport.log(
      {
        level: "info",
        message: "with meta",
        requestId: "req-1",
        splat: ["should be excluded"],
        service: "api",
      },
      callback
    );

    expect(mockLog).toHaveBeenCalledWith(
      LogLevel.Info,
      "with meta",
      expect.objectContaining({ requestId: "req-1", service: "api" })
    );
    // splat should NOT be in the metadata
    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta).not.toHaveProperty("splat");
  });

  it("strips Symbol properties by only using Object.keys", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const callback = vi.fn();
    const sym = Symbol("winstonInternal");

    const info = {
      level: "info",
      message: "symbol test",
      [sym]: "hidden",
      visible: true,
    };

    transport.log(info as any, callback);

    const calledMeta = mockLog.mock.calls[0][2];
    expect(calledMeta).toEqual({ visible: true });
  });

  it("handles empty metadata", () => {
    const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
    const callback = vi.fn();

    transport.log({ level: "error", message: "no meta" }, callback);

    expect(mockLog).toHaveBeenCalledWith(LogLevel.Error, "no meta", {});
  });

  describe("close", () => {
    it("calls client.shutdown", async () => {
      const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
      await transport.close();
      expect(mockShutdown).toHaveBeenCalled();
    });

    it("propagates shutdown errors", async () => {
      mockShutdown.mockRejectedValueOnce(new Error("shutdown error"));
      const transport = new MihariWinstonTransport({ mihariConfig: TEST_CONFIG });
      await expect(transport.close()).rejects.toThrow("shutdown error");
    });
  });
});

describe("default export", () => {
  it("is the MihariWinstonTransport class", () => {
    expect(DefaultExport).toBe(MihariWinstonTransport);
  });
});
