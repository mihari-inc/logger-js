import { Writable } from "stream";
import { MihariClient } from "@mihari/core";
import { LogLevel, MihariConfig } from "@mihari/types";

/**
 * Maps bunyan numeric levels to mihari LogLevel values.
 * Bunyan levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
 */
function mapBunyanLevel(bunyanLevel: number): LogLevel {
  if (bunyanLevel <= 20) return LogLevel.Debug;
  if (bunyanLevel <= 30) return LogLevel.Info;
  if (bunyanLevel <= 40) return LogLevel.Warn;
  if (bunyanLevel <= 50) return LogLevel.Error;
  return LogLevel.Fatal;
}

interface BunyanLogRecord {
  level: number;
  msg: string;
  time: string;
  name: string;
  hostname: string;
  pid: number;
  v: number;
  [key: string]: unknown;
}

/**
 * Bunyan writable stream that forwards logs to mihari.
 *
 * Usage:
 * ```typescript
 * import bunyan from "bunyan";
 * import { MihariBunyanStream } from "@mihari/bunyan";
 *
 * const mihariStream = new MihariBunyanStream({
 *   token: "your-token",
 *   endpoint: "https://logs.example.com",
 * });
 *
 * const logger = bunyan.createLogger({
 *   name: "my-app",
 *   streams: [
 *     { type: "raw", stream: mihariStream },
 *   ],
 * });
 *
 * logger.info("Hello from bunyan");
 * ```
 */
export class MihariBunyanStream extends Writable {
  private readonly client: MihariClient;

  constructor(config: MihariConfig) {
    super({ objectMode: true });
    this.client = new MihariClient(config);
  }

  override _write(
    chunk: BunyanLogRecord,
    _encoding: string,
    callback: (error?: Error | null) => void
  ): void {
    try {
      const { level, msg, time, name, hostname, pid, v, ...rest } = chunk;
      const mihariLevel = mapBunyanLevel(level);

      this.client.log(mihariLevel, msg, {
        bunyanName: name,
        hostname,
        pid,
        ...rest,
      });

      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  override _final(callback: (error?: Error | null) => void): void {
    this.client
      .shutdown()
      .then(() => callback())
      .catch((err) =>
        callback(err instanceof Error ? err : new Error(String(err)))
      );
  }
}

export default MihariBunyanStream;
