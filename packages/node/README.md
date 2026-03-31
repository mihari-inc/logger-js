# @mihari/logger-node

Node.js client for the mihari log collection library with automatic system metadata capture.

## Installation

```bash
npm install @mihari/logger-node
```

## Usage

```typescript
import { NodeMihari } from "@mihari/logger-node";

const logger = new NodeMihari({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

logger.info("Server started", { port: 3000 });
```

## Features

- Automatic capture of hostname, pid, platform, and Node.js version
- Native zlib gzip compression
- Process exit handlers for graceful flush on SIGINT/SIGTERM

## License

MIT
