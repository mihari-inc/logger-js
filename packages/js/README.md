# @mihari/js

Isomorphic mihari client that auto-detects the runtime environment and returns the appropriate client.

## Installation

```bash
npm install @mihari/js
```

## Usage

```typescript
import { createMihari } from "@mihari/js";

const logger = createMihari({
  token: "your-api-token",
  endpoint: "https://logs.example.com",
});

// Works in both Node.js and browser
logger.info("Application started");
logger.error("Something failed", { code: "ERR_TIMEOUT" });

await logger.flush();
```

## Environment Detection

- **Node.js**: Returns `NodeMihari` with hostname, pid, platform metadata
- **Browser**: Returns `BrowserMihari` with userAgent, url, referrer metadata

## License

MIT
