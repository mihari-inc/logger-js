export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
  Error = "error",
  Fatal = "fatal",
}

export interface LogEntry {
  readonly dt: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly [key: string]: unknown;
}

export interface MihariConfig {
  readonly token: string;
  readonly endpoint: string;
  readonly batchSize?: number;
  readonly flushInterval?: number;
  readonly maxQueueSize?: number;
  readonly compression?: boolean;
  readonly retries?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface TransportOptions {
  readonly token: string;
  readonly endpoint: string;
  readonly compression?: boolean;
  readonly retries?: number;
}

export interface BatchOptions {
  readonly batchSize?: number;
  readonly flushInterval?: number;
  readonly maxQueueSize?: number;
}

export interface TransportResponse {
  readonly status: "accepted";
  readonly count: number;
}

export interface TransportError {
  readonly error: string;
}

export type CompressFn = (data: Buffer | Uint8Array) => Promise<Buffer | Uint8Array>;
