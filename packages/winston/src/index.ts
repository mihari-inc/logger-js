import Transport from "winston-transport";
import { MihariClient } from "@mihari/logger-core";
import { LogLevel, MihariConfig } from "@mihari/logger-types";

/**
 * Maps winston level strings to mihari LogLevel values.
 */
function mapWinstonLevel(level: string): LogLevel {
  switch (level) {
    case "silly":
    case "debug":
      return LogLevel.Debug;
    case "verbose":
    case "info":
      return LogLevel.Info;
    case "warn":
    case "warning":
      return LogLevel.Warn;
    case "error":
      return LogLevel.Error;
    case "crit":
    case "critical":
    case "emerg":
    case "alert":
      return LogLevel.Fatal;
    default:
      return LogLevel.Info;
  }
}

interface WinstonLogInfo {
  level: string;
  message: string;
  [key: string]: unknown;
}

export interface MihariWinstonOptions extends Transport.TransportStreamOptions {
  readonly mihariConfig: MihariConfig;
}

/**
 * Winston transport that forwards logs to mihari.
 *
 * Usage:
 * ```typescript
 * import winston from "winston";
 * import { MihariWinstonTransport } from "@mihari/logger-winston";
 *
 * const logger = winston.createLogger({
 *   transports: [
 *     new MihariWinstonTransport({
 *       mihariConfig: {
 *         token: "your-token",
 *         endpoint: "https://logs.example.com",
 *       },
 *     }),
 *   ],
 * });
 *
 * logger.info("Hello from winston");
 * ```
 */
export class MihariWinstonTransport extends Transport {
  private readonly client: MihariClient;

  constructor(options: MihariWinstonOptions) {
    super(options);
    this.client = new MihariClient(options.mihariConfig);
  }

  log(info: WinstonLogInfo, callback: () => void): void {
    setImmediate(() => {
      this.emit("logged", info);
    });

    const { level, message, ...metadata } = info;
    const mihariLevel = mapWinstonLevel(level);

    // Remove winston internal Symbol properties by extracting
    // only string-keyed properties
    const cleanMeta: Record<string, unknown> = {};
    for (const key of Object.keys(metadata)) {
      if (key !== "splat") {
        cleanMeta[key] = metadata[key];
      }
    }

    this.client.log(mihariLevel, message, cleanMeta);
    callback();
  }

  async close(): Promise<void> {
    await this.client.shutdown();
  }
}

export default MihariWinstonTransport;
