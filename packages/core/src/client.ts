import { LogLevel, LogEntry, MihariConfig, CompressFn } from "@mihari/types";
import { HttpTransport } from "./transport";
import { Batcher } from "./batcher";
import { isoTimestamp } from "./utils";

export class MihariClient {
  protected readonly config: MihariConfig;
  protected readonly transport: HttpTransport;
  protected readonly batcher: Batcher;

  constructor(config: MihariConfig) {
    this.config = config;

    this.transport = new HttpTransport({
      token: config.token,
      endpoint: config.endpoint,
      compression: config.compression,
      retries: config.retries,
    });

    this.batcher = new Batcher(
      {
        batchSize: config.batchSize,
        flushInterval: config.flushInterval,
        maxQueueSize: config.maxQueueSize,
      },
      async (logs) => {
        await this.transport.send(logs);
      }
    );
  }

  /**
   * Sets the compression function used by the transport layer.
   */
  setCompressFn(fn: CompressFn): void {
    this.transport.setCompressFn(fn);
  }

  /**
   * Logs a debug-level message.
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.Debug, message, metadata);
  }

  /**
   * Logs an info-level message.
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.Info, message, metadata);
  }

  /**
   * Logs a warn-level message.
   */
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.Warn, message, metadata);
  }

  /**
   * Logs an error-level message.
   */
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.Error, message, metadata);
  }

  /**
   * Logs a fatal-level message.
   */
  fatal(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.Fatal, message, metadata);
  }

  /**
   * Flushes all pending log entries.
   */
  async flush(): Promise<void> {
    await this.batcher.flush();
  }

  /**
   * Shuts down the client, flushing remaining entries.
   */
  async shutdown(): Promise<void> {
    await this.batcher.shutdown();
  }

  /**
   * Creates a log entry and adds it to the batch queue.
   * Subclasses can override getDefaultMetadata() to inject
   * environment-specific fields.
   */
  public log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      dt: isoTimestamp(),
      level,
      message,
      ...this.getDefaultMetadata(),
      ...(this.config.metadata ?? {}),
      ...(metadata ?? {}),
    };

    this.batcher.add(entry);
  }

  /**
   * Returns default metadata to include with every log entry.
   * Override in subclasses to add environment-specific fields.
   */
  protected getDefaultMetadata(): Record<string, unknown> {
    return {};
  }
}
