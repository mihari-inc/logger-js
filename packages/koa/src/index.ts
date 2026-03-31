import { MihariClient } from "@mihari/logger-core";
import { LogLevel, MihariConfig } from "@mihari/logger-types";

/**
 * Minimal Koa context type to avoid requiring koa as a direct dependency.
 */
interface KoaContext {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly ip: string;
  readonly request: {
    readonly length?: number;
    readonly get: (header: string) => string;
  };
  readonly response: {
    readonly length?: number;
  };
}

type KoaNext = () => Promise<void>;
type KoaMiddleware = (ctx: KoaContext, next: KoaNext) => Promise<void>;

/**
 * Creates Koa middleware that logs every HTTP request to mihari.
 *
 * Captured fields:
 * - method: HTTP method (GET, POST, etc.)
 * - url: Request URL
 * - status: Response status code
 * - responseTimeMs: Time to handle the request in milliseconds
 * - userAgent: User-Agent header
 * - contentLength: Response content length
 * - ip: Client IP address
 *
 * Usage:
 * ```typescript
 * import Koa from "koa";
 * import { mihariMiddleware } from "@mihari/logger-koa";
 *
 * const app = new Koa();
 *
 * app.use(mihariMiddleware({
 *   token: "your-token",
 *   endpoint: "https://logs.example.com",
 * }));
 *
 * app.use(async (ctx) => {
 *   ctx.body = "Hello World";
 * });
 *
 * app.listen(3000);
 * ```
 */
export function mihariMiddleware(config: MihariConfig): KoaMiddleware {
  const client = new MihariClient(config);

  return async (ctx: KoaContext, next: KoaNext): Promise<void> => {
    const startTime = Date.now();

    try {
      await next();
    } finally {
      const responseTimeMs = Date.now() - startTime;
      const status = ctx.status;

      const level = status >= 500
        ? LogLevel.Error
        : status >= 400
          ? LogLevel.Warn
          : LogLevel.Info;

      client.log(level, `${ctx.method} ${ctx.url} ${status}`, {
        method: ctx.method,
        url: ctx.url,
        status,
        responseTimeMs,
        userAgent: ctx.request.get("user-agent"),
        contentLength: ctx.response.length,
        ip: ctx.ip,
      });
    }
  };
}

export default mihariMiddleware;
