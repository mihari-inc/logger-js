import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isoTimestamp, isBrowser, isNode, sleep } from "../src/utils";

describe("isoTimestamp", () => {
  it("should return a string in ISO 8601 format", () => {
    const result = isoTimestamp();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should return the current time", () => {
    const before = new Date().toISOString();
    const result = isoTimestamp();
    const after = new Date().toISOString();
    expect(result >= before).toBe(true);
    expect(result <= after).toBe(true);
  });

  it("should return a fixed timestamp when Date is mocked", () => {
    const fixed = new Date("2026-06-15T12:00:00.000Z");
    vi.setSystemTime(fixed);
    expect(isoTimestamp()).toBe("2026-06-15T12:00:00.000Z");
    vi.useRealTimers();
  });
});

describe("isBrowser", () => {
  it("should return false in Node.js environment", () => {
    expect(isBrowser()).toBe(false);
  });
});

describe("isNode", () => {
  it("should return true in Node.js environment", () => {
    expect(isNode()).toBe(true);
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a promise", () => {
    const result = sleep(100);
    expect(result).toBeInstanceOf(Promise);
    vi.advanceTimersByTime(100);
  });

  it("should resolve after the specified delay", async () => {
    let resolved = false;
    const promise = sleep(500).then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    vi.advanceTimersByTime(499);
    await Promise.resolve();
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it("should resolve immediately for 0ms", async () => {
    let resolved = false;
    const promise = sleep(0).then(() => {
      resolved = true;
    });

    vi.advanceTimersByTime(0);
    await promise;
    expect(resolved).toBe(true);
  });
});
