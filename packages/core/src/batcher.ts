import { LogEntry, BatchOptions } from "@mihari/logger-types";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_QUEUE_SIZE = 1000;

export type FlushCallback = (logs: readonly LogEntry[]) => Promise<void>;

export class Batcher {
  private queue: LogEntry[] = [];
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueueSize: number;
  private readonly onFlush: FlushCallback;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(options: BatchOptions, onFlush: FlushCallback) {
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.flushIntervalMs = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.onFlush = onFlush;
    this.startTimer();
  }

  /**
   * Adds a log entry to the queue. Triggers a flush if the
   * batch size threshold is reached.
   */
  add(entry: LogEntry): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Drop the oldest entry when the queue is full
      this.queue.shift();
    }

    this.queue = [...this.queue, entry];

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    }
  }

  /**
   * Flushes all queued log entries by calling the onFlush callback.
   * Returns a promise that resolves when the flush is complete.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = [...this.queue];
    this.queue = [];

    try {
      await this.onFlush(batch);
    } catch (err) {
      // Re-add entries to the front of the queue on failure,
      // respecting the max queue size
      const combined = [...batch, ...this.queue];
      this.queue = combined.slice(0, this.maxQueueSize);
      // Rethrow so callers know the flush failed
      throw err;
    }
  }

  /**
   * Returns the number of entries currently in the queue.
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Stops the periodic flush timer and flushes remaining entries.
   */
  async shutdown(): Promise<void> {
    this.stopTimer();
    await this.flush();
  }

  private startTimer(): void {
    if (this.flushIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);

      // Allow the Node.js process to exit even if the timer is active
      if (typeof this.timer === "object" && "unref" in this.timer) {
        this.timer.unref();
      }
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
