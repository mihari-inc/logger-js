# @mihari/logger-core

Core transport, batching, and client logic for the mihari log collection library.

## Installation

```bash
npm install @mihari/logger-core
```

## Usage

```typescript
import { MihariClient } from "@mihari/logger-core";

const client = new MihariClient({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
  batchSize: 10,
  flushInterval: 5000,
});

client.info("Hello from core", { module: "auth" });

// Flush manually
await client.flush();

// Shutdown gracefully
await client.shutdown();
```

## Components

- **MihariClient** - Base client with info/warn/error/debug/fatal methods
- **HttpTransport** - HTTP POST with Bearer auth, gzip support, and retry with exponential backoff
- **Batcher** - Configurable batching with flush intervals and queue size limits

## License

MIT
