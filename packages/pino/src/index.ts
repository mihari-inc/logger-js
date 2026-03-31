import { Writable } from "stream";
import { MihariClient } from "@mihari/core";
import { LogLevel, MihariConfig } from "@mihari/types";

/**
 * Maps pino numeric levels to mihari LogLevel values.
 * Pino levels: 10=trace, 20=debug, 30=info, 40=warn, 50=error, 60=fatal
 */
function mapPinoLevel(pinoLevel: number): LogLevel {
  if (pinoLevel <= 20) return LogLevel.Debug;
  if (pinoLevel <= 30) return LogLevel.Info;
  if (pinoLevel <= 40) return LogLevel.Warn;
  if (pinoLevel <= 50) return LogLevel.Error;
  return LogLevel.Fatal;
}

interface PinoLogObject {
  level: number;
  time: number;
  msg?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Creates a pino transport writable stream that forwards logs to mihari.
 *
 * Usage:
 * ```typescript
 * import pino from "pino";
 * import { createMihariTransport } from "@mihari/pino";
 *
 * const transport = createMihariTransport({
 *   token: "your-token",
 *   endpoint: "https://logs.example.com",
 * });
 *
 * const logger = pino(transport);
 * ```
 *
 * Or with pino's transport option:
 * ```typescript
 * const logger = pino({
 *   transport: { target: "@mihari/pino" }
 * });
 * ```
 */
export function createMihariTransport(config: MihariConfig): Writable {
  const client = new MihariClient(config);

  const stream = new Writable({
    objectMode: true,
    write(chunk: PinoLogObject | string, _encoding, callback) {
      try {
        const obj: PinoLogObject =
          typeof chunk === "string" ? JSON.parse(chunk) : chunk;

        const { level, time, msg, message, ...rest } = obj;
        const mihariLevel = mapPinoLevel(level);
        const logMessage = msg ?? message ?? "";

        const { pid, hostname, ...metadata } = rest;

        client.log(mihariLevel, String(logMessage), {
          ...(pid !== undefined ? { pid } : {}),
          ...(hostname !== undefined ? { hostname } : {}),
          ...metadata,
        });

        callback();
      } catch (err) {
        callback(err instanceof Error ? err : new Error(String(err)));
      }
    },
    final(callback) {
      client
        .shutdown()
        .then(() => callback())
        .catch((err) =>
          callback(err instanceof Error ? err : new Error(String(err)))
        );
    },
  });

  return stream;
}

/**
 * Default export for use as a pino transport target.
 * The module default export must be a function that returns a writable stream.
 */
export default function (config: MihariConfig): Writable {
  return createMihariTransport(config);
}
