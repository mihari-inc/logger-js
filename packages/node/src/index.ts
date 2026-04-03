import * as os from "os";
import * as zlib from "zlib";
import { promisify } from "util";
import { MihariClient } from "@mihari/logger-core";
import { MihariConfig, CompressFn } from "@mihari/logger-types";

const gzip = promisify(zlib.gzip);

const nodeCompressFn: CompressFn = async (data) => {
  const result = await gzip(Buffer.from(data));
  return new Uint8Array(result);
};

export class NodeMihari extends MihariClient {
  private readonly hostname: string;
  private readonly pid: number;
  private readonly platform: string;
  private readonly nodeVersion: string;
  private exitHandlerRegistered = false;

  constructor(config: MihariConfig) {
    super(config);

    this.hostname = os.hostname();
    this.pid = process.pid;
    this.platform = process.platform;
    this.nodeVersion = process.version;

    if (config.compression !== false) {
      this.setCompressFn(nodeCompressFn);
    }

    this.registerExitHandlers();
  }

  protected override getDefaultMetadata(): Record<string, unknown> {
    return {
      hostname: this.hostname,
      pid: this.pid,
      platform: this.platform,
      nodeVersion: this.nodeVersion,
    };
  }

  private registerExitHandlers(): void {
    if (this.exitHandlerRegistered) {
      return;
    }
    this.exitHandlerRegistered = true;

    const onExit = (): void => {
      // Attempt a synchronous-ish flush. In practice the event loop
      // may not fully drain, but we try our best.
      void this.flush().catch(() => {
        // Swallow errors during exit - nothing we can do
      });
    };

    process.on("beforeExit", () => {
      void this.shutdown();
    });

    process.on("SIGINT", () => {
      onExit();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      onExit();
      process.exit(0);
    });
  }
}

export type { MihariConfig } from "@mihari/logger-types";
