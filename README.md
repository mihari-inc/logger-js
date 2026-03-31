# mihari-js

Open-source log collection and transport library for JavaScript and TypeScript.

## Packages

| Package | Description |
|---------|-------------|
| `@mihari/types` | Shared TypeScript type definitions |
| `@mihari/core` | Core transport, batching, and client logic |
| `@mihari/node` | Node.js client with automatic system metadata |
| `@mihari/browser` | Browser client with sendBeacon support |
| `@mihari/js` | Isomorphic entry point (auto-detects environment) |
| `@mihari/pino` | Pino transport integration |
| `@mihari/winston` | Winston transport integration |
| `@mihari/bunyan` | Bunyan stream integration |
| `@mihari/koa` | Koa request logging middleware |
| `@mihari/tool` | CLI tool for sending logs |

## Quick Start

```bash
npm install @mihari/js
```

```typescript
import { createMihari } from "@mihari/js";

const logger = createMihari({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

logger.info("Application started", { version: "1.0.0" });
logger.error("Something went wrong", { code: 500 });
```

## Development

```bash
npm install
npx lerna run build
npx lerna run test
```

## License

MIT
