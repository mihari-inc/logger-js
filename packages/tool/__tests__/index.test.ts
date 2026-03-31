import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// Mock @mihari/core
const mockLog = vi.fn();
const mockDebug = vi.fn();
const mockInfo = vi.fn();
const mockWarn = vi.fn();
const mockError = vi.fn();
const mockFatal = vi.fn();
const mockFlush = vi.fn().mockResolvedValue(undefined);
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@mihari/core", () => ({
  MihariClient: vi.fn().mockImplementation(() => ({
    log: mockLog,
    debug: mockDebug,
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
    fatal: mockFatal,
    flush: mockFlush,
    shutdown: mockShutdown,
  })),
}));

// We need to mock readline to control stdin simulation
const mockRlOn = vi.fn();
const mockRlInstance = {
  on: mockRlOn,
};

vi.mock("readline", () => ({
  createInterface: vi.fn().mockImplementation(() => mockRlInstance),
}));

// Store original values
const originalArgv = process.argv;
const originalEnv = { ...process.env };
const originalExit = process.exit;
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe("tool CLI", () => {
  let consoleLogSpy: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.fn>;
  let exitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set required env vars
    process.env.MIHARI_TOKEN = "test-token";
    process.env.MIHARI_ENDPOINT = "https://logs.test.com";

    // Mock console and process.exit
    consoleLogSpy = vi.fn();
    consoleErrorSpy = vi.fn();
    exitSpy = vi.fn() as any;

    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
    process.exit = exitSpy as any;

    // Reset readline mock
    mockRlOn.mockReset();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = { ...originalEnv };
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clear module cache so each test gets a fresh import
    vi.resetModules();
  });

  /**
   * Helper: import the module fresh (re-triggers main()).
   * We need resetModules + dynamic import so vi.mock stays in effect
   * but the module's top-level main() runs with our mocked argv/env.
   */
  async function runCLI(args: readonly string[]) {
    process.argv = ["node", "mihari", ...args];
    // Re-apply mocks after resetModules
    vi.doMock("@mihari/core", () => ({
      MihariClient: vi.fn().mockImplementation(() => ({
        log: mockLog,
        debug: mockDebug,
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
        fatal: mockFatal,
        flush: mockFlush,
        shutdown: mockShutdown,
      })),
    }));
    vi.doMock("readline", () => ({
      createInterface: vi.fn().mockImplementation(() => mockRlInstance),
    }));
    await import("../src/index");
  }

  describe("--help flag", () => {
    it("prints usage and exits 0 when --help is passed", async () => {
      await runCLI(["--help"]);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("mihari");
      expect(output).toContain("send");
      expect(output).toContain("tail");
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("prints usage when no arguments given", async () => {
      await runCLI([]);
      expect(consoleLogSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("environment variable validation", () => {
    it("exits with error when MIHARI_TOKEN is missing", async () => {
      delete process.env.MIHARI_TOKEN;
      await runCLI(["send", "hello"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("MIHARI_TOKEN")
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with error when MIHARI_ENDPOINT is missing", async () => {
      delete process.env.MIHARI_ENDPOINT;
      await runCLI(["send", "hello"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("MIHARI_ENDPOINT")
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("unknown command", () => {
    it("prints error and usage for unknown commands", async () => {
      await runCLI(["unknown-cmd"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown command")
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("send command", () => {
    it("sends a message at default info level", async () => {
      await runCLI(["send", "Deployment completed"]);
      expect(mockInfo).toHaveBeenCalledWith("Deployment completed");
      expect(mockFlush).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Sent")
      );
    });

    it("sends a message at specified debug level", async () => {
      await runCLI(["send", "Debug msg", "--level", "debug"]);
      expect(mockDebug).toHaveBeenCalledWith("Debug msg");
    });

    it("sends a message at specified warn level", async () => {
      await runCLI(["send", "Warning msg", "--level", "warn"]);
      expect(mockWarn).toHaveBeenCalledWith("Warning msg");
    });

    it("sends a message at specified error level", async () => {
      await runCLI(["send", "Error msg", "--level", "error"]);
      expect(mockError).toHaveBeenCalledWith("Error msg");
    });

    it("sends a message at specified fatal level", async () => {
      await runCLI(["send", "Fatal msg", "--level", "fatal"]);
      expect(mockFatal).toHaveBeenCalledWith("Fatal msg");
    });

    it("exits with error when no message provided", async () => {
      await runCLI(["send"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Message is required")
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with error for invalid level", async () => {
      await runCLI(["send", "msg", "--level", "banana"]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid log level")
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("handles --level before the message", async () => {
      await runCLI(["send", "--level", "error", "Error first"]);
      expect(mockError).toHaveBeenCalledWith("Error first");
    });
  });

  describe("tail command", () => {
    it("creates a readline interface and registers line/close handlers", async () => {
      await runCLI(["tail"]);
      expect(mockRlOn).toHaveBeenCalledWith("line", expect.any(Function));
      expect(mockRlOn).toHaveBeenCalledWith("close", expect.any(Function));
    });

    it("sends each non-empty line at default info level", async () => {
      await runCLI(["tail"]);

      // Get the line handler
      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;

      expect(lineHandler).toBeDefined();

      lineHandler("first line");
      lineHandler("second line");

      expect(mockInfo).toHaveBeenCalledWith("first line");
      expect(mockInfo).toHaveBeenCalledWith("second line");
    });

    it("skips empty and whitespace-only lines", async () => {
      await runCLI(["tail"]);

      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;

      lineHandler("");
      lineHandler("   ");
      lineHandler("\t");

      expect(mockInfo).not.toHaveBeenCalled();
    });

    it("trims whitespace from lines", async () => {
      await runCLI(["tail"]);

      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;

      lineHandler("  trimmed  ");
      expect(mockInfo).toHaveBeenCalledWith("trimmed");
    });

    it("uses specified log level for all lines", async () => {
      await runCLI(["tail", "--level", "error"]);

      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;

      lineHandler("error line");
      expect(mockError).toHaveBeenCalledWith("error line");
    });

    it("calls shutdown and logs count on close", async () => {
      await runCLI(["tail"]);

      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;
      const closeHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "close"
      )?.[1] as () => Promise<void>;

      // Send some lines
      lineHandler("line 1");
      lineHandler("line 2");
      lineHandler("line 3");

      // Trigger close
      await closeHandler();

      expect(mockShutdown).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith("Sent 3 log entries");
    });

    it("does not count empty lines in the total", async () => {
      await runCLI(["tail"]);

      const lineHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "line"
      )?.[1] as (line: string) => void;
      const closeHandler = mockRlOn.mock.calls.find(
        (call: unknown[]) => call[0] === "close"
      )?.[1] as () => Promise<void>;

      lineHandler("line 1");
      lineHandler("");
      lineHandler("  ");
      lineHandler("line 2");

      await closeHandler();

      expect(consoleLogSpy).toHaveBeenCalledWith("Sent 2 log entries");
    });

    it("supports all log levels via --level flag", async () => {
      for (const level of ["debug", "warn", "fatal"] as const) {
        vi.clearAllMocks();
        mockRlOn.mockReset();

        await runCLI(["tail", "--level", level]);

        const lineHandler = mockRlOn.mock.calls.find(
          (call: unknown[]) => call[0] === "line"
        )?.[1] as (line: string) => void;

        lineHandler(`${level} line`);

        const mockFn =
          level === "debug" ? mockDebug : level === "warn" ? mockWarn : mockFatal;
        expect(mockFn).toHaveBeenCalledWith(`${level} line`);
      }
    });
  });
});
