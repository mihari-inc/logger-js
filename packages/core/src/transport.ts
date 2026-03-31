import { LogEntry, TransportOptions, TransportResponse, CompressFn } from "@mihari/types";
import { sleep } from "./utils";

const DEFAULT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class HttpTransport {
  private readonly token: string;
  private readonly endpoint: string;
  private readonly compression: boolean;
  private readonly maxRetries: number;
  private compressFn: CompressFn | null = null;

  constructor(options: TransportOptions) {
    this.token = options.token;
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.compression = options.compression ?? false;
    this.maxRetries = options.retries ?? DEFAULT_RETRIES;
  }

  /**
   * Sets the compression function. This allows node and browser
   * environments to inject their own gzip implementation.
   */
  setCompressFn(fn: CompressFn): void {
    this.compressFn = fn;
  }

  /**
   * Sends an array of log entries to the ingestion endpoint with
   * retry logic using exponential backoff.
   */
  async send(logs: readonly LogEntry[]): Promise<TransportResponse> {
    const payload = JSON.stringify(logs);
    let body: string | Buffer | Uint8Array = payload;
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };

    if (this.compression && this.compressFn) {
      const encoded = typeof TextEncoder !== "undefined"
        ? new TextEncoder().encode(payload)
        : Buffer.from(payload, "utf-8");
      body = await this.compressFn(encoded);
      headers["Content-Encoding"] = "gzip";
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.doFetch(body, headers);

        if (response.status === 202) {
          return response.json as TransportResponse;
        }

        if (response.status === 401) {
          throw new Error("Invalid or missing authentication token");
        }

        if (response.status === 400) {
          throw new Error("No valid logs found");
        }

        throw new Error(`Unexpected response status: ${response.status}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Do not retry auth or validation errors
        if (
          lastError.message === "Invalid or missing authentication token" ||
          lastError.message === "No valid logs found"
        ) {
          throw lastError;
        }

        if (attempt < this.maxRetries - 1) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error("Transport failed after retries");
  }

  private async doFetch(
    body: string | Buffer | Uint8Array,
    headers: Record<string, string>
  ): Promise<{ status: number; json: unknown }> {
    // Use global fetch (available in Node 18+ and all modern browsers)
    const res = await fetch(`${this.endpoint}`, {
      method: "POST",
      headers,
      body,
    });

    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }
}
