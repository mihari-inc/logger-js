import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Batcher, type FlushCallback } from "../src/batcher";
import { LogLevel, type LogEntry } from "@mihari/logger-types";

function makeEntry(msg = "test"): LogEntry {
  return {
    dt: "2026-01-01T00:00:00.000Z",
    level: LogLevel.Info,
    message: msg,
  };
}

describe("Batcher", () => {
  let onFlush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onFlush = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("constructor defaults", () => {
    it("should use default batchSize of 10", () => {
      const batcher = new Batcher({}, onFlush);

      for (let i = 0; i < 9; i++) {
        batcher.add(makeEntry());
      }
      expect(onFlush).not.toHaveBeenCalled();

      batcher.add(makeEntry());
      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it("should start a periodic flush timer", () => {
      const batcher = new Batcher({}, onFlush);
      batcher.add(makeEntry());

      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe("add", () => {
    it("should add entries to the queue", () => {
      const batcher = new Batcher({ batchSize: 100 }, onFlush);
      batcher.add(makeEntry("a"));
      batcher.add(makeEntry("b"));

      expect(batcher.size).toBe(2);
    });

    it("should trigger flush when batch size is reached", () => {
      const batcher = new Batcher({ batchSize: 3 }, onFlush);
      batcher.add(makeEntry("a"));
      batcher.add(makeEntry("b"));
      expect(onFlush).not.toHaveBeenCalled();

      batcher.add(makeEntry("c"));
      expect(onFlush).toHaveBeenCalledTimes(1);
      expect(onFlush).toHaveBeenCalledWith([
        makeEntry("a"),
        makeEntry("b"),
        makeEntry("c"),
      ]);
    });

    it("should drop oldest entry when maxQueueSize is reached", () => {
      const batcher = new Batcher(
        { batchSize: 100, maxQueueSize: 3 },
        onFlush
      );

      batcher.add(makeEntry("a"));
      batcher.add(makeEntry("b"));
      batcher.add(makeEntry("c"));
      expect(batcher.size).toBe(3);

      batcher.add(makeEntry("d"));
      expect(batcher.size).toBe(3);

      // Flush to inspect contents
      void batcher.flush();
      expect(onFlush).toHaveBeenCalledWith([
        makeEntry("b"),
        makeEntry("c"),
        makeEntry("d"),
      ]);
    });
  });

  describe("flush", () => {
    it("should send all queued entries to the callback", async () => {
      const batcher = new Batcher({ batchSize: 100 }, onFlush);
      batcher.add(makeEntry("x"));
      batcher.add(makeEntry("y"));

      await batcher.flush();

      expect(onFlush).toHaveBeenCalledWith([makeEntry("x"), makeEntry("y")]);
      expect(batcher.size).toBe(0);
    });

    it("should do nothing when queue is empty", async () => {
      const batcher = new Batcher({}, onFlush);

      await batcher.flush();

      expect(onFlush).not.toHaveBeenCalled();
    });

    it("should re-add entries on flush failure", async () => {
      const failFlush = vi.fn().mockRejectedValue(new Error("flush failed"));
      const batcher = new Batcher({ batchSize: 100 }, failFlush);

      batcher.add(makeEntry("a"));
      batcher.add(makeEntry("b"));

      await expect(batcher.flush()).rejects.toThrow("flush failed");

      // Entries should be re-added to the queue
      expect(batcher.size).toBe(2);
    });

    it("should respect maxQueueSize when re-adding entries on failure", async () => {
      const failFlush = vi.fn().mockRejectedValue(new Error("fail"));
      const batcher = new Batcher(
        { batchSize: 100, maxQueueSize: 2 },
        failFlush
      );

      batcher.add(makeEntry("a"));
      batcher.add(makeEntry("b"));

      await expect(batcher.flush()).rejects.toThrow("fail");

      // maxQueueSize is 2, so only 2 re-added
      expect(batcher.size).toBe(2);
    });
  });

  describe("flush interval", () => {
    it("should flush automatically at the configured interval", () => {
      const batcher = new Batcher(
        { flushInterval: 2000, batchSize: 100 },
        onFlush
      );
      batcher.add(makeEntry());

      vi.advanceTimersByTime(1999);
      expect(onFlush).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onFlush).toHaveBeenCalledTimes(1);
    });

    it("should flush multiple times at the interval", () => {
      const batcher = new Batcher(
        { flushInterval: 1000, batchSize: 100 },
        onFlush
      );
      batcher.add(makeEntry("first"));

      vi.advanceTimersByTime(1000);
      expect(onFlush).toHaveBeenCalledTimes(1);

      batcher.add(makeEntry("second"));

      vi.advanceTimersByTime(1000);
      expect(onFlush).toHaveBeenCalledTimes(2);
    });

    it("should not start timer when flushInterval is 0", () => {
      const batcher = new Batcher(
        { flushInterval: 0, batchSize: 100 },
        onFlush
      );
      batcher.add(makeEntry());

      vi.advanceTimersByTime(10000);
      expect(onFlush).not.toHaveBeenCalled();
    });
  });

  describe("size", () => {
    it("should return 0 for empty batcher", () => {
      const batcher = new Batcher({ batchSize: 100 }, onFlush);
      expect(batcher.size).toBe(0);
    });

    it("should return current queue length", () => {
      const batcher = new Batcher({ batchSize: 100 }, onFlush);
      batcher.add(makeEntry());
      batcher.add(makeEntry());
      batcher.add(makeEntry());
      expect(batcher.size).toBe(3);
    });
  });

  describe("shutdown", () => {
    it("should stop the timer and flush remaining entries", async () => {
      const batcher = new Batcher(
        { flushInterval: 1000, batchSize: 100 },
        onFlush
      );
      batcher.add(makeEntry("final"));

      await batcher.shutdown();

      expect(onFlush).toHaveBeenCalledWith([makeEntry("final")]);
      expect(batcher.size).toBe(0);

      // Timer should be stopped - no more flushes
      onFlush.mockClear();
      batcher.add(makeEntry("after-shutdown"));
      vi.advanceTimersByTime(5000);
      expect(onFlush).not.toHaveBeenCalled();
    });

    it("should handle shutdown on empty queue", async () => {
      const batcher = new Batcher({}, onFlush);

      await batcher.shutdown();

      expect(onFlush).not.toHaveBeenCalled();
    });
  });
});
