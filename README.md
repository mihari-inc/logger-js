# mihari-js

Open-source log collection and transport library for JavaScript and TypeScript.

## Packages

| Package | Description |
|---------|-------------|
| `@mihari/logger-types` | Shared TypeScript type definitions |
| `@mihari/logger-core` | Core transport, batching, and client logic |
| `@mihari/logger-node` | Node.js client with automatic system metadata |
| `@mihari/logger-browser` | Browser client with sendBeacon support |
| `@mihari/logger-js` | Isomorphic entry point (auto-detects environment) |
| `@mihari/logger-pino` | Pino transport integration |
| `@mihari/logger-winston` | Winston transport integration |
| `@mihari/logger-bunyan` | Bunyan stream integration |
| `@mihari/logger-koa` | Koa request logging middleware |
| `@mihari/logger-tool` | CLI tool for sending logs |

## Quick Start

```bash
npm install @mihari/js
```

```typescript
import { createMihari } from "@mihari/logger-js";

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
