# @mihari/koa

Koa request logging middleware for the mihari log collection library.

## Installation

```bash
npm install @mihari/koa koa
```

## Usage

```typescript
import Koa from "koa";
import { mihariMiddleware } from "@mihari/koa";

const app = new Koa();

app.use(mihariMiddleware({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
}));

app.use(async (ctx) => {
  ctx.body = "Hello World";
});

app.listen(3000);
```

## Logged Fields

| Field | Description |
|-------|-------------|
| method | HTTP method (GET, POST, etc.) |
| url | Request URL path |
| status | Response status code |
| responseTimeMs | Response time in milliseconds |
| userAgent | User-Agent header value |
| contentLength | Response content length |
| ip | Client IP address |

## Log Level Selection

- 5xx responses: error
- 4xx responses: warn
- All other responses: info

## License

MIT
